# syntax=docker/dockerfile:1

# NODE_ENV=production is set only in the final `runtime` stage: `deps`/`build` need
# devDependencies installed (nest, tsc, prisma CLI) to actually build the app — `npm ci` skips
# them when NODE_ENV=production is already set in the environment.
FROM node:22-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
# postinstall runs `prisma generate`, which needs the schema present (but not a live DB — see
# the comment in prisma.config.ts on why it reads DIRECT_URL via `process.env`, not `env()`).
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nestjs

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package.json ./package.json

USER nestjs
EXPOSE 3000
CMD ["node", "dist/main.js"]
