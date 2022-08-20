var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { exec } from "child_process";
import fs from "fs";
import { EndpointConfig } from "./endpoint-config.js";
import DatexCloud from "./unyt_core/datex_cloud.js";
import { Datex } from "./unyt_core/datex_runtime.js";
import { constructor, expose, meta, property, replicator, root_extension, scope, sync } from "./unyt_core/legacy_decorators.js";
import Logger from "./unyt_core/logger.js";
const logger = new Logger("container manager");
await DatexCloud.connect();
let Container = class Container {
    logger;
    id;
    owner;
    config;
    constructor(id, owner, config) { }
    construct(id, owner, config) {
        this.id = id;
        this.owner = owner;
        this.config = config;
        this.logger = new Logger(this);
    }
    replicate() {
        this.logger = new Logger(this);
    }
    async start() {
        this.logger.info("Starting Container");
        try {
            await execCommand(`docker run --rm -d ${this.id}`);
        }
        catch (e) {
            this.logger.error("error while starting container");
            return false;
        }
        const running = await this.isRunning();
        if (running) {
            this.logger.success("Container is running");
        }
        else {
            this.logger.error("Container is not running");
            return false;
        }
        return true;
    }
    async isRunning() {
        const ps = await execCommand(`docker ps | grep ${this.id}`);
        return !!ps;
    }
};
__decorate([
    property,
    __metadata("design:type", String)
], Container.prototype, "id", void 0);
__decorate([
    property,
    __metadata("design:type", Datex.Addresses.Endpoint)
], Container.prototype, "owner", void 0);
__decorate([
    property,
    __metadata("design:type", EndpointConfig)
], Container.prototype, "config", void 0);
__decorate([
    constructor,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Datex.Addresses.Endpoint, EndpointConfig]),
    __metadata("design:returntype", void 0)
], Container.prototype, "construct", null);
__decorate([
    replicator,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Container.prototype, "replicate", null);
__decorate([
    property,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], Container.prototype, "start", null);
Container = __decorate([
    sync,
    __metadata("design:paramtypes", [String, Datex.Addresses.Endpoint, EndpointConfig])
], Container);
let WorkbenchContainer = class WorkbenchContainer extends Container {
    async start() {
        if (!await super.start())
            return false;
        await new Promise(resolve => { setTimeout(() => resolve(), 8000); });
        try {
            await DatexCloud.pingEndpoint(this.config.endpoint);
        }
        catch (e) {
            this.logger.error("Workbench Endpoint not reachable");
            return false;
        }
        this.logger.success("Workbench Endpoint is reachable");
        return true;
    }
};
__decorate([
    property,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WorkbenchContainer.prototype, "start", null);
WorkbenchContainer = __decorate([
    sync
], WorkbenchContainer);
let ContainerManager = class ContainerManager {
    static async createWorkbenchContainer(meta) {
        logger.info("Creating new Workbench Container for " + meta.sender);
        const config = new EndpointConfig();
        config.endpoint = Datex.Addresses.Endpoint.getNewEndpoint();
        const config_exported = Datex.Runtime.valueToDatexString(config, true, true, true);
        const container_id = config.endpoint.toString().replaceAll('@', '').toLowerCase();
        const username = meta.sender.toString().replaceAll('@', '');
        logger.info("id: " + container_id);
        logger.info("config: " + config_exported);
        const tmp_dir = `res/config-files-${new Date().getTime()}`;
        await execCommand(`cp -r ./res/config-files ${tmp_dir}`);
        const writer = fs.createWriteStream(`${tmp_dir}/endpoint.dx`);
        writer.write(config_exported);
        writer.close();
        await execCommand(`docker build --build-arg username=${username} --build-arg configpath=${tmp_dir} -f ./res/Dockerfile -t ${container_id} .`);
        await execCommand(`rm -r ${tmp_dir}`);
        const container = new WorkbenchContainer(container_id, meta.sender, config);
        return container;
    }
};
__decorate([
    meta(0),
    expose,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ContainerManager, "createWorkbenchContainer", null);
ContainerManager = __decorate([
    root_extension,
    scope
], ContainerManager);
function execCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error)
                reject(error);
            if (stderr)
                reject(stderr);
            else
                resolve(stdout.replace(/\n$/, ''));
        });
    });
}
