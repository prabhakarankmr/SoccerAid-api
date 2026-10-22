import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { LeaderboardsService } from './leaderboards.service';

@ApiTags('leaderboards')
@Controller('leaderboards')
export class LeaderboardsController {
  constructor(private readonly leaderboardsService: LeaderboardsService) {}
}
