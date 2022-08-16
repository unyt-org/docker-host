import { Datex } from "../unyt_core/datex_runtime.js";
import { template, property } from "../unyt_core/legacy_decorators.js";

@template('<unyt:endpoint-config>') export class EndpointConfig {
	@property version: number
	@property endpoint: Datex.Addresses.Endpoint
	@property('expose-database') ['expose-database']: boolean
}