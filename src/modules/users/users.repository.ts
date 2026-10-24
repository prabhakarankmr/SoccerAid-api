import { Injectable } from '@nestjs/common';

import { User } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  create(phone: string): Promise<User> {
    return this.prisma.user.create({ data: { phone } });
  }

  updateProfile(id: string, data: { name: string; username: string; bio?: string }): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }
}
