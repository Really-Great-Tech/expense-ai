/**
 * Zod schemas for validating LLM-extracted country policy data
 * Ensures data integrity before database insertion
 */

import { z } from 'zod';

// Receipt standard schema - what data must appear on receipts
export const ReceiptStandardSchema = z.object({
    required_data: z.string().min(1, 'required_data cannot be empty'),
    travel_non_travel_both: z.enum(['Travel', 'Non-Travel', 'Both']),
    expense_type: z.string().min(1, 'expense_type cannot be empty'),
    icp_name: z.string().min(1, 'icp_name cannot be empty'),
    mandatory_optional: z.enum(['Mandatory', 'Optional']),
    rule: z.string().min(1, 'rule cannot be empty'),
});

// Receipt standard with validation - includes validation score and judgment
export const ReceiptStandardWithValidationSchema = ReceiptStandardSchema.extend({
    validation_score: z.number().min(0).max(10).optional(),
    validation_judgment: z.string().optional(),
});

// Gross-up policy schema - tax treatment rules
export const CompliancePolicyGrossUpSchema = z.object({
    travel_non_travel_both: z.enum(['Travel', 'Non-Travel', 'Both']),
    expense_type: z.string().min(1, 'expense_type cannot be empty'),
    icp_name: z.string().min(1, 'icp_name cannot be empty'),
    gross_up: z.boolean(),
    gross_up_rule: z.string().min(1, 'gross_up_rule cannot be empty'),
});

// Gross-up policy with validation
export const CompliancePolicyGrossUpWithValidationSchema = CompliancePolicyGrossUpSchema.extend({
    validation_score: z.number().min(0).max(10).optional(),
    validation_judgment: z.string().optional(),
});

// Additional info policy schema - extra documentation requirements
export const CompliancePolicyAdditionalInfoSchema = z.object({
    travel_non_travel_both: z.enum(['Travel', 'Non-Travel', 'Both']),
    expense_type: z.string().min(1, 'expense_type cannot be empty'),
    icp_name: z.string().min(1, 'icp_name cannot be empty'),
    additional_info_required: z.boolean(),
    additional_info_rule: z.string().min(1, 'additional_info_rule cannot be empty'),
});

// Additional info policy with validation
export const CompliancePolicyAdditionalInfoWithValidationSchema = CompliancePolicyAdditionalInfoSchema.extend({
    validation_score: z.number().min(0).max(10).optional(),
    validation_judgment: z.string().optional(),
});

// Complete extracted policy data schema
export const ExtractedPolicyDataSchema = z.object({
    receiptStandards: z.array(ReceiptStandardSchema).min(1, 'Must have at least one receipt standard'),
    compliancePoliciesGrossUpRelated: z.array(CompliancePolicyGrossUpSchema),
    compliancePoliciesAdditionalInfoRelated: z.array(CompliancePolicyAdditionalInfoSchema),
});

// Complete validation result schema
export const PolicyValidationResultSchema = z.object({
    overall_validation_status: z.enum(['APPROVED', 'NEEDS_REVISION']),
    overall_summary: z.string(),
    source_documents_reviewed: z.array(z.string()),
    critical_issues: z.array(z.string()),
    icp_entities_identified: z.array(z.string()),
    receiptStandards: z.array(ReceiptStandardWithValidationSchema),
    compliancePoliciesGrossUpRelated: z.array(CompliancePolicyGrossUpWithValidationSchema),
    compliancePoliciesAdditionalInfoRelated: z.array(CompliancePolicyAdditionalInfoWithValidationSchema),
});

// TypeScript types inferred from schemas
export type ReceiptStandardValidated = z.infer<typeof ReceiptStandardSchema>;
export type ReceiptStandardWithValidation = z.infer<typeof ReceiptStandardWithValidationSchema>;
export type CompliancePolicyGrossUpValidated = z.infer<typeof CompliancePolicyGrossUpSchema>;
export type CompliancePolicyGrossUpWithValidation = z.infer<typeof CompliancePolicyGrossUpWithValidationSchema>;
export type CompliancePolicyAdditionalInfoValidated = z.infer<typeof CompliancePolicyAdditionalInfoSchema>;
export type CompliancePolicyAdditionalInfoWithValidation = z.infer<typeof CompliancePolicyAdditionalInfoWithValidationSchema>;
export type ExtractedPolicyDataValidated = z.infer<typeof ExtractedPolicyDataSchema>;
export type PolicyValidationResult = z.infer<typeof PolicyValidationResultSchema>;
