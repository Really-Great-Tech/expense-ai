import { Column, Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { CountryPolicy } from './country-policy.entity';
import { Version } from './version.entity';
import { Datasource } from './datasource.entity';

@Entity('countries')
@Index(['name'], { unique: true })
@Index(['code'])
@Index(['active'])
export class Country {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  code: string;

  @Column({ default: true })
  active: boolean;

  @Column({ name: 'active_policy_id', nullable: true })
  activePolicyId: number;

  // Relationship to active policy
  @OneToOne(() => CountryPolicy, { nullable: true })
  @JoinColumn({ name: 'active_policy_id' })
  activePolicy: CountryPolicy;

  // Relationship to versions
  @OneToMany(() => Version, version => version.country)
  versions: Version[];

  // Relationship to datasources
  @OneToMany(() => Datasource, datasource => datasource.country)
  datasources: Datasource[];

  // Note: ExpenseDocument relationship is defined in ExpenseDocument entity to avoid circular imports

  @Column({ name: 'createdAt', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updatedAt', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  // Virtual methods for country management service
  isCountryActive(): boolean {
    return this.active;
  }

  getDisplayName(): string {
    return this.code ? `${this.name} (${this.code})` : this.name;
  }
}
