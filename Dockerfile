FROM ubuntu


RUN apt-get update && apt-get install -y \
    software-properties-common \
	curl\
    npm
RUN npm install npm -g && \
    npm install n -g && \
    n 18.7.0
RUN apt-get install -y \
	wget \
	git \
	zsh \
	vim \
	nano

# copy unyt workbench endpoint
COPY res/unyt-workbench /unyt-workbench

# install npm packages
WORKDIR /unyt-workbench
RUN npm install

# setup shell/terminal
ENV TERM=xterm
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v1.1.2/zsh-in-docker.sh)"

# add user
RUN useradd -m -d /home/user user -s /usr/bin/zsh
USER user
RUN echo Shell: $SHELL

# copy config files
COPY res/config-files /home/user/.unyt

# start endpoint
ENTRYPOINT node /unyt-workbench/run.js /home/user/.unyt/endpoint.dx

WORKDIR /home/user