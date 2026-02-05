import { filterComplianceByIcp, getFilterStats } from './compliance-filter.util';

describe('ComplianceFilterUtil', () => {
  describe('filterComplianceByIcp', () => {
    const mockComplianceData = {
      receiptStandards: [
        {
          required_data: 'Supplier business name',
          travel_non_travel_both: 'Both',
          expense_type: 'Hotel, Flight, Restaurant',
          icp_name: 'Atlas, Global People, goGlobal, Parakar',
          mandatory_optional: 'Mandatory',
          rule: 'Clear and readable receipts must be submitted',
        },
        {
          required_data: 'Worker or company name',
          travel_non_travel_both: 'Both',
          expense_type: 'Hotel, Flight, Restaurant',
          icp_name: 'Atlas',
          mandatory_optional: 'Mandatory',
          rule: 'The worker or the company name can appear on the invoice',
        },
        {
          required_data: 'ICP company details',
          travel_non_travel_both: 'Non-Travel',
          expense_type: 'Office supplies',
          icp_name: 'Global People',
          mandatory_optional: 'Mandatory',
          rule: 'Invoice must show Global People DE GmbH details',
        },
        {
          required_data: 'ICP company details',
          travel_non_travel_both: 'Non-Travel',
          expense_type: 'Office supplies',
          icp_name: 'goGlobal',
          mandatory_optional: 'Mandatory',
          rule: 'Invoice must show GoGlobal Germany GmbH details',
        },
      ],
      compliancePoliciesGrossUpRelated: [
        {
          travel_non_travel_both: 'Non-Travel',
          expense_type: 'Office supplies',
          icp_name: 'Atlas',
          gross_up: false,
          gross_up_rule: 'Office equipment is tax exempt',
        },
        {
          travel_non_travel_both: 'Non-Travel',
          expense_type: 'Telecommunications',
          icp_name: 'Atlas',
          gross_up: true,
          gross_up_rule: 'Phone/internet €20/month max tax-exempt',
        },
        {
          travel_non_travel_both: 'Non-Travel',
          expense_type: 'Office supplies',
          icp_name: 'Global People',
          gross_up: false,
          gross_up_rule: 'IT equipment that is company property is tax exempt',
        },
        {
          travel_non_travel_both: 'Travel',
          expense_type: 'Mileage',
          icp_name: 'Atlas, Global People',
          gross_up: false,
          gross_up_rule: 'Reimbursement rate €0.30 per km',
        },
      ],
      compliancePoliciesAdditionalInfoRelated: [
        {
          travel_non_travel_both: 'Both',
          expense_type: 'Hotel, Flight, Restaurant',
          icp_name: 'Atlas, Global People, goGlobal, Parakar',
          additional_info_required: true,
          additional_info_rule: 'Online copies are sufficient',
        },
        {
          travel_non_travel_both: 'Travel',
          expense_type: 'Mileage',
          icp_name: 'Atlas',
          additional_info_required: true,
          additional_info_rule: 'Mileage reimbursement requires providing a Fahrtenbuch',
        },
        {
          travel_non_travel_both: 'Travel',
          expense_type: 'Mileage',
          icp_name: 'Global People',
          additional_info_required: true,
          additional_info_rule: 'Worker will need to share a map with the relevant route',
        },
      ],
    };

    it('should filter compliance data for Atlas ICP', () => {
      const filtered = filterComplianceByIcp(mockComplianceData, 'Atlas');

      expect(filtered.receiptStandards).toHaveLength(2);
      expect(filtered.receiptStandards[0].icp_name).toContain('Atlas');
      expect(filtered.receiptStandards[1].icp_name).toBe('Atlas');

      expect(filtered.compliancePoliciesGrossUpRelated).toHaveLength(3);
      expect(filtered.compliancePoliciesAdditionalInfoRelated).toHaveLength(2);
    });

    it('should filter compliance data for Global People ICP', () => {
      const filtered = filterComplianceByIcp(mockComplianceData, 'Global People');

      expect(filtered.receiptStandards).toHaveLength(2);
      expect(filtered.receiptStandards[0].icp_name).toContain('Global People');
      expect(filtered.receiptStandards[1].icp_name).toBe('Global People');

      expect(filtered.compliancePoliciesGrossUpRelated).toHaveLength(2);
      expect(filtered.compliancePoliciesAdditionalInfoRelated).toHaveLength(2);
    });

    it('should filter compliance data for goGlobal ICP', () => {
      const filtered = filterComplianceByIcp(mockComplianceData, 'goGlobal');

      expect(filtered.receiptStandards).toHaveLength(2);
      expect(filtered.receiptStandards[0].icp_name).toContain('goGlobal');
      expect(filtered.receiptStandards[1].icp_name).toBe('goGlobal');

      // goGlobal appears in "goGlobal, Parakar" rules, so it should be included
      expect(filtered.compliancePoliciesGrossUpRelated).toHaveLength(0);
      expect(filtered.compliancePoliciesAdditionalInfoRelated).toHaveLength(1);
    });

    it('should handle case-insensitive ICP matching', () => {
      const filtered1 = filterComplianceByIcp(mockComplianceData, 'atlas');
      const filtered2 = filterComplianceByIcp(mockComplianceData, 'ATLAS');
      const filtered3 = filterComplianceByIcp(mockComplianceData, 'Atlas');

      expect(filtered1.receiptStandards).toHaveLength(2);
      expect(filtered2.receiptStandards).toHaveLength(2);
      expect(filtered3.receiptStandards).toHaveLength(2);
    });

    it('should handle ICP with extra whitespace', () => {
      const filtered = filterComplianceByIcp(mockComplianceData, ' Atlas ');

      expect(filtered.receiptStandards).toHaveLength(2);
    });

    it('should return empty arrays for non-existent ICP', () => {
      const filtered = filterComplianceByIcp(mockComplianceData, 'NonExistentICP');

      expect(filtered.receiptStandards).toHaveLength(0);
      expect(filtered.compliancePoliciesGrossUpRelated).toHaveLength(0);
      expect(filtered.compliancePoliciesAdditionalInfoRelated).toHaveLength(0);
    });

    it('should handle null or undefined compliance data', () => {
      const filtered1 = filterComplianceByIcp(null, 'Atlas');
      const filtered2 = filterComplianceByIcp(undefined, 'Atlas');

      expect(filtered1).toBeNull();
      expect(filtered2).toBeUndefined();
    });

    it('should handle empty ICP string', () => {
      const filtered = filterComplianceByIcp(mockComplianceData, '');

      expect(filtered.receiptStandards).toHaveLength(0);
      expect(filtered.compliancePoliciesGrossUpRelated).toHaveLength(0);
      expect(filtered.compliancePoliciesAdditionalInfoRelated).toHaveLength(0);
    });

    it('should preserve other fields in compliance data', () => {
      const dataWithExtraFields = {
        ...mockComplianceData,
        customField: 'custom value',
        anotherField: 123,
      };

      const filtered = filterComplianceByIcp(dataWithExtraFields, 'Atlas');

      expect(filtered.customField).toBe('custom value');
      expect(filtered.anotherField).toBe(123);
    });

    it('should handle camelCase icp field names', () => {
      const camelCaseData = {
        receiptStandards: [
          {
            required_data: 'Test',
            icpName: 'Atlas',
            rule: 'Test rule',
          },
          {
            required_data: 'Test 2',
            icpName: 'Global People',
            rule: 'Test rule 2',
          },
        ],
      };

      const filtered = filterComplianceByIcp(camelCaseData, 'Atlas');

      expect(filtered.receiptStandards).toHaveLength(1);
      expect(filtered.receiptStandards[0].icpName).toBe('Atlas');
    });
  });

  describe('getFilterStats', () => {
    const original: any = {
      receiptStandards: [1, 2, 3, 4, 5],
      compliancePoliciesGrossUpRelated: [1, 2, 3],
      compliancePoliciesAdditionalInfoRelated: [1, 2],
    };

    const filtered: any = {
      receiptStandards: [1, 2],
      compliancePoliciesGrossUpRelated: [1],
      compliancePoliciesAdditionalInfoRelated: [1, 2],
    };

    it('should return correct statistics', () => {
      const stats = getFilterStats(original, filtered);

      expect(stats.receiptStandards.original).toBe(5);
      expect(stats.receiptStandards.filtered).toBe(2);
      expect(stats.grossUpPolicies.original).toBe(3);
      expect(stats.grossUpPolicies.filtered).toBe(1);
      expect(stats.additionalInfoPolicies.original).toBe(2);
      expect(stats.additionalInfoPolicies.filtered).toBe(2);
    });

    it('should handle missing arrays', () => {
      const emptyOriginal: any = {};
      const emptyFiltered: any = {};

      const stats = getFilterStats(emptyOriginal, emptyFiltered);

      expect(stats.receiptStandards.original).toBe(0);
      expect(stats.receiptStandards.filtered).toBe(0);
      expect(stats.grossUpPolicies.original).toBe(0);
      expect(stats.grossUpPolicies.filtered).toBe(0);
      expect(stats.additionalInfoPolicies.original).toBe(0);
      expect(stats.additionalInfoPolicies.filtered).toBe(0);
    });
  });
});
