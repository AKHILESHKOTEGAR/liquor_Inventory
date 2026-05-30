FROM node:20-alpine

RUN npm install -g pnpm@9.1.0

WORKDIR /app

# Copy workspace manifest first (layer cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/api/package.json ./packages/api/

# Install all deps
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/db ./packages/db
COPY packages/api ./packages/api

# Generate Prisma client + compile TypeScript
RUN pnpm --filter @liquor/db generate
RUN pnpm --filter @liquor/api build

ENV NODE_ENV=production
EXPOSE 3001

# Push schema to DB then start (db push is idempotent)
CMD ["sh", "-c", "npx prisma db push --schema=./packages/db/prisma/schema.prisma --skip-generate --accept-data-loss && node packages/api/dist/server.js"]
