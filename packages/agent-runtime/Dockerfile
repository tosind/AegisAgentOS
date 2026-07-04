FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/agent-runtime/package.json packages/agent-runtime/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY packages/agent-runtime packages/agent-runtime
RUN npm run build -w @enterprise/shared && npm run build -w @enterprise/agent-runtime
RUN npm prune --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/agent-runtime/package.json ./packages/agent-runtime/package.json
COPY --from=builder /app/packages/agent-runtime/dist ./packages/agent-runtime/dist

WORKDIR /app/packages/agent-runtime
EXPOSE 8421

CMD ["node", "dist/index.js"]
