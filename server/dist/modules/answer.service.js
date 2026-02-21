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
exports.AnswerService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const answer_record_entity_1 = require("../entities/answer-record.entity");
const user_entity_1 = require("../entities/user.entity");
function formatDateTime(input) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())} ${pad(input.getHours())}:${pad(input.getMinutes())}:${pad(input.getSeconds())}`;
}
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
function buildTermKey(grade, semester) {
    const normalizedGrade = normalizeGrade(grade);
    if (!normalizedGrade)
        return null;
    const normalizedSemester = semester === '下学期' ? '下学期' : '上学期';
    return `${normalizedGrade}:${normalizedSemester}`;
}
let AnswerService = class AnswerService {
    constructor(answers, users) {
        this.answers = answers;
        this.users = users;
    }
    async submit(studentNo, studentName, payload) {
        const existing = await this.answers.find({ where: { studentId: studentNo, paperId: payload.paperId } });
        const isFirstSubmission = existing.length === 0;
        const user = await this.users.findOne({ where: { role: 'student', studentNo } });
        const gradeSnapshot = user?.grade || null;
        const semesterSnapshot = user?.semester || '上学期';
        const termKey = buildTermKey(gradeSnapshot, semesterSnapshot);
        const record = this.answers.create({
            studentId: studentNo,
            studentName,
            paperId: payload.paperId,
            answers: payload.answers || [],
            score: payload.score,
            gradeSnapshot,
            semesterSnapshot,
            termKey,
            totalPoints: payload.totalPoints || null,
            submitTime: new Date(),
            timeElapsed: payload.timeElapsed || null,
            isFirstSubmission: isFirstSubmission ? 1 : 0,
            fillInBlankStudentImage: payload.fillInBlankStudentImage || null,
            fillInBlankScore: payload.fillInBlankScore || 0,
            fbJudgments: payload.fillInBlankDetails || null
        });
        await this.answers.save(record);
        let updatedPoints = null;
        if (isFirstSubmission && user) {
            user.points = (user.points || 0) + payload.score;
            user.lastUpdate = new Date();
            await this.users.save(user);
            updatedPoints = user.points;
        }
        const payloadRecord = {
            ...record,
            submitTime: formatDateTime(record.submitTime),
            fillInBlankDetails: record.fbJudgments
        };
        return { record: payloadRecord, isFirstSubmission, updatedPoints };
    }
};
exports.AnswerService = AnswerService;
exports.AnswerService = AnswerService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(answer_record_entity_1.AnswerRecord)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], AnswerService);
