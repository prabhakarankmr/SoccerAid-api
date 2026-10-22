import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { MatchesService } from './matches.service';

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}
}
