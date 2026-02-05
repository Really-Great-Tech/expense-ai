/**
 * Type definitions for country policy extraction and storage
 * These match the structure in COUNTRY_POLICY_SEEDS
 */

export interface ReceiptStandard {
  required_data: string;
  travel_non_travel_both: string;
  expense_type: string;
  icp_id: string;
  mandatory_optional: string;
  rule: string;
  citation?: string;
}

export interface CompliancePolicyGrossUp {
  travel_non_travel_both: string;
  expense_type: string;
  icp_id: string;
  gross_up: boolean;
  gross_up_rule: string;
  citation?: string;
}

export interface CompliancePolicyAdditionalInfo {
  travel_non_travel_both: string;
  expense_type: string;
  icp_id: string;
  additional_info_required: boolean;
  additional_info_rule: string;
  citation?: string;
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
  /** The extracted policy rules from the document */
  extractedData?: ExtractedPolicyData;
}

/**
 * Complete upload response
 */
export interface PolicyUploadResponse {
  success: boolean;
  country: string;
  countryCode?: string;
  policyId?: number | string;
  versionId?: string;
  filesProcessed: number;
  /** List of files that contributed to the policy */
  files: string[];
  /** The unified extracted policy data (shown once, not duplicated per file) */
  extractedData?: ExtractedPolicyData;
  /** Validation results - only in response, not persisted to database */
  validationResult?: {
    overall_validation_status: 'APPROVED' | 'NEEDS_REVISION';
    overall_summary: string;
    average_score: number;
    critical_issues: string[];
    icp_entities_identified: string[];
    problematic_rules_count: number;
    /** Extracted data with validation scores and judgments appended to each rule */
    extractedDataWithValidation?: {
      receiptStandards: Array<any>;
      compliancePoliciesGrossUpRelated: Array<any>;
      compliancePoliciesAdditionalInfoRelated: Array<any>;
    };
  };
  /** Individual file processing results (for error tracking) */
  results: Array<{ fileName: string; status: 'success' | 'failed'; error?: string }>;
  timestamp: Date;
}
