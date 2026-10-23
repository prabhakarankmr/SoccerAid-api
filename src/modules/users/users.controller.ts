import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

import { UpdateMeDto } from './dto/update-me.dto';
import { MeEntity } from './entities/me.entity';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<MeEntity> {
    return this.usersService.getMe(user.id);
  }

  @Patch()
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMeDto): Promise<MeEntity> {
    return this.usersService.updateMe(user.id, user.phone, dto);
  }
}
