# Static host for the built SPA. Railway serves this container; the backend is a separate
# service and is reached cross-origin via VITE_API_BASE_URL.
#
# VITE_API_BASE_URL is a BUILD-time value, not a runtime one: Vite inlines import.meta.env into
# the bundle. Changing it therefore requires a rebuild, not a restart — set it as a Railway
# build variable, and expect a redeploy after any change.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
