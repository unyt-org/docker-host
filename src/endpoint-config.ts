import { Datex, sync, property } from "unyt_core";

@sync export class EndpointConfig {
	@property version!: number
	@property endpoint!: Datex.Endpoint
	@property exposeDatabase!: boolean
}