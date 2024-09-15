# Docker Host

The **Docker Host** is a service to create and manage UIX App containers as portable Docker containers used for UIX app deployment.
Remote containers are created via [DATEX interface](https://docs.unyt.org/manual/datex/public-endpoint-interfaces) on the Docker Host.

## Setup
> [!WARNING]
> **Docker Hosts** are only support on Linux systems. If you experience some issues with your Linux distribution please let us know.


You can setup your personal **Docker Host** on the target machine using the following command:
```bash
curl -s https://raw.githubusercontent.com/unyt-org/docker-host/master/setup.sh | bash -s @+YOUR_DOCKER_HOST
```

Make sure to pass a unique [endpoint id](https://docs.unyt.org/manual/datex/endpoints) to the install script. The setup script will create a docker host instance by installing [Deno](https://github.com/denoland/deno) and creating a persistent service inside of `etc/systemd/system`.

Make sure that the service is up and running:
```bash
systemctl status unyt_YOUR_DOCKER_HOST
```

![Status ](.github/service-status.png)

## Configuration
The `config.dx` file is used to apply custom configuration to the Docker Host:
```ts
{
	token: "ACCESS_TOKEN",
	enableTraefik: false, 
	hostPort: 80,
	allowArbitraryDomains: true,
	setDNSEntries: false
}
```
* **token** - If an access token is configured, the Docker Host will deploy apps only if they have the correct token configured. It is highly recommended to use a strong access token if the Docker Host is only used for personal deployment.
* **enableTraefik** - If enabled, a [Traefik Proxy](https://traefik.io/traefik/) is installed automatically to act as reverse proxy on your system to handle different domains and automatic SSL. If this option is disabled, you have to make sure to handle the routing of HTTP traffic to your personal container by yourself.
* **hostPort** - Configure the Docker Port to expose traefik on.
---
* **allowArbitraryDomains** (*internal*) - Allow arbitrary domains to be configured. If set to false, only [*.unyt.app](https://unyt.app)-domains. can be used for deployment.
* **setDNSEntries** (*internal*) - If you have access to the [unyt.org DNS service](https://github.com/unyt-org/dns), you can enable this option to allow for the resolval for [*.unyt.app](https://unyt.app)-domains.

To reload the configuration, the service must be restarted using the following command:
```bash
systemctl restart unyt_YOUR_DOCKER_HOST
```

## Deploying your UIX app

Your UIX app is automatically deployed to host if the `location` option in the `backend/.dx` file is set to the Docker Host endpoint. Please refer to the [Deployment Documentation](https://docs.unyt.org/manual/uix/deployment#example) for more details.

The location can be customized for specific stages:

```ts
use stage from #public.uix;

location: stage {
	staging: 	@+YOUR_DOCKER_HOST_1,
	prod: 		@+YOUR_DOCKER_HOST_2
}
```

You can configure custom (sub)-domains to be used by your app for different stages:

```ts
domain: stage {
	staging:	"staging.example.com",
	prod:		"example.com"
}
```

You can configure custom endpoints to be used as your app backend endpoints for different stages:

```ts
endpoint: stage {
	staging:	@+example,
	prod:		@+example-stage
}
```

> [!WARNING]
> If the Docker Host you plan to deploy to has a access token configured, you need to pass this access token to UIX to make sure your app can authenticate.<br/>
> You can set the access token as `HOST_TOKEN` environment variable on your local UIX projects console.
> ```bash
> export HOST_TOKEN=YOUR_TOKEN
> ```

To deploy your UIX app, please make sure you have the latest changes in sync with your remote git repository. This is required by the Docker Host, since it will clone your sources via [GitHub](https://github.com) or [GitLab](https://gitlab.com) API on deployment.

To deploy your app, start `uix` via CLI. If you want to select a custom stage pass the `--stage <name>` argument.

```bash
uix --stage prod
```

### Manual deployment via the DATEX interface

```datex
use ContainerManager from @+YOUR_DOCKER_HOST;

ref container = ContainerManager.createUIXAppContainer(
	"secret", // Optional access token if configured so
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

container = ContainerManager.createWorkbenchContainer(token);
container.start()
```