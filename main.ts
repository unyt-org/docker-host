import { OutputMode, exec } from "https://deno.land/x/exec@0.0.5/mod.ts";

import { EndpointConfig } from "./endpoint-config.ts";
import { Datex, constructor, expose, meta, property, replicator,default_property, scope, sync, label } from "unyt_core";
import { Class } from "unyt_core/utils/global_types.ts";

const logger = new Datex.Logger("container manager");

await Datex.Supranet.connect();

enum ContainerStatus {
	STOPPED = 0,
	STARTING = 1,
	RUNNING = 2,
	STOPPING = 3,
	FAILED = 4,
	INITIALIZING = 5,
	ONLINE = 6
}

// parent class for all types of containers
@sync('Container') class Container {

	protected logger!:Datex.Logger;
	#initialized = false;

	// docker container image + id
	@property image!: string
	@property container_name = "Container"
	@property name = "Container"
	@property id = '0';

	network = "main"

	@property owner!: Datex.Endpoint
	@property status: ContainerStatus = ContainerStatus.INITIALIZING;

	#labels: string[] = []
	#ports: [number, number][] = []
	#env: Record<string,string> = {}
	#volumes: Record<string,string> = {}

	addLabel(label: string) {
		this.#labels.push(label)
	}

	formatVolumeName(name: string) {
		return name.replace(/[^a-zA-Z0-9_.-]/g, '-')
	}

	async addVolume(name: string, path: string) {
		await execCommand(`docker volume create ${name}`)
		this.#volumes[name] = path;
	}

	addEnvironmentVariable(name: string, value: string) {
		this.#env[name] = value;
	}

