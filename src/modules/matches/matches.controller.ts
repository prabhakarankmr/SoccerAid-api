import { Body, Controller, Get, HttpStatus, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DomainException } from '../../common/errors';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

import { AddTimeDto } from './dto/add-time.dto';
import { CreateMatchDto } from './dto/create-match.dto';
import { ListMatchesDto } from './dto/list-matches.dto';
import { RecordMatchEventDto } from './dto/record-event.dto';
import { SetLineupsDto } from './dto/set-lineups.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchDetailEntity } from './entities/match-detail.entity';
import { MatchSummaryEntity } from './entities/match-summary.entity';
import { MatchesService } from './matches.service';

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMatchDto,
  ): Promise<MatchDetailEntity> {
    return this.matchesService.createMatch(dto, user.id);
  }

  // Public "Matches" tab (§5.8 frontend) — any authenticated user, not scoped to their own
  // teams; backs spectating matches live (§1 Product Overview).
  @Get()
  list(@Query() query: ListMatchesDto): Promise<MatchSummaryEntity[]> {
    return this.matchesService.listMatches(query.status);
  }

  @Get(':id')
  async getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<MatchDetailEntity> {
    const match = await this.matchesService.getDetail(id, user.id);

    if (!match) {
      throw new DomainException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
    }

    return match;
  }

  @Patch(':id')
  updateMatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateMatchDto,
  ): Promise<MatchDetailEntity> {
    return this.matchesService.updateMatch(id, user.id, dto);
  }

  @Put(':id/lineups')
  setLineups(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetLineupsDto,
  ): Promise<MatchDetailEntity> {
    return this.matchesService.setLineups(id, user.id, dto);
  }

  @Post(':id/start')
  startMatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<MatchDetailEntity> {
    return this.matchesService.startMatch(id, user.id);
  }

  @Post(':id/events')
  recordEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RecordMatchEventDto,
  ): Promise<MatchDetailEntity> {
    return this.matchesService.recordEvent(id, user.id, dto);
  }

  @Post(':id/pause')
  pauseMatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<MatchDetailEntity> {
    return this.matchesService.pauseMatch(id, user.id);
  }

  @Post(':id/resume')
  resumeMatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<MatchDetailEntity> {
    return this.matchesService.resumeMatch(id, user.id);
  }

  @Post(':id/add-time')
  addTime(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddTimeDto,
  ): Promise<MatchDetailEntity> {
    return this.matchesService.addTime(id, user.id, dto);
  }

  @Post(':id/half-time')
  endFirstHalf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<MatchDetailEntity> {
    return this.matchesService.endFirstHalf(id, user.id);
  }

  @Post(':id/second-half')
  startSecondHalf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<MatchDetailEntity> {
    return this.matchesService.startSecondHalf(id, user.id);
  }

  @Post(':id/end')
  endMatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<MatchDetailEntity> {
    return this.matchesService.endMatch(id, user.id);
  }
}
