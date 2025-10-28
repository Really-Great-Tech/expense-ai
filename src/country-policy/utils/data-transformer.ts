import * as fs from 'fs';
import * as path from 'path';
import { CountrySeedDataDto, SeedReceiptStandardDto, SeedComplianceGrossUpDto, SeedComplianceAdditionalInfoDto } from '../dto/seed-data.dto';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

export interface TransformedPolicyRules {
  receiptStandards: {
    description: string;
    travelNonTravelBoth: 'Travel' | 'Non-Travel' | 'Both';
    expenseType: string;
    icpName: string;
    mandatoryOptional: 'Mandatory' | 'Optional';
    rule: string;
  }[];
  compliancePoliciesGrossUpRelated: {
    travelNonTravelBoth: 'Travel' | 'Non-Travel' | 'Both';
    expenseType: string;
    icpName: string;
    grossUp: 'Yes' | 'No';
    grossUpRule: string;
  }[];
  compliancePoliciesAdditionalInfoRelated: {
    travelNonTravelBoth: 'Travel' | 'Non-Travel' | 'Both';
    expenseType: string;
    icpName: string;
    additionalInfoRequired: 'Yes' | 'No';
    additionalInfoRule: string;
  }[];
}

export class DataTransformer {
  /**
   * Load and validate country seed data from JSON file
   */
  static async loadCountryData(countryName: string): Promise<CountrySeedDataDto> {
    const filePath = path.resolve(process.cwd(), 'country_seed', `${countryName.toLowerCase()}.json`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Country seed file not found: ${filePath}`);
    }

    const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const seedData = plainToClass(CountrySeedDataDto, rawData);
    
    const errors = await validate(seedData);
    if (errors.length > 0) {
      throw new Error(`Validation failed for ${countryName}: ${JSON.stringify(errors)}`);
    }
    
    return seedData;
  }

  /**
   * Transform seed data to entity-compatible format
   */
  static transformSeedToEntityFormat(seedData: CountrySeedDataDto): TransformedPolicyRules {
    return {
      receiptStandards: seedData.receiptStandards.map(item => ({
        description: item.required_data,
        travelNonTravelBoth: item.travel_non_travel_both,
        expenseType: item.expense_type,
        icpName: item.icp_name,
        mandatoryOptional: item.mandatory_optional,
        rule: item.rule,
      })),
      compliancePoliciesGrossUpRelated: seedData.compliancePoliciesGrossUpRelated.map(item => ({
        travelNonTravelBoth: item.travel_non_travel_both,
        expenseType: item.expense_type,
        icpName: item.icp_name,
        grossUp: item.gross_up ? 'Yes' : 'No',
        grossUpRule: item.gross_up_rule,
      })),
      compliancePoliciesAdditionalInfoRelated: seedData.compliancePoliciesAdditionalInfoRelated.map(item => ({
        travelNonTravelBoth: item.travel_non_travel_both,
        expenseType: item.expense_type,
        icpName: item.icp_name,
        additionalInfoRequired: item.additional_info_required ? 'Yes' : 'No',
        additionalInfoRule: item.additional_info_rule,
      })),
    };
  }

  /**
   * Get all available country names from seed directory
   */
  static getAvailableCountries(): string[] {
    const seedDir = path.resolve(process.cwd(), 'country_seed');
    
    if (!fs.existsSync(seedDir)) {
      throw new Error('Country seed directory not found');
    }

    return fs.readdirSync(seedDir)
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
      .map(name => name.charAt(0).toUpperCase() + name.slice(1)); // Capitalize first letter
  }

  /**
   * Generate a standard version ID based on current date
   */
  static generateVersionId(): string {
    const now = new Date();
    return `v${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  }
}
