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
exports.StudentController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("./guards/auth.guard");
const roles_decorator_1 = require("./guards/roles.decorator");
const roles_guard_1 = require("./guards/roles.guard");
const answer_service_1 = require("./answer.service");
const exchange_service_1 = require("./exchange.service");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../entities/user.entity");
const answer_record_entity_1 = require("../entities/answer-record.entity");
const exchange_record_entity_1 = require("../entities/exchange-record.entity");
const paper_entity_1 = require("../entities/paper.entity");
let StudentController = class StudentController {
    constructor(answers, exchanges, users, answerRepo, exchangeRepo, paperRepo) {
        this.answers = answers;
        this.exchanges = exchanges;
        this.users = users;
        this.answerRepo = answerRepo;
        this.exchangeRepo = exchangeRepo;
        this.paperRepo = paperRepo;
    }
    parseSubmitTime(input) {
        if (!input)
            return null;
        const dt = input instanceof Date ? input : new Date(String(input).replace(/-/g, '/'));
        if (Number.isNaN(dt.getTime()))
            return null;
        return dt;
    }
    getStepDays(period) {
        if (period === 'week')
            return 7;
        return 30;
    }
    buildBuckets(period, now) {
        const stepDays = this.getStepDays(period);
        const pointCount = 12;
        const endDate = new Date(now);
        endDate.setHours(0, 0, 0, 0);
        const buckets = [];
        for (let i = pointCount - 1; i >= 0; i--) {
            const point = new Date(endDate);
            point.setDate(endDate.getDate() - i * stepDays);
            const rangeEnd = new Date(point);
            rangeEnd.setHours(23, 59, 59, 999);
            const rangeStart = new Date(point);
            rangeStart.setDate(point.getDate() - stepDays + 1);
            rangeStart.setHours(0, 0, 0, 0);
            const label = `${point.getFullYear()}-${String(point.getMonth() + 1).padStart(2, '0')}-${String(point.getDate()).padStart(2, '0')}`;
            buckets.push({ label, start: rangeStart, end: rangeEnd });
        }
        return buckets;
    }
    calcCorrectness(record, paperMap) {
        const paper = paperMap[record.paperId];
        const choiceAnswers = Array.isArray(record.answers) ? record.answers : [];
        const stdAnswers = Array.isArray(paper?.answers) ? paper.answers : [];
        let choiceCorrect = 0;
        choiceAnswers.forEach((ans, index) => {
            if (ans && stdAnswers[index] && ans === stdAnswers[index])
                choiceCorrect += 1;
        });
        const fbList = Array.isArray(record.fbJudgments) ? record.fbJudgments : [];
        let fbCorrect = 0;
        fbList.forEach((item) => {
            if (item === true)
                fbCorrect += 1;
        });
        return { questions: choiceAnswers.length + fbList.length, correct: choiceCorrect + fbCorrect };
    }
    async submit(req, body) {
        const user = req.user;
        return this.answers.submit(user.studentNo, user.name, body);
    }
    async exchange(req, body) {
        const user = req.user;
        return this.exchanges.redeem(user.studentNo, user.name, body.prizeId);
    }
    async profile(req) {
        const user = req.user;
        const entity = await this.users.findOne({ where: { role: 'student', studentNo: user.studentNo } });
        if (!entity)
            return null;
        return { studentNo: entity.studentNo, name: entity.name, grade: entity.grade, semester: entity.semester, points: entity.points };
    }
    async answersList(req, paperId) {
        const user = req.user;
        const where = { studentId: user.studentNo };
        if (paperId)
            where.paperId = paperId;
        return this.answerRepo.find({ where });
    }
    async exchangeList(req) {
        const user = req.user;
        return this.exchangeRepo.find({ where: { studentId: user.studentNo } });
    }
    async growthAverage(period = 'week') {
        const mode = period === 'month' ? 'month' : 'week';
        const allAnswers = await this.answerRepo.find();
        const allPapers = await this.paperRepo.find();
        const allStudents = await this.users.find({ where: { role: 'student' } });
        const studentCount = allStudents.length > 0 ? allStudents.length : 1;
        const paperMap = {};
        allPapers.forEach((paper) => {
            paperMap[paper.id] = paper;
        });
        const buckets = this.buildBuckets(mode, new Date());
        const totals = buckets.map(() => ({ questions: 0, correct: 0 }));
        allAnswers.forEach((record) => {
            const submitDate = this.parseSubmitTime(record.submitTime);
            if (!submitDate)
                return;
            const idx = buckets.findIndex((bucket) => submitDate >= bucket.start && submitDate <= bucket.end);
            if (idx < 0)
                return;
            const res = this.calcCorrectness(record, paperMap);
            totals[idx].questions += res.questions;
            totals[idx].correct += res.correct;
        });
        return {
            labels: buckets.map((bucket) => bucket.label),
            averageQuestionCount: totals.map((item) => Number((item.questions / studentCount).toFixed(2))),
            averageAccuracy: totals.map((item) => (item.questions > 0 ? Number(((item.correct / item.questions) * 100).toFixed(2)) : 0))
        };
    }
};
exports.StudentController = StudentController;
__decorate([
    (0, common_1.Post)('submit'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StudentController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)('exchange'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StudentController.prototype, "exchange", null);
__decorate([
    (0, common_1.Get)('profile'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StudentController.prototype, "profile", null);
__decorate([
    (0, common_1.Get)('answers'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('paperId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], StudentController.prototype, "answersList", null);
__decorate([
    (0, common_1.Get)('exchanges'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StudentController.prototype, "exchangeList", null);
__decorate([
    (0, common_1.Get)('growth-average'),
    __param(0, (0, common_1.Query)('period')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StudentController.prototype, "growthAverage", null);
exports.StudentController = StudentController = __decorate([
    (0, common_1.Controller)('api/student'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('student'),
    __param(0, (0, common_1.Inject)(answer_service_1.AnswerService)),
    __param(1, (0, common_1.Inject)(exchange_service_1.ExchangeService)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(3, (0, typeorm_1.InjectRepository)(answer_record_entity_1.AnswerRecord)),
    __param(4, (0, typeorm_1.InjectRepository)(exchange_record_entity_1.ExchangeRecord)),
    __param(5, (0, typeorm_1.InjectRepository)(paper_entity_1.Paper)),
    __metadata("design:paramtypes", [answer_service_1.AnswerService,
        exchange_service_1.ExchangeService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], StudentController);
