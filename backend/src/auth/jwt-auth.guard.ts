import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Hard gate: no valid token -> 401. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
