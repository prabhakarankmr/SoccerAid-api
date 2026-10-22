import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { TournamentsService } from './tournaments.service';

@ApiTags('tournaments')
@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}
}
