FROM node:24-alpine

RUN apk add --no-cache tini

WORKDIR /app

COPY package.json ./
# npm is only needed to install. Removing it drops its bundled packages and their CVEs.
RUN npm install --omit=dev \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY server.js ./
COPY public ./public

ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
