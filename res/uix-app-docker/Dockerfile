FROM denoland/deno

ARG stage
ENV app_stage=$stage

# Copy repo
WORKDIR /app
COPY ./repo .
WORKDIR /app/src

EXPOSE 80

CMD deno run -Aqr https://dev.cdn.unyt.org/uix/run.ts --port 80 --stage $app_stage