	getFormattedLabels() {
		return this.#labels.map(label => `--label ${label
			.replaceAll('`', '\\`')
			.replaceAll('(', '\\(')
			.replaceAll(')', '\\)')
		}`).join(" ")
	}
	getFormattedPorts() {
		return this.#ports.map(ports => `-p ${ports[1]}:${ports[0]}`)
	}
	getFormattedEnvVariables() {
		return Object.entries(this.#env).map(([name, value]) => `--env ${name}=${value}`)
	}
	getFormattedVolumes() {
		return Object.entries(this.#volumes).map(([name, path]) => `-v ${name}:${path}`)
	}

	uniqueID(size = 4) {
		return new Array(size).fill('xxxx').join('-').replace(/[xy]/g, function(c) {
			const r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
			return v.toString(16);
		});
	  }

	constructor(owner: Datex.Endpoint) {}
	@constructor construct(owner: Datex.Endpoint) {
		this.owner = owner;
		this.container_name = this.uniqueID();
		this.logger = new Datex.Logger(this);
	}
	@replicator replicate(){
		this.logger = new Datex.Logger(this);
		this.#initialized = true;
		this.updateAfterReplicate();
	}

	@property async start(){

		// start => RUNNING or FAILED
		const running = await this.handleStart();
		if (running) {
			this.status = ContainerStatus.RUNNING;

			// get online state
			const online = await this.handleOnline();
			if (online) this.status = ContainerStatus.ONLINE;
			else this.status = ContainerStatus.FAILED;
		}
		else this.status = ContainerStatus.FAILED;


		return running;
	}

	// create docker for the first time
	protected async init(){
		if (this.#initialized) return true;

		// INITIALIZING ...
		this.status = ContainerStatus.INITIALIZING;

		// STOPPED (default state) or FAILED
		const initialized = await this.handleInit();
		if (initialized) this.status = ContainerStatus.STOPPED;
		else this.status = ContainerStatus.FAILED;

		this.#initialized = initialized;

		return initialized;
	}

	protected async handleInit(){
		try {
			const restartPolicy = "on-failure"
			await execCommand(`docker run --network=${this.network} -d --restart ${restartPolicy} --name ${this.container_name} ${this.getFormattedPorts()} ${this.getFormattedVolumes()} ${this.getFormattedEnvVariables()} ${this.getFormattedLabels()} ${this.image}`)
		} catch (e) {
			this.logger.error("error while creating container",e);
			return false;
		}
		return true;
	}

	protected updateAfterReplicate(){
		// continue start/stop if in inbetween state
		if (this.status == ContainerStatus.STARTING) this.start();
		else if (this.status == ContainerStatus.STOPPING) this.stop();
	}

	protected async handleStart(){
		// first init docker container (if not yet initialized)
		if (!await this.init()) return false;

		this.logger.info("Starting Container " + this.container_name);

		// STARTING ...
		this.status = ContainerStatus.STARTING;

		// start the container
		try {
			await execCommand(`docker container start ${this.container_name}`)
		} catch (e) {
			this.logger.error("error while starting container")
			return false;
		}

		await sleep(2000);

		// check if container is running
		const running = await this.isRunning();
		if (running) {
			this.logger.success("Container is running")
		}
		else {
			this.logger.error("Container is not running")
			return false;
		}

		return true;
	}

	protected async handleOnline() {
		return false;
	}

	@property async stop(force = true){
		this.logger.info("Stopping Container " + this.container_name);

		this.status = ContainerStatus.STOPPING;
		try {
			await execCommand(`docker container ${force?'kill':'stop'} ${this.container_name}`)
		} catch (e) {
			this.logger.error("error while stopping container",e);
			// TODO FAILED or RUNNING?
			this.status = ContainerStatus.FAILED;
			return false;
		}
		this.status = ContainerStatus.STOPPED;
		return true;
	}

	@property public getLogs() {
		const p = Deno.run({
			cmd: ['docker', 'logs', '--follow', this.container_name],
			stdout: 'piped', 
			stderr: 'piped'
		})
		const stream = $$(new Datex.Stream());
		stream.pipe(p.stdout.readable);
		stream.pipe(p.stderr.readable);
		return stream;
	}

	public async remove(){
		// remove from containers list
		containers.getAuto(this.owner).delete(this);

		await Container.removeContainer(this.container_name);
		await Container.removeImage(this.image);

		return true;
	}

	private async isRunning(){
		try {
			const ps = await execCommand(`docker ps | grep ${this.container_name}`);
			return !!ps;
		}
		catch (e) {
			console.log("err:",e)
			return false
		}
	}

	protected exposePort(port:number, hostPort:number) {
		this.#ports.push([port, hostPort])
	}

	protected enableTraefik(host: string) {
		this.addLabel(`traefik.enable=true`);
		this.addLabel(`traefik.http.routers.${this.image}.rule=Host(\`${host}\`)`);
		this.addLabel(`traefik.http.routers.${this.image}.entrypoints=web`);
		this.addLabel(`traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https`);
		this.addLabel(`traefik.http.routers.${this.image}.middlewares=redirect-to-https@docker`);
		this.addLabel(`traefik.http.routers.${this.image}.middlewares=redirect-to-https@docker`);
		this.addLabel(`traefik.http.routers.${this.image}-secured.rule=Host(\`${host}\`)`);
		this.addLabel(`traefik.http.routers.${this.image}-secured.tls=true`);
		this.addLabel(`traefik.http.routers.${this.image}-secured.tls.certresolver=myhttpchallenge`);

		this.addEnvironmentVariable("UIX_HOST_DOMAINS", host);
	}

	public static async removeContainer(name: string) {
		try {
			await execCommand(`docker rm -f ${name}`)
		} catch (e) {
			logger.error("error while removing container",e);
			return false;
		}
	}

	public static async removeImage(name: string) {
		try {
			await execCommand(`docker image rm -f ${name}`)
		} catch (e) {
			logger.error("error while removing container image",e);
			return false;
		}
	}

}

@sync('WorkbenchContainer') class WorkbenchContainer extends Container {

	@property config!: EndpointConfig

