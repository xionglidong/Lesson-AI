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
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const paper_entity_1 = require("../entities/paper.entity");
const answer_record_entity_1 = require("../entities/answer-record.entity");
const prize_entity_1 = require("../entities/prize.entity");
const user_entity_1 = require("../entities/user.entity");
const exchange_record_entity_1 = require("../entities/exchange-record.entity");
const student_term_history_entity_1 = require("../entities/student-term-history.entity");
function formatDateTime(input) {
    if (!input)
        return '';
    const d = new Date(input);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
let StorageService = class StorageService {
    constructor(papers, answers, prizes, users, exchanges, termHistoryRepo) {
        this.papers = papers;
        this.answers = answers;
        this.prizes = prizes;
        this.users = users;
        this.exchanges = exchanges;
        this.termHistoryRepo = termHistoryRepo;
    }
    normalizeSemester(semester) {
        return semester === '下学期' ? '下学期' : '上学期';
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
                semester: this.normalizeSemester(semester),
                startAt: now,
                endAt: null
            }));
        }
    }
    async rotateHistoryIfNeeded(studentNo, prevGrade, prevSemester, nextGrade, nextSemester, now) {
        const prevSemesterNormalized = this.normalizeSemester(prevSemester);
        const nextSemesterNormalized = this.normalizeSemester(nextSemester);
        const hasChanged = (prevGrade || null) !== (nextGrade || null) || prevSemesterNormalized !== nextSemesterNormalized;
        if (!hasChanged) {
            await this.ensureOpenHistory(studentNo, prevGrade, prevSemesterNormalized, now);
            return;
        }
        const openHistory = await this.termHistoryRepo.findOne({
            where: { studentId: studentNo, endAt: (0, typeorm_2.IsNull)() },
            order: { startAt: 'DESC' }
        });
        if (openHistory) {
            openHistory.endAt = now;
            await this.termHistoryRepo.save(openHistory);
        }
        await this.termHistoryRepo.save(this.termHistoryRepo.create({
            studentId: studentNo,
            grade: nextGrade || null,
            semester: nextSemesterNormalized,
            startAt: now,
            endAt: null
        }));
    }
    async getData(key, role, studentNo) {
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
                throw new common_1.NotFoundException('Unknown storage key');
        }
    }
    async saveData(key, value) {
        switch (key) {
            case 'gradePapers':
                await this.papers.createQueryBuilder().delete().from(paper_entity_1.Paper).execute();
                await this.papers.save((value || []).map((p) => ({
                    ...p,
                    createTime: p.createTime ? new Date(p.createTime) : null
                })));
                return true;
            case 'studentAnswers':
                await this.answers.createQueryBuilder().delete().from(answer_record_entity_1.AnswerRecord).execute();
                await this.answers.save((value || []).map((a) => ({
                    ...a,
                    submitTime: a.submitTime ? new Date(a.submitTime) : new Date(),
                    fbJudgments: a.fillInBlankDetails || a.fbJudgments || null
                })));
                return true;
            case 'exchangePrizes':
                await this.prizes.createQueryBuilder().delete().from(prize_entity_1.Prize).execute();
                await this.prizes.save(value || []);
                return true;
            case 'studentPoints':
                await this.replaceStudentPoints(value || {});
                return true;
            case 'exchangeRecords':
                await this.exchanges.createQueryBuilder().delete().from(exchange_record_entity_1.ExchangeRecord).execute();
                await this.exchanges.save((value || []).map((e) => ({
                    ...e,
                    exchangeTime: e.exchangeTime ? new Date(e.exchangeTime) : new Date()
                })));
                return true;
            default:
                throw new common_1.NotFoundException('Unknown storage key');
        }
    }
    async getStudentPoints() {
        const students = await this.users.find({ where: { role: 'student' } });
        const data = {};
        students.forEach((s) => {
            if (!s.studentNo)
                return;
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
    async replaceStudentPoints(map) {
        const existing = await this.users.find({ where: { role: 'student' } });
        const existingMap = new Map(existing.map((u) => [u.studentNo, u]));
        const incomingKeys = new Set(Object.keys(map));
        const now = new Date();
        for (const [studentNo, info] of Object.entries(map)) {
            const current = existingMap.get(studentNo);
            if (current) {
                const nextGrade = info.grade || current.grade;
                const nextSemester = info.semester || current.semester || '上学期';
                await this.rotateHistoryIfNeeded(studentNo, current.grade, current.semester, nextGrade, nextSemester, now);
                current.name = info.name || current.name;
                current.grade = nextGrade;
                current.semester = nextSemester;
                current.points = Number(info.points || 0);
                current.lastUpdate = info.lastUpdate ? new Date(info.lastUpdate) : current.lastUpdate;
                await this.users.save(current);
            }
            else {
                const user = this.users.create({
                    role: 'student',
                    studentNo: studentNo,
                    name: info.name || '',
                    grade: info.grade || null,
                    semester: info.semester || '上学期',
                    points: Number(info.points || 0),
                    lastUpdate: info.lastUpdate ? new Date(info.lastUpdate) : null
                });
                const saved = await this.users.save(user);
                await this.ensureOpenHistory(studentNo, saved.grade, saved.semester, now);
            }
        }
        // remove students not in incoming map
        for (const existingUser of existing) {
            if (existingUser.studentNo && !incomingKeys.has(existingUser.studentNo)) {
                await this.users.remove(existingUser);
            }
        }
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(paper_entity_1.Paper)),
    __param(1, (0, typeorm_1.InjectRepository)(answer_record_entity_1.AnswerRecord)),
    __param(2, (0, typeorm_1.InjectRepository)(prize_entity_1.Prize)),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(4, (0, typeorm_1.InjectRepository)(exchange_record_entity_1.ExchangeRecord)),
    __param(5, (0, typeorm_1.InjectRepository)(student_term_history_entity_1.StudentTermHistory)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], StorageService);
