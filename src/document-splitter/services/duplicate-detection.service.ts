import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { FileHash } from '../../document/entities/file-hash.entity';
import { DocumentReference, ReferenceType, DetectionMethod } from '../../document/entities/document-reference.entity';
import { ExpenseDocument } from '../../document/entities/expense-document.entity';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType: 'CONTENT_IDENTICAL' | 'METADATA_SIMILAR' | null;
  existingDocument?: ExpenseDocument;
  existingFileHash?: FileHash;
  recommendation: 'REFERENCE_EXISTING' | 'PROCEED';
  message?: string;
  confidence: number;
  contentHash: string;
}

export interface DuplicateCheckRequest {
  fileBuffer: Buffer;
  filename: string;
  mimeType: string;
  userId?: string;
}

export type DuplicateHandlingChoice = 
  | 'REFERENCE_EXISTING'   // Use existing processed results
  | 'FORCE_REPROCESS';     // Process anyway as new document

export interface DuplicateHandlingResult {
  success: boolean;
  message: string;
  referenceId?: number;
  shouldProceedWithProcessing: boolean;
}

export interface StoreFileHashParams {
  hash: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  documentId: string;
}

export interface ExistingResults {
  totalReceipts: number;
  receipts: Array<{
    receiptId: string;
    receiptNumber?: number;
    pages: number[];
    confidence: number;
    fileName: string;
  }>;
}

@Injectable()
export class DuplicateDetectionService {
  private readonly logger = new Logger(DuplicateDetectionService.name);
  private readonly METADATA_SIMILARITY_THRESHOLD = 0.8;

  constructor(
    @InjectRepository(FileHash)
    private readonly fileHashRepository: Repository<FileHash>,
    
    @InjectRepository(DocumentReference)
    private readonly documentReferenceRepository: Repository<DocumentReference>,
    
    @InjectRepository(ExpenseDocument)
    private readonly expenseDocumentRepository: Repository<ExpenseDocument>,
  ) {}

  /**
   * Main duplicate detection method
   */
  async checkForDuplicates(request: DuplicateCheckRequest): Promise<DuplicateCheckResult> {
    const { fileBuffer, filename, mimeType, userId } = request;
    
    try {
      // Step 1: Generate content hash
      const contentHash = await this.generateFileHash(fileBuffer);
      
      // Step 2: Check for exact content match
      const existingHash = await this.fileHashRepository.findOne({
        where: { hash: contentHash },
        relations: ['document']
      });
      
      if (existingHash) {
        const result: DuplicateCheckResult = {
          isDuplicate: true,
          duplicateType: 'CONTENT_IDENTICAL',
          existingDocument: existingHash.document,
          existingFileHash: existingHash,
          recommendation: 'REFERENCE_EXISTING',
          message: `File content matches existing document: ${existingHash.originalFilename}`,
          confidence: 1.0,
          contentHash
        };
        
        // Update upload statistics
        await this.updateUploadStatistics(existingHash);
        
        return result;
      }
      
      // Step 3: Check for metadata-based duplicates
      const metadataDuplicate = await this.checkMetadataDuplicates({
        filename,
        fileSize: fileBuffer.length,
        mimeType,
        userId
      });
      
      if (metadataDuplicate) {
        const result: DuplicateCheckResult = {
          isDuplicate: true,
          duplicateType: 'METADATA_SIMILAR',
          existingDocument: metadataDuplicate.document,
          existingFileHash: metadataDuplicate,
          recommendation: 'REFERENCE_EXISTING',
          message: `Similar file detected: ${metadataDuplicate.originalFilename}`,
          confidence: this.METADATA_SIMILARITY_THRESHOLD,
          contentHash
        };
        
        return result;
      }
      
      // Step 4: No duplicates found
      const result: DuplicateCheckResult = {
        isDuplicate: false,
        duplicateType: null,
        recommendation: 'PROCEED',
        confidence: 0,
        contentHash
      };
      
      return result;
      
    } catch (error) {
      this.logger.error('Duplicate detection failed:', error);
      
      // Return safe fallback - proceed with processing
      return {
        isDuplicate: false,
        duplicateType: null,
        recommendation: 'PROCEED',
        confidence: 0,
        contentHash: await this.generateFileHash(fileBuffer)
      };
    }
  }

