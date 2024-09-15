// deno-lint-ignore-file require-await
import { Datex } from "unyt_core/mod.ts";
import { ContainerStatus } from "./Types.ts";
import { containers } from "../../main.ts";
import { createHash } from "https://deno.land/std@0.91.0/hash/mod.ts";
import { executeDocker, executeShell } from "../CMD.ts";

const logger = new Datex.Logger("Container");

// parent class for all types of containers
@sync export class Container {
	protected logger!: Datex.Logger;
	#initialized = false;

	// docker container image + id
	@property image!: string
	@property container_name = "Container"
	@property name = "Container"
	@property id = '0';
	@property owner!: Datex.Endpoint
	@property status: ContainerStatus = ContainerStatus.INITIALIZING;
	@property errorMessage?: string

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
		return this.#labels.map(label => 
			["--label", `${label.replaceAll('`', '\\`')
								.replaceAll('(', '\\(')
								.replaceAll(')', '\\)')}`
			]).flat();
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

	construct(owner: Datex.Endpoint) {
		this.owner = owner;
		this.container_name = this.uniqueID();
		this.logger = new Datex.Logger(this);
	}
	replicate() {
		this.logger = new Datex.Logger(this);
		this.#initialized = true;
		this.updateAfterReplicate();
	}

	@property async start() {
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
				...(this.debugPort ? [`-p`, `"${this.debugPort}:9229"`] : []),
				"--log-opt",
				"max-size=10m",
				"-d",
				"--restart", restartPolicy,
				"--name", this.container_name,
				...this.getFormattedPorts(),
				...this.getFormattedVolumes(),
				...this.getFormattedEnvVariables(),
				...this.getFormattedLabels(),
				this.image
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
		if (this.status == ContainerStatus.STARTING) this.start();
		else if (this.status == ContainerStatus.STOPPING) this.stop();
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
				this.container_name
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

	@property async stop(force = true){
		this.logger.info("Stopping Container " + this.container_name);
		this.onBeforeStop();
		this.status = ContainerStatus.STOPPING;
		try {
			await executeDocker([
				"container",
				(force ? "kill" : "stop"),
				this.container_name
			]);
		} catch (e) {
			this.logger.error("error while stopping container",e);
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
		const p = new Deno.Command("docker", {
			args: [
				"logs",
				"--follow",
				this.container_name
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
		containers.getAuto(this.owner).delete(this);
		await Container.removeContainer(this.container_name);
		await Container.removeImage(this.image);
		return true;
	}

	private async isRunning() {
		try {
			await executeShell([
				"docker",
				"ps",
				"|",
				"grep",
				this.container_name
			], false);
			return true;
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
			this.addLabel(`traefik.http.routers.${name}-secured.tls.certresolver=myhttpchallenge`);
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
				name
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
				name
			], false);
		} catch (e) {
			logger.error("Could not remove image", e);
			return false;
		}
	}
}