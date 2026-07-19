# first stage, can't use alpine for building armv7
FROM node:22 AS builder
WORKDIR /app

# copy all files
COPY . .

# install, build and prune
RUN rm -rf .svelte-kit && npm install --verbose && \
  npm run build && \
  npm prune --omit=dev

# second stage
FROM node:22-alpine
WORKDIR /app

# copy files to /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js .
COPY --from=builder /app/package.json .

# set environment
ENV PORT=5050 \
  NODE_ENV=production \
  ADDON=false \
  SCREEN_IMAGE_DIR=/app/data/screen-images \
  SCREEN_IMAGE_EXTENSIONS=jpg,jpeg,png,webp \
  SCREEN_INTERVAL=30 \
  SCREEN_LYRICS_API_URL=

EXPOSE 5050
CMD ["node", "server.js"]
