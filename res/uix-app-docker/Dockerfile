FROM denoland/deno:alpine

ARG repo

# Set the working directory
WORKDIR /

# Install Git
RUN apk update && apk add --no-cache git

# Clone repo
RUN git clone ${repo} app

WORKDIR /app/src

EXPOSE 80

CMD ["deno", "run", "-Aqr", "https://dev.cdn.unyt.org/uix/run.ts", "--port", "80"]