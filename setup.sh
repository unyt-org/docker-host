#!/bin/bash

if ! [ -x "$(command -v git)" ]; then
	echo "git must be installed"
	exit 1
fi

if ! [ -x "$(command -v docker)" ]; then
	echo "Docker must be installed"
	exit 1
fi

if ! [ -x "$(command -v unzip)" ]; then
	echo "unzip must be installed"
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


	echo "export DENO_INSTALL="\$HOME/.deno"" >> ~/.bashrc
	echo "export PATH=\"\$DENO_INSTALL/bin:\$PATH\"" >> ~/.bashrc
	
	. ~/.bash_profile
	. ~/.zprofile
	. ~/.bashrc
fi


ENDPOINT="$1"
if [ ${#ENDPOINT} -gt 20 ]; then
	echo "Error: Endpoint id/name must be <=18 bytes"
	exit 1
fi

mkdir -p $HOME/.unyt-docker-host/

DIR=$HOME/.unyt-docker-host/$ENDPOINT
GIT_ORIGIN=https://github.com/unyt-org/docker-host.git
SERVICE_NAME=$(systemd-escape "unyt_$(echo "$ENDPOINT" | sed 's/^[^a-z0-9]*//' | sed 's/[^a-z0-9_]/_/g')")
DENO_DIR=$(which deno)

if [ -d "$DIR" ]; then
	echo "$DIR does already exist. Please pick another endpoint or remove the existing Docker Host"
	exit
fi

# clone git repo
echo "Cloning git repo to $DIR ..."
git clone -b v2 $GIT_ORIGIN $DIR

# set access token
RANDOM_STRING=$(head /dev/urandom | LC_ALL=C tr -dc A-Za-z0-9 | head -c 16)
NEW_TOKEN="\"$(echo $RANDOM_STRING | sed 's/.\{4\}/&-/g;s/-$//')\""
sed -i.bak 's/token: "[^"]*"/token: '"$NEW_TOKEN"'/g' "$DIR/config.dx"

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

echo "Docker host '$ENDPOINT' is running"
echo -e "\nCheck status:"
echo "    systemctl status $SERVICE_NAME"
echo "    journalctl -u $SERVICE_NAME"
echo -e "\n"

systemctl status $SERVICE_NAME