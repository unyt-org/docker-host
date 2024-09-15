import { Datex } from "unyt_core/mod.ts";
import { Container } from "./Container.ts";
import { executeDocker } from "../CMD.ts";

@sync export class RemoteImageContainer extends Container {
	@property version?: string
	@property url!: string

	// @ts-ignore $
	construct(owner: Datex.Endpoint, url: string, version?: string) {
		super.construct(owner)
		this.version = version;
		this.url = url;
		this.name = url;
		this.image = `${this.url}${this.version ? `:${this.version}` : ''}`;
	}

	// update docker image
	@property async update() {
		try {
			if (!/^[a-z\.\-\/#%?=0-9:&]+$/gi.test(this.image))
				throw new Error(`Could not pull image with name ${this.image}`);
			await executeDocker([
				"pull",
				this.image
			], false);
			this.logger.success(`Successfully pulled remote image ${this.image}`);
		} catch (e) {
			this.logger.error(e);
			this.logger.error("Error pulling remote image");
			return false;
		}
		return true;
	}

	// custom workbench container init
	override async handleInit() {
		if (!await this.update())
			return false;
		return super.handleInit();
	}

	// custom start
	override async handleStart() {
		// always pull image first
		if (!await this.update())
			return false;
		return super.handleStart();
	}
}
