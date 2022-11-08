// store and read endpoint config (name, keys, ...)

import { client_type, cwdURL, logger } from "../utils/global_values.js";
import { Endpoint, IdEndpoint } from "../types/addressing.js";
import { Crypto } from "./crypto.js";
import { fs, urlToPath } from "../utils/utils.js";
import { Runtime } from "./runtime.js";
import { Tuple } from "../types/tuple.js";
import { DatexObject } from "../datex_all.js";

class EndpointConfig {

	/* CONFIG VALUES */
	public endpoint:Endpoint
	public id_endpoint:IdEndpoint
	public keys: Crypto.ExportedKeySet
	/*****************/

	async load() {
		let serialized:string;

		if (client_type=="node") {
			const config_file = new URL('./.dx', cwdURL);

			if (fs.existsSync(urlToPath(config_file))) serialized = new TextDecoder().decode(fs.readFileSync(urlToPath(config_file)));
		}
		else serialized = globalThis.localStorage?.getItem("endpoint_config::"+(globalThis.location?.href ?? ''));

		if (serialized) {
			const data = await Runtime.parseDatexData(serialized);
			this.endpoint = DatexObject.get(data, 'endpoint')
			this.id_endpoint = DatexObject.get(data, 'id_endpoint')
			this.keys = DatexObject.get(data, 'keys')
		}
	}
   

	save() {
		const serialized = Runtime.valueToDatexString(new Tuple({endpoint:this.endpoint, id_endpoint:this.id_endpoint, keys:this.keys}));

		if (client_type=="node") {
			const config_file = new URL('./.dx', cwdURL);
			fs.writeFileSync(urlToPath(config_file), serialized)
		}
		else if (!globalThis.localStorage) logger.warn("Cannot save endpoint config persistently")
		else globalThis.localStorage.setItem("endpoint_config::"+(globalThis.location?.href ?? ''), serialized);
	}

	clear() {
		this.endpoint = undefined;
		this.id_endpoint = undefined;
		this.keys = undefined;

		if (client_type=="node") {
			const config_file = new URL('./.dx', cwdURL);
			fs.unlinkSync(urlToPath(config_file))
		}
		else if (globalThis.localStorage) globalThis.localStorage.removeItem("endpoint_config::"+(globalThis.location?.href ?? ''));
	}
}

export const endpoint_config = new EndpointConfig();