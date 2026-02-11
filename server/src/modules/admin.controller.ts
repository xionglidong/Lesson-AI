import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { AuthGuard } from './guards/auth.guard';
import { Roles } from './guards/roles.decorator';
import { RolesGuard } from './guards/roles.guard';

@Controller('api/admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(@InjectRepository(User) private users: Repository<User>) {}

  @Get('students')
  async listStudents() {
    return this.users.find({ where: { role: 'student' } });
  }

  @Post('students')
  async upsertStudent(@Body() body: { studentNo: string; name: string; grade?: string; points?: number }) {
    const existing = await this.users.findOne({ where: { role: 'student', studentNo: body.studentNo } });
    if (existing) {
      existing.name = body.name ?? existing.name;
      existing.grade = body.grade ?? existing.grade;
      if (typeof body.points === 'number') existing.points = body.points;
      existing.lastUpdate = new Date();
      return this.users.save(existing);
    }
    const created = this.users.create({
      role: 'student',
      studentNo: body.studentNo,
      name: body.name,
      grade: body.grade || null,
      points: body.points || 0,
      lastUpdate: new Date()
    });
    return this.users.save(created);
  }

  @Patch('students/:studentNo/points')
  async setPoints(@Param('studentNo') studentNo: string, @Body() body: { points: number }) {
    const existing = await this.users.findOne({ where: { role: 'student', studentNo } });
    if (!existing) return null;
    existing.points = body.points;
    existing.lastUpdate = new Date();
    return this.users.save(existing);
  }
}
