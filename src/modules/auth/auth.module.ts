import { Module } from '@nestjs/common';

import { FirebaseModule } from '../../infra/firebase/firebase.module';
import { UsersModule } from '../users/users.module';

import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

@Module({
  imports: [FirebaseModule, UsersModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository],
  exports: [AuthService],
})
export class AuthModule {}
