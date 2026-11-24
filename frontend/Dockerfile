FROM node:26.13.1-bookworm-slim

RUN mkdir /app && chown node:node /app
WORKDIR /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
