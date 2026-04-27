FROM node:20-slim

WORKDIR /app

RUN corepack enable

ARG NEXT_PUBLIC_API_URL=http://localhost/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @fisrtname/web build

EXPOSE 3000

CMD ["pnpm", "--filter", "@fisrtname/web", "start"]
