import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExchangeRecord } from '../entities/exchange-record.entity';
import { Prize } from '../entities/prize.entity';
import { User } from '../entities/user.entity';

function formatDateTime(input: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())} ${pad(input.getHours())}:${pad(input.getMinutes())}:${pad(input.getSeconds())}`;
}

@Injectable()
export class ExchangeService {
  constructor(
    @InjectRepository(ExchangeRecord) private exchanges: Repository<ExchangeRecord>,
    @InjectRepository(Prize) private prizes: Repository<Prize>,
    @InjectRepository(User) private users: Repository<User>
  ) {}

  async redeem(studentNo: string, studentName: string, prizeId: string) {
    const prize = await this.prizes.findOne({ where: { id: prizeId } });
    if (!prize) throw new BadRequestException('奖品不存在');

    const user = await this.users.findOne({ where: { role: 'student', studentNo } });
    if (!user) throw new BadRequestException('学生不存在');

    if ((user.points || 0) < prize.points) {
      throw new BadRequestException(`积分不足，需要${prize.points}分`);
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
}
