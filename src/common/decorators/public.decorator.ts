import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as not requiring JWT auth. Every other route requires it (§9.2). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
