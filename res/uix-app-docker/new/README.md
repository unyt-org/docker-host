# README

## Default
* `docker build --tag 'uix' .`
* `docker run --platform linux/x86-64 uix`
* `docker run --publish 9999:80 --platform linux/x86-64 -it uix`
* `docker run --publish 9999:80 --platform linux/x86-64 -it uix /bin/bash`

## With args and expose
* `docker build --tag 'uix' --build-arg INSTALL_PACKAGES="git" .`
* `docker run --publish 9999:80 --platform linux/x86-64 -it uix ./importmap.json https://dev.cdn.unyt.org/uix1/run.ts dev --verbose`

## Latest
* `docker build --tag 'uix' --build-arg INSTALL_PACKAGES="" .`
* `docker build --tag 'uix' --build-arg --build-arg DENO="legacy" .`
* `docker run --publish 9999:80 --platform linux/x86-64 -v $(pwd)/repo:/repo -it uix ./importmap.json https://dev.cdn.unyt.org/uix1/run.ts prod`