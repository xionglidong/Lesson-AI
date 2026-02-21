"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("./config");
const user_entity_1 = require("./entities/user.entity");
const paper_entity_1 = require("./entities/paper.entity");
const answer_record_entity_1 = require("./entities/answer-record.entity");
const prize_entity_1 = require("./entities/prize.entity");
const exchange_record_entity_1 = require("./entities/exchange-record.entity");
const student_term_history_entity_1 = require("./entities/student-term-history.entity");
const auth_controller_1 = require("./modules/auth.controller");
const auth_service_1 = require("./modules/auth.service");
const storage_controller_1 = require("./modules/storage.controller");
const storage_service_1 = require("./modules/storage.service");
const student_controller_1 = require("./modules/student.controller");
const admin_controller_1 = require("./modules/admin.controller");
const answer_service_1 = require("./modules/answer.service");
const exchange_service_1 = require("./modules/exchange.service");
const dashboard_controller_1 = require("./modules/dashboard.controller");
const auth_guard_1 = require("./modules/guards/auth.guard");
const roles_guard_1 = require("./modules/guards/roles.guard");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRoot({
                type: 'mysql',
                host: config_1.config.db.host,
                port: config_1.config.db.port,
                username: config_1.config.db.username,
                password: config_1.config.db.password,
                database: config_1.config.db.database,
                ...(config_1.config.db.socketPath ? { socketPath: config_1.config.db.socketPath } : {}),
                entities: [user_entity_1.User, paper_entity_1.Paper, answer_record_entity_1.AnswerRecord, prize_entity_1.Prize, exchange_record_entity_1.ExchangeRecord, student_term_history_entity_1.StudentTermHistory],
                synchronize: true,
                logging: false
            }),
            typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, paper_entity_1.Paper, answer_record_entity_1.AnswerRecord, prize_entity_1.Prize, exchange_record_entity_1.ExchangeRecord, student_term_history_entity_1.StudentTermHistory])
        ],
        controllers: [
            auth_controller_1.AuthController,
            storage_controller_1.StorageController,
            student_controller_1.StudentController,
            admin_controller_1.AdminController,
            dashboard_controller_1.DashboardController
        ],
        providers: [
            auth_service_1.AuthService,
            storage_service_1.StorageService,
            answer_service_1.AnswerService,
            exchange_service_1.ExchangeService,
            auth_guard_1.AuthGuard,
            roles_guard_1.RolesGuard
        ]
    })
], AppModule);
