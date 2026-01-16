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

// Gross-up policy schema - tax treatment rules
export const CompliancePolicyGrossUpSchema = z.object({
    travel_non_travel_both: z.enum(['Travel', 'Non-Travel', 'Both']),
    expense_type: z.string().min(1, 'expense_type cannot be empty'),
    icp_name: z.string().min(1, 'icp_name cannot be empty'),
    gross_up: z.boolean(),
    gross_up_rule: z.string().min(1, 'gross_up_rule cannot be empty'),
});

// Additional info policy schema - extra documentation requirements
export const CompliancePolicyAdditionalInfoSchema = z.object({
    travel_non_travel_both: z.enum(['Travel', 'Non-Travel', 'Both']),
    expense_type: z.string().min(1, 'expense_type cannot be empty'),
    icp_name: z.string().min(1, 'icp_name cannot be empty'),
    additional_info_required: z.boolean(),
    additional_info_rule: z.string().min(1, 'additional_info_rule cannot be empty'),
});

// Complete extracted policy data schema
export const ExtractedPolicyDataSchema = z.object({
    receiptStandards: z.array(ReceiptStandardSchema).min(1, 'Must have at least one receipt standard'),
    compliancePoliciesGrossUpRelated: z.array(CompliancePolicyGrossUpSchema),
    compliancePoliciesAdditionalInfoRelated: z.array(CompliancePolicyAdditionalInfoSchema),
});

// TypeScript types inferred from schemas
export type ReceiptStandardValidated = z.infer<typeof ReceiptStandardSchema>;
export type CompliancePolicyGrossUpValidated = z.infer<typeof CompliancePolicyGrossUpSchema>;
export type CompliancePolicyAdditionalInfoValidated = z.infer<typeof CompliancePolicyAdditionalInfoSchema>;
export type ExtractedPolicyDataValidated = z.infer<typeof ExtractedPolicyDataSchema>;
