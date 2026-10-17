# Build from the repository root: the image needs the shared kernel, the web client and the API.
#   docker build -f server/Dockerfile -t cuidat .

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci
COPY shared shared
COPY client client
COPY server server
RUN npm run build -w shared && npm run build -w client && npm run build -w server \
 && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared ./shared
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/server/dist ./server/dist
# SQL migrations are plain files, so they are copied next to the compiled migrate.js.
COPY --from=build /app/server/src/db/migrations ./server/dist/db/migrations
WORKDIR /app/server
USER node
EXPOSE 3000
# Migrations are idempotent. They run before the server starts, because the free Render plan has no pre-deploy hook.
CMD ["sh", "-c", "node dist/db/migrate.js && exec node dist/main.js"]
