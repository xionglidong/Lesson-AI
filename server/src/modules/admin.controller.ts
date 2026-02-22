import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { AnswerRecord } from '../entities/answer-record.entity';
import { Paper } from '../entities/paper.entity';
import { StudentTermHistory } from '../entities/student-term-history.entity';
import { AuthGuard } from './guards/auth.guard';
import { Roles } from './guards/roles.decorator';
import { RolesGuard } from './guards/roles.guard';

type CanonicalTermKey =
  | 'grade1:上学期'
  | 'grade1:下学期'
  | 'grade2:上学期'
  | 'grade2:下学期'
  | 'grade3:上学期'
  | 'grade3:下学期';

const SIX_TERM_KEYS: CanonicalTermKey[] = [
  'grade1:上学期',
  'grade1:下学期',
  'grade2:上学期',
  'grade2:下学期',
  'grade3:上学期',
  'grade3:下学期'
];

function normalizeGrade(grade: string | null | undefined): 'grade1' | 'grade2' | 'grade3' | null {
  if (!grade) return null;
  const raw = String(grade).trim().toLowerCase();
  if (raw === 'grade1' || raw === 'grade2' || raw === 'grade3') return raw;
  if (String(grade).includes('高一')) return 'grade1';
  if (String(grade).includes('高二')) return 'grade2';
  if (String(grade).includes('高三')) return 'grade3';
  return null;
}

function normalizeSemester(semester: string | null | undefined): '上学期' | '下学期' {
  return semester === '下学期' ? '下学期' : '上学期';
}

function buildTermKey(grade: string | null | undefined, semester: string | null | undefined): CanonicalTermKey | null {
  const normalizedGrade = normalizeGrade(grade);
  if (!normalizedGrade) return null;
  const normalizedSemester = normalizeSemester(semester);
  return `${normalizedGrade}:${normalizedSemester}` as CanonicalTermKey;
}

function termLabel(termKey: CanonicalTermKey): string {
  const [grade, semester] = termKey.split(':');
  const gradeLabel = grade === 'grade1' ? '高一' : grade === 'grade2' ? '高二' : '高三';
  return `${gradeLabel}${semester === '上学期' ? '上' : '下'}`;
}