	constructor(owner: Datex.Endpoint, config: EndpointConfig) {super(owner)}
	@constructor constructWorkbenchContanier(owner: Datex.Endpoint, config: EndpointConfig) {
		this.construct(owner)
		this.config = config;
		this.name = "unyt Workbench"
	}

	// custom workbench container init
	override async handleInit(){
		try {
			const username = "user"; // TODO other usernames?
			const config_exported = Datex.Runtime.valueToDatexString(this.config, true, true, true);
	
			this.image = 'unyt-workbench-' + this.config.endpoint.toString().replaceAll('@','').toLowerCase();
	
			logger.info("image: " + this.image);
			logger.info("config: " + config_exported);
			logger.info("username: " + username);
	
			// create new config directory to copy to docker
			const tmp_dir = `res/config-files-${new Date().getTime()}`
			await execCommand(`cp -r ./res/config-files ${tmp_dir}`);
			await Deno.writeTextFile(`${tmp_dir}/endpoint.dx`, config_exported)
			
			// create docker container
			await execCommand(`docker build --build-arg username=${username} --build-arg configpath=${tmp_dir} -f ./res/Dockerfile -t ${this.image} .`)
	
			// remove tmp directory
			await execCommand(`rm -r ${tmp_dir}`);
		}

		catch (e) {
			this.logger.error("Error initializing container",e);
			return false;
		}

		return super.handleInit();
	}

	override async handleOnline() {
		await sleep(6000);
		try {
			await Datex.Supranet.pingEndpoint(this.config.endpoint);
		}
		catch (e) {
			this.logger.error("Workbench Endpoint not reachable")
			await this.stop(); // stop container again for consistant container state
			return false;
		}
		this.logger.success("Workbench Endpoint is reachable");
		return true;
	}

}


@sync('RemoteImageContainer') class RemoteImageContainer extends Container {

	@property version?:string
	@property url!:string

	constructor(owner: Datex.Endpoint, url: string, version?:string) {super(owner)}
	@constructor constructRemoteImageContainer(owner: Datex.Endpoint, url: string, version?: string) {
		this.construct(owner)
		this.version = version;
		this.url = url;
		this.name = url;
	}

	// update docker image
	@property async update(){
		try {
			this.image = `${this.url}${this.version?':'+this.version:''}`;
			await execCommand(`docker pull ${this.image}`);
		}

		catch (e) {
			this.logger.error("Error initializing container",e);
			return false;
		}
		return true;
	}

	// custom workbench container init
	override async handleInit(){
		if (!await this.update()) return false;
		return super.handleInit();
	}

	// custom start
	override async handleStart(){
		// always pull image first
		if (!await this.update()) return false;

		return super.handleStart();
	}
}


@sync('UIXAppContainer') class UIXAppContainer extends Container {

	@property branch?:string
	@property gitURL!:string
	@property stage!:string
	@property domain?:string
	@property endpoint!:Datex.Endpoint

	constructor(owner: Datex.Endpoint, endpoint: Datex.Endpoint, gitURL: string, branch?:string, stage?: string, domain?: string, env?:string[]) {super(owner)}
	@constructor constructUIXAppContainer(owner: Datex.Endpoint, endpoint: Datex.Endpoint, gitURL: string, branch?: string, stage = 'prod', domain?: string, env?:string[]) {
		this.construct(owner)

		// TODO fix: convert https to ssh url
		if (gitURL.startsWith("https://")) gitURL = gitURL.replace('https://github.com/', 'git@github.com:') + ".git";

		this.container_name = endpoint.name + '-' + (stage??'')

		this.endpoint = endpoint; // TODO: what if @@local is passed
		this.gitURL = gitURL;
		
		this.branch = branch;
		this.stage = stage;
		this.domain = domain;
		
		// inject environment variables
		for (const envVar of env??[]) {
			const [key, val] = envVar.split("=");
			this.addEnvironmentVariable(key, val)
		}

	}

