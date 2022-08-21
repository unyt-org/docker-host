import { exec } from "child_process";
import fs from "fs";
import { EndpointConfig } from "./endpoint-config.js";
import DatexCloud from "./unyt_core/datex_cloud.js";
import { datex, Datex, eternal } from "./unyt_core/datex_runtime.js";
import {constructor, expose, meta, property, replicator, root_extension, scope, sync} from "./unyt_core/legacy_decorators.js";
import Logger from "./unyt_core/logger.js";
const logger = new Logger("container manager");

await DatexCloud.connect();


enum ContainerStatus {
	STOPPED = 0,
	STARTING = 1,
	RUNNING = 2,
	STOPPING = 3,
	FAILED = 4
}

// parent class for all types of containers
@sync class Container {

	protected logger:Logger
	protected initialized = false;

	// docker container image + id
	@property image: string
	@property id: string = '0';

	@property owner: Datex.Addresses.Endpoint
	@property status: ContainerStatus = 0

	protected get container_name(){
		return `${this.image}-inst-${this.id}`;
	}

	constructor(image:string, owner: Datex.Addresses.Endpoint) {}
	@constructor construct(image:string, owner: Datex.Addresses.Endpoint) {
		this.image = image;
		this.owner = owner;
		this.logger = new Logger(this);
	}
	@replicator replicate(){
		this.logger = new Logger(this);
		this.initialized = true;
		this.updateAfterReplicate();
	}

	@property async start(){
		this.logger.info("Starting Container " + this.container_name);

		// STARTING ...
		this.status = ContainerStatus.STARTING;

		// start => RUNNING or FAILED
		const running = await this.handleStart();
		if (running) this.status = ContainerStatus.RUNNING;
		else this.status = ContainerStatus.FAILED;

		return running;
	}

	// create docker for the first time
	public async init(){
		try {
			await execCommand(`docker run -d --name ${this.container_name} ${this.image}`)
		} catch (e) {
			this.logger.error("error while creating container")
			return false;
		}
		this.initialized = true;
		return true;
	}

	protected async updateAfterReplicate(){
		// continue start/stop if in inbetween state
		if (this.status == ContainerStatus.STARTING) this.start();
		else if (this.status == ContainerStatus.STOPPING) this.stop();
	}

	protected async handleStart(){
		// first init docker container (only once)
		if (!this.initialized) {
			if (!await this.init()) return false;
		}

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

	// only one instance for each workbench docker container image
	protected override get container_name(){
		return `${this.image}`;
	}

	constructor(id:string, owner: Datex.Addresses.Endpoint, config: EndpointConfig) {super(id,owner)}
	@constructor constructWorkbenchContanier(id:string, owner: Datex.Addresses.Endpoint, config: EndpointConfig) {
		this.construct(id, owner)
		this.config = config;
		this.logger = new Logger(this);
	}

	override async handleStart(){
		if (!await super.handleStart()) return false;

		// check if endpoint is reachable
		// wait some time TODO wait until endpoint calls
		await new Promise<void>(resolve=>{setTimeout(()=>resolve(),6000)});
		try {
			await DatexCloud.pingEndpoint(this.config.endpoint);
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

@root_extension @scope class ContainerManager {

	@meta(0)
	@expose static async getContainers(meta:Datex.datex_meta):Promise<Set<Container>>{
		return containers.getAuto(meta.sender);
	}

	@meta(0)
	@expose static async createWorkbenchContainer(meta:Datex.datex_meta):Promise<WorkbenchContainer>{
		logger.info("Creating new Workbench Container for " + meta.sender);

		// config
		const config = new EndpointConfig();
		config.endpoint = Datex.Addresses.Endpoint.getNewEndpoint();

		// docker parameters
		const config_exported = Datex.Runtime.valueToDatexString(config, true, true, true);
		const image_name = 'unyt-workbench-' + config.endpoint.toString().replaceAll('@','').toLowerCase();
		const username = meta.sender.toString().replaceAll('@','');

		logger.info("id: " + image_name);
		logger.info("config: " + config_exported);
		logger.info("username: " + username);

		// create new config directory to copy to docker
		const tmp_dir = `res/config-files-${new Date().getTime()}`
		await execCommand(`cp -r ./res/config-files ${tmp_dir}`);
		const writer = fs.createWriteStream(`${tmp_dir}/endpoint.dx`)
		writer.write(config_exported);
		writer.close();

		// create docker container
		await execCommand(`docker build --build-arg username=${username} --build-arg configpath=${tmp_dir} -f ./res/Dockerfile -t ${image_name} .`)

		// remove tmp directory
		await execCommand(`rm -r ${tmp_dir}`);

		// create WorkbenchContainer
		const container = new WorkbenchContainer(image_name, meta.sender, config);
		container.start(); // start in background

		// add container
		this.addContainer(meta.sender, container);

		return container;
	}

	private static addContainer(endpoint:Datex.Addresses.Endpoint, container:Container) {
		containers.getAuto(endpoint).add(container);
	}

}


const containers = (await eternal(Map<Datex.Addresses.Endpoint, Set<Container>>)).setAutoDefault(Set);
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