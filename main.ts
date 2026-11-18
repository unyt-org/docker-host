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

if (!config.token || typeof config.token !== "string" || !config.token.length)
	logger.error("No access token configured in config.dx - all requests to the Docker Host will be rejected. Please set a token.");
else if (config.token === "admin" || config.token.length < 12)
	logger.warn("The configured access token is weak or the default token. Please set a strong random token in config.dx.");

const encoder = new TextEncoder();
function timingSafeEqual(a: string, b: string) {
	const aBytes = encoder.encode(a);
	const bBytes = encoder.encode(b);
	let diff = aBytes.length ^ bBytes.length;
	for (let i = 0; i < aBytes.length; i++)
		diff |= aBytes[i] ^ (bBytes[i] ?? 0);
	return diff === 0;
}

// SECURITY: limit failed token attempts (brute force protection).
// Per caller: max 5 failures in 10 minutes. Globally (callers can use new endpoint ids for every request):
// max 20 failures in 10 minutes. When a limit is reached, all token checks of the caller (or all callers)
// are rejected for 15 minutes, even with a valid token.
const FAILURE_WINDOW = 10 * 60 * 1000;
const LOCK_DURATION = 15 * 60 * 1000;
const MAX_FAILURES_PER_CALLER = 5;
const MAX_FAILURES_GLOBAL = 20;
let globalFailures: number[] = [];
let globalLockedUntil = 0;
const callerFailures = new Map<string, number[]>();
const callerLockedUntil = new Map<string, number>();

function registerTokenFailure(caller: string) {
	const now = Date.now();
	globalFailures = globalFailures.filter(t => now - t < FAILURE_WINDOW);
	globalFailures.push(now);
	const failures = (callerFailures.get(caller) ?? []).filter(t => now - t < FAILURE_WINDOW);
	failures.push(now);
	callerFailures.set(caller, failures);
	if (failures.length >= MAX_FAILURES_PER_CALLER) {
		callerLockedUntil.set(caller, now + LOCK_DURATION);
		logger.error(`Too many invalid access tokens from ${caller} - blocked for ${LOCK_DURATION / 60000} minutes`);
	}
	if (globalFailures.length >= MAX_FAILURES_GLOBAL) {
		globalLockedUntil = now + LOCK_DURATION;
		logger.error(`Too many invalid access tokens (${globalFailures.length} in ${FAILURE_WINDOW / 60000} minutes) - all requests blocked for ${LOCK_DURATION / 60000} minutes`);
	}
	// cleanup old entries
	if (callerFailures.size > 10_000) {
		for (const [key, times] of callerFailures) if (!times.some(t => now - t < FAILURE_WINDOW)) callerFailures.delete(key);
		for (const [key, until] of callerLockedUntil) if (until < now) callerLockedUntil.delete(key);
	}
}

const ensureToken = (token?: string) => {
	const caller = String(datex.meta?.caller?.main ?? datex.meta?.caller ?? "unknown");
	const now = Date.now();
	if (globalLockedUntil > now || (callerLockedUntil.get(caller) ?? 0) > now) {
		logger.error(`Rejected request from ${caller}: blocked after too many invalid access tokens`);
		throw new Error(`Too many invalid access tokens: The Docker Host ${Datex.Runtime.endpoint} is temporarily blocked. Please try again later.`);
	}
	// fail closed: if no token is configured, reject all requests
	if (
		!config.token || typeof config.token !== "string" || !config.token.length ||
		typeof token !== "string" || !timingSafeEqual(config.token, token)
	) {
		logger.error(`Got request with invalid or missing access token from ${caller}`);
		registerTokenFailure(caller);
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
		container.startInternal();

		// link container to requesting endpoint
		await this.addContainer(sender, container);
		return container;
	}

	@property static async createRemoteImageContainer(token: string, name: string): Promise<RemoteImageContainer> {
		ensureToken(token);
		const sender = datex.meta!.caller;
		if (!name || typeof name !== "string" || name.length < 2 || name.length > 80 || name.startsWith("-") || !/^[a-z\.\-\/#%?=0-9:&]+$/i.test(name))
			throw new Error(`Can not create remote image container with name '${name}'`);
		logger.info(`Creating new Remote Image Container '${name}' for`, sender);

		// init and start RemoteImageContainer
		// @ts-ignore $
		const container = new RemoteImageContainer(sender, name);
		container.startInternal().then(async ()=>{
			await this.addContainer(sender, container);
		}).catch();

		// link container to requesting endpoint
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
		advancedOptions?: AdvancedUIXContainerOptions,
		token?: string
	): Promise<UIXAppContainer> {
		ensureToken(token);
		const sender = datex.meta!.caller;
		// only log env variable names, values may contain secrets
		logger.info(`Creating new UIX App Container for ${sender}`, gitURL, branch, (Array.isArray(env) ? env : []).map(e => String(e).split("=")[0]));

		if (!branch || typeof branch !== "string" || branch.length < 2 || branch.length > 50 || branch.startsWith("-") || !/^[a-z\.\-\/#0-9:&_]+$/i.test(branch))
			throw new Error(`Can not create UIX App container with branch '${branch}'`);
		if (!gitURL || typeof gitURL !== "string" || gitURL.length < 2)
			throw new Error(`Can not create UIX App container with url '${gitURL}'`);
		if (!endpoint || !(endpoint instanceof Endpoint))
			throw new Error(`Can not create UIX App container with endpoint '${endpoint}'`);

		// init and start RemoteImageContainer
		// @ts-ignore $
		const container = new UIXAppContainer(sender, endpoint, gitURL, branch, stage, domains, env, args, persistentVolumePaths, gitAccessToken, advancedOptions);
		container.startInternal().then(async ()=>{
			if (container.status === ContainerStatus.FAILED) {
				//container.stop(true);
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