import { Datex, template, property } from "../unyt_core/datex.js";

@template('<unyt:endpoint-config>') export class EndpointConfig {
	@property version: number
	@property endpoint: Datex.Endpoint
	@property('expose-database') ['expose-database']: boolean
}