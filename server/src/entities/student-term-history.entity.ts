import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn
} from 'typeorm';

@Entity({ name: 'student_term_histories' })
export class StudentTermHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  studentId!: string; // studentNo

  @Column({ type: 'varchar', length: 16, nullable: true })
  grade!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: false, default: '上学期' })
  semester!: string;

  @Column({ type: 'datetime' })
  startAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  endAt!: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}
