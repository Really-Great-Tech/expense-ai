/**
 * Type definitions for country policy extraction and storage
 * These match the structure in COUNTRY_POLICY_SEEDS
 */

export interface ReceiptStandard {
  required_data: string;
  travel_non_travel_both: string;
  expense_type: string;
  icp_name: string;
  mandatory_optional: string;
  rule: string;
}

export interface CompliancePolicyGrossUp {
  travel_non_travel_both: string;
  expense_type: string;
  icp_name: string;
  gross_up: boolean;
  gross_up_rule: string;
}

export interface CompliancePolicyAdditionalInfo {
  travel_non_travel_both: string;
  expense_type: string;
  icp_name: string;
  additional_info_required: boolean;
  additional_info_rule: string;
}

/**
 * Extracted policy data structure from LLM
 * Must match the format in country-policies.seed.ts
 */
export interface ExtractedPolicyData {
  receiptStandards: ReceiptStandard[];
  compliancePoliciesGrossUpRelated: CompliancePolicyGrossUp[];
  compliancePoliciesAdditionalInfoRelated: CompliancePolicyAdditionalInfo[];
}

/**
 * File information after storage
 */
export interface StoredFileInfo {
  fileName: string;
  fileType: 'url' | 'file' | 'csv' | 'docx'; // Must match Datasource entity enum
  filePath: string; // S3 path or local path
  fileSize: number;
  uploadedAt: Date;
  rawContent?: string; // Optional raw text content
}

/**
 * Result of saving policy to database
 */
export interface PolicySaveResult {
  success: boolean;
  countryId: number | string;
  countryCode: string;
  versionId: string;
  policyId: number | string;
  datasourceId?: number | string;
}

/**
 * Result for a single file processing
 */
export interface FileProcessingResult {
  fileName: string;
  status: 'success' | 'failed';
  error?: string;
  policyId?: number | string;
  versionId?: string;
}

/**
 * Complete upload response
 */
export interface PolicyUploadResponse {
  success: boolean;
  country: string;
  countryCode?: string;
  versionId?: string;
  filesProcessed: number;
  results: FileProcessingResult[];
  timestamp: Date;
}
