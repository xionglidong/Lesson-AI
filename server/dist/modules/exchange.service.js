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
exports.ExchangeService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const exchange_record_entity_1 = require("../entities/exchange-record.entity");
const prize_entity_1 = require("../entities/prize.entity");
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
let ExchangeService = class ExchangeService {
    constructor(exchanges, prizes, users) {
        this.exchanges = exchanges;
        this.prizes = prizes;
        this.users = users;
    }
    async redeem(studentNo, studentName, prizeId) {
        const prize = await this.prizes.findOne({ where: { id: prizeId } });
        if (!prize)
            throw new common_1.BadRequestException('奖品不存在');
        const user = await this.users.findOne({ where: { role: 'student', studentNo } });
        if (!user)
            throw new common_1.BadRequestException('学生不存在');
        if ((user.points || 0) < prize.points) {
            throw new common_1.BadRequestException(`积分不足，需要${prize.points}分`);
        }
        user.points = (user.points || 0) - prize.points;
        user.lastUpdate = new Date();
        await this.users.save(user);
        const record = this.exchanges.create({
            id: `exchange_${Date.now()}`,
            studentId: studentNo,
            studentName,
            prizeId: prize.id,
            prizeName: prize.name,
            points: prize.points,
            gradeSnapshot: user.grade || null,
            semesterSnapshot: user.semester || '上学期',
            termKey: buildTermKey(user.grade, user.semester),
            exchangeTime: new Date()
        });
        await this.exchanges.save(record);
        const payloadRecord = {
            ...record,
            exchangeTime: formatDateTime(record.exchangeTime),
            time: formatDateTime(record.exchangeTime)
        };
        return { record: payloadRecord, updatedPoints: user.points };
    }
};
exports.ExchangeService = ExchangeService;
exports.ExchangeService = ExchangeService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(exchange_record_entity_1.ExchangeRecord)),
    __param(1, (0, typeorm_1.InjectRepository)(prize_entity_1.Prize)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ExchangeService);
