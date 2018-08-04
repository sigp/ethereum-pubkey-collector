FROM node:alpine

RUN echo "ipv6" >> /etc/modules
RUN apk --update add supervisor
RUN apk add python bash build-base git 

RUN mkdir /code
WORKDIR /code

ADD package.json .
RUN npm install
RUN npm install -g forever

ADD ./pubkey-collector.js ./
ADD ./pubkey-collector-entrypoint.sh ./
RUN chmod +x ./pubkey-collector-entrypoint.sh

ENTRYPOINT ["./pubkey-collector-entrypoint.sh"]
