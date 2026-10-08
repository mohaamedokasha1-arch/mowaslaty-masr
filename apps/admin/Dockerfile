# Mowaslaty Egypt — admin dashboard image
# Build from the repository root:  docker build -f apps/admin/Dockerfile .
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS builder
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/admin/package.json apps/admin/
RUN npm install --no-audit --no-fund
COPY packages/shared packages/shared
COPY apps/admin apps/admin
RUN npm run build --workspace @mowaslaty/admin

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared packages/shared
COPY --from=builder /app/apps/admin apps/admin
WORKDIR /app/apps/admin
EXPOSE 3002
CMD ["npm", "run", "start"]
