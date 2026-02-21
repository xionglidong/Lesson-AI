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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../entities/user.entity");
const config_1 = require("../config");
let AuthService = class AuthService {
    constructor(users) {
        this.users = users;
    }
    async onModuleInit() {
        await this.ensureAdmin();
    }
    async ensureAdmin() {
        const existing = await this.users.findOne({ where: { role: 'admin' } });
        if (existing)
            return;
        const passwordHash = await bcryptjs_1.default.hash(config_1.config.admin.password, 10);
        const admin = this.users.create({
            role: 'admin',
            username: config_1.config.admin.username,
            passwordHash,
            name: '管理员',
            points: 0
        });
        await this.users.save(admin);
    }
    issueToken(user) {
        return jsonwebtoken_1.default.sign({
            id: user.id,
            role: user.role,
            studentNo: user.studentNo,
            name: user.name
        }, config_1.config.jwtSecret, { expiresIn: '7d' });
    }
    async adminLogin(username, password) {
        await this.ensureAdmin();
        const user = await this.users.findOne({ where: { role: 'admin', username } });
        if (!user || !user.passwordHash)
            throw new common_1.UnauthorizedException('用户名或密码错误');
        const ok = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!ok)
            throw new common_1.UnauthorizedException('用户名或密码错误');
        const token = this.issueToken(user);
        return { token, user };
    }
    async studentLogin(studentNo, name) {
        const user = await this.users.findOne({ where: { role: 'student', studentNo } });
        if (!user)
            throw new common_1.UnauthorizedException('学号不存在');
        if (user.name !== name)
            throw new common_1.UnauthorizedException('姓名与学号不匹配');
        const token = this.issueToken(user);
        return { token, user };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AuthService);
