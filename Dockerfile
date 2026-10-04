# --- Build ---
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json tsconfig.build.json nest-cli.json ./
# prisma generate só lê o schema; a URL abaixo é fictícia (não conecta em nada)
# e existe apenas porque o prisma.config.ts exige a variável definida.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate
COPY src ./src
RUN npm run build

# --- Runtime ---
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# node_modules completo de propósito: o Prisma CLI (devDependency) é
# necessário no start para rodar `prisma migrate deploy`.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
