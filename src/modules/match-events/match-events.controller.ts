import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { MatchEventsService } from './match-events.service';

@ApiTags('match-events')
@Controller('matches/:id/events')
export class MatchEventsController {
  constructor(private readonly matchEventsService: MatchEventsService) {}
}
