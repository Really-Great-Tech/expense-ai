import { Injectable, Logger } from '@nestjs/common';

/**
 * Citation structure from issue detection
 */
export interface Citation {
    field?: string; // Field this citation applies to (for grouped issues)
    page: string;
    section: string;
    quote: string;
    is_verified?: boolean;
    verification_failure_reason?: 'quote_not_found' | 'page_not_found' | 'both';
    verification_details?: string;
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
    failureReason?: 'quote_not_found' | 'page_not_found' | 'both';
}

/**
 * Issue structure with citation
 * Supports both:
 * - Single citation (Category 2 & 3)
 * - Citations array (Category 1 grouped issues)
 */
export interface IssueWithCitation {
    issue_type: string;
    field: string;
    description: string | Array<{ reason: string; fields: string[]; message: string }>;
    recommendation: string;
    confidence_score: number;
    knowledge_base_reference?: string;
    citation?: Citation;
    citations?: Citation[];
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
        // Try strict check first
        let quoteIndex = normalizedPolicy.indexOf(normalizedQuote);
        let quoteFound = quoteIndex !== -1;

        // If not found, try less strict check (removing all punctuation)
        if (!quoteFound) {
            const strictPolicy = this.normalizeStrict(policyMarkdown);
            const strictQuote = this.normalizeStrict(citation.quote);
            if (strictPolicy.includes(strictQuote)) {
                quoteFound = true;
                quoteIndex = 0; // Approximate location
            }
        }

        // If still not found, try word-based fuzzy matching
        // This handles cases where Textract fragments text across lines
        if (!quoteFound) {
            quoteFound = this.wordBasedMatch(citation.quote, policyMarkdown);
            if (quoteFound) {
                quoteIndex = 0; // Approximate location
            }
        }

        // Validate page marker exists
        // Support multiple formats: [[PAGE_X]], ## Page X, Page X
        const pageNum = citation.page.replace(/^(PAGE_|Page\s*)/i, '');
        const pageMarkers = [
            `[[${citation.page}]]`,                 // Standard ingestion format
            `[[PAGE_${pageNum}]]`,                  // Normalized ingestion format
            `## Page ${pageNum}`,                   // Markdown header format
            `## Page ${pageNum}\n`,                 // Header with newline
            `Page ${pageNum}`                       // Simple text format
        ];

        // Case insensitive check for page markers
        const lowerPolicy = policyMarkdown.toLowerCase();
        const pageValid = pageMarkers.some(marker => lowerPolicy.includes(marker.toLowerCase()));

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
            if (!pageValid) reasons.push(`page marker (e.g. [[PAGE_${pageNum}]]) not found`);
            result.verificationDetails = `Verification failed: ${reasons.join(', ')}`;

            if (!quoteFound && !pageValid) result.failureReason = 'both';
            else if (!quoteFound) result.failureReason = 'quote_not_found';
            else if (!pageValid) result.failureReason = 'page_not_found';
        }

        return result;
    }

    /**
     * Strict normalization: remove all non-alphanumeric characters
     */
    private normalizeStrict(text: string): string {
        return text.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    /**
     * Word-based fuzzy matching for quotes.
     * Handles cases where Textract fragments text across lines/cells.
     * 
     * Strategy: Extract significant words (length > 3) from quote,
     * then check if most of them appear in the policy in roughly the same order.
     * 
     * @param quote - The quote to search for
     * @param policy - The policy document to search in
     * @returns true if a sufficient match is found
     */
    private wordBasedMatch(quote: string, policy: string): boolean {
        // Extract words, filter to significant ones (length > 3)
        const quoteWords = quote.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3);

        if (quoteWords.length === 0) return false;

        const policyLower = policy.toLowerCase();

        // Check if at least 70% of significant words appear in policy (relaxed from 80%)
        const wordsFound = quoteWords.filter(word => policyLower.includes(word));
        const matchRatio = wordsFound.length / quoteWords.length;

        if (matchRatio < 0.70) return false;

        // Additional check: verify words appear in roughly the same order
        // Find positions of each word in policy
        const positions = wordsFound.map(word => {
            const idx = policyLower.indexOf(word);
            return idx;
        }).filter(pos => pos !== -1);

        if (positions.length < 3) {
            // Too few words to check order, accept based on word presence (relaxed from 90%)
            return matchRatio >= 0.80;
        }

        // Check if positions are generally increasing (allowing some disorder)
        let increasingCount = 0;
        for (let i = 1; i < positions.length; i++) {
            if (positions[i] >= positions[i - 1]) {
                increasingCount++;
            }
        }

        const orderRatio = increasingCount / (positions.length - 1);

        // Accept if 60% of words are in order and 80% are present
        return orderRatio >= 0.6 && matchRatio >= 0.8;
    }

    /**
     * Verify all citations in an issue detection result and add is_verified flag.
     * 
     * This mutates the issues array to add verification details to each citation.
     * Handles both:
     * - Single `citation` (Category 2 & 3)
     * - `citations` array (Category 1 grouped issues)
     * 
     * @param issues - Array of issues with potential citations
     * @param policyMarkdown - The source policy document
     * @returns The issues array with verification details added to citations
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
            // Handle single citation (Category 2 & 3)
            if (issue.citation) {
                const result = this.verifyCitation(issue.citation, policyMarkdown);
                issue.citation.is_verified = result.isVerified;

                if (!result.isVerified) {
                    issue.citation.verification_failure_reason = result.failureReason;
                    issue.citation.verification_details = result.verificationDetails;
                }

                if (result.isVerified) {
                    verifiedCount++;
                } else {
                    unverifiedCount++;
                    const desc = typeof issue.description === 'string' ? issue.description : 'grouped issue';
                    this.logger.warn(
                        `Unverified citation for issue "${desc}": ${result.verificationDetails}`
                    );
                }
            }

            // Handle citations array (Category 1 grouped issues)
            if (issue.citations && Array.isArray(issue.citations)) {
                issue.citations.forEach(citation => {
                    const result = this.verifyCitation(citation, policyMarkdown);
                    citation.is_verified = result.isVerified;

                    if (!result.isVerified) {
                        citation.verification_failure_reason = result.failureReason;
                        citation.verification_details = result.verificationDetails;
                    }

                    if (result.isVerified) {
                        verifiedCount++;
                    } else {
                        unverifiedCount++;
                        this.logger.warn(
                            `Unverified citation for field "${citation.field || 'unknown'}": ${result.verificationDetails}`
                        );
                    }
                });
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
