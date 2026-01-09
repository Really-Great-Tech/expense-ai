// Queue names - single unified workflow queue
export const QUEUE_NAMES = {
  EXPENSE_WORKFLOW: 'expense-workflow',
  CIRCUIT_BREAKER: 'circuit-breaker',
} as const;

// Job names for workflow queue
export const JOB_NAMES = {
  SPLIT_EXPENSE: 'split-expense',
  PROCESS_RECEIPT: 'process-receipt',
  PROCESS_EXPENSE: 'process-expense',
} as const;

// Job names for circuit breaker queue
export const CIRCUIT_BREAKER_JOB_NAMES = {
  EXECUTE_REQUEST: 'execute-request',
} as const;