	// custom workbench container init
	override async handleInit(){

		// remove any existing previous container
		const existingContainers = ContainerManager.findContainer({type: UIXAppContainer, properties: {
			gitURL: this.gitURL,
			stage: this.stage
		}})
		for (const existingContainer of existingContainers) {
			this.logger.error("removing existing container", existingContainer)
			await existingContainer.remove()
		}

		// also remove docker container + docker image with same name remove to make sure
		await Container.removeContainer(this.container_name);
		await Container.removeImage(this.image);

		try {
			this.image = this.container_name
	
			const domain = this.domain ?? Datex.Unyt.formatEndpointURL(this.endpoint)!.replace("https://","");

			this.logger.info("image: " + this.image);
			this.logger.info("repo: " + this.gitURL);
			this.logger.info("branch: " + this.branch);
			this.logger.info("endpoint: " + this.endpoint);
			this.logger.info("url: " + domain);

			// clone repo
			const dir = await Deno.makeTempDir({prefix:'uix-app-'});
			const dockerfilePath = `${dir}/Dockerfile`;
			const repoPath = `${dir}/repo`;

			await execCommand(`git clone ${this.gitURL} ${repoPath}`)
			await execCommand(`cd ${repoPath} && git checkout ${this.branch}`)

			// copy dockerfile
			const dockerfile = await Deno.readTextFile('./res/uix-app-docker/Dockerfile');
			await Deno.writeTextFile(dockerfilePath, dockerfile);

			// create docker container
			await execCommand(`docker build -f ${dockerfilePath} --build-arg stage=${this.stage} --build-arg host_endpoint=${Datex.Runtime.endpoint} -t ${this.image} ${dir}`)

			// remove tmp dir
			await Deno.remove(dir, {recursive: true});

			// enable traefik routing
			this.enableTraefik(domain);
			// add persistent volume for datex cache
			await this.addVolume(this.formatVolumeName(this.container_name), '/datex-cache')
		}

		catch (e) {
			this.logger.error("Error initializing container",e);
			return false;
		}

		return super.handleInit();
	}


	override async handleOnline(){
		// wait until endpoint inside container is reachable
		this.logger.info("Waiting for "+this.endpoint+" to come online");
		let iterations = 0;
		while (true) {
			await sleep(2000);
			if (await this.endpoint.isOnline()) {
				this.logger.success("Endpoint "+this.endpoint+" is online");
				return true;
			}
			if (iterations++ > 20) {
				this.logger.error("Endpoint "+this.endpoint+" not reachable")
				return false;
			}
		}
	}
	
}

@default_property @scope class ContainerManager {

	@expose static async getContainers():Promise<Set<Container>>{
		return containers.getAuto(datex.meta!.sender);
	}

	@expose static async createWorkbenchContainer():Promise<WorkbenchContainer>{
		const sender = datex.meta!.sender;
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

	@expose static async createRemoteImageContainer(url:string):Promise<RemoteImageContainer>{
		const sender = datex.meta!.sender;

		logger.info("Creating new Remote Image Container for " + sender, url);

		// init and start RemoteImageContainer
		const container = new RemoteImageContainer(sender, url);
		container.start();

		// link container to requesting endpoint
		this.addContainer(sender, container);

		return container;
	}

	@expose static async createUIXAppContainer(gitURL:string, branch: string, endpoint: Datex.Endpoint, stage?: string, domain?: string, env?: string[]):Promise<UIXAppContainer>{
		const sender = datex.meta!.sender;

		logger.info("Creating new UIX App Container for " + sender, gitURL, branch, env);

		// init and start RemoteImageContainer
		const container = new UIXAppContainer(sender, endpoint, gitURL, branch, stage, domain, env);
		container.start();

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

const containers = (await lazyEternalVar("containers") ?? $$(new Map<Datex.Endpoint, Set<Container>>)).setAutoDefault(Set);
logger.info("containers", containers)


async function execCommand(command:string) {
	console.log("exec: " + command)
	const {status, output} = (await exec(`sh -c "${command}"`, {output: OutputMode.Capture}));

	if (!status.success) throw output;
	else return output;
}