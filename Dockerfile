# Static host for the built SPA, with Caddy proxying /api to the backend service.
#
# The proxy is deliberate: the backend resolves which store a request belongs to
# from the Host header, so the browser must talk to the shop's own domain and
# never to the API's. See the Caddyfile and docs/storefront-api-guide.md §1.2.
#
# Consequently API_UPSTREAM is a RUNTIME variable (read by Caddy), not a build
# argument. VITE_API_BASE_URL remains available as an escape hatch for a
# deployment that genuinely cannot proxy — leave it unset for the normal case,
# and remember Vite inlines it into the bundle, so setting it needs a rebuild.
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
