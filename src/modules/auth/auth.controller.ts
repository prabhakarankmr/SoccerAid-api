import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';

import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyFirebaseTokenDto } from './dto/verify-firebase-token.dto';
import { AuthResultEntity, TokenPairEntity } from './entities/auth-result.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('firebase/verify')
  verifyFirebase(@Body() dto: VerifyFirebaseTokenDto): Promise<AuthResultEntity> {
    return this.authService.verifyFirebaseToken(dto.idToken);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenPairEntity> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto): Promise<{ success: true }> {
    await this.authService.logout(dto.refreshToken);
    return { success: true };
  }
}
