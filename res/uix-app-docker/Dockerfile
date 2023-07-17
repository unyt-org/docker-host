FROM denoland/deno

ARG stage
ARG host_endpoint

ENV APP_STAGE=$stage
ENV UIX_HOST_ENDPOINT=$host_endpoint

# Copy repo
WORKDIR /app
COPY ./repo .
WORKDIR /app/src

EXPOSE 80

CMD deno run --importmap https://dev.cdn.unyt.org/importmap.json -Aqr https://dev.cdn.unyt.org/uix/run.ts --port 80 --stage $APP_STAGE