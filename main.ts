import { exec } from "child_process";
import fs from "fs";
import { EndpointConfig } from "./endpoint-config.js";
import { Datex, eternal, constructor, expose, meta, property, replicator,default_property, scope, sync } from "./unyt_core/datex.js";
const logger = new Datex.Logger("container manager");

await Datex.Supranet.connect();


enum ContainerStatus {
	STOPPED = 0,
	STARTING = 1,
	RUNNING = 2,
	STOPPING = 3,
	FAILED = 4,
	INITIALIZING = 5
}

// parent class for all types of containers
@sync class Container {

	protected logger:Datex.Logger;
	#initialized = false;

	// docker container image + id
	@property image: string
	@property container_name: string = "Container"
	@property name: string = "Container"
	@property id: string = '0';

	@property owner: Datex.Endpoint
	@property status: ContainerStatus = ContainerStatus.INITIALIZING;

	uniqueID() {
		return 'xxxx-xxxx-xxxx-xxxx-xxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
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
		if (running) this.status = ContainerStatus.RUNNING;
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
			await execCommand(`docker run -d --name ${this.container_name} ${this.image}`)
		} catch (e) {
			this.logger.error("error while creating container",e);
			return false;
		}
		return true;
	}

	protected async updateAfterReplicate(){
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

	protected async remove(){
		try {
			await execCommand(`docker rm -f ${this.container_name}`)
		} catch (e) {
			this.logger.error("error while removing container",e);
			return false;
		}
		return true;
	}

	private async isRunning(){
		const ps = await execCommand(`docker ps | grep ${this.container_name}`);
		return !!ps;
	}
}

@sync class WorkbenchContainer extends Container {

	@property config: EndpointConfig

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
			const writer = fs.createWriteStream(`${tmp_dir}/endpoint.dx`)
			writer.write(config_exported);
			writer.close();
	
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

	override async handleStart(){
		if (!await super.handleStart()) return false;

		// check if endpoint is reachable
		// wait some time TODO wait until endpoint calls
		await new Promise<void>(resolve=>{setTimeout(()=>resolve(),6000)});
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


@sync class RemoteImageContainer extends Container {

	@property version:string
	@property url:string

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



@default_property @scope class ContainerManager {

	@meta(0)
	@expose static async getContainers(meta:Datex.datex_meta):Promise<Set<Container>>{
		return containers.getAuto(meta.sender);
	}

	@meta(0)
	@expose static async createWorkbenchContainer(meta:Datex.datex_meta):Promise<WorkbenchContainer>{
		logger.info("Creating new Workbench Container for " + meta.sender);

		// create config
		const config = new EndpointConfig();
		config.endpoint = Datex.Endpoint.getNewEndpoint();

		// init and start WorkbenchContainer
		const container = new WorkbenchContainer(meta.sender, config);
		container.start();

		// link container to requesting endpoint
		this.addContainer(meta.sender, container);

		return container;
	}

	@meta(1)
	@expose static async createRemoteImageContainer(url:string, meta:Datex.datex_meta):Promise<RemoteImageContainer>{
		logger.info("Creating new Remote Image Container for " + meta.sender, url);

		// init and start RemoteImageContainer
		const container = new RemoteImageContainer(meta.sender, url);
		container.start();

		// link container to requesting endpoint
		this.addContainer(meta.sender, container);
		console.log(containers);

		return container;
	}

	private static addContainer(endpoint:Datex.Endpoint, container:Container) {
		containers.getAuto(endpoint).add(container);
	}

}

const containers = (await eternal(Map<Datex.Endpoint, Set<Container>>)).setAutoDefault(Set);
logger.info("containers", containers)


function execCommand(command:string) {
	return new Promise<string>((resolve, reject)=>{
		exec(command, (error, stdout, stderr)=> {
			if (error) reject(error);
			if (stderr) reject(stderr);
			else resolve(stdout.replace(/\n$/, ''));
		})
	})
}