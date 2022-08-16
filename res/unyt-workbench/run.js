var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { expose, scope } from "./unyt_core/legacy_decorators.js";
import DatexCloud from "./unyt_core/datex_cloud.js";
import Logger from "./unyt_core/logger.js";
import { Datex } from "./unyt_core/datex_runtime.js";
import { EndpointConfig } from "./lib/endpoint-config.js";
import "./lib/sql-db-interface.js";
import "./lib/remote-shell.js";
EndpointConfig;
let Endpoint = class Endpoint {
    static logger = new Logger("endpoint");
    static async reload(config_path = process.argv[2]) {
        const config = await Datex.Runtime.parseDatexData(await Datex.getFileContent(null, config_path));
        this.logger.info("reloading endpoint");
        this.logger.success("loaded endpoint config: ", config);
        await DatexCloud.connect(config.endpoint);
    }
};
__decorate([
    expose,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], Endpoint, "reload", null);
Endpoint = __decorate([
    scope
], Endpoint);
let Workbench = class Workbench {
};
Workbench = __decorate([
    scope
], Workbench);
Endpoint.reload();
