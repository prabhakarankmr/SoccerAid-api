import { Body, Controller, Get, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { DomainException } from '../../common/errors';

import { CreatePlayerDto } from './dto/create-player.dto';
import { SearchPlayersDto } from './dto/search-players.dto';
import { PlayerStatsEntity } from './entities/player-stats.entity';
import { PlayerSummaryEntity } from './entities/player-summary.entity';
import { PlayersService } from './players.service';

@ApiTags('players')
@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  async search(@Query() query: SearchPlayersDto): Promise<PlayerSummaryEntity[]> {
    const players = await this.playersService.search(query.q);
    return players.map((player) => ({
      id: player.id,
      displayName: player.displayName,
      phone: player.phone,
      preferredPosition: player.preferredPosition,
    }));
  }

  @Post()
  async create(@Body() dto: CreatePlayerDto): Promise<PlayerSummaryEntity> {
    const player = await this.playersService.createPlayer(dto.displayName);
    return {
      id: player.id,
      displayName: player.displayName,
      phone: player.phone,
      preferredPosition: player.preferredPosition,
    };
  }

  @Get(':id/stats')
  async getStats(@Param('id') id: string): Promise<PlayerStatsEntity> {
    const stats = await this.playersService.getStats(id);

    if (!stats) {
      throw new DomainException('NOT_FOUND', 'Player not found', HttpStatus.NOT_FOUND);
    }

    return { playerId: id, ...stats };
  }
}
