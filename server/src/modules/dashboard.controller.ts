import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { AnswerRecord } from '../entities/answer-record.entity';
import { AuthGuard } from './guards/auth.guard';
import { Roles } from './guards/roles.decorator';
import { RolesGuard } from './guards/roles.guard';

@Controller('api/dashboard')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class DashboardController {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(AnswerRecord) private answers: Repository<AnswerRecord>
  ) {}

  @Get('summary')
  async summary() {
    const students = await this.users.find({ where: { role: 'student' } });
    const totalPoints = students.reduce((sum, s) => sum + (s.points || 0), 0);
    const avgPoints = students.length ? Number((totalPoints / students.length).toFixed(1)) : 0;
    const topStudent = [...students].sort((a, b) => (b.points || 0) - (a.points || 0))[0];
    const answerCount = await this.answers.count();
    return {
      studentCount: students.length,
      avgPoints,
      answerCount,
      topStudent: topStudent ? topStudent.name : '-'
    };
  }
}
