import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Throttle({
    default: {
      limit: Number.parseInt(process.env.LOGIN_THROTTLE_LIMIT ?? '5', 10) || 5,
      ttl: Number.parseInt(process.env.LOGIN_THROTTLE_TTL_MS ?? '60000', 10) || 60_000,
    },
  })
  @Post('login')
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    return this.authService.login(dto, response);
  }

  @Public()
  @Throttle({
    default: {
      limit: Number.parseInt(process.env.LOGIN_THROTTLE_LIMIT ?? '5', 10) || 5,
      ttl: Number.parseInt(process.env.LOGIN_THROTTLE_TTL_MS ?? '60000', 10) || 60_000,
    },
  })
  @Post('refresh')
  refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshTokenCookieName = this.configService.get<string>(
      'refreshTokenCookieName',
      'fisrtname_rt',
    );
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const cookieValue = cookies?.[refreshTokenCookieName];
    const refreshToken = typeof cookieValue === 'string' ? cookieValue : undefined;

    return this.authService.refresh(response, refreshToken);
  }

  @Post('logout')
  logout(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.logout(user, response);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user);
  }
}
