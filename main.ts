import { exec } from "child_process";
import fs from "fs";
import { EndpointConfig } from "./endpoint-config.js";
import DatexCloud from "./unyt_core/datex_cloud.js";
import { datex, Datex } from "./unyt_core/datex_runtime.js";
import {constructor, expose, meta, property, replicator, root_extension, scope, sync} from "./unyt_core/legacy_decorators.js";
import Logger from "./unyt_core/logger.js";
const logger = new Logger("container manager");

await DatexCloud.connect();



@sync class Container {

	protected logger:Logger

	@property id: string
	@property owner: Datex.Addresses.Endpoint
	@property config: EndpointConfig

	constructor(id:string, owner: Datex.Addresses.Endpoint, config: EndpointConfig) {}
	@constructor construct(id:string, owner: Datex.Addresses.Endpoint, config: EndpointConfig) {
		this.id = id;
		this.owner = owner;
		this.config = config;
		this.logger = new Logger(this);
	}
	@replicator replicate(){
		this.logger = new Logger(this);
	}

	@property async start(){
		this.logger.info("Starting Container");
		try {
			await execCommand(`docker run --rm -d ${this.id}`)
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

	private async isRunning(){
		const ps = await execCommand(`docker ps | grep ${this.id}`);
		return !!ps;
	}
}

@sync class WorkbenchContainer extends Container {
	@property override async start(){

		if (!await super.start()) return false;

		// check if endpoint is reachable
		// wait some time TODO wait until endpoint calls
		await new Promise<void>(resolve=>{setTimeout(()=>resolve(),8000)});
		try {
			await DatexCloud.pingEndpoint(this.config.endpoint);
		}
		catch (e) {
			this.logger.error("Workbench Endpoint not reachable")
			return false;
		}
		this.logger.success("Workbench Endpoint is reachable");
		return true;
	}
}


@root_extension @scope class ContainerManager {

	@meta(0)
	@expose static async createWorkbenchContainer(meta:Datex.datex_meta):Promise<WorkbenchContainer>{
		logger.info("Creating new Workbench Container for " + meta.sender);

		// config
		const config = new EndpointConfig();
		config.endpoint = Datex.Addresses.Endpoint.getNewEndpoint();

		// docker parameters
		const config_exported = Datex.Runtime.valueToDatexString(config, true, true, true);
		const container_id = config.endpoint.toString().replaceAll('@','').toLowerCase();
		const username = meta.sender.toString().replaceAll('@','');

		logger.info("id: " + container_id);
		logger.info("config: " + config_exported);

		// create new config directory to copy to docker
		const tmp_dir = `res/config-files-${new Date().getTime()}`
		await execCommand(`cp -r ./res/config-files ${tmp_dir}`);
		const writer = fs.createWriteStream(`${tmp_dir}/endpoint.dx`)
		writer.write(config_exported);
		writer.close();

		// create docker container
		await execCommand(`docker build --build-arg username=${username} --build-arg configpath=${tmp_dir} -f ./res/Dockerfile -t ${container_id} .`)

		// remove tmp directory
		await execCommand(`rm -r ${tmp_dir}`);

		// create WorkbenchContainer
		const container = new WorkbenchContainer(container_id, meta.sender, config);

		return container;
	}

	

}



function execCommand(command:string) {
	return new Promise<string>((resolve, reject)=>{
		exec(command, (error, stdout, stderr)=> {
			if (error) reject(error);
			if (stderr) reject(stderr);
			else resolve(stdout.replace(/\n$/, ''));
		})
	})
}