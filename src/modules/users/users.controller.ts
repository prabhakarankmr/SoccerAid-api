import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { UsersService } from './users.service';

@ApiTags('users')
@Controller('me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
}
