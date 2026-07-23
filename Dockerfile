FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js jsconfig.json tailwind.config.js postcss.config.js components.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app/server
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/prisma ./prisma
RUN npx prisma generate

COPY server/src ./src
COPY --from=frontend-build /app/dist ./public

RUN mkdir -p /app/data /app/server/uploads

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
