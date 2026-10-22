import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { TeamsService } from './teams.service';

@ApiTags('teams')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}
}
