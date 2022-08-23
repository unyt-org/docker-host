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
	openssh-server \
	sudo \
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

# copy config files
COPY $configpath /home/${username}/.unyt

# SSH - not yet working
# Create sshuser directory in home
RUN mkdir -p /home/${username}/.ssh
# Copy the ssh public key in the authorized_keys file. The idkey.pub below is a public key file you get from ssh-keygen. They are under ~/.ssh directory by default.
COPY $configpath/sshkey.pub /home/${username}/.ssh/authorized_keys
# change ownership of the key file. 
RUN chown ${username} /home/${username}/.ssh/authorized_keys && chmod 600 /home/${username}/.ssh/authorized_keys
# Start SSH service
RUN service ssh start

USER $username

EXPOSE 22
CMD ["/usr/sbin/sshd", "-D"]





WORKDIR /home/${username}


#LABEL traefik.enable="true"
#LABEL traefik.http.routers.workbench.rule="Host(`wb1.unyt.org`)"
#LABEL traefik.http.routers.workbench.entrypoints="web"
#LABEL traefik.http.middlewares.redirect-to-https.redirectscheme.scheme="https"
#LABEL traefik.http.routers.workbench.middlewares="redirect-to-https@docker"
#LABEL traefik.http.routers.workbench-secured.rule="Host(`${UNYT_HOST}`)"
#LABEL traefik.http.routers.workbench-secured.tls="true"
#LABEL traefik.http.routers.workbench-secured.tls.certresolver="myhttpchallenge"







# start endpoint
ENTRYPOINT node /unyt-workbench/run.js /home/${username}/.unyt/endpoint.dx
