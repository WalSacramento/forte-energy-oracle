FROM node:20-alpine AS deps
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app/frontend
COPY --from=deps /app/frontend/node_modules ./node_modules
# Copy frontend source
COPY frontend/ .
# Copy artifacts and deployments from project root (needed by contracts.ts at build time)
COPY artifacts/ ../artifacts/
COPY deployments/ ../deployments/
RUN mkdir -p public && npm run build

FROM node:20-alpine AS runner
WORKDIR /app/frontend
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/frontend/public ./public
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./.next/static

EXPOSE 3001
CMD ["node", "server.js"]
