FROM node:26.13.1-bookworm-slim

RUN mkdir /app && chown node:node /app
WORKDIR /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .
COPY --from=contracts --chown=node:node openapi.yaml /contracts/openapi.yaml
RUN npm run generate:api

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
