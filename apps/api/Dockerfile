# Verza OS API — multi-stage production image.
# Build from the monorepo root:  docker build -f apps/api/Dockerfile .

FROM node:20-slim AS build
WORKDIR /workspace
ENV CI=true

# OpenSSL is needed so `prisma generate` detects the right engine target.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @verza/api --workspace @verza/shared --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

# Generate the Prisma client, then bundle the API + seed into self-contained
# JS (inlines @verza/shared so the runtime needs no workspace/TS resolution).
RUN npx -w @verza/api prisma generate \
  && npm run -w @verza/api bundle

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# OpenSSL is required by the Prisma engine on slim images.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# node_modules provides the external deps (Prisma client + engine, Express, …)
# and the Prisma CLI used by `migrate deploy`.
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/dist ./dist
COPY --from=build /workspace/apps/api/prisma ./prisma
COPY --from=build /workspace/apps/api/package.json ./package.json

EXPOSE 3333
# Apply migrations, seed (idempotent), then start. Railway injects PORT + DATABASE_URL.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/seed.js && node dist/main.js"]
