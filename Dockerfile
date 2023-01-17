FROM node:18-alpine

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

CMD ["npm", "start"]
