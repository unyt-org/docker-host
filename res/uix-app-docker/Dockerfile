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
CMD sh -c "rm -f deno.lock; rm -f ./src/deno.lock; deno run --importmap https://dev.cdn.unyt.org/importmap.json -Aqr https://dev.cdn.unyt.org/uix/run.ts --port 80 --stage $APP_STAGE --cache-path /datex-cache"