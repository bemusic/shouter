# == bmsampler ==
FROM node:10.16.3-stretch

# Install p7zip and sox
RUN sed -i "s/stretch main/stretch main contrib non-free/" /etc/apt/sources.list \
  && apt-get update \
	&& apt-get install -y \
    sox \
    libsox-fmt-mp3 \
    libsndfile1 \
    lame \
    libshout3 \
    libshout3-dev \
	&& rm -rf /var/lib/apt/lists/*

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY yarn.lock /usr/src/app/
COPY package.json /usr/src/app/
RUN yarn install --frozen-lockfile

ENV LANG C.UTF-8
COPY src/ /usr/src/app/src/
CMD ["bash", "-c", "node src/index.js"]