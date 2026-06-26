# TeleBlock indexer image. Apache-2.0
FROM node:22-alpine

WORKDIR /app

# Install only the indexer workspace's deps (it depends on viem).
COPY indexer/package.json indexer/package.json
RUN cd indexer && npm install --omit=dev

COPY indexer indexer

WORKDIR /app/indexer
EXPOSE 8090
CMD ["node", "src/index.js"]
