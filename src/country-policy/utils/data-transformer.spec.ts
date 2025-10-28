import 'reflect-metadata';
import { DataTransformer } from './data-transformer';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs for testing
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('DataTransformer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadCountryData', () => {
    it('should load and validate country data successfully', async () => {
      const mockData = {
        receiptStandards: [
          {
            required_data: 'Transaction date',
            travel_non_travel_both: 'Both',
            expense_type: 'Hotel',
            icp_name: 'Test Company',
            mandatory_optional: 'Mandatory',
            rule: 'Date must be visible'
          }
        ],
        compliancePoliciesGrossUpRelated: [],
        compliancePoliciesAdditionalInfoRelated: []
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockData));

      const result = await DataTransformer.loadCountryData('Belgium');

      expect(result).toBeDefined();
      expect(result.receiptStandards).toHaveLength(1);
      expect(mockFs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('belgium.json')
      );
    });

    it('should throw error when country file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(DataTransformer.loadCountryData('NonExistent')).rejects.toThrow(
        'Country seed file not found'
      );
    });

    it('should throw error when validation fails', async () => {
      const invalidData = {
        receiptStandards: [
          {
            // Missing required fields
            required_data: 'Date'
          }
        ],
        compliancePoliciesGrossUpRelated: [],
        compliancePoliciesAdditionalInfoRelated: []
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(invalidData));

      await expect(DataTransformer.loadCountryData('Invalid')).rejects.toThrow(
        'Validation failed'
      );
    });
  });

  describe('transformSeedToEntityFormat', () => {
    it('should transform seed data to entity format', () => {
      const seedData = {
        receiptStandards: [
          {
            required_data: 'Transaction date',
            travel_non_travel_both: 'Both' as const,
            expense_type: 'Hotel',
            icp_name: 'Test Company',
            mandatory_optional: 'Mandatory' as const,
            rule: 'Date must be visible'
          }
        ],
        compliancePoliciesGrossUpRelated: [
          {
            travel_non_travel_both: 'Travel' as const,
            expense_type: 'Flight',
            icp_name: 'Test Company',
            gross_up: true,
            gross_up_rule: 'Tax exempt'
          }
        ],
        compliancePoliciesAdditionalInfoRelated: [
          {
            travel_non_travel_both: 'Both' as const,
            expense_type: 'All',
            icp_name: 'Test Company',
            additional_info_required: true,
            additional_info_rule: 'Business purpose required'
          }
        ]
      } as any;

      const result = DataTransformer.transformSeedToEntityFormat(seedData);

      expect(result.receiptStandards).toHaveLength(1);
      expect(result.receiptStandards[0].description).toBe('Transaction date');
      expect(result.compliancePoliciesGrossUpRelated[0].grossUp).toBe('Yes');
      expect(result.compliancePoliciesAdditionalInfoRelated[0].additionalInfoRequired).toBe('Yes');
    });
  });

  describe('getAvailableCountries', () => {
    it('should return list of available countries', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        'belgium.json',
        'france.json',
        'germany.json',
        'other-file.txt'
      ] as any);

      const result = DataTransformer.getAvailableCountries();

      expect(result).toEqual(['Belgium', 'France', 'Germany']);
      expect(result).not.toContain('Other-file');
    });

    it('should throw error when seed directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => DataTransformer.getAvailableCountries()).toThrow(
        'Country seed directory not found'
      );
    });
  });

  describe('generateVersionId', () => {
    it('should generate version ID in correct format', () => {
      const mockDate = new Date('2024-01-15');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const versionId = DataTransformer.generateVersionId();

      expect(versionId).toMatch(/^v\d{4}\.\d{2}\.\d{2}$/);
      expect(versionId).toBe('v2024.01.15');

      (global.Date as any).mockRestore();
    });
  });
});
