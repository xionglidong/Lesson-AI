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
exports.StorageController = void 0;
const common_1 = require("@nestjs/common");
const storage_service_1 = require("./storage.service");
const auth_guard_1 = require("./guards/auth.guard");
const roles_decorator_1 = require("./guards/roles.decorator");
const roles_guard_1 = require("./guards/roles.guard");
let StorageController = class StorageController {
    constructor(storage) {
        this.storage = storage;
    }
    async getKey(key, req) {
        const user = req.user;
        return this.storage.getData(key, user.role, user.studentNo);
    }
    async putKey(key, body) {
        await this.storage.saveData(key, body);
        return { ok: true };
    }
};
exports.StorageController = StorageController;
__decorate([
    (0, common_1.Get)(':key'),
    __param(0, (0, common_1.Param)('key')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "getKey", null);
__decorate([
    (0, common_1.Put)(':key'),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "putKey", null);
exports.StorageController = StorageController = __decorate([
    (0, common_1.Controller)('api/storage'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    __param(0, (0, common_1.Inject)(storage_service_1.StorageService)),
    __metadata("design:paramtypes", [storage_service_1.StorageService])
], StorageController);
