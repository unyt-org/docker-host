FROM denoland/deno:alpine

ARG stage
ARG host_endpoint
# ARG uix_args

ENV APP_STAGE=$stage
ENV UIX_HOST_ENDPOINT=$host_endpoint
# ENV UIX_ARGS=$uix_args

# Copy repo
WORKDIR /app
COPY ./repo .

EXPOSE 80
# todo: $UIX_ARGS
CMD sh -c "rm -f deno.lock; rm -f ./src/deno.lock; deno upgrade --version 1.39.4 &>/dev/null; deno run --import-map https://cdn.unyt.org/uix@0.0.x/importmap.json -Aqr https://cdn.unyt.org/uix@0.0.x/run.ts --port 80 --stage $APP_STAGE --cache-path /datex-cache"
