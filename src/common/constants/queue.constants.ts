// Queue names - single unified workflow queue
export const QUEUE_NAMES = {
  EXPENSE_WORKFLOW: 'expense-workflow',
} as const;

// Job names for workflow queue
export const JOB_NAMES = {
  SPLIT_EXPENSE: 'split-expense',
  PROCESS_RECEIPT: 'process-receipt',
  PROCESS_EXPENSE: 'process-expense',
} as const;
