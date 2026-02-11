import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn
} from 'typeorm';

@Entity({ name: 'answer_records' })
export class AnswerRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  studentId!: string; // studentNo

  @Column({ type: 'varchar', length: 64 })
  studentName!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  paperId!: string;

  @Column({ type: 'json', nullable: true })
  answers!: (string | null)[] | null;

  @Column({ type: 'int' })
  score!: number;

  @Column({ type: 'int', nullable: true })
  totalPoints!: number | null;

  @Column({ type: 'datetime' })
  submitTime!: Date;

  @Column({ type: 'int', nullable: true })
  timeElapsed!: number | null;

  @Column({ type: 'tinyint', default: 1 })
  isFirstSubmission!: number;

  @Column({ type: 'longtext', nullable: true })
  fillInBlankStudentImage!: string | null;

  @Column({ type: 'int', nullable: true })
  fillInBlankScore!: number | null;

  @Column({ type: 'json', nullable: true })
  fbJudgments!: (boolean | null)[] | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}
