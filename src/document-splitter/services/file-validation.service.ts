import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileValidationResult, SecurityFlag, ProcessingHint } from '../types/file-validation.types';
import { FILE_VALIDATION_CONFIG } from '../config/validation.config';

@Injectable()
export class FileValidationService {
  private readonly logger = new Logger(FileValidationService.name);

  constructor(private readonly configService: ConfigService) {}

  async validateFile(file: Express.Multer.File): Promise<FileValidationResult> {
    const startTime = Date.now();
    
    const validationResult: FileValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      fileInfo: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        extension: this.getFileExtension(file.originalname),
        detectedType: 'UNKNOWN'
      },
      securityFlags: [],
      processingHints: []
    };

    try {
      // Sequential validation pipeline
      await this.validateBasicFile(file, validationResult);
      if (validationResult.errors.length === 0) {
        await this.validateMimeType(file, validationResult);
      }
      if (validationResult.errors.length === 0) {
        await this.validateFileExtension(file, validationResult);
      }
      if (validationResult.errors.length === 0) {
        await this.scanForMaliciousContent(file, validationResult);
      }
      // Validate size before magic numbers so "oversized" errors are prioritized
      if (validationResult.errors.length === 0) {
        await this.validateFileSize(file, validationResult);
      }
      if (validationResult.errors.length === 0) {
        await this.validateMagicNumbers(file, validationResult);
      }
      if (validationResult.errors.length === 0) {
        await this.validateFileContent(file, validationResult);
      }

      // Final validation
      validationResult.isValid = validationResult.errors.length === 0;

      const processingTime = Date.now() - startTime;
      this.logger.log(`File validation completed for ${file.originalname}: ${validationResult.isValid ? 'VALID' : 'INVALID'} (${processingTime}ms)`);
      
      return validationResult;

    } catch (error) {
      this.logger.error(`File validation error for ${file.originalname}:`, error);
      validationResult.errors.push(`Validation error: ${error.message}`);
      validationResult.isValid = false;
      return validationResult;
    }
  }

  private async validateBasicFile(file: Express.Multer.File, result: FileValidationResult): Promise<void> {
    // Check file presence
    if (!file || !file.buffer || file.buffer.length === 0) {
      result.errors.push('File is empty or missing');
      return;
    }

    // Check filename
    if (!file.originalname || file.originalname.trim().length === 0) {
      result.errors.push('File name is required');
      return;
    }

    // Validate filename length
    if (file.originalname.length > FILE_VALIDATION_CONFIG.FILENAME_RULES.maxLength) {
      result.errors.push(`Filename exceeds maximum length of ${FILE_VALIDATION_CONFIG.FILENAME_RULES.maxLength} characters`);
      return;
    }

    // Check for suspicious patterns FIRST
    for (const pattern of FILE_VALIDATION_CONFIG.FILENAME_RULES.suspiciousPatterns) {
      if (pattern.test(file.originalname)) {
        this.addSecurityFlag(result, 'SUSPICIOUS_FILENAME', 'HIGH', 'Filename contains suspicious pattern', true);
        result.errors.push('Filename contains suspicious patterns');
        return;
      }
    }

    // Check filename characters
    if (!FILE_VALIDATION_CONFIG.FILENAME_RULES.allowedCharacters.test(file.originalname)) {
      this.addSecurityFlag(result, 'SUSPICIOUS_FILENAME', 'HIGH', 'Filename contains invalid or suspicious characters', true);
      result.errors.push('Filename contains invalid characters');
      return;
    }

    // Check for reserved names
    const baseName = file.originalname.split('.')[0].toUpperCase();
    if (FILE_VALIDATION_CONFIG.FILENAME_RULES.reservedNames.includes(baseName)) {
      this.addSecurityFlag(result, 'SUSPICIOUS_FILENAME', 'HIGH', 'Filename uses reserved system name', true);
      result.errors.push('Filename uses reserved system name');
      return;
    }

  }

  private async validateMimeType(file: Express.Multer.File, result: FileValidationResult): Promise<void> {
    const allowedConfig = FILE_VALIDATION_CONFIG.ALLOWED_MIME_TYPES[file.mimetype];
    
    if (!allowedConfig) {
      result.errors.push(`Unsupported file type: ${file.mimetype}. Allowed types: ${Object.keys(FILE_VALIDATION_CONFIG.ALLOWED_MIME_TYPES).join(', ')}`);
      return;
    }

    // Store processing complexity hint
    this.addProcessingHint(result, 'COMPLEXITY', allowedConfig.processingComplexity, `Expected processing complexity: ${allowedConfig.processingComplexity}`);
    result.fileInfo.detectedType = file.mimetype;
  }

  private async validateFileExtension(file: Express.Multer.File, result: FileValidationResult): Promise<void> {
    const extension = this.getFileExtension(file.originalname).toLowerCase();
    const allowedConfig = FILE_VALIDATION_CONFIG.ALLOWED_MIME_TYPES[file.mimetype];
    
    if (allowedConfig && !allowedConfig.extensions.includes(extension)) {
      this.addSecurityFlag(result, 'INVALID_FORMAT', 'HIGH', 'File extension does not match MIME type', true);
      result.errors.push(`File extension ${extension} does not match MIME type ${file.mimetype}`);
    }
  }

  private async validateMagicNumbers(file: Express.Multer.File, result: FileValidationResult): Promise<void> {
    const allowedConfig = FILE_VALIDATION_CONFIG.ALLOWED_MIME_TYPES[file.mimetype];
    if (!allowedConfig?.magicNumbers) return;

    const expectedMagic = allowedConfig.magicNumbers;
    const actualMagic = Array.from(file.buffer.subarray(0, expectedMagic.length));
    
    // Special handling for WebP (RIFF container)
    if (file.mimetype === 'image/webp') {
      const webpSignature = Array.from(file.buffer.subarray(8, 12)); // "WEBP" at offset 8
      if (!this.arraysEqual(webpSignature, [0x57, 0x45, 0x42, 0x50])) { // "WEBP"
        this.addSecurityFlag(result, 'INVALID_FORMAT', 'HIGH', 'File header does not match WebP format', true);
        result.errors.push('File header does not match WebP format');
      }
      return;
    }

    if (!this.arraysEqual(actualMagic, expectedMagic)) {
      this.addSecurityFlag(result, 'INVALID_FORMAT', 'HIGH', 'File header does not match expected format (possible file spoofing)', true);
      result.errors.push(`File header does not match expected format for ${file.mimetype}`);
    }
  }

  private async validateFileSize(file: Express.Multer.File, result: FileValidationResult): Promise<void> {
    const allowedConfig = FILE_VALIDATION_CONFIG.ALLOWED_MIME_TYPES[file.mimetype];
    
    // Check maximum size
    const maxSize = allowedConfig?.maxSize || FILE_VALIDATION_CONFIG.LIMITS.maxFileSize;
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      const actualSizeMB = Math.round(file.size / (1024 * 1024));
      
      this.addSecurityFlag(result, 'OVERSIZED', 'MEDIUM', `File size ${actualSizeMB}MB exceeds limit of ${maxSizeMB}MB`, true);
      result.errors.push(`File size ${actualSizeMB}MB exceeds maximum allowed size of ${maxSizeMB}MB`);
    }

    // Check minimum size
    if (file.size < FILE_VALIDATION_CONFIG.LIMITS.minFileSize) {
      result.errors.push(`File size is too small, minimum ${FILE_VALIDATION_CONFIG.LIMITS.minFileSize} bytes required`);
    }
  }

  private async validateFileContent(file: Express.Multer.File, result: FileValidationResult): Promise<void> {
    const allowedConfig = FILE_VALIDATION_CONFIG.ALLOWED_MIME_TYPES[file.mimetype];
    if (!allowedConfig?.maxPages) return;

    try {
      let pageCount = 0;

      if (file.mimetype === 'application/pdf') {
        pageCount = await this.countPdfPages(file.buffer);
      } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        pageCount = await this.countDocxPages(file.buffer);
      }

      if (pageCount > allowedConfig.maxPages) {
        result.errors.push(`Document has ${pageCount} pages, maximum allowed is ${allowedConfig.maxPages} pages`);
      }

      result.fileInfo.pageCount = pageCount;
      this.addProcessingHint(result, 'PAGE_COUNT', pageCount, `Document contains ${pageCount} pages`);

    } catch (error) {
      result.warnings.push(`Could not validate page count: ${error.message}`);
    }
  }

  private async scanForMaliciousContent(file: Express.Multer.File, result: FileValidationResult): Promise<void> {
    const content = file.buffer.toString('latin1');
    
    // Check for malicious patterns
    for (const patternConfig of FILE_VALIDATION_CONFIG.MALICIOUS_PATTERNS) {
      if (patternConfig.pattern.test(content)) {
        this.addSecurityFlag(result, 'MALICIOUS_PATTERN', patternConfig.severity as any, patternConfig.description, true);
        result.errors.push(`File contains potentially malicious content: ${patternConfig.description}`);
        break; // Stop on first malicious pattern found
      }
    }

    // Check file size vs content ratio (detect compressed/embedded files)
    if (file.size > 1024 * 1024) { // Only for files > 1MB
      const readableContentRatio = content.length / file.size;
      if (readableContentRatio < 0.1) { // Less than 10% readable content
        result.warnings.push('File may contain compressed or binary data');
        this.addProcessingHint(result, 'QUALITY', 'LOW_TEXT_RATIO', 'File has low readable content ratio - may be heavily compressed or contain binary data');
      }
    }
  }

  // Helper methods
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
  }

  private arraysEqual(arr1: number[], arr2: number[]): boolean {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, index) => val === arr2[index]);
  }

  private async countPdfPages(buffer: Buffer): Promise<number> {
    // Simple PDF page counting using regex
    const pdfText = buffer.toString('latin1');
    const pageMatches = pdfText.match(/\/Type\s*\/Page[^s]/g);
    return pageMatches ? pageMatches.length : 1;
  }

  private async countDocxPages(buffer: Buffer): Promise<number> {
    // Basic DOCX page estimation - in production, use proper ZIP parsing library
    try {
      const docxText = buffer.toString('latin1');
      const pageBreaks = (docxText.match(/w:br[^>]*w:type="page"/g) || []).length;
      return Math.max(1, pageBreaks + 1); // At least 1 page
    } catch (error) {
      throw new Error(`Failed to parse DOCX structure: ${error.message}`);
    }
  }

  private addSecurityFlag(result: FileValidationResult, type: SecurityFlag['type'], severity: SecurityFlag['severity'], description: string, blocked: boolean): void {
    result.securityFlags.push({
      type,
      severity,
      description,
      blocked
    });
  }

  private addProcessingHint(result: FileValidationResult, type: ProcessingHint['type'], value: any, description: string): void {
    result.processingHints.push({
      type,
      value,
      description
    });
  }
}
