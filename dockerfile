FROM node:12.12.0-alpine

RUN mkdir -p /usr/src/app/challenge
WORKDIR /usr/src/app

COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
COPY ./challenge/transactions-1.json ./challenge
COPY ./challenge/transactions-2.json ./challenge

RUN npm ci
RUN npm run build

CMD [ "npm", "start" ]
