FROM node:24-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@11.23.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY dashboard/package.json ./dashboard/package.json

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Prod Deps
FROM node:24-alpine AS prod-deps
WORKDIR /app

RUN npm install -g pnpm@11.23.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY dashboard/package.json ./dashboard/package.json

RUN pnpm install --frozen-lockfile --prod --filter openwhispr-proxy

# Runner
FROM node:24-alpine AS runner
WORKDIR /app

LABEL dev.orbstack.icon="https://raw.githubusercontent.com/cmglezpdev/openwhispr-proxy/main/assets/orbstack-icon.png"

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist/ ./dist
COPY --from=builder /app/dashboard/dist/ ./dashboard/dist
COPY --from=prod-deps /app/node_modules/ ./node_modules

ENV PORT=8080
EXPOSE $PORT
CMD ["node", "dist/main"]
