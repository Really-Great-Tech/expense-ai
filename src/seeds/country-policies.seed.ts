/**
 * Country Policy Seed Data
 *
 * This file contains seed data for country expense policies using the
 * markdown-based context stuffing architecture.
 *
 * Policies are stored as full markdown documents with page markers ([[PAGE_X]])
 * for citation and verification purposes.
 *
 * Use the policy ingestion endpoint (POST /api/country-policy/ingest) to
 * populate this data from PDF/DOCX policy documents.
 */

export interface PolicyMetadata {
  title?: string;
  effectiveDate?: string;
  version?: string;
  sourceFile?: string;
  parsedDate?: string;
  parserUsed?: string;
}

export interface CountryPolicySeed {
  name: string;           // Country name
  code?: string;          // ISO country code (e.g., "AT", "US")
  policyMarkdown: string; // Full policy document with [[PAGE_X]] markers
  pageCount: number;      // Number of pages in the source document
  icps: string[];         // ICP identifiers in the document
  metadata: PolicyMetadata;
}

/**
 * Country policy seeds - populated via the policy ingestion pipeline.
 * 
 * Example structure:
 * ```typescript
 * "Austria": {
 *   name: "Austria",
 *   code: "AT",
 *   policyMarkdown: "[[PAGE_1]]\n# Expense Policy\n\nIntroduction...\n\n[[PAGE_2]]\n# Receipt Requirements\n...",
 *   pageCount: 6,
 *   icps: ["Global People IT-Services GmbH"],
 *   metadata: {
 *     title: "Austria Expense Policy",
 *     effectiveDate: "2024-01-01",
 *     version: "1.0",
 *     sourceFile: "austria_expense_policy.pdf",
 *     parsedDate: "2024-01-25T10:30:00Z",
 *     parserUsed: "Textract"
 *   }
 * }
 * ```
 */
export const COUNTRY_POLICY_SEEDS: Record<string, CountryPolicySeed> = {
  // Policies will be populated via the ingestion endpoint
};
