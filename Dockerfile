FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Public analytics ID is optional. No server secret belongs in VITE_*.
ARG VITE_ANALYTICS_ID=""
ARG VITE_ANALYTICS_ORIGIN=""
ARG VITE_ANALYTICS_PARENT_ORIGIN=""
ARG ATLAS_BASE_PATH="/"
ENV VITE_ANALYTICS_ID=$VITE_ANALYTICS_ID
ENV VITE_ANALYTICS_ORIGIN=$VITE_ANALYTICS_ORIGIN
ENV VITE_ANALYTICS_PARENT_ORIGIN=$VITE_ANALYTICS_PARENT_ORIGIN
ENV ATLAS_BASE_PATH=$ATLAS_BASE_PATH
RUN pnpm build
FROM nginx:alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
