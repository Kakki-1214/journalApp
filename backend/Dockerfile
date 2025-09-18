# syntax=docker/dockerfile:1.6
FROM node:20-bullseye-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-bullseye-slim AS build
WORKDIR /app
# Toolchain for native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure native module matches this image
RUN npm rebuild better-sqlite3 --build-from-source
RUN npm run build

FROM node:20-bullseye-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# user could be added for security; omitted for simplicity now
EXPOSE 3000
# Allow extensionless ESM specifiers at runtime without rewriting imports
CMD ["node","--experimental-specifier-resolution=node","dist/index.js"]
