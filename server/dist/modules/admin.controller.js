"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../entities/user.entity");
const answer_record_entity_1 = require("../entities/answer-record.entity");
const paper_entity_1 = require("../entities/paper.entity");
const student_term_history_entity_1 = require("../entities/student-term-history.entity");
const auth_guard_1 = require("./guards/auth.guard");
const roles_decorator_1 = require("./guards/roles.decorator");
const roles_guard_1 = require("./guards/roles.guard");
const SIX_TERM_KEYS = [
    'grade1:上学期',
    'grade1:下学期',
    'grade2:上学期',
    'grade2:下学期',
    'grade3:上学期',
    'grade3:下学期'
];
function normalizeGrade(grade) {
    if (!grade)
        return null;
    const raw = String(grade).trim().toLowerCase();
    if (raw === 'grade1' || raw === 'grade2' || raw === 'grade3')
        return raw;
    if (String(grade).includes('高一'))
        return 'grade1';
    if (String(grade).includes('高二'))
        return 'grade2';
    if (String(grade).includes('高三'))
        return 'grade3';
    return null;
}
function normalizeSemester(semester) {
    return semester === '下学期' ? '下学期' : '上学期';
}
function buildTermKey(grade, semester) {
    const normalizedGrade = normalizeGrade(grade);
    if (!normalizedGrade)
        return null;
    const normalizedSemester = normalizeSemester(semester);
    return `${normalizedGrade}:${normalizedSemester}`;
}
function termLabel(termKey) {
    const [grade, semester] = termKey.split(':');
    const gradeLabel = grade === 'grade1' ? '高一' : grade === 'grade2' ? '高二' : '高三';
    return `${gradeLabel}${semester === '上学期' ? '上' : '下'}`;
}
let AdminController = class AdminController {
    constructor(users, answers, papers, termHistoryRepo) {
        this.users = users;
        this.answers = answers;
        this.papers = papers;
        this.termHistoryRepo = termHistoryRepo;
    }
    async ensureOpenHistory(studentNo, grade, semester, now) {
        const openHistory = await this.termHistoryRepo.findOne({
            where: { studentId: studentNo, endAt: (0, typeorm_2.IsNull)() },
            order: { startAt: 'DESC' }
        });
        if (!openHistory) {
            await this.termHistoryRepo.save(this.termHistoryRepo.create({
                studentId: studentNo,
                grade: grade || null,
                semester: normalizeSemester(semester),
                startAt: now,
                endAt: null
            }));
        }
    }
    async rotateHistoryIfNeeded(student, nextGrade, nextSemester, now) {
        const prevGrade = student.grade || null;
        const prevSemester = normalizeSemester(student.semester);
        const nextSemesterNormalized = normalizeSemester(nextSemester);
        const hasChanged = (nextGrade || null) !== prevGrade || nextSemesterNormalized !== prevSemester;
        if (!hasChanged) {
            await this.ensureOpenHistory(student.studentNo, prevGrade, prevSemester, now);
            return;
        }
        const openHistory = await this.termHistoryRepo.findOne({
            where: { studentId: student.studentNo, endAt: (0, typeorm_2.IsNull)() },
            order: { startAt: 'DESC' }
        });
        if (openHistory) {
            openHistory.endAt = now;
            await this.termHistoryRepo.save(openHistory);
        }
        await this.termHistoryRepo.save(this.termHistoryRepo.create({
            studentId: student.studentNo,
            grade: nextGrade || null,
            semester: nextSemesterNormalized,
            startAt: now,
            endAt: null
        }));
    }
    calcCorrectness(record, paperMap) {
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
    async backfillTermSnapshots(studentNo, student) {
        const records = await this.answers.find({ where: { studentId: studentNo } });
        if (!records.length)
            return;
        const histories = await this.termHistoryRepo.find({
            where: { studentId: studentNo },
            order: { startAt: 'ASC' }
        });
        const patched = [];
        for (const record of records) {
            if (record.termKey && record.gradeSnapshot && record.semesterSnapshot)
                continue;
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
    async listStudents() {
        return this.users.find({ where: { role: 'student' } });
    }
    async upsertStudent(body) {
        const now = new Date();
        const existing = await this.users.findOne({ where: { role: 'student', studentNo: body.studentNo } });
        if (existing) {
            await this.rotateHistoryIfNeeded(existing, body.grade ?? existing.grade, body.semester ?? existing.semester, now);
            existing.name = body.name ?? existing.name;
            existing.grade = body.grade ?? existing.grade;
            existing.semester = body.semester ?? existing.semester ?? '上学期';
            if (typeof body.points === 'number')
                existing.points = body.points;
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
    async setPoints(studentNo, body) {
        const existing = await this.users.findOne({ where: { role: 'student', studentNo } });
        if (!existing)
            return null;
        existing.points = body.points;
        existing.lastUpdate = new Date();
        return this.users.save(existing);
    }
    async semesterStats(studentNo) {
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
        const paperMap = new Map();
        papers.forEach((paper) => paperMap.set(paper.id, paper));
        const stats = new Map();
        SIX_TERM_KEYS.forEach((key) => {
            stats.set(key, {
                questionCount: 0,
                correctCount: 0,
                earnedPoints: 0,
                paperIds: new Set()
            });
        });
        for (const record of records) {
            const key = buildTermKey(record.gradeSnapshot, record.semesterSnapshot) || record.termKey;
            if (!key || !stats.has(key))
                continue;
            const current = stats.get(key);
            const correctness = this.calcCorrectness(record, paperMap);
            current.questionCount += correctness.questionCount;
            current.correctCount += correctness.correctCount;
            const isFirstSubmission = Number(record.isFirstSubmission || 0) === 1;
            if (isFirstSubmission) {
                if (record.paperId)
                    current.paperIds.add(record.paperId);
                current.earnedPoints += Number(record.score || 0);
            }
        }
        return {
            studentNo,
            studentName: student.name,
            terms: SIX_TERM_KEYS.map((key) => {
                const item = stats.get(key);
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
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('students'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "listStudents", null);
__decorate([
    (0, common_1.Post)('students'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "upsertStudent", null);
__decorate([
    (0, common_1.Patch)('students/:studentNo/points'),
    __param(0, (0, common_1.Param)('studentNo')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "setPoints", null);
__decorate([
    (0, common_1.Get)('students/:studentNo/semester-stats'),
    __param(0, (0, common_1.Param)('studentNo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "semesterStats", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.Controller)('api/admin'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(answer_record_entity_1.AnswerRecord)),
    __param(2, (0, typeorm_1.InjectRepository)(paper_entity_1.Paper)),
    __param(3, (0, typeorm_1.InjectRepository)(student_term_history_entity_1.StudentTermHistory)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AdminController);
