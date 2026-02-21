import { Body, Controller, Get, Inject, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './guards/auth.guard';
import { Roles } from './guards/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { AnswerService } from './answer.service';
import { ExchangeService } from './exchange.service';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { AnswerRecord } from '../entities/answer-record.entity';
import { ExchangeRecord } from '../entities/exchange-record.entity';
import { Paper } from '../entities/paper.entity';
import { StudentTermHistory } from '../entities/student-term-history.entity';

@Controller('api/student')
@UseGuards(AuthGuard, RolesGuard)
@Roles('student')
export class StudentController {
  constructor(
    @Inject(AnswerService) private answers: AnswerService,
    @Inject(ExchangeService) private exchanges: ExchangeService,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(AnswerRecord) private answerRepo: Repository<AnswerRecord>,
    @InjectRepository(ExchangeRecord) private exchangeRepo: Repository<ExchangeRecord>,
    @InjectRepository(Paper) private paperRepo: Repository<Paper>,
    @InjectRepository(StudentTermHistory) private termHistoryRepo: Repository<StudentTermHistory>
  ) {}

  private readonly sixTermKeys = [
    'grade1:上学期',
    'grade1:下学期',
    'grade2:上学期',
    'grade2:下学期',
    'grade3:上学期',
    'grade3:下学期'
  ] as const;

  private parseSubmitTime(input: Date | string) {
    if (!input) return null;
    const dt = input instanceof Date ? input : new Date(String(input).replace(/-/g, '/'));
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  }

  private getStepDays(period: string) {
    if (period === 'week') return 7;
    return 30;
  }

  private normalizeGrade(grade: string | null | undefined): 'grade1' | 'grade2' | 'grade3' | null {
    if (!grade) return null;
    const raw = String(grade).trim().toLowerCase();
    if (raw === 'grade1' || raw === 'grade2' || raw === 'grade3') return raw;
    if (String(grade).includes('高一')) return 'grade1';
    if (String(grade).includes('高二')) return 'grade2';
    if (String(grade).includes('高三')) return 'grade3';
    return null;
  }

  private normalizeSemester(semester: string | null | undefined): '上学期' | '下学期' {
    return semester === '下学期' ? '下学期' : '上学期';
  }

  private buildTermKey(grade: string | null | undefined, semester: string | null | undefined): (typeof this.sixTermKeys)[number] | null {
    const normalizedGrade = this.normalizeGrade(grade);
    if (!normalizedGrade) return null;
    return `${normalizedGrade}:${this.normalizeSemester(semester)}` as (typeof this.sixTermKeys)[number];
  }

  private termLabel(termKey: (typeof this.sixTermKeys)[number]) {
    const [grade, semester] = termKey.split(':');
    const gradeLabel = grade === 'grade1' ? '高一' : grade === 'grade2' ? '高二' : '高三';
    return `${gradeLabel}${semester === '上学期' ? '上' : '下'}`;
  }

  private async ensureOpenHistory(studentNo: string, grade: string | null | undefined, semester: string | null | undefined, now: Date) {
    const openHistory = await this.termHistoryRepo.findOne({
      where: { studentId: studentNo, endAt: IsNull() },
      order: { startAt: 'DESC' }
    });
    if (!openHistory) {
      await this.termHistoryRepo.save(
        this.termHistoryRepo.create({
          studentId: studentNo,
          grade: grade || null,
          semester: this.normalizeSemester(semester),
          startAt: now,
          endAt: null
        })
      );
    }
  }

  private async backfillTermSnapshots(studentNo: string, student: User | null) {
    const records = await this.answerRepo.find({ where: { studentId: studentNo } });
    if (!records.length) return;
    const histories = await this.termHistoryRepo.find({
      where: { studentId: studentNo },
      order: { startAt: 'ASC' }
    });
    const patched: AnswerRecord[] = [];
    for (const record of records) {
      if (record.termKey && record.gradeSnapshot && record.semesterSnapshot) continue;
      const submitAt = record.submitTime ? new Date(record.submitTime) : new Date(record.createdAt);
      const hit = histories.find((item) => item.startAt <= submitAt && (!item.endAt || item.endAt >= submitAt));
      const grade = record.gradeSnapshot || hit?.grade || student?.grade || null;
      const semester = record.semesterSnapshot || hit?.semester || student?.semester || '上学期';
      record.gradeSnapshot = grade;
      record.semesterSnapshot = this.normalizeSemester(semester);
      record.termKey = this.buildTermKey(grade, semester);
      patched.push(record);
    }
    if (patched.length) await this.answerRepo.save(patched);
  }

  private buildBuckets(period: string, now: Date) {
    const stepDays = this.getStepDays(period);
    const pointCount = 12;
    const endDate = new Date(now);
    endDate.setHours(0, 0, 0, 0);
    const buckets: Array<{ label: string; start: Date; end: Date }> = [];

    for (let i = pointCount - 1; i >= 0; i--) {
      const point = new Date(endDate);
      point.setDate(endDate.getDate() - i * stepDays);
      const rangeEnd = new Date(point);
      rangeEnd.setHours(23, 59, 59, 999);
      const rangeStart = new Date(point);
      rangeStart.setDate(point.getDate() - stepDays + 1);
      rangeStart.setHours(0, 0, 0, 0);
      const label = `${point.getFullYear()}-${String(point.getMonth() + 1).padStart(2, '0')}-${String(point.getDate()).padStart(2, '0')}`;
      buckets.push({ label, start: rangeStart, end: rangeEnd });
    }
    return buckets;
  }

  private calcCorrectness(record: AnswerRecord, paperMap: Record<string, Paper>) {
    const paper = paperMap[record.paperId];
    const choiceAnswers = Array.isArray(record.answers) ? record.answers : [];
    const stdAnswers = Array.isArray(paper?.answers) ? paper.answers : [];
    let choiceCorrect = 0;
    choiceAnswers.forEach((ans, index) => {
      if (ans && stdAnswers[index] && ans === stdAnswers[index]) choiceCorrect += 1;
    });

    const fbList = Array.isArray(record.fbJudgments) ? record.fbJudgments : [];
    let fbCorrect = 0;
    fbList.forEach((item) => {
      if (item === true) fbCorrect += 1;
    });
    return { questions: choiceAnswers.length + fbList.length, correct: choiceCorrect + fbCorrect };
  }

  @Post('submit')
  async submit(@Req() req: any, @Body() body: any) {
    const user = req.user as { studentNo: string; name: string };
    return this.answers.submit(user.studentNo, user.name, body);
  }

  @Post('exchange')
  async exchange(@Req() req: any, @Body() body: { prizeId: string }) {
    const user = req.user as { studentNo: string; name: string };
    return this.exchanges.redeem(user.studentNo, user.name, body.prizeId);
  }

  @Get('profile')
  async profile(@Req() req: any) {
    const user = req.user as { studentNo: string };
    const entity = await this.users.findOne({ where: { role: 'student', studentNo: user.studentNo } });
    if (!entity) return null;
    return { studentNo: entity.studentNo, name: entity.name, grade: entity.grade, semester: entity.semester, points: entity.points };
  }

  @Get('answers')
  async answersList(@Req() req: any, @Query('paperId') paperId?: string) {
    const user = req.user as { studentNo: string };
    const where: any = { studentId: user.studentNo };
    if (paperId) where.paperId = paperId;
    return this.answerRepo.find({ where });
  }

  @Get('exchanges')
  async exchangeList(@Req() req: any) {
    const user = req.user as { studentNo: string };
    return this.exchangeRepo.find({ where: { studentId: user.studentNo } });
  }

  @Get('semester-stats')
  async semesterStats(@Req() req: any) {
    const user = req.user as { studentNo: string };
    const student = await this.users.findOne({ where: { role: 'student', studentNo: user.studentNo } });

    if (!student) {
      return {
        studentNo: user.studentNo,
        terms: this.sixTermKeys.map((key) => ({
          termKey: key,
          termLabel: this.termLabel(key),
          questionCount: 0,
          paperCount: 0,
          accuracy: 0,
          earnedPoints: 0
        }))
      };
    }

    await this.ensureOpenHistory(user.studentNo, student.grade, student.semester, new Date());
    await this.backfillTermSnapshots(user.studentNo, student);

    const [papers, records] = await Promise.all([
      this.paperRepo.find(),
      this.answerRepo.find({ where: { studentId: user.studentNo } })
    ]);
    const paperMap: Record<string, Paper> = {};
    papers.forEach((paper) => {
      paperMap[paper.id] = paper;
    });

    const stats = new Map<string, { questionCount: number; correctCount: number; earnedPoints: number; paperIds: Set<string> }>();
    this.sixTermKeys.forEach((key) => {
      stats.set(key, { questionCount: 0, correctCount: 0, earnedPoints: 0, paperIds: new Set<string>() });
    });

    for (const record of records) {
      const termKey = this.buildTermKey(record.gradeSnapshot, record.semesterSnapshot) || (record.termKey as string | null);
      if (!termKey || !stats.has(termKey)) continue;
      const current = stats.get(termKey) as { questionCount: number; correctCount: number; earnedPoints: number; paperIds: Set<string> };
      const correctness = this.calcCorrectness(record, paperMap);
      current.questionCount += correctness.questions;
      current.correctCount += correctness.correct;

      if (Number(record.isFirstSubmission || 0) === 1) {
        if (record.paperId) current.paperIds.add(record.paperId);
        current.earnedPoints += Number(record.score || 0);
      }
    }

    return {
      studentNo: user.studentNo,
      studentName: student.name,
      terms: this.sixTermKeys.map((key) => {
        const item = stats.get(key) as { questionCount: number; correctCount: number; earnedPoints: number; paperIds: Set<string> };
        return {
          termKey: key,
          termLabel: this.termLabel(key),
          questionCount: item.questionCount,
          paperCount: item.paperIds.size,
          accuracy: item.questionCount > 0 ? Number(((item.correctCount / item.questionCount) * 100).toFixed(2)) : 0,
          earnedPoints: item.earnedPoints
        };
      })
    };
  }

  @Get('growth-average')
  async growthAverage(@Query('period') period = 'week') {
    const mode = period === 'month' ? 'month' : 'week';
    const allAnswers = await this.answerRepo.find();
    const allPapers = await this.paperRepo.find();
    const allStudents = await this.users.find({ where: { role: 'student' } });
    const studentCount = allStudents.length > 0 ? allStudents.length : 1;

    const paperMap: Record<string, Paper> = {};
    allPapers.forEach((paper) => {
      paperMap[paper.id] = paper;
    });

    const buckets = this.buildBuckets(mode, new Date());
    const totals = buckets.map(() => ({ questions: 0, correct: 0 }));

    allAnswers.forEach((record) => {
      const submitDate = this.parseSubmitTime(record.submitTime);
      if (!submitDate) return;
      const idx = buckets.findIndex((bucket) => submitDate >= bucket.start && submitDate <= bucket.end);
      if (idx < 0) return;
      const res = this.calcCorrectness(record, paperMap);
      totals[idx].questions += res.questions;
      totals[idx].correct += res.correct;
    });

    return {
      labels: buckets.map((bucket) => bucket.label),
      averageQuestionCount: totals.map((item) => Number((item.questions / studentCount).toFixed(2))),
      averageAccuracy: totals.map((item) => (item.questions > 0 ? Number(((item.correct / item.questions) * 100).toFixed(2)) : 0))
    };
  }
}
