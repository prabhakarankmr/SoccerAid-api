import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CreatePlayerDto } from './dto/create-player.dto';
import { SearchPlayersDto } from './dto/search-players.dto';
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
}
