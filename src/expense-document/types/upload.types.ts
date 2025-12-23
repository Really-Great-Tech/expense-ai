export interface PageMarkdown {
  pageNumber: number;
  content: string;
  filePath: string;
  /** Base64-encoded PNG image for vision analysis */
  imageBase64?: string;
}

export interface PageGroup {
  invoiceNumber: number;
  pages: number[];
  confidence: number;
  reasoning: string;
  /** Whether this group is an Expensify container/summary page */
  isExpensifyExport?: boolean;
  /** Confidence score for Expensify detection (0-1) */
  expensifyConfidence?: number;
  /** Reason for Expensify classification */
  expensifyReason?: string;
  /** Detected Expensify indicators */
  expensifyIndicators?: string[];
  /** Whether this group contains blank or error pages */
  isBlankOrError?: boolean;
  /** Reason for blank/error classification */
  blankErrorReason?: string;
  /** Page classification for boundary detection */
  pageClassification?: 'EXPENSE_COVER' | 'RECEIPT_THUMBNAIL' | 'ACTUAL_RECEIPT' | 'UNKNOWN';
}

export interface PageAnalysisResult {
  totalInvoices: number;
  pageGroups: PageGroup[];
}

export interface SplitPdfInfo {
  invoiceNumber: number;
  pages: number[];
  pdfPath: string;
  fileName: string;
  fileSize: number;
}

export interface InvoiceGroup {
  invoiceNumber: number;
  pages: number[];
  content: string;
  confidence: number;
  reasoning: string;
  totalPages: number;
  // PDF file information
  pdfPath: string | null;
  fileName: string | null;
  fileSize: number | null;
  // Upload information (set after uploading)
  storagePath?: string | null;
  jobId?: string | null;
  receiptId?: string;
  // Expensify detection fields
  isExpensifyExport?: boolean;
  expensifyConfidence?: number;
  expensifyReason?: string;
  expensifyIndicators?: string[];
  // Blank/error page detection
  isBlankOrError?: boolean;
  blankErrorReason?: string;
  // Page classification
  pageClassification?: 'EXPENSE_COVER' | 'RECEIPT_THUMBNAIL' | 'ACTUAL_RECEIPT' | 'UNKNOWN';
}

export interface DuplicateChoice {
  action: 'REFERENCE_EXISTING' | 'FORCE_REPROCESS';
  label: string;
  description: string;
}

export interface DuplicateInfo {
  isDuplicate: boolean;
  duplicateType: 'CONTENT_IDENTICAL' | 'METADATA_SIMILAR';
  existingDocument?: any; // ExpenseDocument - avoiding circular import
  confidence: number;
  recommendation: 'REFERENCE_EXISTING' | 'PROCEED';
  choices: DuplicateChoice[];
}

export interface SplitAnalysisResponse {
  success: boolean;
  data: {
    originalFileName: string;
    totalPages?: number;
    hasMultipleInvoices?: boolean;
    totalInvoices?: number;
    invoices?: InvoiceGroup[];
    tempDirectory?: string;
    expenseDocumentId: string;
    receiptIds?: string[];
    // Duplicate detection fields
    isDuplicate?: boolean;
    duplicateAction?: 'REFERENCED' | 'REPROCESSED';
    // Async processing fields
    status?: 'QUEUED' | 'PROCESSING' | 'COMPLETED';
  } | null;
  // Duplicate detection workflow
  requiresUserChoice?: boolean;
  duplicateInfo?: DuplicateInfo;
}
