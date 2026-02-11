import { Body, Controller, Get, Inject, Param, Put, UseGuards, Req } from '@nestjs/common';
import { StorageService } from './storage.service';
import { AuthGuard } from './guards/auth.guard';
import { Roles } from './guards/roles.decorator';
import { RolesGuard } from './guards/roles.guard';

@Controller('api/storage')
@UseGuards(AuthGuard, RolesGuard)
export class StorageController {
  constructor(@Inject(StorageService) private storage: StorageService) {}

  @Get(':key')
  async getKey(@Param('key') key: string, @Req() req: any) {
    const user = req.user as { role: 'admin' | 'student'; studentNo?: string | null };
    return this.storage.getData(key, user.role, user.studentNo);
  }

  @Put(':key')
  @Roles('admin')
  async putKey(@Param('key') key: string, @Body() body: any) {
    await this.storage.saveData(key, body);
    return { ok: true };
  }
}
