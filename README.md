# Docker Host

Creates and manages docker containers (e.g. UIX Apps).
Containers can be created via a DATEX interface.

## Setup
A docker host instance can be created by running the `setup.sh` script:
```shell
curl -s https://raw.githubusercontent.com/unyt-org/docker-host/master/setup.sh | bash -s @+YOUR_DOCKER_HOST
```


## Deploying a UIX app

A UIX app is automatically deployed to this host if the `location` option in the `.dx`
file is set to the host endpoint. 
This can also be configured for a specific stage only, e.g.:

```datex
use stage from #public.uix;

location: stage {
	staging: 	@+YOUR_DOCKER_HOST_1,
	prod: 		@+YOUR_DOCKER_HOST_2
}
```

### Manual deployment via the DATEX interface

```datex
use ContainerManager from @+YOUR_DOCKER_HOST;

ref container = ContainerManager.createUIXAppContainer(
	"git@github.com:benStre/xam.git", // git origin for the UIX app 
	"main", // branch name
	@+my_app_deployment, // endpoint for the deployment stage
	"production", // stage
	["my-app.com"], // custom exposed domains
	["SECRET=123", "SECRET2=42"] // environment variables
);

print container.status // current container status
```



## Create a new Workbench (Development) Container
```datex
use ContainerManager from @+YOUR_DOCKER_HOST;

container = ContainerManager.createWorkbenchContainer();
container.start()
```