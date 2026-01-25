
import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Version } from './version.entity';

/**
 * Policy metadata from the source document
 */
export interface PolicyMetadata {
  title?: string;
  effectiveDate?: string;
  version?: string;
  sourceFile?: string;
  parsedDate?: string;
  parserUsed?: string;
}

@Entity('country_policies')
export class CountryPolicy {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Full policy document in markdown format with [[PAGE_X]] markers
   * for citation and verification purposes.
   */
  @Column({ name: 'policy_markdown', type: 'longtext' })
  policyMarkdown: string;

  /**
   * Number of pages in the source document
   */
  @Column({ name: 'page_count', type: 'int', default: 0 })
  pageCount: number;

  /**
   * List of ICP (Internal Control Policy) identifiers found in the document
   */
  @Column({ type: 'json' })
  icps: string[];

  /**
   * Metadata about the policy document source and parsing
   */
  @Column({ name: 'policy_metadata', type: 'json', nullable: true })
  policyMetadata: PolicyMetadata;

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
