// Queue names
export const QUEUE_NAMES = {
  EXPENSE_PROCESSING: 'expense-processing',
  DOCUMENT_SPLITTING: 'document-splitting',
} as const;

// Job types for queues
export const JOB_TYPES = {
  PROCESS_DOCUMENT: 'process-document',
  SPLIT_DOCUMENT: 'split-document',
} as const;
