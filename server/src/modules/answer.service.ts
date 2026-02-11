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

@Injectable()
export class AnswerService {
  constructor(
    @InjectRepository(AnswerRecord) private answers: Repository<AnswerRecord>,
    @InjectRepository(User) private users: Repository<User>
  ) {}

  async submit(studentNo: string, studentName: string, payload: SubmitPayload) {
    const existing = await this.answers.find({ where: { studentId: studentNo, paperId: payload.paperId } });
    const isFirstSubmission = existing.length === 0;

    const record = this.answers.create({
      studentId: studentNo,
      studentName,
      paperId: payload.paperId,
      answers: payload.answers || [],
      score: payload.score,
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
    if (isFirstSubmission) {
      const user = await this.users.findOne({ where: { role: 'student', studentNo } });
      if (user) {
        user.points = (user.points || 0) + payload.score;
        user.lastUpdate = new Date();
        await this.users.save(user);
        updatedPoints = user.points;
      }
    }

    const payloadRecord = {
      ...record,
      submitTime: formatDateTime(record.submitTime),
      fillInBlankDetails: record.fbJudgments
    };
    return { record: payloadRecord, isFirstSubmission, updatedPoints };
  }
}
