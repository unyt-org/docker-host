
/**
╔══════════════════════════════════════════════════════════════════════════════════════╗
║  unyt cloud endpoint                                                                 ║
╠══════════════════════════════════════════════════════════════════════════════════════╣
║  server endpoint for the unyt command center and workbench                           ║
╠═════════════════════════════════════════╦════════════════════════════════════════════╣
║  © 2022 unyt.org                        ║                                            ║
╚═════════════════════════════════════════╩════════════════════════════════════════════╝
*/

/** imports ***************************************************************************/
import {Datex, expose, scope} from "./unyt_core/datex.js";

import { EndpointConfig } from "./lib/endpoint-config.js";
import "./lib/sql-db-interface.js"
import "./lib/remote-shell.js"
/**************************************************************************************/

declare let process:any;


EndpointConfig;

@scope class Endpoint {

	static logger = new Datex.Logger("endpoint")

	@expose static async reload(config_path = process.argv[2]){
		console.log("path",config_path);
		const config = await Datex.Runtime.parseDatexData(await Datex.getFileContent(null, config_path.startsWith('/') ? config_path : new URL(config_path, import.meta.url)));
		this.logger.info("reloading endpoint");
		this.logger.success("loaded endpoint config: ", config);
		await Datex.Supranet.connect(config.endpoint);
	}

}


@scope class Workbench {


}

Endpoint.reload();