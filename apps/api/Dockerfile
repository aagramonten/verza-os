# Verza OS API — multi-stage production image.
# Build from the monorepo root:  docker build -f apps/api/Dockerfile .

FROM node:20-slim AS build
WORKDIR /workspace
ENV CI=true

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @verza/api --workspace @verza/shared --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npx -w @verza/api prisma generate \
  && npm run -w @verza/api build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# OpenSSL is required by the Prisma engine on slim images.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/dist ./dist
COPY --from=build /workspace/apps/api/prisma ./prisma
COPY --from=build /workspace/apps/api/package.json ./package.json

EXPOSE 3333
# Run migrations, then start. Railway's release phase can also run the deploy step.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
