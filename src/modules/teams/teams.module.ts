import { Module } from '@nestjs/common';

import { PlayersModule } from '../players/players.module';
import { UsersModule } from '../users/users.module';

import { TeamsController } from './teams.controller';
import { TeamsRepository } from './teams.repository';
import { TeamsService } from './teams.service';

@Module({
  imports: [UsersModule, PlayersModule],
  controllers: [TeamsController],
  providers: [TeamsService, TeamsRepository],
  exports: [TeamsService],
})
export class TeamsModule {}
