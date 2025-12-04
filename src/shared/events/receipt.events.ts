export enum ReceiptEventPattern {
  EXTRACTED = 'receipt.extracted',
  PROCESSING_REQUESTED = 'receipt.processing.requested',
  PROCESSING_COMPLETED = 'receipt.processing.completed',
  PROCESSING_FAILED = 'receipt.processing.failed',
}

export interface ReceiptExtractedEvent {
  receiptId: string;
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
}

export interface ReceiptProcessingRequestedEvent {
  receiptId: string;
  documentId: string;
  storageKey: string;
  storageType: 'local' | 's3';
  storageBucket: string;
  fileName: string;
  userId: string;
  country: string;
  icp: string;
  documentReader?: string;
  requestedAt: Date;
}

export interface ReceiptProcessingCompletedEvent {
  receiptId: string;
  documentId: string;
  result: any;
  completedAt: Date;
}

export interface ReceiptProcessingFailedEvent {
  receiptId: string;
  documentId: string;
  error: string;
  failedAt: Date;
}
