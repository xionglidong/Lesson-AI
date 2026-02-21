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
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../entities/user.entity");
const answer_record_entity_1 = require("../entities/answer-record.entity");
const auth_guard_1 = require("./guards/auth.guard");
const roles_decorator_1 = require("./guards/roles.decorator");
const roles_guard_1 = require("./guards/roles.guard");
let DashboardController = class DashboardController {
    constructor(users, answers) {
        this.users = users;
        this.answers = answers;
    }
    async summary() {
        const students = await this.users.find({ where: { role: 'student' } });
        const totalPoints = students.reduce((sum, s) => sum + (s.points || 0), 0);
        const avgPoints = students.length ? Number((totalPoints / students.length).toFixed(1)) : 0;
        const topStudent = [...students].sort((a, b) => (b.points || 0) - (a.points || 0))[0];
        const answerCount = await this.answers.count();
        return {
            studentCount: students.length,
            avgPoints,
            answerCount,
            topStudent: topStudent ? topStudent.name : '-'
        };
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)('summary'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "summary", null);
exports.DashboardController = DashboardController = __decorate([
    (0, common_1.Controller)('api/dashboard'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(answer_record_entity_1.AnswerRecord)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], DashboardController);
