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

// Queue names
export const QUEUE_NAMES = {
  EXPENSE_PROCESSING: 'expense-processing',
  DOCUMENT_SPLITTING: 'document-splitting',
} as const;

// Job types
export const JOB_TYPES = {
  PROCESS_DOCUMENT: 'process-document',
  SPLIT_DOCUMENT: 'split-document',
} as const;

// Job data for document splitting queue
export interface DocumentSplittingJobData {
  documentId: string;
  originalFilePath: string;
  tempDirectory: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  userId: string;
  country: string;
  icp: string;
  documentReader?: string;
}

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
