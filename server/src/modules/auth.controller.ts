import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';

@Controller('api/auth')
export class AuthController {
  constructor(@Inject(AuthService) private auth: AuthService) {}

  @Post('admin/login')
  async adminLogin(@Body() body: { username: string; password: string }) {
    const { token, user } = await this.auth.adminLogin(body.username, body.password);
    return { token, user: this.sanitize(user) };
  }

  @Post('student/login')
  async studentLogin(@Body() body: { studentId: string; name: string }) {
    const { token, user } = await this.auth.studentLogin(body.studentId, body.name);
    return { token, user: this.sanitize(user) };
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async me() {
    return { ok: true };
  }

  private sanitize(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
