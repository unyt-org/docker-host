#!/bin/bash

if ! [ -x "$(command -v git)" ]; then
	echo "git must be installed"
	exit 1
fi

if ! [ -x "$(command -v docker)" ]; then
	echo "docker must be installed"
	exit 1
fi

# Install deno
if ! [ -x "$(command -v deno)" ]; then
	echo 'Installing deno...'
	curl -fsSL https://deno.land/x/install/install.sh | sh

	# add deno to bashrc
	echo "export DENO_INSTALL="\$HOME/.deno"" >> ~/.bash_profile
	echo "export PATH=\"\$DENO_INSTALL/bin:\$PATH\"" >> ~/.bash_profile

	echo "export DENO_INSTALL="\$HOME/.deno"" >> ~/.zprofile
	echo "export PATH=\"\$DENO_INSTALL/bin:\$PATH\"" >> ~/.zprofile

	. ~/.bash_profile
	. ~/.zprofile
fi


echo "Please enter the endpoint id for this docker host:"
read ENDPOINT

mkdir -p $HOME/.unyt-docker-host/

DIR=$HOME/.unyt-docker-host/$ENDPOINT
GIT_ORIGIN=https://github.com/unyt-org/docker-host.git
SERVICE_NAME=unyt_docker_host_$ENDPOINT
DENO_DIR=$(which deno)

# clone git repo
echo "Cloning git repo to $DIR ..."
git clone $GIT_ORIGIN $DIR

# rename endpoint
echo "endpoint: $ENDPOINT" > "$DIR/.dx"


# Create the service unit file
cat > /etc/systemd/system/$SERVICE_NAME.service <<EOL
[Unit]
Description=Docker Host ($ENDPOINT)
After=network.target
StartLimitIntervalSec=0

[Service]
Restart=on-failure
RestartSec=3s
User=$USER
WorkingDirectory=$DIR
ExecStartPre=rm -f $DIR/deno.lock
ExecStart=$DENO_DIR run -Aqr $DIR/main.ts

[Install]
WantedBy=multi-user.target

EOL

# Reload systemd
systemctl daemon-reload

# Enable and start the service
systemctl enable $SERVICE_NAME
systemctl start $SERVICE_NAME

echo "Docker host running"
echo "\nCheck status:"
echo "    systemctl status $SERVICE_NAME"
echo "    journalctl -u $SERVICE_NAME"
echo "\n"

systemctl status $SERVICE_NAME