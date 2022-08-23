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
import { Datex, eternal } from "./unyt_core/datex_runtime.js";
import { constructor, expose, meta, property, replicator, root_extension, scope, sync } from "./unyt_core/legacy_decorators.js";
import Logger from "./unyt_core/logger.js";
const logger = new Logger("container manager");
await DatexCloud.connect();
var ContainerStatus;
(function (ContainerStatus) {
    ContainerStatus[ContainerStatus["STOPPED"] = 0] = "STOPPED";
    ContainerStatus[ContainerStatus["STARTING"] = 1] = "STARTING";
    ContainerStatus[ContainerStatus["RUNNING"] = 2] = "RUNNING";
    ContainerStatus[ContainerStatus["STOPPING"] = 3] = "STOPPING";
    ContainerStatus[ContainerStatus["FAILED"] = 4] = "FAILED";
    ContainerStatus[ContainerStatus["INITIALIZING"] = 5] = "INITIALIZING";
})(ContainerStatus || (ContainerStatus = {}));
let Container = class Container {
    logger;
    #initialized = false;
    image;
    container_name = "Container";
    name = "Container";
    id = '0';
    owner;
    status = ContainerStatus.INITIALIZING;
    uniqueID() {
        return 'xxxx-xxxx-xxxx-xxxx-xxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    constructor(owner) { }
    construct(owner) {
        this.owner = owner;
        this.container_name = this.uniqueID();
        this.logger = new Logger(this);
    }
    replicate() {
        this.logger = new Logger(this);
        this.#initialized = true;
        this.updateAfterReplicate();
    }
    async start() {
        const running = await this.handleStart();
        if (running)
            this.status = ContainerStatus.RUNNING;
        else
            this.status = ContainerStatus.FAILED;
        return running;
    }
    async init() {
        if (this.#initialized)
            return true;
        this.status = ContainerStatus.INITIALIZING;
        const initialized = await this.handleInit();
        if (initialized)
            this.status = ContainerStatus.STOPPED;
        else
            this.status = ContainerStatus.FAILED;
        this.#initialized = initialized;
        return initialized;
    }
    async handleInit() {
        try {
            await execCommand(`docker run -d --name ${this.container_name} ${this.image}`);
        }
        catch (e) {
            this.logger.error("error while creating container", e);
            return false;
        }
        return true;
    }
    async updateAfterReplicate() {
        if (this.status == ContainerStatus.STARTING)
            this.start();
        else if (this.status == ContainerStatus.STOPPING)
            this.stop();
    }
    async handleStart() {
        if (!await this.init())
            return false;
        this.logger.info("Starting Container " + this.container_name);
        this.status = ContainerStatus.STARTING;
        try {
            await execCommand(`docker container start ${this.container_name}`);
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
    async stop(force = true) {
        this.logger.info("Stopping Container " + this.container_name);
        this.status = ContainerStatus.STOPPING;
        try {
            await execCommand(`docker container ${force ? 'kill' : 'stop'} ${this.container_name}`);
        }
        catch (e) {
            this.logger.error("error while stopping container", e);
            this.status = ContainerStatus.FAILED;
            return false;
        }
        this.status = ContainerStatus.STOPPED;
        return true;
    }
    async remove() {
        try {
            await execCommand(`docker rm -f ${this.container_name}`);
        }
        catch (e) {
            this.logger.error("error while removing container", e);
            return false;
        }
        return true;
    }
    async isRunning() {
        const ps = await execCommand(`docker ps | grep ${this.container_name}`);
        return !!ps;
    }
};
__decorate([
    property,
    __metadata("design:type", String)
], Container.prototype, "image", void 0);
__decorate([
    property,
    __metadata("design:type", String)
], Container.prototype, "container_name", void 0);
__decorate([
    property,
    __metadata("design:type", String)
], Container.prototype, "name", void 0);
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
    __metadata("design:type", Number)
], Container.prototype, "status", void 0);
__decorate([
    constructor,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Datex.Addresses.Endpoint]),
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
__decorate([
    property,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], Container.prototype, "stop", null);
Container = __decorate([
    sync,
    __metadata("design:paramtypes", [Datex.Addresses.Endpoint])
], Container);
let WorkbenchContainer = class WorkbenchContainer extends Container {
    config;
    constructor(owner, config) { super(owner); }
    constructWorkbenchContanier(owner, config) {
        this.construct(owner);
        this.config = config;
        this.name = "unyt Workbench";
    }
    async handleInit() {
        try {
            const username = "user";
            const config_exported = Datex.Runtime.valueToDatexString(this.config, true, true, true);
            this.image = 'unyt-workbench-' + this.config.endpoint.toString().replaceAll('@', '').toLowerCase();
            logger.info("image: " + this.image);
            logger.info("config: " + config_exported);
            logger.info("username: " + username);
            const tmp_dir = `res/config-files-${new Date().getTime()}`;
            await execCommand(`cp -r ./res/config-files ${tmp_dir}`);
            const writer = fs.createWriteStream(`${tmp_dir}/endpoint.dx`);
            writer.write(config_exported);
            writer.close();
            await execCommand(`docker build --build-arg username=${username} --build-arg configpath=${tmp_dir} -f ./res/Dockerfile -t ${this.image} .`);
            await execCommand(`rm -r ${tmp_dir}`);
        }
        catch (e) {
            this.logger.error("Error initializing container", e);
            return false;
        }
        return super.handleInit();
    }
    async handleStart() {
        if (!await super.handleStart())
            return false;
        await new Promise(resolve => { setTimeout(() => resolve(), 6000); });
        try {
            await DatexCloud.pingEndpoint(this.config.endpoint);
        }
        catch (e) {
            this.logger.error("Workbench Endpoint not reachable");
            await this.stop();
            return false;
        }
        this.logger.success("Workbench Endpoint is reachable");
        return true;
    }
};
__decorate([
    property,
    __metadata("design:type", EndpointConfig)
], WorkbenchContainer.prototype, "config", void 0);
__decorate([
    constructor,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Datex.Addresses.Endpoint, EndpointConfig]),
    __metadata("design:returntype", void 0)
], WorkbenchContainer.prototype, "constructWorkbenchContanier", null);
WorkbenchContainer = __decorate([
    sync,
    __metadata("design:paramtypes", [Datex.Addresses.Endpoint, EndpointConfig])
], WorkbenchContainer);
let RemoteImageContainer = class RemoteImageContainer extends Container {
    version;
    url;
    constructor(owner, url, version) { super(owner); }
    constructRemoteImageContainer(owner, url, version) {
        this.construct(owner);
        this.version = version;
        this.url = url;
        this.name = url;
    }
    async update() {
        try {
            this.image = `${this.url}${this.version ? ':' + this.version : ''}`;
            await execCommand(`docker pull ${this.image}`);
        }
        catch (e) {
            this.logger.error("Error initializing container", e);
            return false;
        }
        return true;
    }
    async handleInit() {
        if (!await this.update())
            return false;
        return super.handleInit();
    }
    async handleStart() {
        if (!await this.update())
            return false;
        return super.handleStart();
    }
};
__decorate([
    property,
    __metadata("design:type", String)
], RemoteImageContainer.prototype, "version", void 0);
__decorate([
    property,
    __metadata("design:type", String)
], RemoteImageContainer.prototype, "url", void 0);
__decorate([
    constructor,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Datex.Addresses.Endpoint, String, String]),
    __metadata("design:returntype", void 0)
], RemoteImageContainer.prototype, "constructRemoteImageContainer", null);
__decorate([
    property,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RemoteImageContainer.prototype, "update", null);
RemoteImageContainer = __decorate([
    sync,
    __metadata("design:paramtypes", [Datex.Addresses.Endpoint, String, String])
], RemoteImageContainer);
let ContainerManager = class ContainerManager {
    static async getContainers(meta) {
        return containers.getAuto(meta.sender);
    }
    static async createWorkbenchContainer(meta) {
        logger.info("Creating new Workbench Container for " + meta.sender);
        const config = new EndpointConfig();
        config.endpoint = Datex.Addresses.Endpoint.getNewEndpoint();
        const container = new WorkbenchContainer(meta.sender, config);
        container.start();
        this.addContainer(meta.sender, container);
        return container;
    }
    static async createRemoteImageContainer(url, meta) {
        logger.info("Creating new Remote Image Container for " + meta.sender, url);
        const container = new RemoteImageContainer(meta.sender, url);
        container.start();
        this.addContainer(meta.sender, container);
        console.log(containers);
        return container;
    }
    static addContainer(endpoint, container) {
        containers.getAuto(endpoint).add(container);
    }
};
__decorate([
    meta(0),
    expose,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ContainerManager, "getContainers", null);
__decorate([
    meta(0),
    expose,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ContainerManager, "createWorkbenchContainer", null);
__decorate([
    meta(1),
    expose,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ContainerManager, "createRemoteImageContainer", null);
ContainerManager = __decorate([
    root_extension,
    scope
], ContainerManager);
const containers = (await eternal((Map))).setAutoDefault(Set);
logger.info("containers", containers);
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
