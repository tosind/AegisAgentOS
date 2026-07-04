FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/dashboard/package.json packages/dashboard/package.json
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/shared packages/shared
COPY packages/dashboard packages/dashboard
RUN npm run build -w @enterprise/shared && npm run build -w @enterprise/dashboard

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

COPY --from=builder /app/packages/dashboard/.next/standalone ./
COPY --from=builder /app/packages/dashboard/.next/static ./packages/dashboard/.next/static

EXPOSE 3000
ENV PORT 3000

CMD ["node", "packages/dashboard/server.js"]
