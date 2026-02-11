import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paper } from '../entities/paper.entity';
import { AnswerRecord } from '../entities/answer-record.entity';
import { Prize } from '../entities/prize.entity';
import { User } from '../entities/user.entity';
import { ExchangeRecord } from '../entities/exchange-record.entity';

function formatDateTime(input: Date | null | undefined) {
  if (!input) return '';
  const d = new Date(input);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

@Injectable()
export class StorageService {
  constructor(
    @InjectRepository(Paper) private papers: Repository<Paper>,
    @InjectRepository(AnswerRecord) private answers: Repository<AnswerRecord>,
    @InjectRepository(Prize) private prizes: Repository<Prize>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(ExchangeRecord) private exchanges: Repository<ExchangeRecord>
  ) {}

  async getData(key: string, role: 'admin' | 'student', studentNo?: string | null) {
    switch (key) {
      case 'gradePapers':
        return (await this.papers.find()).map((p) => ({
          ...p,
          createTime: formatDateTime(p.createTime)
        }));
      case 'studentAnswers':
        if (role === 'student' && studentNo) {
          return (await this.answers.find({ where: { studentId: studentNo } })).map((a) => ({
            ...a,
            submitTime: formatDateTime(a.submitTime),
            fillInBlankDetails: a.fbJudgments
          }));
        }
        return (await this.answers.find()).map((a) => ({
          ...a,
          submitTime: formatDateTime(a.submitTime),
          fillInBlankDetails: a.fbJudgments
        }));
      case 'exchangePrizes':
        return this.prizes.find();
      case 'studentPoints':
        return this.getStudentPoints();
      case 'exchangeRecords':
        if (role === 'student' && studentNo) {
          return (await this.exchanges.find({ where: { studentId: studentNo } })).map((e) => ({
            ...e,
            exchangeTime: formatDateTime(e.exchangeTime),
            time: formatDateTime(e.exchangeTime)
          }));
        }
        return (await this.exchanges.find()).map((e) => ({
          ...e,
          exchangeTime: formatDateTime(e.exchangeTime),
          time: formatDateTime(e.exchangeTime)
        }));
      default:
        throw new NotFoundException('Unknown storage key');
    }
  }

  async saveData(key: string, value: any) {
    switch (key) {
      case 'gradePapers':
        await this.papers.createQueryBuilder().delete().from(Paper).execute();
        await this.papers.save(
          (value || []).map((p: any) => ({
            ...p,
            createTime: p.createTime ? new Date(p.createTime) : null
          }))
        );
        return true;
      case 'studentAnswers':
        await this.answers.createQueryBuilder().delete().from(AnswerRecord).execute();
        await this.answers.save(
          (value || []).map((a: any) => ({
            ...a,
            submitTime: a.submitTime ? new Date(a.submitTime) : new Date(),
            fbJudgments: a.fillInBlankDetails || a.fbJudgments || null
          }))
        );
        return true;
      case 'exchangePrizes':
        await this.prizes.createQueryBuilder().delete().from(Prize).execute();
        await this.prizes.save(value || []);
        return true;
      case 'studentPoints':
        await this.replaceStudentPoints(value || {});
        return true;
      case 'exchangeRecords':
        await this.exchanges.createQueryBuilder().delete().from(ExchangeRecord).execute();
        await this.exchanges.save(
          (value || []).map((e: any) => ({
            ...e,
            exchangeTime: e.exchangeTime ? new Date(e.exchangeTime) : new Date()
          }))
        );
        return true;
      default:
        throw new NotFoundException('Unknown storage key');
    }
  }

  private async getStudentPoints() {
    const students = await this.users.find({ where: { role: 'student' } });
    const data: Record<string, any> = {};
    students.forEach((s) => {
      if (!s.studentNo) return;
      data[s.studentNo] = {
        id: s.studentNo,
        name: s.name,
        grade: s.grade || '',
        points: s.points || 0,
        lastUpdate: formatDateTime(s.lastUpdate)
      };
    });
    return data;
  }

  private async replaceStudentPoints(map: Record<string, any>) {
    const existing = await this.users.find({ where: { role: 'student' } });
    const existingMap = new Map(existing.map((u) => [u.studentNo, u]));
    const incomingKeys = new Set(Object.keys(map));

    for (const [studentNo, info] of Object.entries(map)) {
      const current = existingMap.get(studentNo as string);
      if (current) {
        current.name = info.name || current.name;
        current.grade = info.grade || current.grade;
        current.points = Number(info.points || 0);
        current.lastUpdate = info.lastUpdate ? new Date(info.lastUpdate) : current.lastUpdate;
        await this.users.save(current);
      } else {
        const user = this.users.create({
          role: 'student',
          studentNo: studentNo as string,
          name: info.name || '',
          grade: info.grade || null,
          points: Number(info.points || 0),
          lastUpdate: info.lastUpdate ? new Date(info.lastUpdate) : null
        });
        await this.users.save(user);
      }
    }

    // remove students not in incoming map
    for (const existingUser of existing) {
      if (existingUser.studentNo && !incomingKeys.has(existingUser.studentNo)) {
        await this.users.remove(existingUser);
      }
    }
  }
}
