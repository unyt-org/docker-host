// deno-lint-ignore-file require-await
import { EndpointConfig } from "./src/endpoint-config.ts";
import { Datex, f, property } from "unyt_core/datex.ts";
import { Class } from "unyt_core/utils/global_types.ts";
import { config } from "./src/config.ts";
import Container from "./src/container/Container.ts";
import RemoteImageContainer from "./src/container/RemoteImageContainer.ts";
import UIXAppContainer, { AdvancedUIXContainerOptions } from "./src/container/UIXAppContainer.ts";
import WorkbenchContainer from "./src/container/WorkbenchContainer.ts";

localStorage.clear();

export const execCommand = async (...args: any[]) => {
	console.log("exec", args);
}

const logger = new Datex.Logger("Docker Host");
logger.info("Starting up Docker Host with config:", config);
await Datex.Supranet.connect();

@endpoint @entrypointProperty export class ContainerManager {
	@property static async getContainers(): Promise<Set<Container>>{
		return containers.getAuto(datex.meta!.caller);
	}

	@property static async createWorkbenchContainer(): Promise<WorkbenchContainer>{
		const sender = datex.meta!.caller;
		logger.info("Creating new Workbench Container for " + sender);

		// create config
		const config = new EndpointConfig();
		config.endpoint = Datex.Endpoint.getNewEndpoint();

		// init and start WorkbenchContainer
		// @ts-ignore $
		const container = new WorkbenchContainer(sender, config);
		container.start();

		// link container to requesting endpoint
		this.addContainer(sender, container as unknown as Container);
		return container;
	}

	@property static async createRemoteImageContainer(name: string): Promise<RemoteImageContainer>{
		const sender = datex.meta!.caller;
		if (!name || typeof name !== "string" || name.length < 2 || name.length > 80 || !/^[a-z\.\-\/#%?=0-9:&]+$/gi.test(name))
			throw new Error(`Can not create remote image container with name '${name}'`);
		logger.info(`Creating new Remote Image Container '${name}' for`, sender);

		// init and start RemoteImageContainer
		// @ts-ignore $
		const container = new RemoteImageContainer(sender, name);
		container.start();

		// link container to requesting endpoint
		this.addContainer(sender, container as unknown as Container);
		return container;
	}

	@property static async createUIXAppContainer(
		gitURL: string,
		branch: string,
		endpoint: Datex.Endpoint,
		stage?: string,
		domains?: Record<string, number>,
		env?: string[],
		args?: string[],
		persistentVolumePaths?: string[],
		gitAccessToken?: string,
		advancedOptions?: AdvancedUIXContainerOptions): Promise<UIXAppContainer> {
		const sender = datex.meta!.caller;
		logger.info(`Creating new UIX App Container for ${sender}`, gitURL, branch);

		try { new URL(gitURL); }
		catch {
			throw new Error("The URL seems to be no valid URL");
		}

		// init and start RemoteImageContainer
		// @ts-ignore $
		const container = new UIXAppContainer(sender, endpoint, gitURL, branch, stage, domains, env, args, persistentVolumePaths, gitAccessToken, advancedOptions);
		container.start();
		await sleep(2000); // wait for immediate status updates

		// link container to requesting endpoint
		this.addContainer(sender, container as unknown as Container);
		return container;
	}

	private static addContainer(endpoint: Datex.Endpoint, container: Container) {
		containers.getAuto(endpoint).add(container);
	}

	public static findContainer({type, properties, endpoint}: {
		type?: Class<Container>,
		endpoint?: Datex.Endpoint,
		properties?: Record<string, any>
	}) {
		const matches = [];
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
logger.info(`Found ${containers.size} containers in cache.`);

// await ContainerManager.createRemoteImageContainer("hello-world");
await ContainerManager.createUIXAppContainer(
	"https://github.com/unyt-org/blog",
	"main",
	f("@test123")
);