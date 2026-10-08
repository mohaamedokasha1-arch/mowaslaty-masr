# Mowaslaty Egypt — public web app image
# Build from the repository root:  docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS builder
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm install --no-audit --no-fund
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace @mowaslaty/web

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared packages/shared
COPY --from=builder /app/apps/web apps/web
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "run", "start"]
