FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/security-layer/package.json packages/security-layer/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY packages/security-layer packages/security-layer
RUN npm run build -w @enterprise/shared && npm run build -w @enterprise/security-layer
RUN npm prune --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/security-layer/package.json ./packages/security-layer/package.json
COPY --from=builder /app/packages/security-layer/dist ./packages/security-layer/dist

WORKDIR /app/packages/security-layer
EXPOSE 8423

CMD ["node", "dist/index.js"]