  /**
   * Generate SHA-256 hash for file content
   */
  async generateFileHash(fileBuffer: Buffer): Promise<string> {
    return createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Check for metadata-based duplicates
   */
  private async checkMetadataDuplicates(criteria: {
    filename: string;
    fileSize: number;
    mimeType: string;
    userId?: string;
  }): Promise<FileHash | null> {
    const { filename, fileSize, mimeType, userId } = criteria;
    
    const queryBuilder = this.fileHashRepository
      .createQueryBuilder('fh')
      .leftJoinAndSelect('fh.document', 'doc')
      .where('fh.file_size = :fileSize', { fileSize })
      .andWhere('fh.mime_type = :mimeType', { mimeType });
    
    // Check for exact filename match
    queryBuilder.andWhere('fh.original_filename = :filename', { filename });
    
    // Optionally filter by user (same user uploading same file)
    if (userId) {
      queryBuilder.andWhere('doc.uploaded_by = :userId', { userId });
    }
    
    // Check for recent uploads (last 24 hours)
    const timeWindow = new Date();
    timeWindow.setHours(timeWindow.getHours() - 24);
    queryBuilder.andWhere('fh.first_uploaded_at >= :timeWindow', { timeWindow });
    
    // Limit results for performance
    queryBuilder.limit(1);
    
    return await queryBuilder.getOne();
  }

  /**
   * Handle user's duplicate file choice
   */
  async handleDuplicateFile(
    duplicateResult: DuplicateCheckResult,
    userChoice: DuplicateHandlingChoice,
    sourceDocumentId: string,
    userId?: string
  ): Promise<DuplicateHandlingResult> {
    
    if (!duplicateResult.isDuplicate || !duplicateResult.existingDocument) {
      return {
        success: false,
        message: 'No duplicate detected, cannot create reference',
        shouldProceedWithProcessing: true
      };
    }
    
    try {
      switch (userChoice) {
        case 'REFERENCE_EXISTING':
          return await this.createDocumentReference({
            sourceDocumentId,
            targetDocumentId: duplicateResult.existingDocument.id,
            referenceType: duplicateResult.duplicateType === 'CONTENT_IDENTICAL' 
              ? ReferenceType.CONTENT_DUPLICATE 
              : ReferenceType.USER_REFERENCE,
            confidence: duplicateResult.confidence,
            detectionMethod: duplicateResult.duplicateType === 'CONTENT_IDENTICAL' 
              ? DetectionMethod.SHA256_HASH 
              : DetectionMethod.METADATA_MATCH,
            createdBy: userId
          });
          
        case 'FORCE_REPROCESS':
          this.logger.log(`User chose to force reprocess document ${sourceDocumentId}`);
          return {
            success: true,
            message: 'Document will be processed as new file',
            shouldProceedWithProcessing: true
          };
          
        default:
          throw new Error(`Unsupported duplicate handling choice: ${userChoice}`);
      }
    } catch (error) {
      this.logger.error('Failed to handle duplicate file:', error);
      return {
        success: false,
        message: `Failed to handle duplicate: ${error.message}`,
        shouldProceedWithProcessing: true
      };
    }
  }

  /**
   * Create a document reference linking duplicate to existing document
   */
  private async createDocumentReference(params: {
    sourceDocumentId: string;
    targetDocumentId: string;
    referenceType: ReferenceType;
    confidence: number;
    detectionMethod: DetectionMethod;
    createdBy?: string;
  }): Promise<DuplicateHandlingResult> {
    
    // Check if reference already exists
    const existingReference = await this.documentReferenceRepository.findOne({
      where: {
        sourceDocumentId: params.sourceDocumentId,
        targetDocumentId: params.targetDocumentId
      }
    });
    
    if (existingReference) {
      return {
        success: true,
        message: 'Reference already exists',
        referenceId: existingReference.id,
        shouldProceedWithProcessing: false
      };
    }
    
    // Create new reference
    const reference = this.documentReferenceRepository.create(params);
    const savedReference = await this.documentReferenceRepository.save(reference);
    
    this.logger.log(`Created document reference: ${params.sourceDocumentId} -> ${params.targetDocumentId}`);
    
    return {
      success: true,
      message: 'Document reference created successfully',
      referenceId: savedReference.id,
      shouldProceedWithProcessing: false // Skip processing, use existing results
    };
  }

  /**
   * Store file hash after successful processing
   */
  async storeFileHash(params: StoreFileHashParams): Promise<FileHash> {
    
    // Check if hash already exists (edge case handling)
    const existingHash = await this.fileHashRepository.findOne({
      where: { hash: params.hash }
    });
    
    if (existingHash) {
      // Update existing hash record
      existingHash.uploadCount += 1;
      existingHash.lastUploadedAt = new Date();
      return await this.fileHashRepository.save(existingHash);
    }
    
    // Create new hash record
    const fileHash = this.fileHashRepository.create({
      ...params,
      uploadCount: 1,
      firstUploadedAt: new Date(),
      lastUploadedAt: new Date()
    });
    
    return await this.fileHashRepository.save(fileHash);
  }

  /**
   * Get existing results for referenced document
   */
  async getExistingResults(documentId: string): Promise<ExistingResults | null> {
    
    const document = await this.expenseDocumentRepository.findOne({
      where: { id: documentId },
      relations: ['receipts']
    });
    
    if (!document || !document.receipts) {
      return null;
    }
    
    return {
      totalReceipts: document.receipts.length,
      receipts: document.receipts.map(receipt => ({
        receiptId: receipt.id,
        receiptNumber: receipt.metadata?.receiptNumber,
        pages: receipt.metadata?.pageNumbers || [],
        confidence: receipt.metadata?.splitConfidence || 0,
        fileName: receipt.fileName
      }))
    };
  }

  /**
   * Update upload statistics for existing hash
   */
  private async updateUploadStatistics(fileHash: FileHash): Promise<void> {
    fileHash.uploadCount += 1;
    fileHash.lastUploadedAt = new Date();
    await this.fileHashRepository.save(fileHash);
  }

  /**
   * Get duplicate statistics for monitoring (basic implementation)
   */
  async getDuplicateStatistics(timeframe: 'day' | 'week' | 'month' = 'day'): Promise<{
    totalDuplicatesDetected: number;
    contentDuplicates: number;
    metadataDuplicates: number;
    referencesCreated: number;
  }> {
    
    let fromDate: Date;
    const now = new Date();
    
    switch (timeframe) {
      case 'day':
        fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    // Get reference statistics
    const references = await this.documentReferenceRepository
      .createQueryBuilder('ref')
      .where('ref.created_at >= :fromDate', { fromDate })
      .getMany();
    
    const contentDuplicates = references.filter(r => r.referenceType === ReferenceType.CONTENT_DUPLICATE).length;
    const metadataDuplicates = references.filter(r => r.referenceType === ReferenceType.METADATA_SIMILAR).length;
    
    return {
      totalDuplicatesDetected: references.length,
      contentDuplicates,
      metadataDuplicates,
      referencesCreated: references.length
    };
  }
}
