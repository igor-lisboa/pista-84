# Local development image: the game plus its Node server. MongoDB and Redis run as
# separate Compose services (see docker-compose.yml). Not used by Heroku or Vercel.
FROM node:24-slim

WORKDIR /app

# Dependencies first so source edits do not reinstall them.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Generates www/ and the Worker asset module (needed by `npm run typecheck`).
RUN npm run build

EXPOSE 4173

# The development launcher speaks plain HTTP, so accounts and cookies work on localhost.
# Credentials and service URLs come from the Compose environment, never from the image.
CMD ["node", "dev-server.ts"]
