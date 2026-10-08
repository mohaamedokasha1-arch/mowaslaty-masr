# Mowaslaty Egypt — backend API image
# Build from the repository root:  docker build -f apps/backend/Dockerfile .
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/
RUN npm install --workspace @mowaslaty/backend --include-workspace-root --no-audit --no-fund || npm install --no-audit --no-fund

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY packages/shared packages/shared
COPY apps/backend apps/backend
WORKDIR /app/apps/backend

# Generate the Prisma client and apply migrations + seed at container start.
RUN npx prisma generate

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:seed && npm run start"]
