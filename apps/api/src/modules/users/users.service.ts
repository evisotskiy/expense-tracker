import { Injectable, NotFoundException } from '@nestjs/common';

import { type PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, baseCurrency: true, createdAt: true },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    return user;
  }

  findByEmail(email: string) {
    return this.prisma.client.user.findUnique({ where: { email } });
  }
}
