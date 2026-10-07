import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
/** Opt an endpoint out of the global JWT guard. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
