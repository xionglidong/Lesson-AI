import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnswerRecord } from '../entities/answer-record.entity';
import { User } from '../entities/user.entity';

function formatDateTime(input: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())} ${pad(input.getHours())}:${pad(input.getMinutes())}:${pad(input.getSeconds())}`;
}

interface SubmitPayload {
  paperId: string;
  answers: (string | null)[];
  score: number;
  totalPoints: number;
  timeElapsed?: number;
  fillInBlankStudentImage?: string | null;
  fillInBlankScore?: number | null;
  fillInBlankDetails?: (boolean | null)[] | null;
}

function normalizeGrade(grade: string | null | undefined): 'grade1' | 'grade2' | 'grade3' | null {
  if (!grade) return null;
  const raw = String(grade).trim().toLowerCase();
  if (raw === 'grade1' || raw === 'grade2' || raw === 'grade3') return raw;
  if (String(grade).includes('高一')) return 'grade1';
  if (String(grade).includes('高二')) return 'grade2';
  if (String(grade).includes('高三')) return 'grade3';
  return null;
}

function buildTermKey(grade: string | null | undefined, semester: string | null | undefined): string | null {
  const normalizedGrade = normalizeGrade(grade);
  if (!normalizedGrade) return null;
  const normalizedSemester = semester === '下学期' ? '下学期' : '上学期';
  return `${normalizedGrade}:${normalizedSemester}`;
}

@Injectable()
export class AnswerService {
  constructor(
    @InjectRepository(AnswerRecord) private answers: Repository<AnswerRecord>,
    @InjectRepository(User) private users: Repository<User>
  ) {}

  async submit(studentNo: string, studentName: string, payload: SubmitPayload) {
    const existing = await this.answers.find({ where: { studentId: studentNo, paperId: payload.paperId } });
    const isFirstSubmission = existing.length === 0;
    const user = await this.users.findOne({ where: { role: 'student', studentNo } });
    const gradeSnapshot = user?.grade || null;
    const semesterSnapshot = user?.semester || '上学期';
    const termKey = buildTermKey(gradeSnapshot, semesterSnapshot);

    const record = this.answers.create({
      studentId: studentNo,
      studentName,
      paperId: payload.paperId,
      answers: payload.answers || [],
      score: payload.score,
      gradeSnapshot,
      semesterSnapshot,
      termKey,
      totalPoints: payload.totalPoints || null,
      submitTime: new Date(),
      timeElapsed: payload.timeElapsed || null,
      isFirstSubmission: isFirstSubmission ? 1 : 0,
      fillInBlankStudentImage: payload.fillInBlankStudentImage || null,
      fillInBlankScore: payload.fillInBlankScore || 0,
      fbJudgments: payload.fillInBlankDetails || null
    });

    await this.answers.save(record);

    let updatedPoints: number | null = null;
    if (isFirstSubmission && user) {
      user.points = (user.points || 0) + payload.score;
      user.lastUpdate = new Date();
      await this.users.save(user);
      updatedPoints = user.points;
    }

    const payloadRecord = {
      ...record,
      submitTime: formatDateTime(record.submitTime),
      fillInBlankDetails: record.fbJudgments
    };
    return { record: payloadRecord, isFirstSubmission, updatedPoints };
  }
}
