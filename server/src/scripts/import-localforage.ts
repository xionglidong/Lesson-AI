import 'reflect-metadata';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DataSource } from 'typeorm';
import { config } from '../config';
import { User } from '../entities/user.entity';
import { Paper } from '../entities/paper.entity';
import { AnswerRecord } from '../entities/answer-record.entity';
import { Prize } from '../entities/prize.entity';
import { ExchangeRecord } from '../entities/exchange-record.entity';
import { StudentTermHistory } from '../entities/student-term-history.entity';
import bcrypt from 'bcryptjs';

async function main() {
  const fileArg = process.argv.find((arg) => arg.startsWith('--file='));
  if (!fileArg) {
    console.error('Usage: npm run import -- --file=/path/to/backup.json');
    process.exit(1);
  }
  const filePath = fileArg.split('=')[1];
  const absPath = path.resolve(process.cwd(), filePath);
  const raw = await fs.readFile(absPath, 'utf-8');
  const data = JSON.parse(raw);

  const ds = new DataSource({
    type: 'mysql',
    host: config.db.host,
    port: config.db.port,
    username: config.db.username,
    password: config.db.password,
    database: config.db.database,
    ...(config.db.socketPath ? { socketPath: config.db.socketPath } : {}),
    entities: [User, Paper, AnswerRecord, Prize, ExchangeRecord, StudentTermHistory],
    synchronize: true
  });
  await ds.initialize();

  const users = ds.getRepository(User);
  const papers = ds.getRepository(Paper);
  const answers = ds.getRepository(AnswerRecord);
  const prizes = ds.getRepository(Prize);
  const exchanges = ds.getRepository(ExchangeRecord);
  const termHistories = ds.getRepository(StudentTermHistory);

  await answers.createQueryBuilder().delete().from(AnswerRecord).execute();
  await exchanges.createQueryBuilder().delete().from(ExchangeRecord).execute();
  await termHistories.createQueryBuilder().delete().from(StudentTermHistory).execute();
  await papers.createQueryBuilder().delete().from(Paper).execute();
  await prizes.createQueryBuilder().delete().from(Prize).execute();

  const studentPoints = data.studentPoints || {};
  const existingStudents = await users.find({ where: { role: 'student' } });
  if (existingStudents.length) {
    for (const s of existingStudents) await users.remove(s);
  }

  for (const [studentNo, info] of Object.entries(studentPoints)) {
    const u = users.create({
      role: 'student',
      studentNo,
      name: (info as any).name || '',
      grade: (info as any).grade || null,
      semester: (info as any).semester || '上学期',
      points: Number((info as any).points || 0),
      lastUpdate: (info as any).lastUpdate ? new Date((info as any).lastUpdate) : null
    });
    await users.save(u);
    await termHistories.save(
      termHistories.create({
        studentId: studentNo,
        grade: (info as any).grade || '高一',
        semester: (info as any).semester || '上学期',
        startAt: new Date(),
        endAt: null
      })
    );
  }

  const papersData: any[] = data.gradePapers || [];
  for (const [index, p] of papersData.entries()) {
    const paper = papers.create({
      id: p.id || `p_${Date.now()}_${index}`,
      grade: p.grade || 'grade1',
      name: p.name,
      questionCount: Number(p.questionCount || 0),
      singlePoints: Number(p.singlePoints || 0),
      totalPoints: Number(p.totalPoints || 0),
      answers: p.answers || null,
      options: p.options || null,
      fillInBlankCount: p.fillInBlankCount || null,
      fillInBlankPoints: p.fillInBlankPoints || null,
      fillInBlankAnswerImage: p.fillInBlankAnswerImage || null,
      videos: p.videos || null,
      fillBlankVideos: p.fillBlankVideos || null,
      createTime: p.createTime ? new Date(p.createTime) : null
    });
    await papers.save(paper);
  }

  const prizeData: any[] = data.exchangePrizes || [];
  for (const p of prizeData) {
    const prize = prizes.create({
      id: p.id || `prize_${Date.now()}`,
      name: p.name,
      points: Number(p.points || 0),
      description: p.description || '',
      icon: p.icon || null,
      iconColor: p.iconColor || null,
      bgColor: p.bgColor || null
    });
    await prizes.save(prize);
  }

  const answerData: any[] = data.studentAnswers || [];
  for (const a of answerData) {
    const record = answers.create({
      studentId: a.studentId,
      studentName: a.studentName || '',
      paperId: a.paperId,
      answers: a.answers || null,
      score: Number(a.score || 0),
      gradeSnapshot: a.gradeSnapshot || null,
      semesterSnapshot: a.semesterSnapshot || null,
      termKey: a.termKey || null,
      totalPoints: a.totalPoints ? Number(a.totalPoints) : null,
      submitTime: a.submitTime ? new Date(a.submitTime) : new Date(),
      timeElapsed: a.timeElapsed ? Number(a.timeElapsed) : null,
      isFirstSubmission: a.isFirstSubmission ? 1 : 0,
      fillInBlankStudentImage: a.fillInBlankStudentImage || null,
      fillInBlankScore: Number(a.fillInBlankScore || 0),
      fbJudgments: a.fillInBlankDetails || null
    });
    await answers.save(record);
  }

  const exchangeData: any[] = data.exchangeRecords || [];
  for (const e of exchangeData) {
    const record = exchanges.create({
      id: e.id || `exchange_${Date.now()}`,
      studentId: e.studentId,
      studentName: e.studentName || '',
      prizeId: e.prizeId || null,
      prizeName: e.prizeName || '',
      points: Number(e.points || 0),
      gradeSnapshot: e.gradeSnapshot || null,
      semesterSnapshot: e.semesterSnapshot || null,
      termKey: e.termKey || null,
      exchangeTime: e.exchangeTime ? new Date(e.exchangeTime) : new Date()
    });
    await exchanges.save(record);
  }

  const admin = await users.findOne({ where: { role: 'admin' } });
  if (!admin) {
    const passwordHash = await bcrypt.hash(config.admin.password, 10);
    const adminUser = users.create({
      role: 'admin',
      username: config.admin.username,
      passwordHash,
      name: '管理员',
      points: 0
    });
    await users.save(adminUser);
  }

  console.log('Import completed.');
  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