@Controller('api/admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(AnswerRecord) private answers: Repository<AnswerRecord>,
    @InjectRepository(Paper) private papers: Repository<Paper>,
    @InjectRepository(StudentTermHistory) private termHistoryRepo: Repository<StudentTermHistory>
  ) {}

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
          semester: normalizeSemester(semester),
          startAt: now,
          endAt: null
        })
      );
    }
  }

  private async rotateHistoryIfNeeded(student: User, nextGrade: string | null | undefined, nextSemester: string | null | undefined, now: Date) {
    const prevGrade = student.grade || null;
    const prevSemester = normalizeSemester(student.semester);
    const nextSemesterNormalized = normalizeSemester(nextSemester);
    const hasChanged = (nextGrade || null) !== prevGrade || nextSemesterNormalized !== prevSemester;
    if (!hasChanged) {
      await this.ensureOpenHistory(student.studentNo as string, prevGrade, prevSemester, now);
      return;
    }

    const openHistory = await this.termHistoryRepo.findOne({
      where: { studentId: student.studentNo as string, endAt: IsNull() },
      order: { startAt: 'DESC' }
    });
    if (openHistory) {
      openHistory.endAt = now;
      await this.termHistoryRepo.save(openHistory);
    }
    await this.termHistoryRepo.save(
      this.termHistoryRepo.create({
        studentId: student.studentNo as string,
        grade: nextGrade || '高一',
        semester: nextSemesterNormalized,
        startAt: now,
        endAt: null
      })
    );
  }

  private calcCorrectness(record: AnswerRecord, paperMap: Map<string, Paper>) {
    const paper = paperMap.get(record.paperId);
    const studentAnswers = Array.isArray(record.answers) ? record.answers : [];
    const standardAnswers = Array.isArray(paper?.answers) ? paper?.answers : [];
    let choiceCorrect = 0;
    for (let i = 0; i < studentAnswers.length; i += 1) {
      if (studentAnswers[i] && standardAnswers[i] && studentAnswers[i] === standardAnswers[i]) {
        choiceCorrect += 1;
      }
    }
    const fb = Array.isArray(record.fbJudgments) ? record.fbJudgments : [];
    const fbCorrect = fb.filter((item) => item === true).length;
    return {
      questionCount: studentAnswers.length + fb.length,
      correctCount: choiceCorrect + fbCorrect
    };
  }

  private async backfillTermSnapshots(studentNo: string, student: User | null) {
    const records = await this.answers.find({ where: { studentId: studentNo } });
    if (!records.length) return;

    const histories = await this.termHistoryRepo.find({
      where: { studentId: studentNo },
      order: { startAt: 'ASC' }
    });
    const patched: AnswerRecord[] = [];

    for (const record of records) {
      if (record.termKey && record.gradeSnapshot && record.semesterSnapshot) continue;
      const submitAt = record.submitTime ? new Date(record.submitTime) : new Date(record.createdAt);

      const hit = histories.find((item) => {
        const inStart = item.startAt <= submitAt;
        const inEnd = !item.endAt || item.endAt >= submitAt;
        return inStart && inEnd;
      });

      const grade = record.gradeSnapshot || hit?.grade || student?.grade || null;
      const semester = record.semesterSnapshot || hit?.semester || student?.semester || '上学期';
      const key = buildTermKey(grade, semester);

      record.gradeSnapshot = grade;
      record.semesterSnapshot = normalizeSemester(semester);
      record.termKey = key;
      patched.push(record);
    }

    if (patched.length) {
      await this.answers.save(patched);
    }
  }

  @Get('students')
  async listStudents() {
    return this.users.find({ where: { role: 'student' } });
  }

  @Post('students')
  async upsertStudent(@Body() body: { studentNo: string; name: string; grade?: string; semester?: string; points?: number }) {
    const now = new Date();
    const existing = await this.users.findOne({ where: { role: 'student', studentNo: body.studentNo } });
    if (existing) {
      await this.rotateHistoryIfNeeded(existing, body.grade ?? existing.grade, body.semester ?? existing.semester, now);
      existing.name = body.name ?? existing.name;
      existing.grade = body.grade ?? existing.grade;
      existing.semester = body.semester ?? existing.semester ?? '上学期';
      if (typeof body.points === 'number') existing.points = body.points;
      existing.lastUpdate = now;
      return this.users.save(existing);
    }
    const created = this.users.create({
      role: 'student',
      studentNo: body.studentNo,
      name: body.name,
      grade: body.grade || null,
      semester: body.semester || '上学期',
      points: body.points || 0,
      lastUpdate: now
    });
    const saved = await this.users.save(created);
    await this.ensureOpenHistory(body.studentNo, saved.grade, saved.semester, now);
    return saved;
  }

  @Patch('students/:studentNo/points')
  async setPoints(@Param('studentNo') studentNo: string, @Body() body: { points: number }) {
    const existing = await this.users.findOne({ where: { role: 'student', studentNo } });
    if (!existing) return null;
    existing.points = body.points;
    existing.lastUpdate = new Date();
    return this.users.save(existing);
  }

  @Get('students/:studentNo/semester-stats')
  async semesterStats(@Param('studentNo') studentNo: string) {
    const student = await this.users.findOne({ where: { role: 'student', studentNo } });
    if (!student) {
      return {
        studentNo,
        terms: SIX_TERM_KEYS.map((key) => ({
          termKey: key,
          termLabel: termLabel(key),
          questionCount: 0,
          paperCount: 0,
          accuracy: 0,
          earnedPoints: 0
        }))
      };
    }

    await this.ensureOpenHistory(studentNo, student.grade, student.semester, new Date());
    await this.backfillTermSnapshots(studentNo, student);

    const [papers, records] = await Promise.all([
      this.papers.find(),
      this.answers.find({ where: { studentId: studentNo } })
    ]);
    const paperMap = new Map<string, Paper>();
    papers.forEach((paper) => paperMap.set(paper.id, paper));

    const stats = new Map<
      CanonicalTermKey,
      {
        questionCount: number;
        correctCount: number;
        earnedPoints: number;
        paperIds: Set<string>;
      }
    >();
    SIX_TERM_KEYS.forEach((key) => {
      stats.set(key, {
        questionCount: 0,
        correctCount: 0,
        earnedPoints: 0,
        paperIds: new Set<string>()
      });
    });

    for (const record of records) {
      const key = buildTermKey(record.gradeSnapshot, record.semesterSnapshot) || (record.termKey as CanonicalTermKey | null);
      if (!key || !stats.has(key)) continue;
      const current = stats.get(key) as {
        questionCount: number;
        correctCount: number;
        earnedPoints: number;
        paperIds: Set<string>;
      };
      const correctness = this.calcCorrectness(record, paperMap);
      current.questionCount += correctness.questionCount;
      current.correctCount += correctness.correctCount;

      const isFirstSubmission = Number(record.isFirstSubmission || 0) === 1;
      if (isFirstSubmission) {
        if (record.paperId) current.paperIds.add(record.paperId);
        current.earnedPoints += Number(record.score || 0);
      }
    }

    return {
      studentNo,
      studentName: student.name,
      terms: SIX_TERM_KEYS.map((key) => {
        const item = stats.get(key) as {
          questionCount: number;
          correctCount: number;
          earnedPoints: number;
          paperIds: Set<string>;
        };
        return {
          termKey: key,
          termLabel: termLabel(key),
          questionCount: item.questionCount,
          paperCount: item.paperIds.size,
          accuracy: item.questionCount > 0 ? Number(((item.correctCount / item.questionCount) * 100).toFixed(2)) : 0,
          earnedPoints: item.earnedPoints
        };
      })
    };
  }
}
