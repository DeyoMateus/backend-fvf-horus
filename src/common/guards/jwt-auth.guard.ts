import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Exige um access token JWT válido (Authorization: Bearer <token>). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
