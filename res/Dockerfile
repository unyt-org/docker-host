FROM ubuntu


RUN apt-get update && apt-get install -y \
    software-properties-common \
	curl\
	lsof\
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
ENV TERM=xterm-256color
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v1.1.2/zsh-in-docker.sh)"


ARG username=user
ARG configpath=res/config-files
ENV username=${username}

# add user
RUN useradd -m -d /home/${username} ${username} -s /usr/bin/zsh
USER $username
RUN echo Shell: $SHELL

# copy config files
COPY $configpath /home/${username}/.unyt

WORKDIR /home/${username}

# start endpoint
ENTRYPOINT node /unyt-workbench/run.js /home/${username}/.unyt/endpoint.dx
