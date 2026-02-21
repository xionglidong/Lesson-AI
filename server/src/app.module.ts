import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from './config';
import { User } from './entities/user.entity';
import { Paper } from './entities/paper.entity';
import { AnswerRecord } from './entities/answer-record.entity';
import { Prize } from './entities/prize.entity';
import { ExchangeRecord } from './entities/exchange-record.entity';
import { StudentTermHistory } from './entities/student-term-history.entity';
import { AuthController } from './modules/auth.controller';
import { AuthService } from './modules/auth.service';
import { StorageController } from './modules/storage.controller';
import { StorageService } from './modules/storage.service';
import { StudentController } from './modules/student.controller';
import { AdminController } from './modules/admin.controller';
import { AnswerService } from './modules/answer.service';
import { ExchangeService } from './modules/exchange.service';
import { DashboardController } from './modules/dashboard.controller';
import { AuthGuard } from './modules/guards/auth.guard';
import { RolesGuard } from './modules/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: config.db.host,
      port: config.db.port,
      username: config.db.username,
      password: config.db.password,
      database: config.db.database,
      ...(config.db.socketPath ? { socketPath: config.db.socketPath } : {}),
      entities: [User, Paper, AnswerRecord, Prize, ExchangeRecord, StudentTermHistory],
      synchronize: true,
      logging: false
    }),
    TypeOrmModule.forFeature([User, Paper, AnswerRecord, Prize, ExchangeRecord, StudentTermHistory])
  ],
  controllers: [
    AuthController,
    StorageController,
    StudentController,
    AdminController,
    DashboardController
  ],
  providers: [
    AuthService,
    StorageService,
    AnswerService,
    ExchangeService,
    AuthGuard,
    RolesGuard
  ]
})
export class AppModule {}
