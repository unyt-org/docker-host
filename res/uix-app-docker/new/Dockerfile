FROM --platform=linux/x86-64 ubuntu:latest

# Install Deno for UIX dependencies
RUN apt-get update && apt-get install -y \
	bash \
	unzip \
	curl

# List of packages to be installed by apt-get
ARG INSTALL_PACKAGES
RUN if [ ! -z "$INSTALL_PACKAGES" ] ; then apt-get install -y $INSTALL_PACKAGES ; fi

# Expose port 80
EXPOSE 80

# Copy startup.sh script
WORKDIR /uix
VOLUME /repo
COPY ./uix-startup.sh .
RUN chmod +x uix-startup.sh

# Install Deno
ARG DENO
RUN if [ "$DENO" = "legacy" ] ; then curl -fsSL https://deno.land/install.sh | bash; fi
RUN if [ "$DENO" != "legacy" ] ; then curl -fsSL https://raw.githubusercontent.com/unyt-org/uix-install/main/install-deno.sh | bash ; fi

# Set version for Deno
ARG DENO_VERSION
RUN if [ "$DENO_VERSION" ] && [ "$DENO" = "legacy" ] ; then $HOME/.deno/bin/deno upgrade --version "$DENO_VERSION"; fi
RUN if [ "$DENO_VERSION" ] && [ "$DENO" != "legacy" ] ; then $HOME/.uix/bin/deno upgrade --version "$DENO_VERSION"; fi

# Startup UIX app
ENTRYPOINT ["./uix-startup.sh"]