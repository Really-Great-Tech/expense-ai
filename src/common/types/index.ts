export interface DocumentProcessingData {
  jobId: string;
  storageKey: string;
  storageType: 'local' | 's3';
  storageBucket: string;
  fileName: string;
  userId: string;
  country: string;
  icp: string;
  documentReader?: string;
  uploadedAt: Date;
  // NEW: Hierarchical user system fields
  actualUserId?: string;
  sessionId?: string;
  legacyUserId?: string; // Keep original userId for backward compatibility
  // NEW: Receipt tracking for document splitter
  receiptId?: string;
  sourceDocumentId?: string; // Document ID from which receipt was split
  // Deprecated fields (keep for backward compatibility)
  filePath?: string; // @deprecated Use storageKey instead
}

/**
 * Job data for document splitting queue
 * Used to process multi-page documents and split them into individual receipts
 */
export interface DocumentSplittingJobData {
  /** ExpenseDocument ID */
  documentId: string;
  /** S3 storage key for the original document */
  storageKey: string;
  /** S3 bucket name */
  storageBucket: string;
  /** Storage type */
  storageType: 'local' | 's3';
  /** Original file name */
  originalFileName: string;
  /** File size in bytes */
  fileSize: number;
  /** MIME type */
  mimeType: string;
  /** User who uploaded the document */
  userId: string;
  /** Country for compliance */
  country: string;
  /** ICP code */
  icp: string;
  /** Document reader to use (e.g., 'textract') */
  documentReader?: string;
}

export interface ExpenseLineItem {
  description: string;
  amount: string;
  quantity?: number;
  category?: string;
}

// Only one job data type needed now
export type ExpenseProcessingJobData = DocumentProcessingData;

export interface ProcessingStatus {
  jobId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: {
    fileClassification: boolean;
    dataExtraction: boolean;
    issueDetection: boolean;
    citationGeneration: boolean;
  };
  results?: {
    classification?: any;
    extraction?: any;
    compliance?: any;
    citations?: any;
  };
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  processingTime?: number;
}

// Re-export constants for backward compatibility
export { QUEUE_NAMES, JOB_TYPES } from '../constants/queue.constants';

export interface ProcessingMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  queueHealth: {
    [key: string]: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
  };
}
