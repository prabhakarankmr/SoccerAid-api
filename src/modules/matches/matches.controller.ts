import { Body, Controller, Get, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DomainException } from '../../common/errors';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

import { CreateMatchDto } from './dto/create-match.dto';
import { SetLineupsDto } from './dto/set-lineups.dto';
import { MatchDetailEntity } from './entities/match-detail.entity';
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

  @Get(':id')
  async getById(@Param('id') id: string): Promise<MatchDetailEntity> {
    const match = await this.matchesService.getDetail(id);

    if (!match) {
      throw new DomainException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
    }

    return match;
  }

  @Put(':id/lineups')
  setLineups(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetLineupsDto,
  ): Promise<MatchDetailEntity> {
    return this.matchesService.setLineups(id, user.id, dto);
  }
}
