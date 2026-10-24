import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DomainException } from '../../common/errors';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PlayerSummaryEntity } from '../players/entities/player-summary.entity';

import { AddMemberDto } from './dto/add-member.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { LookupMemberDto } from './dto/lookup-member.dto';
import { SearchTeamsDto } from './dto/search-teams.dto';
import { SetCaptainDto } from './dto/set-captain.dto';
import { TeamDetailEntity } from './entities/team-detail.entity';
import { TeamSummaryEntity } from './entities/team-summary.entity';
import { TeamsService } from './teams.service';

@ApiTags('teams')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTeamDto,
  ): Promise<TeamSummaryEntity> {
    return this.teamsService.createTeam({
      name: dto.name,
      captainPlayerId: dto.captainPlayerId,
      contactNumber: dto.contactNumber,
      place: dto.place,
      logoUrl: dto.logoUrl,
      ownerId: user.id,
    });
  }

  /** "Our Teams" — teams this user owns. */
  @Get()
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchTeamsDto,
  ): Promise<TeamSummaryEntity[]> {
    return this.teamsService.searchOwned(user.id, query.q);
  }

  /** "Opponent Teams" — teams that have played a Match against one of this user's teams. */
  @Get('opponents')
  searchOpponents(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchTeamsDto,
  ): Promise<TeamSummaryEntity[]> {
    return this.teamsService.searchOpponents(user.id, query.q);
  }

  /** Finds a real app user by exact phone/username, for adding as captain or a roster player. */
  @Get('lookup-member')
  lookupMember(@Query() query: LookupMemberDto): Promise<PlayerSummaryEntity | null> {
    return this.teamsService.findMemberCandidate(query.identifier);
  }

  // Must come after the static routes above — otherwise `:id` would greedily match
  // "opponents"/"lookup-member" as an id.
  @Get(':id')
  async getById(@Param('id') id: string): Promise<TeamDetailEntity> {
    const team = await this.teamsService.getDetail(id);

    if (!team) {
      throw new DomainException('NOT_FOUND', 'Team not found', HttpStatus.NOT_FOUND);
    }

    return team;
  }

  @Post(':id/members')
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ): Promise<TeamDetailEntity> {
    return this.teamsService.addMember(id, user.id, dto.playerId);
  }

  @Delete(':id/members/:playerId')
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('playerId') playerId: string,
  ): Promise<TeamDetailEntity> {
    return this.teamsService.removeMember(id, user.id, playerId);
  }

  @Put(':id/captain')
  setCaptain(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetCaptainDto,
  ): Promise<TeamDetailEntity> {
    return this.teamsService.setCaptain(id, user.id, dto.playerId);
  }
}
