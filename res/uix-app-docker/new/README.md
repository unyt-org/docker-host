# README

* `docker build -f ./Dockerfile --tag 'uix' --build-arg DENO="legacy" --build-arg DENO_VERSION="v1.46.2" .`
* `docker build -f ./Dockerfile --tag 'uix' --build-arg DENO="uix" --build-arg INSTALL_PACKAGES="git" .`
* `docker run --publish 9999:80 --platform linux/x86-64 -v $(pwd)/repo:/repo -it uix ./importmap.json https://dev.cdn.unyt.org/uix1/run.ts prod`