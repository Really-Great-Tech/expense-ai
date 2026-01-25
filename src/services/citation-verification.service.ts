import { Injectable, Logger } from '@nestjs/common';

/**
 * Citation structure from issue detection
 */
export interface Citation {
    page: string;
    section: string;
    quote: string;
    is_verified?: boolean;
}

/**
 * Result of citation verification
 */
export interface CitationVerificationResult {
    isVerified: boolean;
    pageValid: boolean;
    quoteFound: boolean;
    normalizedQuote: string;
    matchLocation?: {
        start: number;
        end: number;
    };
    verificationDetails?: string;
}

/**
 * Issue structure with citation
 */
export interface IssueWithCitation {
    issue_type: string;
    field: string;
    description: string;
    recommendation: string;
    confidence_score: number;
    knowledge_base_reference?: string;
    citation?: Citation;
}

/**
 * Service for verifying LLM-provided citations against source policy documents.
 * 
 * Implements deterministic string validation to catch hallucinated quotes
 * and ensure audit trail accuracy.
 */
@Injectable()
export class CitationVerificationService {
    private readonly logger = new Logger(CitationVerificationService.name);

    /**
     * Verify a single citation against the source policy document.
     * 
     * Verification steps:
     * 1. Normalize text (lowercase, remove extra whitespace)
     * 2. Check if normalized quote exists in normalized policy
     * 3. Validate page marker exists in document
     * 
     * @param citation - The citation to verify
     * @param policyMarkdown - The source policy document
     * @returns Verification result with details
     */
    verifyCitation(citation: Citation, policyMarkdown: string): CitationVerificationResult {
        if (!citation || !citation.quote || !policyMarkdown) {
            return {
                isVerified: false,
                pageValid: false,
                quoteFound: false,
                normalizedQuote: '',
                verificationDetails: 'Missing citation or policy document',
            };
        }

        // Normalize text for comparison
        const normalizedPolicy = this.normalizeText(policyMarkdown);
        const normalizedQuote = this.normalizeText(citation.quote);

        // Check if quote exists in policy
        const quoteIndex = normalizedPolicy.indexOf(normalizedQuote);
        const quoteFound = quoteIndex !== -1;

        // Validate page marker exists
        const pageMarker = `[[${citation.page}]]`;
        const pageValid = policyMarkdown.includes(pageMarker);

        // Determine overall verification status
        const isVerified = quoteFound && pageValid;

        const result: CitationVerificationResult = {
            isVerified,
            pageValid,
            quoteFound,
            normalizedQuote,
        };

        if (quoteFound) {
            result.matchLocation = {
                start: quoteIndex,
                end: quoteIndex + normalizedQuote.length,
            };
        }

        if (!isVerified) {
            const reasons: string[] = [];
            if (!quoteFound) reasons.push('quote not found in policy');
            if (!pageValid) reasons.push(`page marker ${pageMarker} not found`);
            result.verificationDetails = `Verification failed: ${reasons.join(', ')}`;
        }

        return result;
    }

    /**
     * Verify all citations in an issue detection result and add is_verified flag.
     * 
     * This mutates the issues array to add is_verified to each citation.
     * 
     * @param issues - Array of issues with potential citations
     * @param policyMarkdown - The source policy document
     * @returns The issues array with is_verified flags added to citations
     */
    verifyAndEnrichIssues(
        issues: IssueWithCitation[],
        policyMarkdown: string
    ): IssueWithCitation[] {
        if (!issues || !Array.isArray(issues)) {
            return issues;
        }

        let verifiedCount = 0;
        let unverifiedCount = 0;

        const enrichedIssues = issues.map(issue => {
            if (issue.citation) {
                const result = this.verifyCitation(issue.citation, policyMarkdown);
                issue.citation.is_verified = result.isVerified;

                if (result.isVerified) {
                    verifiedCount++;
                } else {
                    unverifiedCount++;
                    this.logger.warn(
                        `Unverified citation for issue "${issue.description}": ${result.verificationDetails}`
                    );
                }
            }
            return issue;
        });

        this.logger.log(
            `Citation verification complete: ${verifiedCount} verified, ${unverifiedCount} unverified`
        );

        return enrichedIssues;
    }

    /**
     * Normalize text for comparison.
     * - Convert to lowercase
     * - Replace multiple whitespace with single space
     * - Trim leading/trailing whitespace
     * - Remove special characters that might differ
     */
    private normalizeText(text: string): string {
        return text
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/['']/g, "'")
            .replace(/[""]/g, '"')
            .trim();
    }

    /**
     * Calculate similarity between two strings (for fuzzy matching if needed in future)
     * Uses Levenshtein distance ratio
     */
    calculateSimilarity(str1: string, str2: string): number {
        const s1 = this.normalizeText(str1);
        const s2 = this.normalizeText(str2);

        if (s1 === s2) return 1.0;
        if (s1.length === 0 || s2.length === 0) return 0.0;

        // Check for substring match
        if (s1.includes(s2) || s2.includes(s1)) {
            return Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
        }

        // Simple Levenshtein-based similarity for short strings
        const maxLen = Math.max(s1.length, s2.length);
        if (maxLen > 500) {
            // For long strings, just check substring presence
            return 0.0;
        }

        const distance = this.levenshteinDistance(s1, s2);
        return 1 - distance / maxLen;
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    private levenshteinDistance(s1: string, s2: string): number {
        const m = s1.length;
        const n = s2.length;

        // Create distance matrix
        const dp: number[][] = Array(m + 1)
            .fill(null)
            .map(() => Array(n + 1).fill(0));

        // Initialize base cases
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        // Fill in the rest
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (s1[i - 1] === s2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
                }
            }
        }

        return dp[m][n];
    }
}
