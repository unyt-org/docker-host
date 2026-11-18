// deno-lint-ignore-file require-await
import { Datex } from "unyt_core/mod.ts";
import { ContainerStatus } from "./Types.ts";
import { createHash } from "https://deno.land/std@0.91.0/hash/mod.ts";
import { executeCommandOutput, executeDocker } from "../CMD.ts";
import { containers } from "../../main.ts";

const logger = new Datex.Logger("Container");

// parent class for all types of containers
@sync export class Container {
	protected logger!: Datex.Logger;
	#initialized = false;

	// docker container image + id
	@property image!: string;
	@property container_name = "Container";
	@property name = "Container";
	@property id = '0';
	@property owner!: Datex.Endpoint;
	@property status: ContainerStatus = ContainerStatus.INITIALIZING;
	@property errorMessage?: string;

	#labels: string[] = []
	#ports: [number, number][] = []
	#env: Record<string,string> = {}
	#volumes: Record<string,string> = {}

	network = "main"
	debugPort: string|null = null

	get volumes() {return this.#volumes;}

	addLabel(label: string) {
		this.#labels.push(label);
	}

	formatVolumeName(name: string) {
		return name.replace(/[^a-zA-Z0-9_.-]/g, '-');
	}

	async addVolume(name: string, path: string) {
		await executeDocker(["volume", "create", name], false);
		this.#volumes[name] = path;
	}

	addVolumePath(hostPath: string, path: string) {
		this.#volumes[hostPath] = path;
	}

	addEnvironmentVariable(name: string, value: string) {
		this.#env[name] = value;
	}

	getFormattedLabels() {
		return this.#labels
			.map(label => ["--label", `${label}`])
			.flat();
	}
	getFormattedPorts() {
		return this.#ports.map(ports => ["-p", `${ports[1]}:${ports[0]}`]).flat();
	}
	getFormattedEnvVariables() {
		return Object.entries(this.#env).map(([name, value]) => ["--env", `${name}=${value}`]).flat();
	}
	getFormattedVolumes() {
		return Object.entries(this.#volumes).map(([name, path]) => ["-v", `${name}:${path}`]).flat();
	}

	uniqueID(size = 16) {
		return crypto.randomUUID().replaceAll("-", "").slice(0, size);
	}

	construct(owner: Datex.Endpoint, ..._: unknown[]) {
		this.owner = owner;
		this.container_name = this.uniqueID();
		this.logger = new Datex.Logger(this);
	}
	replicate() {
		this.logger = new Datex.Logger(this);
		this.#initialized = true;
		this.updateAfterReplicate();
	}

	// SECURITY: container/image names are synced properties and passed to docker commands -
	// only allow plain docker names (no leading '-', no whitespace or shell characters)
	static SAFE_DOCKER_NAME = /^[A-Za-z0-9][A-Za-z0-9_.\-\/:@]{0,199}$/;
	static assertSafeDockerName(name: unknown, what = "name"): string {
		if (typeof name !== "string" || !Container.SAFE_DOCKER_NAME.test(name))
			throw new Error(`Invalid docker ${what}: ${JSON.stringify(name)}`);
		return name;
	}

	/**
	 * Throws if the current remote caller is not the owner of this container.
	 * Local calls (no remote caller / own endpoint) are always allowed.
	 */
	protected assertCallerIsOwner() {
		const caller = datex.meta?.caller as Datex.Endpoint|undefined;
		if (!caller || caller === Datex.LOCAL_ENDPOINT) return;
		if (caller.main?.equals?.(Datex.Runtime.endpoint.main)) return;
		if (this.owner && (caller.equals(this.owner) || caller.main?.equals?.(this.owner.main))) return;
		this.logger?.error(`Rejected access to container ${this.container_name} from ${caller}`);
		throw new Error(`No permission to access container ${this.container_name}`);
	}

	@property async start() {
		this.assertCallerIsOwner();
		return await this.startInternal();
	}

	public async startInternal() {
		// start => RUNNING or FAILED
		const running = await this.handleStart();
		if (running) {
			this.status = ContainerStatus.RUNNING;

			// get online state
			const online = await this.handleOnline();
			if (online) this.status = ContainerStatus.ONLINE;
			else this.status = ContainerStatus.FAILED;
		} else this.status = ContainerStatus.FAILED;
		return running;
	}

	// create docker for the first time
	protected async init() {
		if (this.#initialized)
			return true;

		// INITIALIZING ...
		this.status = ContainerStatus.INITIALIZING;

		// STOPPED (default state) or FAILED
		const initialized = await this.handleInit();
		if (initialized)
			this.status = ContainerStatus.STOPPED;
		else this.status = ContainerStatus.FAILED;

		this.#initialized = initialized;
		return initialized;
	}


	protected async handleInit() {
		try {
			const restartPolicy = "always";
			await executeDocker([
				"run",
				"--network", this.network,
				// only bind the debug (inspector) port to localhost - an exposed inspector allows arbitrary code execution
				...(this.debugPort ? [`-p`, `127.0.0.1:${this.debugPort}:9229`] : []),
				"--log-opt",
				"max-size=10m",
				"-d",
				"--restart", restartPolicy,
				"--name", Container.assertSafeDockerName(this.container_name, "container name"),
				...this.getFormattedPorts(),
				...this.getFormattedVolumes(),
				...this.getFormattedEnvVariables(),
				...this.getFormattedLabels(),
				Container.assertSafeDockerName(this.image, "image")
			], false);
			this.logger.success(`Running docker ${this.container_name}...`);
		} catch(error) {
			this.logger.error("Could not create container", error);
			return false;
		}
		return true;
	}

	protected updateAfterReplicate() {
		// continue start/stop if in inbetween state
		if (this.status == ContainerStatus.STARTING) this.startInternal();
		else if (this.status == ContainerStatus.STOPPING) this.stopInternal();
	}

	protected async handleStart() {
		// first init docker container (if not yet initialized)
		if (!await this.init()) return false;
		this.logger.info("Starting Container", this.container_name);
		await this.onBeforeStart();
		if (this.status == ContainerStatus.FAILED)
			return false;

		// STARTING ...
		this.status = ContainerStatus.STARTING;
		// start the container
		try {
			await executeDocker([
				"container",
				"start",
				Container.assertSafeDockerName(this.container_name, "container name")
			], false);
		} catch (error) {
			this.logger.error("error while starting container", error);
			return false;
		}
		await sleep(2000);

		// check if container is running
		const running = await this.isRunning();
		if (running)
			this.logger.success("Container is running")
		else this.logger.error("Container is not running")
		return running;
	}

	protected onBeforeStart() {}
	protected onBeforeStop() {}

	protected async handleOnline() {
		return false;
	}

	@property async stop(force = true) {
		this.assertCallerIsOwner();
		return await this.stopInternal(force);
	}

	public async stopInternal(force = true) {
		this.logger.info("Stopping Container " + this.container_name);
		this.onBeforeStop();
		this.status = ContainerStatus.STOPPING;
		try {
			await executeDocker([
				"container",
				(force ? "kill" : "stop"),
				Container.assertSafeDockerName(this.container_name, "container name")
			], false);
		} catch (e) {
			this.logger.error("error while stopping container", e);
			// TODO FAILED or RUNNING?
			this.status = ContainerStatus.FAILED;
			return false;
		}
		this.status = ContainerStatus.STOPPED;
		return true;
	}

	/**
	 * Get a stream of the container logs
	 * @param timeout timeout in minutes after which the stream will be closed
	 * @returns 
	 */
	@property public getLogs(timeout = 60) {
		this.assertCallerIsOwner();
		timeout = Number(timeout);
		if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 24 * 60) timeout = 60;
		const p = new Deno.Command("docker", {
			args: [
				"logs",
				"--follow",
				"--",
				Container.assertSafeDockerName(this.container_name, "container name")
			],
			stdout: "piped",
			stderr: "piped"
		}).spawn()
		
		const stream = $$(new Datex.Stream());
		stream.pipe(p.stdout);
		stream.pipe(p.stderr);

		// close stream after timeout
		setTimeout(() => {
			// \u0004 is the EOT character
			stream.write(new TextEncoder().encode("\n[Stream was closed after " + timeout + " minutes]\n\u0004").buffer);
			stream.close();
			p.kill();
		}, timeout * 60 * 1000);
		return stream;
	}

	public async remove() {
		// remove from containers list
		if (await containers.has(this.owner))
			(await containers.get(this.owner))?.delete(this);
		await Container.removeContainer(this.container_name);
		await Container.removeImage(this.image);
		return true;
	}

	private async isRunning() {
		try {
			// no shell - container_name must never be interpolated into a shell command
			const names = await executeCommandOutput("docker", [
				"ps",
				"--format", "{{.Names}}"
			]);
			return names.split("\n").map(n => n.trim()).includes(this.container_name);
		} catch (e) {
			this.logger.error(e);
			return false
		}
	}

	exposePort(port: number, hostPort: number) {
		this.#ports.push([port, hostPort])
	}

	protected enableTraefik(host: string, port?: number) {
		const name = this.image + "-" + createHash("md5").update(host).toString()
		const hasWildcard = host.startsWith('*.');

		const hostRule = hasWildcard ?
			`HostRegexp(\`{subhost:[a-z0-9-_]+}.${host.slice(2)}\`)` :
			`Host(\`${host}\`)`;

		this.addLabel(`traefik.enable=true`);
		this.addLabel(`traefik.http.routers.${name}.rule=${hostRule}`);
		this.addLabel(`traefik.http.routers.${name}.entrypoints=web`);
		// TODO: only workaoound for *.unyt.app domains: prio 1
		this.addLabel(`traefik.http.routers.${name}.priority=${hasWildcard ? 1 : 10}`);
		this.addLabel(`traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https`);
		this.addLabel(`traefik.http.routers.${name}.middlewares=redirect-to-https@docker`);
		this.addLabel(`traefik.http.routers.${name}-secured.rule=${hostRule}`);
		this.addLabel(`traefik.http.routers.${name}-secured.tls=true`);
		// TODO: only workaoound for *.unyt.app domains: prio 1
		this.addLabel(`traefik.http.routers.${name}-secured.priority=${hasWildcard ? 1 : 10}`);

		if (hasWildcard) {
			const rawHost = host.slice(2);
			this.addLabel(`traefik.http.routers.${name}-secured.tls.domains[0].main=${rawHost}`);
			this.addLabel(`traefik.http.routers.${name}-secured.tls.domains[0].sans=${host}`);
			this.addLabel(`traefik.http.routers.${name}.tls.domains[0].main=${rawHost}`);
			this.addLabel(`traefik.http.routers.${name}.tls.domains[0].sans=${host}`);
			this.addLabel(`traefik.http.routers.${name}-secured.tls.certresolver=mydnschallenge`);
		} else {
			this.addLabel(`traefik.http.routers.${name}-secured.tls.certresolver=le`);
		}

		if (port) {
			this.addLabel(`traefik.http.routers.${name}.service=${name}`);
			this.addLabel(`traefik.http.routers.${name}-secured.service=${name}`);
			this.addLabel(`traefik.http.services.${name}.loadbalancer.server.port=${port}`);
		}
	}

	public static async removeContainer(name: string) {
		try {
			await executeDocker([
				"rm",
				"-f",
				Container.assertSafeDockerName(name, "container name")
			], false);
		} catch (e) {
			logger.error("Could not remove container", e);
			return false;
		}
	}

	public static async removeImage(name: string) {
		try {
			await executeDocker([
				"image",
				"rm",
				"-f",
				Container.assertSafeDockerName(name, "image")
			], false);
		} catch (e) {
			logger.error("Could not remove image", e);
			return false;
		}
	}
}
