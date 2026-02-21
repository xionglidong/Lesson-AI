"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const express_1 = __importDefault(require("express"));
const app_module_1 = require("./app.module");
const config_1 = require("./config");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { cors: false });
    app.use(express_1.default.json({ limit: '100mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '100mb' }));
    app.enableCors({
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    });
    await app.listen(config_1.config.port);
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${config_1.config.port}`);
}
bootstrap();
