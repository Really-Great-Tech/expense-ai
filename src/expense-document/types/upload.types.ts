export interface PageMarkdown {
  pageNumber: number;
  content: string;
  filePath: string;
  /** Base64-encoded PNG image for vision analysis */
  imageBase64?: string;
}

/**
 * Rich metadata extracted from a document group using LLM + vision analysis
 * Used for document classification, filtering, and downstream processing
 */
export interface DocumentMetadata {
  /** Type of document (e.g., Invoice, Receipt, Statement, Contract, Form, Report, Letter) */
  documentType: string;
  /** More specific type if applicable (e.g., Hotel Receipt, Flight Itinerary, Bank Statement) */
  documentSubtype?: string;
  /** Confidence score for the metadata extraction (0-1) */
  confidence: number;
  /** Header text or title visible on the document */
  headerInfo: string;
  /** Footer text visible on the document */
  footerInfo: string;
  /** Brief 1-2 sentence summary of document content */
  mainContent: string;
  /** Key names or entities found in the document */
  keyEntities: string[];
  /** Company or merchant name if applicable */
  merchantName?: string;
  /** Transaction or reference ID if found */
  transactionId?: string;
  /** Date or date range mentioned */
  datePeriod?: string;
  /** Total amount if this is a financial document */
  totalAmount?: string;
  /** Currency code if amount found (e.g., USD, EUR) */
  currency?: string;
  /** Whether the document has a visible logo */
  hasLogo: boolean;
  /** Brief description of logo if present */
  logoDescription?: string;
  /** LLM-detected Expensify/expense system page */
  isExpensifyPage?: boolean;
  /** LLM confidence for Expensify detection (0-1) */
  expensifyConfidenceLlm?: number;
  /** LLM reason for Expensify classification */
  expensifyReasonLlm?: string;
  /** LLM-detected blank or empty page */
  isBlankLlm?: boolean;
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
  /** Rich metadata extracted via LLM+vision */
  metadata?: DocumentMetadata;
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
  // Rich metadata from LLM extraction
  merchantName?: string;
  totalAmount?: string;
  currency?: string;
  documentType?: string;
  transactionId?: string;
  datePeriod?: string;
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
