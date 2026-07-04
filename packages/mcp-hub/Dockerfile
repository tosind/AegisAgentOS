FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/mcp-hub/package.json packages/mcp-hub/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY packages/mcp-hub packages/mcp-hub
RUN npm run build -w @enterprise/shared && npm run build -w @enterprise/mcp-hub
RUN npm prune --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/mcp-hub/package.json ./packages/mcp-hub/package.json
COPY --from=builder /app/packages/mcp-hub/dist ./packages/mcp-hub/dist

WORKDIR /app/packages/mcp-hub
EXPOSE 8422

CMD ["node", "dist/index.js"]
