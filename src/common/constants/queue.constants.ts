// Single queue name
export const QUEUE_NAMES = {
  EXPENSE_PROCESSING: 'expense-processing',
} as const;

// Job types for the single queue - now only one job type needed
export const JOB_TYPES = {
  PROCESS_DOCUMENT: 'process-document',
} as const;
