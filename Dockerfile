FROM node:18

RUN mkdir /app

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV DATABASE_URL_SOURCE=postgresql://username:password@host:port/database_name
ENV DATABASE_URL_TARGET=postgresql://username:password@host:port/database_name

ENV SCHEDULE_TIME="0 0 * * *"
ENV SCHEDULE_TIMEZONE=UTC

ENV RUN_ON_STARTUP=true

ENV FAILOVER_RETRIES=3
ENV FAILOVER_RETRY_DELAY_MS=10000

RUN apt-get update && apt-get install -y postgresql-client

CMD ["npm", "start"]
