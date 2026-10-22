import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Migrations run against Neon's DIRECT (non-pooled) endpoint — see BACKEND_INSTRUCTIONS.md §11.
// The running app uses a separate driver-adapter instance against DATABASE_URL (pooled); see
// src/infra/prisma/prisma.service.ts.
//
// Deliberately `process.env.DIRECT_URL`, not the `env()` helper: every Prisma CLI invocation
// loads this file, and `env()` throws immediately if the var is unset — which would break
// `prisma generate` (schema-only, no DB needed) during `npm install`/the Docker build. `migrate
// dev`/`deploy` still fail correctly, just with a connection error instead of a config error.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
