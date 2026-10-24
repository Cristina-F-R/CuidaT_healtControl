# Build from the repository root: the image needs the shared kernel, the web client and the API.
#   docker build -f server/Dockerfile -t cuidat .

# OWASP A08: exact version plus digest, so a rebuild cannot pull a different base image.
# To update: docker buildx imagetools inspect node:22.x.y-bookworm-slim
ARG NODE_IMAGE=node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci
COPY shared shared
COPY client client
COPY server server
# Client build-time settings: Vite inlines them into the bundle. VITE_API_URL stays empty (same origin, /api).
ARG VITE_SENTRY_DSN=""
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN}
RUN npm run build -w shared && npm run build -w client && npm run build -w server \
 && npm prune --omit=dev

FROM ${NODE_IMAGE} AS runtime
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
