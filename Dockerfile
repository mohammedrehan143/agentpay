FROM node:22.23.3-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
RUN npm ci --ignore-scripts
COPY . .

ENV NODE_ENV=production
ENV AGENTPAY_RECORDED=1
EXPOSE 4021
CMD ["node", "apps/reference-server/src/index.js"]
