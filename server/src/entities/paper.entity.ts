import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity({ name: 'papers' })
export class Paper {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 16 })
  grade!: string; // grade1/grade2/grade3

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'int' })
  questionCount!: number;

  @Column({ type: 'int' })
  singlePoints!: number;

  @Column({ type: 'int' })
  totalPoints!: number;

  @Column({ type: 'json', nullable: true })
  answers!: string[] | null;

  @Column({ type: 'json', nullable: true })
  options!: Record<string, string> | null;

  @Column({ type: 'int', nullable: true })
  fillInBlankCount!: number | null;

  @Column({ type: 'int', nullable: true })
  fillInBlankPoints!: number | null;

  @Column({ type: 'longtext', nullable: true })
  fillInBlankAnswerImage!: string | null;

  @Column({ type: 'json', nullable: true })
  videos!: (string | null)[] | null;

  @Column({ type: 'json', nullable: true })
  fillBlankVideos!: (string | null)[] | null;

  @Column({ type: 'datetime', nullable: true })
  createTime!: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}
