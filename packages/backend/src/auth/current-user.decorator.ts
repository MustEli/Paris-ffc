import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { type PublicUser } from '../users/user.types';

/** Pulls the authenticated user off the request — set by JwtStrategy.validate(). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): PublicUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
