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

ARG DENO

RUN if [ "$DENO" = "legacy" ] ; then curl -fsSL https://deno.land/install.sh | bash ; fi
RUN if [ ! "$DENO" ] ; then curl -fsSL https://unyt.land/install.sh | bash ; fi

# Startup UIX app
ENTRYPOINT ["./uix-startup.sh"]