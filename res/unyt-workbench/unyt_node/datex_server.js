var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import WebServer from "./web_server.js";
import Logger from "../unyt_core/logger.js";
import TCP from "net";
import WebSocket from 'isomorphic-ws';
import websocketStream from 'websocket-stream';
import systeminformation from 'systeminformation';
import webpush from 'web-push';
import { btoa, datex, Datex, pointer } from "../unyt_core/datex_runtime.js";
import { DatexCompiler } from "../unyt_core/datex_compiler.js";
import { meta } from "../unyt_core/datex_js_class_adapter.js";
import { expose, scope } from "../unyt_core/legacy_decorators.js";
import DatexInterfaceManager, { DatexCommonInterface } from "../unyt_core/datex_client.js";
import DatexCloud from "../unyt_core/datex_cloud.js";
import { BlockchainSimAdapter } from "./blockchain_sim_adapter.js";
export class ServerDatexInterface {
    constructor() {
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "unknown"
        });
        Object.defineProperty(this, "in", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "out", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "endpoints", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: pointer(new Set())
        });
        Object.defineProperty(this, "reachable_endpoints", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: pointer(new Map())
        });
        Object.defineProperty(this, "logger", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "datex_in_handler", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.logger = new Logger(this.constructor.name);
        this.datex_in_handler = Datex.Runtime.getDatexInputHandler();
    }
    static getInstance() {
        if (!this.instance)
            this.instance = new this();
        return this.instance;
    }
    disconnect() {
    }
    endpointWelcomeMessage(endpoint) {
        return;
    }
    handleBlock(dxb, last_endpoint, header_callback) {
        if (header_callback)
            return this.datex_in_handler({ dxb, header_callback }, last_endpoint);
        else
            return this.datex_in_handler(dxb, last_endpoint);
    }
    send(dx, to) {
        return this.sendRequest(dx, to);
    }
}
class HttpComInterface extends ServerDatexInterface {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "http"
        });
        Object.defineProperty(this, "in", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "out", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    init() {
        this.logger.success("init");
        WebServer.express.get("/", (req, res) => {
            res.send(`<div style='font-family:"Courier New", Courier, monospace;width:100%;height:100%;display:flex;justify-content:center;align-items:center'><div style='text-align:center'><h3 style='margin-bottom: 0'>DATEX Node <span style='color:#0774de'>${Datex.Runtime.endpoint}</span></h3><br>© 2022 <a style='color: black;text-decoration: none;' href="https://unyt.org">unyt.org</a></div></div>`);
        });
        WebServer.express.get("/http/:dmx", async (req, res) => {
            let message_string = req.params.dmx.toString();
            console.log("==> A Connection says:\n%s", message_string);
            this.datex_in_handler(await DatexCompiler.compile(message_string), Datex.Runtime.endpoint);
            let result = "[OK]";
            res.type('text/plain');
            res.send(result);
        });
    }
    async sendRequest(dx, to) {
        return null;
    }
}
class WebPushInterface extends ServerDatexInterface {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "webpush"
        });
        Object.defineProperty(this, "in", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "out", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "saved_push_connections", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    init() {
        this.logger.success("init");
        webpush.setVapidDetails('mailto:admin@unyt.org', WebPushInterface.publicKey, WebPushInterface.privateKey);
    }
    registerChannel(endpoint, data) {
        this.saved_push_connections.set(endpoint, data);
        DatexCommonInterface.addInterfaceForEndpoint(endpoint, this);
        return true;
    }
    async sendRequest(dx, to) {
        if (this.saved_push_connections.has(to)) {
            let subscription = this.saved_push_connections.get(to);
            let base64 = btoa(String.fromCharCode(...new Uint8Array(dx)));
            let result = await webpush.sendNotification(subscription, base64);
            this.logger.success("-> push notification to " + to.toString(), result);
        }
        return null;
    }
}
Object.defineProperty(WebPushInterface, "publicKey", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 'BEurqeNZ1qqnY3BzL17tu-pMusRWr2zIxw4nau7nkTYQqeMYjV31s_l6DUP-AaV1VDYvOJYRfxfQQqlFvITg01s'
});
Object.defineProperty(WebPushInterface, "privateKey", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 'hshlp0C6kowCz6tgs8g-ZDRyyqHJXEcY1orM8AAe2WU'
});
class TCPCLI extends ServerDatexInterface {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "tcp_cli"
        });
        Object.defineProperty(this, "in", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "out", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "tcp_server", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
    }
    introText() {
        return `
        [30;107m                [0m
      [30;107m  [0m[30;40m                [0m[30;107m  [0m
    [30;107m  [0m[30;40m                    [0m[30;107m  [0m                                           [30;107m  [0m
   [30;107m  [0m[30;40m        [0m[30;107m      [0m[30;40m        [0m[30;107m  [0m    [30;107m  [0m      [30;107m  [0m  [30;107m        [0m    [30;107m  [0m      [30;107m  [0m  [30;107m      [0m
   [30;107m  [0m[30;40m       [0m[30;107m        [0m[30;40m       [0m[30;107m  [0m    [30;107m  [0m      [30;107m  [0m  [30;107m  [0m      [30;107m  [0m  [30;107m  [0m      [30;107m  [0m    [30;107m  [0m
   [30;107m  [0m[30;40m        [0m[30;107m      [0m[30;40m        [0m[30;107m  [0m    [30;107m  [0m      [30;107m  [0m  [30;107m  [0m      [30;107m  [0m  [30;107m  [0m      [30;107m  [0m    [30;107m  [0m
   [30;107m  [0m[30;40m     [0m[30;46m      [0m[30;101m      [0m[30;40m     [0m[30;107m  [0m    [30;107m  [0m      [30;107m  [0m  [30;107m  [0m      [30;107m  [0m  [30;107m          [0m    [30;107m  [0m
   [30;107m  [0m[30;40m    [0m[30;46m       [0m[30;101m       [0m[30;40m    [0m[30;107m  [0m    [30;107m  [0m      [30;107m  [0m  [30;107m  [0m      [30;107m  [0m        [30;107m  [0m      [30;107m  [0m
   [30;107m  [0m[30;40m     [0m[30;46m     [0m[30;40m  [0m[30;101m     [0m[30;40m     [0m[30;107m  [0m      [30;107m        [0m  [30;107m  [0m      [30;107m  [0m        [30;107m  [0m      [30;107m  [0m[90m  0.0.1a[0m
    [30;107m  [0m[30;40m                    [0m[30;107m  [0m                                   [30;107m  [0m
      [30;107m  [0m[30;40m                [0m[30;107m  [0m                                 [30;107m      [0m
        [30;107m                [0m


  Connected via [92m${process.env.UNYT_NAME.replace("ROUDINI-", "").replace(/\-/g, '.')}[0m (wss)
[92m
  [MODE]      [0mProduction[92m
  [APP]       [0m:unyt[92m
  [LICENSE]   [0mUnyt Corporation[92m
  [STATION]   [0m?[36m

  Enable debug mode for this endpoint: https://r.unyt.cc/@jonas[0m

  © 2022 Jonas & Benedikt Strehle



[97m> [0m`;
    }
    init() {
        this.logger.success("init");
        this.tcp_server = TCP.createServer((conn) => {
            conn.setEncoding('utf8');
            conn.write(this.introText(), async function () {
            });
            conn.on("error", console.log);
            conn.on("end", () => {
            });
            conn.on("data", async (message) => {
                let message_string = message.toString();
                console.log("==> A Connection says:\n%s", message);
                try {
                    let res = await datex(message_string);
                    if (res !== Datex.VOID)
                        conn.write(res + "\n");
                }
                catch (e) {
                    conn.write("[30;31m" + e + "[0m\n");
                }
                conn.write("[97m> [0m");
            });
        });
        const port = process.env.UNYT_TCP_PORT;
        this.tcp_server.listen(port, () => {
            this.logger.success(`TCP CLI Server is listening on port ${port}`);
        });
    }
    async sendRequest(dx, to) {
    }
}
class TCPComInterface extends ServerDatexInterface {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "tcp"
        });
        Object.defineProperty(this, "in", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "out", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "tcp_server", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "connection_endpoint_map", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "endpoint_connection_map", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    init() {
        this.logger.success("init");
        this.tcp_server = TCP.createServer((conn) => {
            conn.on("error", console.log);
            conn.on("end", () => {
            });
            conn.on("data", async (dx_block) => {
                let header;
                console.log("TCP data:", dx_block);
                let conn_endpoint = this.connection_endpoint_map.get(conn);
                if (!conn_endpoint) {
                    header = await this.handleBlock(new Uint8Array(dx_block).buffer, null, header => {
                        this.logger.debug("tcp endpoint registered: " + header.sender);
                        this.endpoints.add(header.sender);
                        DatexCommonInterface.addInterfaceForEndpoint(header.sender, this);
                        this.endpoint_connection_map.set(header.sender, conn);
                        this.connection_endpoint_map.set(conn, header.sender);
                        this.endpointWelcomeMessage(header.sender);
                    });
                }
                else {
                    header = await this.handleBlock(new Uint8Array(dx_block).buffer, conn_endpoint, null);
                }
                if (header && header.sender != conn_endpoint && !this.reachable_endpoints.has(header.sender)) {
                    this.reachable_endpoints.set(header.sender, conn_endpoint);
                    DatexCommonInterface.addIndirectInterfaceForEndpoint(header.sender, this);
                }
            });
        });
        const port = process.env.UNYT_TCP_PORT;
        this.tcp_server.listen(port, () => {
            this.logger.success(`TCP Server is listening on port ${port}`);
        });
    }
    async sendRequest(dx, to) {
        let buffer = Buffer.from(dx);
        if (!this.endpoint_connection_map.has(to)) {
            if (this.reachable_endpoints.has(to))
                to = this.reachable_endpoints.get(to);
            else {
                this.logger.error("alias " + to + " not connected");
                return;
            }
        }
        else
            this.endpoint_connection_map.get(to).write(buffer);
    }
}
class WebsocketStreamComInterface extends ServerDatexInterface {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "wss", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "in", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "out", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "wss"
        });
        Object.defineProperty(this, "connected_endpoint_streams", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    init() {
        this.logger.success("init");
        this.wss = new WebSocket.Server({
            server: WebServer.http,
            perMessageDeflate: {
                zlibDeflateOptions: {
                    chunkSize: 1024,
                    memLevel: 7,
                    level: 3
                },
                zlibInflateOptions: {
                    chunkSize: 10 * 1024
                },
                clientNoContextTakeover: true,
                serverNoContextTakeover: true,
                serverMaxWindowBits: 10,
                concurrencyLimit: 10,
                threshold: 1024
            }
        });
        this.logger.success(`WebSocket stream server is listening`);
        this.wss.on('connection', async (ws) => {
            console.log("new connection");
            let ws_stream = websocketStream(ws);
            ws_stream.on('data', async (dx_block) => {
                let header;
                if (!ws_stream.endpoint) {
                    header = await this.handleBlock(new Uint8Array(dx_block).buffer, ws_stream.endpoint, header => {
                        this.connected_endpoint_streams.set(header.sender, ws_stream);
                        this.endpoints.add(header.sender);
                        DatexCommonInterface.addInterfaceForEndpoint(header.sender, this);
                        ws_stream.endpoint = header.sender;
                        this.endpointWelcomeMessage(header.sender);
                    });
                }
                else {
                    header = await this.handleBlock(new Uint8Array(dx_block).buffer, ws_stream.endpoint, null);
                }
                if (header && header.sender != ws_stream.endpoint && !this.reachable_endpoints.has(header.sender)) {
                    this.reachable_endpoints.set(header.sender, ws_stream.endpoint);
                    DatexCommonInterface.addIndirectInterfaceForEndpoint(header.sender, this);
                }
            });
        });
    }
    async sendRequest(dx, to) {
        let buffer = Buffer.from(dx);
        if (!this.connected_endpoint_streams.has(to)) {
            if (this.reachable_endpoints.has(to))
                to = this.reachable_endpoints.get(to);
            else {
                this.logger.error("alias " + to + " not connected");
                return;
            }
        }
        else
            this.connected_endpoint_streams.get(to).write(buffer);
    }
}
class WebsocketComInterface extends ServerDatexInterface {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "websocket"
        });
        Object.defineProperty(this, "in", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "out", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "wss", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "connected_endpoints", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    init() {
        this.logger.success("init");
        this.wss = new WebSocket.Server({
            server: WebServer.http,
            perMessageDeflate: {
                zlibDeflateOptions: {
                    chunkSize: 1024,
                    memLevel: 7,
                    level: 3
                },
                zlibInflateOptions: {
                    chunkSize: 10 * 1024
                },
                clientNoContextTakeover: true,
                serverNoContextTakeover: true,
                serverMaxWindowBits: 10,
                concurrencyLimit: 10,
                threshold: 1024
            }
        });
        this.logger.success(`WebSocket server is listening`);
        this.wss.on('connection', async (ws) => {
            console.log("new connection");
            ws.on('message', async (dmx_block) => {
                let header;
                if (!ws.endpoint) {
                    ws.endpoint = true;
                    header = await this.handleBlock(new Uint8Array(dmx_block).buffer, ws.endpoint, header => {
                        this.logger.debug("endpoint registered: " + header.sender);
                        this.connected_endpoints.set(header.sender, ws);
                        this.endpoints.add(header.sender);
                        DatexCommonInterface.addInterfaceForEndpoint(header.sender, this);
                        ws.endpoint = header.sender;
                    });
                }
                else {
                    header = await this.handleBlock(new Uint8Array(dmx_block).buffer, ws.endpoint, null);
                }
                if (header && header.sender != ws.endpoint && !this.reachable_endpoints.has(header.sender)) {
                    this.logger.debug("reachable endpoint registered: " + header.sender);
                    this.reachable_endpoints.set(header.sender, ws.endpoint);
                    DatexCommonInterface.addIndirectInterfaceForEndpoint(header.sender, this);
                }
            });
        });
    }
    async sendRequest(dx, to) {
        let buffer = Buffer.from(dx);
        if (!this.connected_endpoints.has(to)) {
            if (this.reachable_endpoints.has(to))
                to = this.reachable_endpoints.get(to);
            else {
                this.logger.error("alias " + to + " not connected");
                return;
            }
        }
        if (this.connected_endpoints.has(to))
            this.connected_endpoints.get(to).send(buffer);
    }
}
var Server;
(function (Server) {
    Server.http_com_interface = HttpComInterface.getInstance();
    Server.websocket_stream_com_interface = WebsocketStreamComInterface.getInstance();
    Server.websocket_com_interface = WebsocketComInterface.getInstance();
    Server.tcp_com_interface = TCPComInterface.getInstance();
    Server.tcp_cli_com_interface = TCPCLI.getInstance();
    Server.web_push_interface = WebPushInterface.getInstance();
    async function init(interfaces = ["http", "tcp", "tcp_cli", "websocket", "websocketstream", "webpush"], parent_node) {
        Datex.Runtime.blockchain_interface = new BlockchainSimAdapter();
        if (parent_node) {
            console.log("Connecting to parent node: " + parent_node);
            await DatexCloud.connect(undefined, undefined, true, undefined, undefined, parent_node);
        }
        else {
            await DatexCloud.init();
        }
        WebServer.launch();
        if (interfaces.includes("http")) {
            Server.http_com_interface.init();
            DatexInterfaceManager.addInterface(Server.http_com_interface);
        }
        if (interfaces.includes("tcp")) {
            Server.tcp_com_interface.init();
            DatexInterfaceManager.addInterface(Server.tcp_com_interface);
        }
        if (interfaces.includes("tcp_cli")) {
            Server.tcp_cli_com_interface.init();
            DatexInterfaceManager.addInterface(Server.tcp_com_interface);
        }
        if (interfaces.includes("websocket")) {
            Server.websocket_com_interface.init();
            DatexInterfaceManager.addInterface(Server.websocket_com_interface);
        }
        if (interfaces.includes("websocketstream")) {
            Server.websocket_stream_com_interface.init();
            DatexInterfaceManager.addInterface(Server.websocket_stream_com_interface);
        }
        if (interfaces.includes("webpush")) {
            Server.web_push_interface.init();
            DatexInterfaceManager.addInterface(Server.web_push_interface);
        }
        DatexInterfaceManager.enable();
    }
    Server.init = init;
})(Server || (Server = {}));
DatexInterfaceManager.handleNoRedirectFound = function (receiver) {
    console.log("cannot redirect to " + receiver);
};
export default Server;
let network = class network {
    static async add_push_channel(channel, data, meta, ...more) {
        console.log("new push endpoint: " + meta.sender.getInstance(channel).toString());
        return Server.web_push_interface.registerChannel(meta.sender.getInstance(channel), data);
    }
    static async get_keys(endpoint) {
        console.log("GET keys for " + endpoint);
        let keys = await Datex.Crypto.getEndpointPublicKeys2(endpoint);
        return keys;
    }
};
__decorate([
    expose,
    __param(2, meta),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Number]),
    __metadata("design:returntype", Promise)
], network, "add_push_channel", null);
__decorate([
    expose,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Datex.Addresses.Person]),
    __metadata("design:returntype", Promise)
], network, "get_keys", null);
network = __decorate([
    scope("network")
], network);
const system = await systeminformation.baseboard();
const os = await systeminformation.osInfo();
let Roudini = class Roudini {
    static ping() { return 'pong'; }
};
Object.defineProperty(Roudini, "ABOUT", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: {
        datex_version: Datex.Runtime.VERSION,
        system: system,
        os: os
    }
});
Object.defineProperty(Roudini, "STATUS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: pointer({
        uptime: 0,
        connections: 42
    })
});
Object.defineProperty(Roudini, "INTERFACES", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: pointer(new Set())
});
__decorate([
    expose,
    __metadata("design:type", Object)
], Roudini, "ABOUT", void 0);
__decorate([
    expose,
    __metadata("design:type", Object)
], Roudini, "STATUS", void 0);
__decorate([
    expose,
    __metadata("design:type", Object)
], Roudini, "INTERFACES", void 0);
__decorate([
    expose,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Roudini, "ping", null);
Roudini = __decorate([
    scope('roudini')
], Roudini);
setInterval(() => Roudini.STATUS.uptime = Math.round(process.uptime()), 1000);
DatexInterfaceManager.onNewInterface(interf => {
    console.log("new interface: " + interf.type);
    let i = {
        type: interf.type,
        in: interf.in,
        out: interf.out
    };
    if (interf.endpoints)
        i.endpoints = interf.endpoints;
    if (interf.endpoint)
        i.endpoint = interf.endpoint;
    Roudini.INTERFACES.add(i);
});
export const NETWORK = [
    [1, 1, 0],
    [0, 0, 0],
    [0, 1, 0]
];
