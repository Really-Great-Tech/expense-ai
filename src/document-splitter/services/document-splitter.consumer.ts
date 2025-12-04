import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { ClientProxy } from '@nestjs/microservices';
import { DocumentEventPattern, DocumentUploadedEvent, DocumentSplitCompletedEvent, DocumentSplitFailedEvent } from '@/shared/events/document.events';
import { ReceiptEventPattern, ReceiptExtractedEvent } from '@/shared/events/receipt.events';
import { DocumentSplitterService } from '../document-splitter.service';
import { DocumentPersistenceService } from './document-persistence.service';
import { StorageResolverService } from '@/storage/services/storage-resolver.service';
import * as fs from 'fs';

@Injectable()
export class DocumentSplitterConsumer {
  private readonly logger = new Logger(DocumentSplitterConsumer.name);

  constructor(
    @Inject('RABBITMQ_CLIENT') private rabbitClient: ClientProxy,
    private readonly documentSplitterService: DocumentSplitterService,
    private readonly persistenceService: DocumentPersistenceService,
    private readonly storageResolver: StorageResolverService,
  ) {}

  @EventPattern(DocumentEventPattern.UPLOADED)
  async handleDocumentUploaded(
    @Payload() data: DocumentUploadedEvent,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    
    this.logger.log(`Received ${DocumentEventPattern.UPLOADED} event for document ${data.documentId}`);
    
    try {
      // Get the file from storage
      const { path: filePath, isTemp } = await this.storageResolver.getPhysicalPath(data.storageKey);
      
      // Read file buffer
      const fileBuffer = fs.readFileSync(filePath);
      
      // Create a mock file object for the splitter service
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: data.fileName,
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: fileBuffer,
        size: fileBuffer.length,
        destination: '',
        filename: data.fileName,
        path: filePath,
        stream: null as any,
      };

      // Create or get the document
      const expenseDocument = await this.persistenceService.createOrGetExpenseDocument(file, {
        userId: data.userId,
        country: data.country,
        icp: data.icp,
        documentReader: data.documentReader,
      });

      // Split the document
      const splitResult = await this.documentSplitterService.analyzeAndSplitDocument(file, {
        userId: data.userId,
        country: data.country,
        icp: data.icp,
        documentReader: data.documentReader,
      });

      // Publish split completed event
      const completedEvent: DocumentSplitCompletedEvent = {
        documentId: expenseDocument.id,
        receiptIds: splitResult.data?.receiptIds || [],
        splitAt: new Date(),
      };
      
      this.rabbitClient.emit(DocumentEventPattern.SPLIT_COMPLETED, completedEvent);
      this.logger.log(`Published ${DocumentEventPattern.SPLIT_COMPLETED} for document ${expenseDocument.id}`);

      // Clean up temp file if needed
      if (isTemp && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          this.logger.warn(`Failed to cleanup temp file ${filePath}:`, error);
        }
      }

      // Acknowledge message
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(`Failed to process document.uploaded event for ${data.documentId}:`, error);
      
      // Publish failure event
      const failedEvent: DocumentSplitFailedEvent = {
        documentId: data.documentId,
        error: error instanceof Error ? error.message : String(error),
        failedAt: new Date(),
      };
      
      this.rabbitClient.emit(DocumentEventPattern.SPLIT_FAILED, failedEvent);
      
      // Reject message (will go to DLQ if configured)
      channel.nack(originalMsg, false, false);
    }
  }
}

