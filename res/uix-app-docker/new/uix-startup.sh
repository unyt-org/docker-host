#!/bin/bash

IMPORT_MAP_PATH="$1"
RUN_TS_URL="$2"
STAGE="$3"
shift 3
UIX_ARGS="$@"

rm -f deno.lock
$HOME/.uix/bin/deno run\
	--config deno.json\
	--import-map "$IMPORT_MAP_PATH"\
	-Aqr "$RUN_TS_URL"\
	--port 80\
	--stage "$STAGE"\
	--cache-path /datex-cache\
	-y "$UIX_ARGS"