import { validateIssuesAgainstCompliance, getComplianceStats } from './issue-validation.util';

describe('Issue Validation Utility', () => {
  const mockComplianceData = {
    receiptStandards: [
      {
        rule_id: 'RS001',
        description: 'VAT number required for all EU receipts over €50',
        applicable_icps: ['Global People'],
      },
      {
        rule_id: 'RS002',
        description: 'Itemized receipts required for meals over €25',
        applicable_icps: ['Global People', 'Finance'],
      },
    ],
    compliancePoliciesGrossUpRelated: [
      {
        rule_id: 'GP001',
        description: 'Phone expenses limited to €20/month, excess will be grossed up',
        applicable_icps: ['Global People'],
      },
    ],
  };

  describe('validateIssuesAgainstCompliance', () => {
    it('should validate issue with exact quote from compliance data', () => {
      const issues = [
        {
          issue_type: 'Required Details Missing',
          field: 'supplier_vat_number',
          description: 'VAT number is missing',
          recommendation: 'Contact supplier for VAT number',
          knowledge_base_reference: 'VAT number required for all EU receipts over €50',
          confidence_score: 0.9,
        },
      ];

      const result = validateIssuesAgainstCompliance(issues, mockComplianceData);

      expect(result.validIssues).toHaveLength(1);
      expect(result.invalidIssues).toHaveLength(0);
      expect(result.metrics.hallucinationRate).toBe(0);
    });

    it('should validate issue with partial quote from compliance data', () => {
      const issues = [
        {
          issue_type: 'Required Details Missing',
          field: 'line_items',
          description: 'Receipt not itemized',
          recommendation: 'Request itemized receipt',
          knowledge_base_reference: 'Itemized receipts required for meals',
          confidence_score: 0.85,
        },
      ];

      const result = validateIssuesAgainstCompliance(issues, mockComplianceData);

      expect(result.validIssues).toHaveLength(1);
      expect(result.invalidIssues).toHaveLength(0);
    });

    it('should filter issue with made-up reference', () => {
      const issues = [
        {
          issue_type: 'Required Details Missing',
          field: 'employee_signature',
          description: 'Missing employee signature',
          recommendation: 'Get employee to sign',
          knowledge_base_reference: 'Employee signature required on all receipts',
          confidence_score: 0.8,
        },
      ];

      const result = validateIssuesAgainstCompliance(issues, mockComplianceData);

      expect(result.validIssues).toHaveLength(0);
      expect(result.invalidIssues).toHaveLength(1);
      expect(result.invalidIssues[0].reason).toBe('Reference not found in compliance data');
      expect(result.metrics.hallucinationRate).toBe(1.0);
    });

    it('should filter issue with generic reference', () => {
      const issues = [
        {
          issue_type: 'Required Details Missing',
          field: 'receipt_format',
          description: 'Receipt format incorrect',
          recommendation: 'Use standard format',
          knowledge_base_reference: 'Standard receipt requirements',
          confidence_score: 0.7,
        },
      ];

      const result = validateIssuesAgainstCompliance(issues, mockComplianceData);

      expect(result.validIssues).toHaveLength(0);
      expect(result.invalidIssues).toHaveLength(1);
    });

    it('should filter issue with empty reference', () => {
      const issues = [
        {
          issue_type: 'Required Details Missing',
          field: 'some_field',
          description: 'Some issue',
          recommendation: 'Fix it',
          knowledge_base_reference: '',
          confidence_score: 0.5,
        },
      ];

      const result = validateIssuesAgainstCompliance(issues, mockComplianceData);

      expect(result.validIssues).toHaveLength(0);
      expect(result.invalidIssues).toHaveLength(1);
      expect(result.invalidIssues[0].reason).toBe('Empty or missing knowledge_base_reference');
    });

    it('should handle empty issues array', () => {
      const result = validateIssuesAgainstCompliance([], mockComplianceData);

      expect(result.validIssues).toHaveLength(0);
      expect(result.invalidIssues).toHaveLength(0);
      expect(result.metrics.totalIssues).toBe(0);
      expect(result.metrics.hallucinationRate).toBe(0);
    });

    it('should handle mix of valid and invalid issues', () => {
      const issues = [
        {
          issue_type: 'Required Details Missing',
          field: 'supplier_vat_number',
          description: 'VAT number missing',
          recommendation: 'Get VAT number',
          knowledge_base_reference: 'VAT number required for all EU receipts over €50',
          confidence_score: 0.9,
        },
        {
          issue_type: 'Required Details Missing',
          field: 'manager_approval',
          description: 'Missing manager approval',
          recommendation: 'Get approval',
          knowledge_base_reference: 'Manager approval required for all expenses',
          confidence_score: 0.8,
        },
        {
          issue_type: 'Potential Gross-Up',
          field: 'phone_expense',
          description: 'Phone expense exceeds limit',
          recommendation: 'Will be grossed up',
          knowledge_base_reference: 'Phone expenses limited to €20/month',
          confidence_score: 0.95,
        },
      ];

      const result = validateIssuesAgainstCompliance(issues, mockComplianceData);

      expect(result.validIssues).toHaveLength(2); // VAT and phone expense
      expect(result.invalidIssues).toHaveLength(1); // manager approval
      expect(result.metrics.totalIssues).toBe(3);
      expect(result.metrics.hallucinationRate).toBeCloseTo(0.333, 2);
    });

    it('should handle paraphrased references with word overlap', () => {
      const issues = [
        {
          issue_type: 'Required Details Missing',
          field: 'line_items',
          description: 'Not itemized',
          recommendation: 'Get itemized version',
          knowledge_base_reference: 'For meals exceeding €25, itemized receipts are required',
          confidence_score: 0.85,
        },
      ];

      const result = validateIssuesAgainstCompliance(issues, mockComplianceData);

      expect(result.validIssues).toHaveLength(1);
      expect(result.invalidIssues).toHaveLength(0);
    });
  });

  describe('getComplianceStats', () => {
    it('should return correct statistics', () => {
      const stats = getComplianceStats(mockComplianceData);

      expect(stats.totalSections).toBe(2);
      expect(stats.totalRules).toBe(3);
      expect(stats.sections).toContain('receiptStandards');
      expect(stats.sections).toContain('compliancePoliciesGrossUpRelated');
    });

    it('should handle empty compliance data', () => {
      const stats = getComplianceStats({});

      expect(stats.totalSections).toBe(0);
      expect(stats.totalRules).toBe(0);
      expect(stats.sections).toEqual([]);
    });
  });
});
