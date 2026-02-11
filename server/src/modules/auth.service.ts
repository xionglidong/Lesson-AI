import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { config } from '../config';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(@InjectRepository(User) private users: Repository<User>) {}

  async onModuleInit() {
    await this.ensureAdmin();
  }

  async ensureAdmin(): Promise<void> {
    const existing = await this.users.findOne({ where: { role: 'admin' } });
    if (existing) return;
    const passwordHash = await bcrypt.hash(config.admin.password, 10);
    const admin = this.users.create({
      role: 'admin',
      username: config.admin.username,
      passwordHash,
      name: '管理员',
      points: 0
    });
    await this.users.save(admin);
  }

  issueToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        role: user.role,
        studentNo: user.studentNo,
        name: user.name
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );
  }

  async adminLogin(username: string, password: string): Promise<{ token: string; user: User }> {
    await this.ensureAdmin();
    const user = await this.users.findOne({ where: { role: 'admin', username } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('用户名或密码错误');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('用户名或密码错误');
    const token = this.issueToken(user);
    return { token, user };
  }

  async studentLogin(studentNo: string, name: string): Promise<{ token: string; user: User }> {
    const user = await this.users.findOne({ where: { role: 'student', studentNo } });
    if (!user) throw new UnauthorizedException('学号不存在');
    if (user.name !== name) throw new UnauthorizedException('姓名与学号不匹配');
    const token = this.issueToken(user);
    return { token, user };
  }
}
