"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const typeorm_1 = require("typeorm");
const config_1 = require("../config");
const user_entity_1 = require("../entities/user.entity");
const paper_entity_1 = require("../entities/paper.entity");
const answer_record_entity_1 = require("../entities/answer-record.entity");
const prize_entity_1 = require("../entities/prize.entity");
const exchange_record_entity_1 = require("../entities/exchange-record.entity");
const student_term_history_entity_1 = require("../entities/student-term-history.entity");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function main() {
    const fileArg = process.argv.find((arg) => arg.startsWith('--file='));
    if (!fileArg) {
        console.error('Usage: npm run import -- --file=/path/to/backup.json');
        process.exit(1);
    }
    const filePath = fileArg.split('=')[1];
    const absPath = node_path_1.default.resolve(process.cwd(), filePath);
    const raw = await promises_1.default.readFile(absPath, 'utf-8');
    const data = JSON.parse(raw);
    const ds = new typeorm_1.DataSource({
        type: 'mysql',
        host: config_1.config.db.host,
        port: config_1.config.db.port,
        username: config_1.config.db.username,
        password: config_1.config.db.password,
        database: config_1.config.db.database,
        ...(config_1.config.db.socketPath ? { socketPath: config_1.config.db.socketPath } : {}),
        entities: [user_entity_1.User, paper_entity_1.Paper, answer_record_entity_1.AnswerRecord, prize_entity_1.Prize, exchange_record_entity_1.ExchangeRecord, student_term_history_entity_1.StudentTermHistory],
        synchronize: true
    });
    await ds.initialize();
    const users = ds.getRepository(user_entity_1.User);
    const papers = ds.getRepository(paper_entity_1.Paper);
    const answers = ds.getRepository(answer_record_entity_1.AnswerRecord);
    const prizes = ds.getRepository(prize_entity_1.Prize);
    const exchanges = ds.getRepository(exchange_record_entity_1.ExchangeRecord);
    const termHistories = ds.getRepository(student_term_history_entity_1.StudentTermHistory);
    await answers.createQueryBuilder().delete().from(answer_record_entity_1.AnswerRecord).execute();
    await exchanges.createQueryBuilder().delete().from(exchange_record_entity_1.ExchangeRecord).execute();
    await termHistories.createQueryBuilder().delete().from(student_term_history_entity_1.StudentTermHistory).execute();
    await papers.createQueryBuilder().delete().from(paper_entity_1.Paper).execute();
    await prizes.createQueryBuilder().delete().from(prize_entity_1.Prize).execute();
    const studentPoints = data.studentPoints || {};
    const existingStudents = await users.find({ where: { role: 'student' } });
    if (existingStudents.length) {
        for (const s of existingStudents)
            await users.remove(s);
    }
    for (const [studentNo, info] of Object.entries(studentPoints)) {
        const u = users.create({
            role: 'student',
            studentNo,
            name: info.name || '',
            grade: info.grade || null,
            semester: info.semester || '上学期',
            points: Number(info.points || 0),
            lastUpdate: info.lastUpdate ? new Date(info.lastUpdate) : null
        });
        await users.save(u);
        await termHistories.save(termHistories.create({
            studentId: studentNo,
            grade: info.grade || null,
            semester: info.semester || '上学期',
            startAt: new Date(),
            endAt: null
        }));
    }
    const papersData = data.gradePapers || [];
    for (const [index, p] of papersData.entries()) {
        const paper = papers.create({
            id: p.id || `p_${Date.now()}_${index}`,
            grade: p.grade,
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
    const prizeData = data.exchangePrizes || [];
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
    const answerData = data.studentAnswers || [];
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
    const exchangeData = data.exchangeRecords || [];
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
        const passwordHash = await bcryptjs_1.default.hash(config_1.config.admin.password, 10);
        const adminUser = users.create({
            role: 'admin',
            username: config_1.config.admin.username,
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
