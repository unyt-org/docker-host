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
import { spawn } from 'child_process';
import { Datex } from "../unyt_core/datex_runtime.js";
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const logger = new Logger("ssh relay");
let RemoteShell = RemoteShell_1 = class RemoteShell {
    static async newSession() {
        logger.success("new remote shell session");
        return new RemoteShell_1();
    }
    out_stream = new Datex.Stream;
    in_stream = new Datex.Stream;
    #process;
    async construct() {
        this.start();
        const reader = this.in_stream.getReader();
        let next;
        while (true) {
            next = await reader.read();
            if (next.done)
                return;
            this.#process?.stdin.write(new Uint8Array(next.value));
        }
    }
    start() {
        try {
            this.#process = spawn(__dirname + '/shell.sh');
            this.#process.stdout.on('data', (data) => {
                this.out_stream.write(data);
            });
            this.#process.stderr.on('data', (data) => {
                this.out_stream.write(data);
            });
        }
        catch (e) {
            logger.error("Error:", e);
        }
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
