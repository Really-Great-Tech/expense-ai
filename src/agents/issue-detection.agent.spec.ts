import { IssueDetectionAgent } from './issue-detection.agent';
import { BedrockLlmService } from '../utils/bedrockLlm';
import * as fs from 'fs';

// Mock AWS SDK before any imports
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(),
  InvokeModelCommand: jest.fn(),
  ConverseCommand: jest.fn(),
}));

jest.mock('../utils/bedrockLlm');
jest.mock('fs');

describe('IssueDetectionAgent', () => {
  let agent: IssueDetectionAgent;
  let mockLlmService: jest.Mocked<BedrockLlmService>;

  beforeEach(() => {
    mockLlmService = {
      chat: jest.fn(),
      getCurrentProvider: jest.fn().mockReturnValue('bedrock'),
      getCurrentModelName: jest.fn().mockReturnValue('eu.amazon.nova-pro-v1:0'),
    } as any;

    // Mock expense schema loading
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        properties: {
          vendor_name: { type: 'string', required: true },
          total_amount: { type: 'number', required: true },
          tax_id: { type: 'string', required: false },
        },
      }),
    );

    agent = new IssueDetectionAgent('bedrock');
    agent['llm'] = mockLlmService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeCompliance', () => {
    const validComplianceResponse = {
      validation_result: {
        is_valid: true,
        issues_count: 0,
        issues: [],
        corrected_receipt: null,
        compliance_summary: 'All compliance requirements met',
      },
      technical_details: {
        content_type: 'expense_receipt',
        country: 'USA',
        icp: 'standard',
        receipt_type: 'restaurant',
        issues_count: 0,
      },
    };

    const complianceDataMock = {
      country: 'USA',
      receipt_standards: {
        required_fields: ['vendor_name', 'total_amount', 'date'],
      },
    };

    const extractedDataMock = {
      vendor_name: 'Restaurant ABC',
      total_amount: 45.5,
      date_of_issue: '2024-01-15',
    };

    it('should pass compliance check with valid data', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(validComplianceResponse) },
        usage: { input_tokens: 250, output_tokens: 80 },
      });

      const result = await agent.analyzeCompliance('USA', 'restaurant', 'standard', complianceDataMock, extractedDataMock);

      expect(result.validation_result.is_valid).toBe(true);
      expect(result.validation_result.issues_count).toBe(0);
      expect(result.technical_details.country).toBe('USA');
      expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
    });

    it('should identify compliance issues', async () => {
      const issuesResponse = {
        validation_result: {
          is_valid: false,
          issues_count: 2,
          issues: [
            {
              issue_type: 'Missing Required Field',
              field: 'tax_id',
              description: 'Tax ID is required but missing',
              recommendation: 'Add supplier tax identification number',
              knowledge_base_reference: 'USA Tax Compliance Guide',
              confidence_score: 0.95,
            },
            {
              issue_type: 'Format Error',
              field: 'date_of_issue',
              description: 'Date format does not match required format',
              recommendation: 'Use YYYY-MM-DD format',
              knowledge_base_reference: 'Date Format Standards',
              confidence_score: 0.88,
            },
          ],
          corrected_receipt: null,
          compliance_summary: '2 compliance issues identified',
        },
        technical_details: {
          content_type: 'expense_receipt',
          country: 'USA',
          icp: 'standard',
          receipt_type: 'restaurant',
          issues_count: 2,
        },
      };

      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(issuesResponse) },
      });

      const result = await agent.analyzeCompliance('USA', 'restaurant', 'standard', complianceDataMock, extractedDataMock);

      expect(result.validation_result.is_valid).toBe(false);
      expect(result.validation_result.issues_count).toBe(2);
      expect(result.validation_result.issues).toHaveLength(2);
      expect(result.validation_result.issues[0].field).toBe('tax_id');
    });

    it('should handle markdown code blocks in response', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: {
          content: '```json\n' + JSON.stringify(validComplianceResponse) + '\n```',
        },
      });

      const result = await agent.analyzeCompliance('USA', 'restaurant', 'standard', complianceDataMock, extractedDataMock);

      expect(result.validation_result.is_valid).toBe(true);
    });

    it('should handle Anthropic array format response', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: {
          content: [{ type: 'text', text: JSON.stringify(validComplianceResponse) }],
        },
      } as any);

      const result = await agent.analyzeCompliance('USA', 'restaurant', 'standard', complianceDataMock, extractedDataMock);

      expect(result.validation_result.is_valid).toBe(true);
    });

    it('should return fallback result on LLM error', async () => {
      mockLlmService.chat.mockRejectedValue(new Error('Connection timeout'));

      const result = await agent.analyzeCompliance('USA', 'restaurant', 'standard', complianceDataMock, extractedDataMock);

      expect(result.validation_result.is_valid).toBe(false);
      expect(result.validation_result.issues_count).toBe(1);
      expect(result.validation_result.issues[0].issue_type).toContain('Standards & Compliance');
      expect(result.validation_result.issues[0].description).toContain('Connection timeout');
    });

    it('should return fallback result on invalid JSON', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: { content: 'Invalid JSON response' },
      });

      const result = await agent.analyzeCompliance('USA', 'restaurant', 'standard', complianceDataMock, extractedDataMock);

      expect(result.validation_result.is_valid).toBe(false);
      expect(result.validation_result.issues_count).toBeGreaterThan(0);
    });

    it('should validate different countries', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(validComplianceResponse) },
      });

      const result = await agent.analyzeCompliance('Germany', 'invoice', 'standard', complianceDataMock, extractedDataMock);

      const callArgs = mockLlmService.chat.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Germany');
    });

    it('should include issue confidence scores', async () => {
      const issuesResponse = {
        validation_result: {
          is_valid: false,
          issues_count: 1,
          issues: [
            {
              issue_type: 'Data Quality',
              field: 'vendor_name',
              description: 'Vendor name appears incomplete',
              recommendation: 'Verify vendor name spelling',
              knowledge_base_reference: 'Data Quality Standards',
              confidence_score: 0.75,
            },
          ],
          corrected_receipt: null,
          compliance_summary: '1 issue identified',
        },
        technical_details: {
          content_type: 'expense_receipt',
          country: 'USA',
          icp: 'standard',
          receipt_type: 'restaurant',
          issues_count: 1,
        },
      };

      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(issuesResponse) },
      });

      const result = await agent.analyzeCompliance('USA', 'restaurant', 'standard', complianceDataMock, extractedDataMock);

      expect(result.validation_result.issues[0].confidence_score).toBe(0.75);
    });
  });

  describe('getActualModelUsed', () => {
    it('should return model name from Bedrock service', () => {
      const modelName = agent.getActualModelUsed();
      expect(modelName).toBe('eu.amazon.nova-pro-v1:0');
    });
  });

  describe('constructor', () => {
    it('should load expense schema on initialization', () => {
      expect(fs.readFileSync).toHaveBeenCalled();
    });

    it('should handle schema loading failure gracefully', () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });

      const newAgent = new IssueDetectionAgent('bedrock');
      expect(newAgent['expenseSchema']).toBeNull();
    });
  });

  describe('Integration: Full compliance workflow', () => {
    it('should analyze complete receipt against compliance rules', async () => {
      const complianceData = {
        country: 'USA',
        receipt_standards: {
          required_fields: ['vendor_name', 'total_amount', 'date', 'tax_id'],
        },
      };

      const extractedData = {
        vendor_name: 'Restaurant ABC',
        total_amount: 45.5,
        date_of_issue: '2024-01-15',
      };

      const complexIssuesResponse = {
        validation_result: {
          is_valid: false,
          issues_count: 3,
          issues: [
            {
              issue_type: 'Missing Required Field',
              field: 'tax_id',
              description: 'Supplier tax ID is required for amounts over $25',
              recommendation: 'Request updated receipt with tax ID',
              knowledge_base_reference: 'USA Expense Policy Section 3.2',
              confidence_score: 0.98,
            },
            {
              issue_type: 'Standards & Compliance | Fix Identified',
              field: 'receipt_number',
              description: 'Receipt number format invalid',
              recommendation: 'Receipt number should follow format: XXX-YYYY-NNNNN',
              knowledge_base_reference: 'Receipt Standards v2.0',
              confidence_score: 0.85,
            },
            {
              issue_type: 'Data Quality',
              field: 'vendor_address',
              description: 'Vendor address incomplete',
              recommendation: 'Full address including postal code required',
              knowledge_base_reference: 'Vendor Information Requirements',
              confidence_score: 0.72,
            },
          ],
          corrected_receipt: null,
          compliance_summary:
            '3 issues found: 1 missing field, 1 format error, 1 data quality issue. Manual review recommended.',
        },
        technical_details: {
          content_type: 'expense_receipt',
          country: 'USA',
          icp: 'corporate_standard',
          receipt_type: 'restaurant',
          issues_count: 3,
        },
      };

      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(complexIssuesResponse) },
        usage: { input_tokens: 400, output_tokens: 200 },
      });

      const result = await agent.analyzeCompliance('USA', 'restaurant', 'corporate_standard', complianceData, extractedData);

      // Verify comprehensive issue detection
      expect(result.validation_result.is_valid).toBe(false);
      expect(result.validation_result.issues_count).toBe(3);
      expect(result.validation_result.issues).toHaveLength(3);

      // Verify issue categorization
      const issueTypes = result.validation_result.issues.map((i) => i.issue_type);
      expect(issueTypes).toContain('Missing Required Field');
      expect(issueTypes).toContain('Data Quality');

      // Verify all issues have required fields
      result.validation_result.issues.forEach((issue) => {
        expect(issue).toHaveProperty('field');
        expect(issue).toHaveProperty('description');
        expect(issue).toHaveProperty('recommendation');
        expect(issue).toHaveProperty('confidence_score');
      });
    });
  });
});
