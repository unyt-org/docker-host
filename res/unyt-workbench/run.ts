
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
import {expose, root_variable, scope} from "./unyt_core/legacy_decorators.js";
import DatexCloud from "./unyt_core/datex_cloud.js";
import Logger from "./unyt_core/logger.js";
import { Datex } from "./unyt_core/datex_runtime.js";

import { EndpointConfig } from "./lib/endpoint-config.js";
import "./lib/sql-db-interface.js"
import "./lib/remote-shell.js"
/**************************************************************************************/

declare let process:any;


EndpointConfig;

@scope class Endpoint {

	static logger = new Logger("endpoint")


	@expose static async reload(config_path = process.argv[2]){
		const config = await Datex.Runtime.parseDatexData(await Datex.getFileContent(null, config_path));
		this.logger.info("reloading endpoint");
		this.logger.success("loaded endpoint config: ", config);
		await DatexCloud.connect(config.endpoint);
	}

}


@scope class Workbench {


}

Endpoint.reload();