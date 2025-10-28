import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Country } from './country.entity';
import { Version } from './version.entity';

@Entity('datasources')
export class Datasource {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: ['url', 'file', 'csv', 'docx'] })
  type: 'url' | 'file' | 'csv' | 'docx';

  @Column()
  source: string; // URL, S3 link, or file path

  @Column({ type: 'text', nullable: true })
  content: string; // Raw content storage

  @Column({ name: 'country_id' })
  countryId: number;

  @Column({ name: 'version_country_id' })
  versionCountryId: number;

  @Column({ name: 'version_id' })
  versionId: string;

  // Relationship to country
  @ManyToOne(() => Country, country => country.datasources)
  @JoinColumn({ name: 'country_id' })
  country: Country;

  // Relationship to version (composite foreign key)
  @ManyToOne(() => Version, version => version.datasources)
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
