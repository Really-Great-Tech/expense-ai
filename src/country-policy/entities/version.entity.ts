import { Column, Entity, PrimaryColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Country } from './country.entity';
import { CountryPolicy } from './country-policy.entity';
import { Datasource } from './datasource.entity';

@Entity('versions')
export class Version {
  @PrimaryColumn({ name: 'country_id' })
  countryId: number;

  @PrimaryColumn({ name: 'version_id' })
  versionId: string;

  // Relationship to country
  @ManyToOne(() => Country, country => country.versions)
  @JoinColumn({ name: 'country_id' })
  country: Country;

  // Relationship to country policies
  @OneToMany(() => CountryPolicy, policy => policy.version)
  policies: CountryPolicy[];

  // Relationship to datasources
  @OneToMany(() => Datasource, datasource => datasource.version)
  datasources: Datasource[];

  @Column({ name: 'createdAt', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updatedAt', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
