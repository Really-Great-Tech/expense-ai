export enum DocumentEventPattern {
  UPLOADED = 'document.uploaded',
  SPLIT_REQUESTED = 'document.split.requested',
  SPLIT_COMPLETED = 'document.split.completed',
  SPLIT_FAILED = 'document.split.failed',
  PROCESSED = 'document.processed',
  FAILED = 'document.failed',
}

export interface DocumentUploadedEvent {
  documentId: string;
  storageKey: string;
  storageType: 'local' | 's3';
  storageBucket: string;
  fileName: string;
  userId: string;
  country: string;
  icp: string;
  documentReader?: string;
  uploadedAt: Date;
  actualUserId?: string;
  sessionId?: string;
  receiptId?: string;
  sourceDocumentId?: string;
}

export interface DocumentSplitCompletedEvent {
  documentId: string;
  receiptIds: string[];
  splitAt: Date;
}

export interface DocumentSplitFailedEvent {
  documentId: string;
  error: string;
  failedAt: Date;
}

export interface DocumentProcessedEvent {
  documentId: string;
  processedAt: Date;
  status: 'completed' | 'failed';
  result?: any;
  error?: string;
}

