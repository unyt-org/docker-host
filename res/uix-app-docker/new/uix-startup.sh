#!/bin/bash
IMPORT_MAP_PATH="$1"
RUN_TS_URL="$2"
STAGE="$3"
shift 3
UIX_ARGS="$@"

cd /repo/

if [ -x "$HOME/.uix/bin/deno" ]; then
	DENO_EXEC="$HOME/.uix/bin/deno"
elif [ -x "$HOME/.deno/bin/deno" ]; then
	DENO_EXEC="$HOME/.deno/bin/deno"
else
	echo "Error: Deno executable not found in either $HOME/.uix/bin/deno or $HOME/.deno/bin/deno"
	exit 1
fi

echo "Using Deno from $DENO_EXEC..."
rm -f deno.lock

"$DENO_EXEC" run \
	--config deno.json \
	--import-map "$IMPORT_MAP_PATH" \
	-Aqr "$RUN_TS_URL" \
	--port 80\
	--stage "$STAGE" \
	--cache-path /datex-cache \
	-y \
	"$UIX_ARGS"