import { Body, Controller, Get, Inject, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './guards/auth.guard';
import { Roles } from './guards/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { AnswerService } from './answer.service';
import { ExchangeService } from './exchange.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { AnswerRecord } from '../entities/answer-record.entity';
import { ExchangeRecord } from '../entities/exchange-record.entity';
import { Paper } from '../entities/paper.entity';

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
    @InjectRepository(Paper) private paperRepo: Repository<Paper>
  ) {}

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
    return { studentNo: entity.studentNo, name: entity.name, grade: entity.grade, points: entity.points };
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
