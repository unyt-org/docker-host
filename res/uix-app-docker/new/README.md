# README

* `docker build --tag 'uix' .`
* `docker run --platform linux/x86-64 uix`
* `docker run --publish 9999:80 --platform linux/x86-64 -it uix`
* `docker run --publish 9999:80 --platform linux/x86-64 -it uix /bin/bash`