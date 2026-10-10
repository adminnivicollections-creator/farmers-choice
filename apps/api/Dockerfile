# Multi-stage: build with dev deps, ship without them.
FROM node:22-slim AS build
WORKDIR /repo

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Workspace manifests first so the dependency layer caches.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/geo/package.json packages/geo/
COPY packages/fert/package.json packages/fert/
COPY packages/tokens/package.json packages/tokens/
RUN npm ci

COPY packages ./packages
COPY apps/api ./apps/api

RUN npm run build --workspace @fc/fert

WORKDIR /repo/apps/api
RUN npx prisma generate && npm run build

# ---------------------------------------------------------------- runtime
FROM node:22-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/geo/package.json packages/geo/
COPY packages/fert/package.json packages/fert/
COPY packages/tokens/package.json packages/tokens/
RUN npm ci --omit=dev

COPY packages ./packages
COPY --from=build /repo/packages/fert/dist ./packages/fert/dist
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /repo/node_modules/@prisma ./node_modules/@prisma

WORKDIR /repo/apps/api
EXPOSE 3000

# Migrations run on boot so a deploy can never serve a schema it doesn't have.
# Migrations always; seed only when asked. Neither can be skipped silently:
# a failed migration stops the boot rather than serving an unknown schema.
CMD ["sh", "-c", "npx prisma migrate deploy && \
  if [ \"$SEED_ON_BOOT\" = \"true\" ]; then node dist/seed/run.js; fi && \
  node dist/main.js"]
