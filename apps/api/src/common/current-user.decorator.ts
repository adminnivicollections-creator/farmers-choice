import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AuthUser = { id: string; roles: string[] };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
