import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Version } from './version.entity';

interface ReceiptStandard {
  description: string;
  travelNonTravelBoth: 'Travel' | 'Non-Travel' | 'Both';
  expenseType: string;
  icpName: string;
  mandatoryOptional: 'Mandatory' | 'Optional';
  rule: string;
}

interface CompliancePolicyGrossUp {
  travelNonTravelBoth: 'Travel' | 'Non-Travel' | 'Both';
  expenseType: string;
  icpName: string;
  grossUp: 'Yes' | 'No';
  grossUpRule: string;
}

interface CompliancePolicyAdditionalInfo {
  travelNonTravelBoth: 'Travel' | 'Non-Travel' | 'Both';
  expenseType: string;
  icpName: string;
  additionalInfoRequired: 'Yes' | 'No';
  additionalInfoRule: string;
}

interface PolicyRules {
  receiptStandards: ReceiptStandard[];
  compliancePoliciesGrossUpRelated: CompliancePolicyGrossUp[];
  compliancePoliciesAdditionalInfoRelated: CompliancePolicyAdditionalInfo[];
}

@Entity('country_policies')
export class CountryPolicy {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'json' })
  rules: PolicyRules;

  @Column({ name: 'version_country_id' })
  versionCountryId: number;

  @Column({ name: 'version_id' })
  versionId: string;

  // Relationship to version (composite foreign key)
  @ManyToOne(() => Version, version => version.policies)
  @JoinColumn([
    { name: 'version_country_id', referencedColumnName: 'countryId' },
    { name: 'version_id', referencedColumnName: 'versionId' }
  ])
  version: Version;

  @Column({ name: 'createdAt', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updatedAt', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
