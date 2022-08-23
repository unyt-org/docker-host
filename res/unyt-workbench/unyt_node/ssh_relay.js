var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import Logger from "../unyt_core/logger.js";
import { sync, expose, scope, property } from "../unyt_core/legacy_decorators.js";
const logger = new Logger("ssh relay");
import SSH2Client from 'ssh2';
import { Datex } from "../unyt_core/datex_runtime.js";
let SSHRelayServer = class SSHRelayServer {
    static async connect(host, port, username, passsword, private_key) {
        logger.success("connecting to " + host + ":" + port);
        let connection = new SSHConnection(host, port, username, passsword, private_key);
        await connection.connect();
        return connection;
    }
};
__decorate([
    expose,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, String, String, String]),
    __metadata("design:returntype", Promise)
], SSHRelayServer, "connect", null);
SSHRelayServer = __decorate([
    scope('ssh')
], SSHRelayServer);
export { SSHRelayServer };
let SSHConnection = class SSHConnection {
    constructor(host, port, username, passsword, private_key) {
        Object.defineProperty(this, "host", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "port", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "username", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "out_stream", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Datex.Stream()
        });
        Object.defineProperty(this, "in_stream", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Datex.Stream()
        });
        Object.defineProperty(this, "passsword", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "private_key", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "internal_stream", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.host = host;
        this.port = port;
        this.username = username;
        this.passsword = passsword;
        this.private_key = private_key;
        this.pipeInStream();
    }
    async pipeInStream() {
        const reader = this.in_stream.getReader();
        let next;
        while (true) {
            next = await reader.read();
            if (next.done)
                return;
            this.internal_stream?.write(new Uint8Array(next.value));
        }
    }
    async connect() {
        const conn = new SSH2Client();
        return new Promise((resolve, reject) => {
            conn
                .on('error', (e) => {
                reject(e);
            })
                .on('ready', () => {
                conn.shell({ cols: 500, rows: 45, term: 'xterm-256color' }, {}, (err, stream) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                    this.internal_stream = stream;
                    stream
                        .on('close', () => {
                        logger.error('Stream connection closed.');
                        conn.end();
                    })
                        .on('data', async (data) => {
                        let array_buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.length);
                        this.out_stream.write(array_buffer);
                    })
                        .stderr.on('data', async (data) => {
                        let array_buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.length);
                        this.out_stream.write(array_buffer);
                    });
                });
            }).connect({
                host: this.host,
                port: this.port,
                username: this.username,
                password: this.passsword,
                privateKey: this.private_key
            });
        });
    }
};
__decorate([
    property,
    __metadata("design:type", String)
], SSHConnection.prototype, "host", void 0);
__decorate([
    property,
    __metadata("design:type", Number)
], SSHConnection.prototype, "port", void 0);
__decorate([
    property,
    __metadata("design:type", String)
], SSHConnection.prototype, "username", void 0);
__decorate([
    property,
    __metadata("design:type", Datex.Stream)
], SSHConnection.prototype, "out_stream", void 0);
__decorate([
    property,
    __metadata("design:type", Datex.Stream)
], SSHConnection.prototype, "in_stream", void 0);
SSHConnection = __decorate([
    sync,
    __metadata("design:paramtypes", [String, Number, String, String, String])
], SSHConnection);
