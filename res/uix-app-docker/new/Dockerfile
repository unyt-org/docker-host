FROM --platform=linux/x86-64 ubuntu:latest
RUN apt-get update && apt-get install -y \
	bash \
	unzip \
	curl

EXPOSE 80

WORKDIR /uix
COPY ./repo .
COPY ./uix-startup.sh .

RUN curl -fsSL https://unyt.land/install.sh | bash
RUN chmod +x ./uix-startup.sh

ENTRYPOINT ["./uix-startup.sh ./importmap.json https://dev.cdn.unyt.org/uix1/run.ts dev"]