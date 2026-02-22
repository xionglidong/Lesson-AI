import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Paper } from '../entities/paper.entity';
import { AnswerRecord } from '../entities/answer-record.entity';
import { Prize } from '../entities/prize.entity';
import { User } from '../entities/user.entity';
import { ExchangeRecord } from '../entities/exchange-record.entity';
import { StudentTermHistory } from '../entities/student-term-history.entity';

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
    @InjectRepository(ExchangeRecord) private exchanges: Repository<ExchangeRecord>,
    @InjectRepository(StudentTermHistory) private termHistoryRepo: Repository<StudentTermHistory>
  ) {}

  private normalizeSemester(semester: string | null | undefined): '上学期' | '下学期' {
    return semester === '下学期' ? '下学期' : '上学期';
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
          grade: grade || '高一',
          semester: this.normalizeSemester(semester),
          startAt: now,
          endAt: null
        })
      );
    }
  }

  private async rotateHistoryIfNeeded(studentNo: string, prevGrade: string | null | undefined, prevSemester: string | null | undefined, nextGrade: string | null | undefined, nextSemester: string | null | undefined, now: Date) {
    const prevSemesterNormalized = this.normalizeSemester(prevSemester);
    const nextSemesterNormalized = this.normalizeSemester(nextSemester);
    const hasChanged = (prevGrade || null) !== (nextGrade || null) || prevSemesterNormalized !== nextSemesterNormalized;
    if (!hasChanged) {
      await this.ensureOpenHistory(studentNo, prevGrade, prevSemesterNormalized, now);
      return;
    }

    const openHistory = await this.termHistoryRepo.findOne({
      where: { studentId: studentNo, endAt: IsNull() },
      order: { startAt: 'DESC' }
    });
    if (openHistory) {
      openHistory.endAt = now;
      await this.termHistoryRepo.save(openHistory);
    }
    await this.termHistoryRepo.save(
      this.termHistoryRepo.create({
        studentId: studentNo,
        grade: nextGrade || '高一',
        semester: nextSemesterNormalized,
        startAt: now,
        endAt: null
      })
    );
  }

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
          (value || []).map((p: any, index: number) => ({
            ...p,
            id: p.id || `paper_${Date.now()}_${index}`,
            grade: p.grade || 'grade1',
            name: p.name || `未命名套卷${index + 1}`,
            questionCount: Number(p.questionCount || 0),
            singlePoints: Number(p.singlePoints || 0),
            totalPoints: Number(p.totalPoints || 0),
            createTime: p.createTime ? new Date(p.createTime) : null
          }))
        );
        return true;
      case 'studentAnswers':
        await this.answers.createQueryBuilder().delete().from(AnswerRecord).execute();
        await this.answers.save(
          (value || []).map((a: any, index: number) => ({
            ...a,
            studentId: a.studentId || a.id || `unknown_student_${index}`,
            studentName: a.studentName || '',
            paperId: a.paperId || `unknown_paper_${index}`,
            score: Number(a.score || 0),
            totalPoints: a.totalPoints == null ? null : Number(a.totalPoints),
            submitTime: a.submitTime ? new Date(a.submitTime) : new Date(),
            timeElapsed: a.timeElapsed == null ? null : Number(a.timeElapsed),
            isFirstSubmission: Number(a.isFirstSubmission || 0) === 1 ? 1 : 0,
            fillInBlankScore: Number(a.fillInBlankScore || 0),
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
        semester: s.semester || '上学期',
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
    const now = new Date();

    for (const [studentNo, info] of Object.entries(map)) {
      const current = existingMap.get(studentNo as string);
      if (current) {
        const nextGrade = info.grade || current.grade;
        const nextSemester = info.semester || current.semester || '上学期';
        await this.rotateHistoryIfNeeded(
          studentNo as string,
          current.grade,
          current.semester,
          nextGrade,
          nextSemester,
          now
        );
        current.name = info.name || current.name;
        current.grade = nextGrade;
        current.semester = nextSemester;
        current.points = Number(info.points || 0);
        current.lastUpdate = info.lastUpdate ? new Date(info.lastUpdate) : current.lastUpdate;
        await this.users.save(current);
      } else {
        const user = this.users.create({
          role: 'student',
          studentNo: studentNo as string,
          name: info.name || '',
          grade: info.grade || null,
          semester: info.semester || '上学期',
          points: Number(info.points || 0),
          lastUpdate: info.lastUpdate ? new Date(info.lastUpdate) : null
        });
        const saved = await this.users.save(user);
        await this.ensureOpenHistory(studentNo as string, saved.grade, saved.semester, now);
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
