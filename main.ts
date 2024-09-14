// deno-lint-ignore-file require-await
import { OutputMode, exec } from "https://deno.land/x/exec@0.0.5/mod.ts";
import { EndpointConfig } from "./endpoint-config.ts";
import { Datex, property, sync } from "unyt_core";
import { Class } from "unyt_core/utils/global_types.ts";
import { config } from "./config.ts";
import { getIP } from "https://deno.land/x/get_ip@v2.0.0/mod.ts";
import { Path } from "unyt_core/utils/path.ts";
import { formatEndpointURL } from "unyt_core/utils/format-endpoint-url.ts";
import Container from "./src/container/Container.ts";
import RemoteImageContainer from "./src/container/RemoteImageContainer.ts";
import UIXAppContainer from "./src/container/UIXAppContainer.ts";
import WorkbenchContainer from "./src/container/WorkbenchContainer.ts";
import { ESCAPE_SEQUENCES } from "unyt_core/utils/logger.ts";

const publicServerIP = await getIP({ipv6: false});

const defaulTraefikToml = `
[entryPoints]
  [entryPoints.web]
  address = ":80"

  [entryPoints.web-secure]
  address = ":443"

[api]
  dashboard = true

[providers.docker]
  endpoint = "unix:///var/run/docker.sock"
  exposedByDefault = false
  network = "main"

[certificatesresolvers.myhttpchallenge.acme]
    caserver = "https://acme-v02.api.letsencrypt.org/directory"
    email = "postmaster@unyt.org"
    [certificatesresolvers.myhttpchallenge.acme.httpchallenge] 
    entrypoint = "web"
`

const logger = new Datex.Logger("docker host");

logger.info("Config: ", config);

await Datex.Supranet.connect();

type AdvancedUIXContainerOptions = {
	importMapPath?:string, 
	uixRunPath?:string
} 

@endpoint @entrypointProperty class ContainerManager {
	@property static async getContainers():Promise<Set<Container>>{
		return containers.getAuto(datex.meta!.caller);
	}

	@property static async createWorkbenchContainer():Promise<WorkbenchContainer>{
		const sender = datex.meta!.caller;
		logger.info("Creating new Workbench Container for " + sender);

		// create config
		const config = new EndpointConfig();
		config.endpoint = Datex.Endpoint.getNewEndpoint();

		// init and start WorkbenchContainer
		const container = new WorkbenchContainer(sender, config);
		container.start();

		// link container to requesting endpoint
		this.addContainer(sender, container);

		return container;
	}

	@property static async createRemoteImageContainer(url: string | URL):Promise<RemoteImageContainer>{
		const sender = datex.meta!.caller;
		if (!sender)
			throw new Error("Could not determine sender");
		if (!url || typeof url !== "string")
			throw new Error("Could not determine url");
		logger.info("Creating new Remote Image Container for " + sender, url);
		
		// init and start RemoteImageContainer
		const container = new RemoteImageContainer(sender, url);

		if (true)
			return;

		container.start();

		// link container to requesting endpoint
		this.addContainer(sender, container);
		return container;
	}

	@property static async createUIXAppContainer(gitURL:string, branch: string, endpoint: Datex.Endpoint, stage?: string, domains?: Record<string, number>, env?: string[], args?: string[], persistentVolumePaths?: string[], gitAccessToken?: string, advancedOptions?: AdvancedUIXContainerOptions):Promise<UIXAppContainer>{
		const sender = datex.meta!.caller;

		console.log("Creating new UIX App Container for " + sender, gitURL, branch, env);

		// init and start RemoteImageContainer
		const container = new UIXAppContainer(sender, endpoint, gitURL, branch, stage, domains, env, args, persistentVolumePaths, gitAccessToken, advancedOptions);
		container.start();
		await sleep(2000); // wait for immediate status updates

		// link container to requesting endpoint
		this.addContainer(sender, container);

		return container;
	}

	private static addContainer(endpoint:Datex.Endpoint, container:Container) {
		containers.getAuto(endpoint).add(container);
	}


	public static findContainer({type, properties, endpoint}: {type?: Class<Container>, endpoint?: Datex.Endpoint, properties?: Record<string, any>}) {
		const matches = []
		iterate: for (const [containerEndpoint, containerSet] of containers) {
			// match endpoint
			if (endpoint && !containerEndpoint.equals(endpoint)) continue;

			for (const container of containerSet) {
				// match container type
				if (!type || container instanceof type) {
					// match properties
					if (properties) {
						for (const [key, value] of Object.entries(properties)) {
							if ((container as any)[key] !== value) continue iterate;
						}
					}
					matches.push(container);
				}
			}
		}
		return matches;
	}

}

export const containers = (await lazyEternalVar("containers") ?? $$(new Map<Datex.Endpoint, Set<Container>>)).setAutoDefault(Set);
logger.info(containers.size + " containers in cache")


async function execCommand<DenoRun extends boolean = false>(command:string, denoRun?:DenoRun): Promise<DenoRun extends true ? Deno.ProcessStatus : string> {
	console.log("exec: " + command)

	if (denoRun) {
		const status = await Deno.run({
			cmd: command.split(" "),
		}).status();
	
		if (!status.success) throw status.code;
		else return status as any;
	}
	else {
		const {status, output} = (await exec(`bash -c "${command.replaceAll('"', '\\"')}"`, {output: OutputMode.Capture}));
		if (!status.success) throw output;
		else return output as any;
	}
}


await ContainerManager.createRemoteImageContainer("ubuntu")