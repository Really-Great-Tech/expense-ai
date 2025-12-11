export interface PageMarkdown {
  pageNumber: number;
  content: string;
  filePath: string;
  imageBase64?: string; // Optional base64 encoded page image for vision analysis
}

export interface PageGroup {
  invoiceNumber: number;
  pages: number[];
  confidence: number;
  reasoning: string;
  // Expensify detection
  isExpensifyExport?: boolean;
  expensifyConfidence?: number;
  expensifyReason?: string;
  expensifyIndicators?: string[];
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
  // Expensify detection
  isExpensifyExport?: boolean;
  expensifyConfidence?: number;
  expensifyReason?: string;
  expensifyIndicators?: string[];
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
    tempDirectory: string;
    expenseDocumentId: string;
    receiptIds?: string[];
    // Duplicate detection fields
    isDuplicate?: boolean;
    duplicateAction?: 'REFERENCED' | 'REPROCESSED';
  } | null;
  // Duplicate detection workflow
  requiresUserChoice?: boolean;
  duplicateInfo?: DuplicateInfo;
}
