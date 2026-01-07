/**
 * Job data for SPLIT_EXPENSE job
 * Input to DocumentSplitterHandler
 */
export interface SplitExpenseJobData {
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

/**
 * Job data for PROCESS_RECEIPT job (child job)
 * Input to ReceiptProcessorHandler
 */
export interface ProcessReceiptJobData {
  /** Receipt ID */
  receiptId: string;
  /** Parent ExpenseDocument ID */
  sourceDocumentId: string;
  /** User ID */
  userId: string;
  /** Country for compliance */
  country: string;
  /** ICP code */
  icp: string;
  /** Document reader to use */
  documentReader?: string;
  /** First page image of receipt's page range for quality assessment */
  image?: {
    pageNumber: number;
    imageBase64: string;
  };
}

/**
 * Job data for PROCESS_EXPENSE job (parent job)
 * Input to ResultAggregatorHandler
 */
export interface ProcessExpenseJobData {
  /** ExpenseDocument ID */
  documentId: string;
  /** User ID */
  userId: string;
  /** Country for compliance */
  country: string;
  /** ICP code */
  icp: string;
}

/**
 * Result from DocumentSplitterHandler
 */
export interface SplitResult {
  documentId: string;
  receipts: Array<{
    id: string;
    sourceDocumentId: string;
    image?: {
      pageNumber: number;
      imageBase64: string;
    };
  }>;
  segments: Array<{
    receiptId: string;
    invoiceNumber: number;
    startPage: number;
    endPage: number;
    confidence: number;
  }>;
  skippedExpensifyPages: number;
}

/**
 * Parameters for creating expense workflow flow
 */
export interface CreateExpenseFlowParams {
  documentId: string;
  userId: string;
  country: string;
  icp: string;
  documentReader?: string;
  receipts: Array<{
    id: string;
    sourceDocumentId: string;
    image?: {
      pageNumber: number;
      imageBase64: string;
    };
  }>;
}
