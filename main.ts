// deno-lint-ignore-file require-await
import { EndpointConfig } from "./src/endpoint-config.ts";
import { Datex, property } from "unyt_core/datex.ts";
import { Class } from "unyt_core/utils/global_types.ts";
import { config } from "./src/config.ts";
import { Container} from "./src/container/Container.ts";
import { RemoteImageContainer } from "./src/container/RemoteImageContainer.ts";
import { UIXAppContainer, AdvancedUIXContainerOptions } from "./src/container/UIXAppContainer.ts";
import { WorkbenchContainer } from "./src/container/WorkbenchContainer.ts";
import { Endpoint, StorageMap } from "unyt_core/datex_all.ts";
import { ContainerStatus } from "./src/container/Types.ts";

const logger = new Datex.Logger("Docker Host");
logger.info("Starting up Docker Host with config:", config);
await Datex.Supranet.connect();

const ensureToken = (token?: string) => {
	if (config.token && config.token.length && config.token !== token) {
		logger.error(`Got request with invalid or missing access token "${token ?? "none"}"`);
		throw new Error(`Invalid access token: The Docker Host ${Datex.Runtime.endpoint} requires authentication. Please make sure to set the HOST_TOKEN environment variable.`);
	}
}

@endpoint @entrypointProperty export class ContainerManager {
	@property static async getContainers(token?: string): Promise<Set<Container>> {
		ensureToken(token);
		return await containers.get(datex.meta!.caller) ?? new Set();
	}
	@property static async getAllContainers(token?: string): Promise<Set<Container>> {
		ensureToken(token);
		return this.getContainerList();
	}

	@property static async createWorkbenchContainer(token?: string): Promise<WorkbenchContainer> {
		ensureToken(token);
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
		await this.addContainer(sender, container);
		return container;
	}

	@property static async createRemoteImageContainer(token: string, name: string): Promise<RemoteImageContainer> {
		ensureToken(token);
		const sender = datex.meta!.caller;
		if (!name || typeof name !== "string" || name.length < 2 || name.length > 80 || !/^[a-z\.\-\/#%?=0-9:&]+$/gi.test(name))
			throw new Error(`Can not create remote image container with name '${name}'`);
		logger.info(`Creating new Remote Image Container '${name}' for`, sender);

		// init and start RemoteImageContainer
		// @ts-ignore $
		const container = new RemoteImageContainer(sender, name);
		container.start().then(async ()=>{
			await this.addContainer(sender, container);
		}).catch();

		// link container to requesting endpoint
		return container;
	}

	@property static async createUIXAppContainer(
		token: string,
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
		ensureToken(token);
		const sender = datex.meta!.caller;
		logger.info(`Creating new UIX App Container for ${sender}`, gitURL, branch, env);

		if (!branch || typeof branch !== "string" || branch.length < 2 || branch.length > 50 || !/^[a-z\.\-\/#0-9:&]+$/gi.test(branch))
			throw new Error(`Can not create UIX App container with branch '${branch}'`);
		if (!gitURL || typeof gitURL !== "string" || gitURL.length < 2)
			throw new Error(`Can not create UIX App container with url '${gitURL}'`);
		if (!endpoint || !(endpoint instanceof Endpoint))
			throw new Error(`Can not create UIX App container with endpoint '${endpoint}'`);

		// init and start RemoteImageContainer
		// @ts-ignore $
		const container = new UIXAppContainer(sender, endpoint, gitURL, branch, stage, domains, env, args, persistentVolumePaths, gitAccessToken, advancedOptions);
		container.start().then(async ()=>{
			if (container.status === ContainerStatus.FAILED) {
				container.stop(true);
				logger.error(`Could not start app container for '${gitURL}'`);
			} else {
				// link container to requesting endpoint
				await this.addContainer(sender, container);
			}
		}).catch();
		await sleep(2000); // wait for immediate status updates
		return container;
	}

	public static async getContainerList() {
		const list = new Set<Container>();
		for await (const containerList of containers.values())
			containerList.forEach(e => list.add(e));
		return list;
	}

	private static async addContainer(endpoint: Datex.Endpoint, container: Container) {
		if (await containers.has(endpoint))
			(await containers.get(endpoint))!.add(container);
		else await containers.set(endpoint, new Set([container]));
		console.log("Added", container.name, endpoint, await containers.getSize(), containers.constructor.name)
	}

	public static async findContainer<T extends Container>({type, properties, endpoint}: {
		type?: Class<Container>,
		endpoint?: Datex.Endpoint,
		properties?: Record<string, any>
	}): Promise<T[]> {
		const matches: T[] = [];
		iterate: for await (const [containerEndpoint, containerSet] of containers.entries()) {
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
					matches.push(container as T);
				}
			}
		}
		return matches;
	}
}

export const containers = eternalVar("containers") ?? $$(new StorageMap<Datex.Endpoint, Set<Container>>());

logger.info(`Found ${await containers.getSize()} unique endpoint(s) in cache.`);
logger.info("Container List:", [...(await ContainerManager.getContainerList())].map(e => `${e.constructor.name} ${e.container_name}: ${e.owner} ${e.image} (${ContainerStatus[e.status]})`));
logger.success("Docker Host is up and running");