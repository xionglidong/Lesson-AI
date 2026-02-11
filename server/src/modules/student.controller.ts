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

@Controller('api/student')
@UseGuards(AuthGuard, RolesGuard)
@Roles('student')
export class StudentController {
  constructor(
    @Inject(AnswerService) private answers: AnswerService,
    @Inject(ExchangeService) private exchanges: ExchangeService,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(AnswerRecord) private answerRepo: Repository<AnswerRecord>,
    @InjectRepository(ExchangeRecord) private exchangeRepo: Repository<ExchangeRecord>
  ) {}

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
}
