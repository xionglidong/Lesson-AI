import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn
} from 'typeorm';

@Entity({ name: 'exchange_records' })
export class ExchangeRecord {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  studentId!: string; // studentNo

  @Column({ type: 'varchar', length: 64 })
  studentName!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  prizeId!: string | null;

  @Column({ type: 'varchar', length: 128 })
  prizeName!: string;

  @Column({ type: 'int' })
  points!: number;

  @Column({ type: 'varchar', length: 16, nullable: true })
  gradeSnapshot!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  semesterSnapshot!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  termKey!: string | null;

  @Column({ type: 'datetime' })
  exchangeTime!: Date;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}
