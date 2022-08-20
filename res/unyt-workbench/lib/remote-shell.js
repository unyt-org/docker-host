var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RemoteShell_1;
import Logger from "../unyt_core/logger.js";
import { sync, expose, scope, property, constructor } from "../unyt_core/legacy_decorators.js";
import { spawn, exec } from 'child_process';
import { Datex, props } from "../unyt_core/datex_runtime.js";
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const logger = new Logger("ssh relay");
let RemoteShell = RemoteShell_1 = class RemoteShell {
    static async newSession() {
        logger.success("new remote shell session");
        const shell = new RemoteShell_1();
        await shell.start();
        return shell;
    }
    out_stream = new Datex.Stream;
    in_stream = new Datex.Stream;
    width = 200;
    height = 100;
    #process;
    #device;
    #bash_pid;
    async construct() {
        const reader = this.in_stream.getReader();
        let next;
        while (true) {
            next = await reader.read();
            if (next.done)
                return;
            this.#process?.stdin.write(new Uint8Array(next.value));
        }
    }
    async start() {
        try {
            this.#process = spawn(__dirname + '/shell.sh');
            this.#process.stdout.on('data', (data) => {
                this.out_stream.write(data);
            });
            this.#process.stderr.on('data', (data) => {
                this.out_stream.write(data);
            });
            await this.getTerminalDevice(this.#process.pid);
            this.#bash_pid = await this.getChildPID(await this.getChildPID(this.#process.pid, 'script'), 'sh');
            this.#device = await this.getTerminalDevice(this.#bash_pid);
            logger.info(`Bash Process: PID=${this.#bash_pid}, DEVICE=${this.#device}`);
        }
        catch (e) {
            logger.error("Error:", e);
        }
        props(this).height.observe(() => this.resize());
        props(this).width.observe(() => this.resize());
    }
    async getChildPID(pid, cmd) {
        const pid_string = await this.exec(`ps --ppid ${pid} | grep ${cmd} | awk '{print $1}'`);
        if (pid_string)
            return Number(pid_string);
        else
            throw Error("Could not get PID");
    }
    async getTerminalDevice(pid) {
        return (await this.exec(`lsof -X -p ${pid} | grep -o '/dev/.*' | grep -v urandom | uniq`)).split("\n")[0];
    }
    exec(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout) => {
                if (error)
                    reject(error);
                else
                    resolve(stdout.replace(/\n$/, ''));
            });
        });
    }
    async resize() {
        const width = this.width;
        const height = this.height;
        if (!(typeof width == "number" || typeof width == "bigint") || !(typeof height == "number" || typeof height == "bigint"))
            throw new Datex.ValueError("Invalid width or height");
        if (width <= 0 || height <= 0)
            throw new Datex.ValueError("width and height must be >= 0");
        await this.exec(`stty rows ${height} cols ${width} -F ${this.#device}`);
        this.#process.kill("SIGWINCH");
        logger.info(`Resizing Terminal: ${width} x ${height}`);
    }
};
__decorate([
    property,
    __metadata("design:type", Datex.Stream)
], RemoteShell.prototype, "out_stream", void 0);
__decorate([
    property,
    __metadata("design:type", Datex.Stream)
], RemoteShell.prototype, "in_stream", void 0);
__decorate([
    property,
    __metadata("design:type", Number)
], RemoteShell.prototype, "width", void 0);
__decorate([
    property,
    __metadata("design:type", Number)
], RemoteShell.prototype, "height", void 0);
__decorate([
    constructor,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RemoteShell.prototype, "construct", null);
__decorate([
    expose,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RemoteShell, "newSession", null);
RemoteShell = RemoteShell_1 = __decorate([
    sync,
    scope('shell')
], RemoteShell);
export { RemoteShell };
