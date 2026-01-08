import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

/**
 * DTO for expense document submission via S3 reference
 *
 * Example payload:
 * ```json
 * {
 *   "fileId": "file-123456",
 *   "fileName": "expense_receipt_2026_01.pdf",
 *   "filePath": "s3://expenses-bucket/uploads/customer-1/file-123456.pdf",
 *   "customerId": 67890,
 *   "icp": "global people",
 *   "country": "UK"
 * }
 * ```
 */
export class ExpenseSubmitDto {
  /** Unique identifier for idempotency - prevents duplicate processing */
  @IsString()
  @IsNotEmpty()
  fileId!: string;

  /** Original file name */
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  /** Full S3 path (e.g., "s3://bucket-name/path/to/file.pdf") */
  @IsString()
  @IsNotEmpty()
  filePath!: string;

  /** Customer ID for tracking */
  @IsNumber()
  customerId!: number;

  /** ICP code (e.g., "global people") */
  @IsString()
  @IsNotEmpty()
  icp!: string;

  /** Country code (e.g., "UK", "US") */
  @IsString()
  @IsNotEmpty()
  country!: string;
}

/**
 * Parsed S3 location from filePath
 */
export interface S3Location {
  bucket: string;
  key: string;
}

/**
 * Parse S3 URI into bucket and key
 * @param filePath - S3 URI (e.g., "s3://bucket-name/path/to/file.pdf")
 * @returns Parsed S3 location
 * @throws Error if filePath is not a valid S3 URI
 */
export function parseS3Path(filePath: string): S3Location {
  const s3Regex = /^s3:\/\/([^/]+)\/(.+)$/;
  const match = filePath.match(s3Regex);

  if (!match) {
    throw new Error(`Invalid S3 path: ${filePath}. Expected format: s3://bucket/key`);
  }

  return {
    bucket: match[1],
    key: match[2],
  };
}
