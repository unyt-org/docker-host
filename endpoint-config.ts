import { Datex, template, property } from "unyt_core";

@template('<unyt:endpoint-config>') export class EndpointConfig {
	@property declare version: number
	@property declare endpoint: Datex.Endpoint
	@property('expose-database') declare ['expose-database']: boolean
}