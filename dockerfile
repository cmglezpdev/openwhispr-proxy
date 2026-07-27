FROM node:26-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@latest
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Prod Deps
FROM node:26-alpine AS prod-deps
WORKDIR /app

RUN npm install -g pnpm@latest
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile --prod

# Runner
FROM node:26-alpine AS runner
WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist/ ./dist
COPY --from=prod-deps /app/node_modules/ ./node_modules

ENV PORT=8080
EXPOSE $PORT
CMD ["node", "dist/main"]
