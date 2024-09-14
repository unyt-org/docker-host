import { Datex } from "unyt_core/mod.ts";
import Container from "./Container.ts";

@sync export default class RemoteImageContainer extends Container {
	@property version?: string
	@property url!: string

	construct(owner: Datex.Endpoint, url: string, version?: string) {
		super.construct(owner)
		this.version = version;
		this.url = url;
		this.name = url;
		this.image = `${this.url}${this.version?':'+this.version:''}`;
	}

	// update docker image
	@property async update() {
		try {
			if (this.image.includes('"'))
				throw new Error("Invalid image name");
			await new Deno.Command("docker", { args: ["pull", `\"${this.image}\"`] }).output();
		} catch (e) {
			console.log(e)
			this.logger.error("Error initializing remote image container");
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
