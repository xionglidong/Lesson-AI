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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExchangeRecord = void 0;
const typeorm_1 = require("typeorm");
let ExchangeRecord = class ExchangeRecord {
};
exports.ExchangeRecord = ExchangeRecord;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], ExchangeRecord.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], ExchangeRecord.prototype, "studentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], ExchangeRecord.prototype, "studentName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], ExchangeRecord.prototype, "prizeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128 }),
    __metadata("design:type", String)
], ExchangeRecord.prototype, "prizeName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], ExchangeRecord.prototype, "points", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, nullable: true }),
    __metadata("design:type", Object)
], ExchangeRecord.prototype, "gradeSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, nullable: true }),
    __metadata("design:type", Object)
], ExchangeRecord.prototype, "semesterSnapshot", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", Object)
], ExchangeRecord.prototype, "termKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], ExchangeRecord.prototype, "exchangeTime", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], ExchangeRecord.prototype, "createdAt", void 0);
exports.ExchangeRecord = ExchangeRecord = __decorate([
    (0, typeorm_1.Entity)({ name: 'exchange_records' })
], ExchangeRecord);
