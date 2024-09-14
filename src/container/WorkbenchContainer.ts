import { logger } from "unyt_core/datex_all.ts";
import { Datex } from "unyt_core/mod.ts";
import { EndpointConfig } from "../endpoint-config.ts";
import Container from "./Container.ts";

@sync export default class WorkbenchContainer extends Container {
	@property config!: EndpointConfig

	// @ts-ignore $
	override construct(owner: Datex.Endpoint, config: EndpointConfig) {
		super.construct(owner)
		this.config = config;
		this.name = "unyt Workbench"
	}

	// custom workbench container init
	override async handleInit() {
		try {
			const username = "user"; // TODO other usernames?
			const config_exported = Datex.Runtime.valueToDatexString(this.config, true, true, true);
	
			this.image = 'unyt-workbench-' + this.config.endpoint.toString().replace(/[^A-Za-z0-9_-]/g,'').toLowerCase();
	
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
		} catch (e) {
			this.logger.error(e);
			this.logger.error("Error initializing workbench container");
			return false;
		}
		return super.handleInit();
	}

	override async handleOnline() {
		await sleep(6000);
		try {
			if (!await this.config.endpoint.isOnline())
				throw new Error("Endpoint not reachable");
		} catch (e) {
			this.logger.error("Workbench Endpoint not reachable");
			this.logger.error(e);
			await this.stop(); // stop container again for consistant container state
			return false;
		}
		this.logger.success("Workbench Endpoint is reachable");
		return true;
	}
}