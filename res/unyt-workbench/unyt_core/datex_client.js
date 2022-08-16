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
import Logger from "./logger.js";
import { Datex, pointer } from "./datex_runtime.js";
import { DatexCompiler } from "./datex_compiler.js";
import { datex_advanced, meta } from "./datex_js_class_adapter.js";
import { expose, scope, remote } from "./legacy_decorators.js";
let WebSocket = globalThis.WebSocket;
let WebSocketStream = globalThis.WebSocketStream;
let _WebRTCSignaling = class _WebRTCSignaling {
    static offer(data, meta) {
        DatexInterfaceManager.connect("webrtc", meta.sender, [data]);
    }
    static accept(data, meta) {
        WebRTCClientInterface.waiting_interfaces_by_endpoint.get(meta.sender)?.setRemoteDescription(data);
    }
    static candidate(data, meta) {
        WebRTCClientInterface.waiting_interfaces_by_endpoint.get(meta.sender)?.addICECandidate(data);
    }
};
__decorate([
    remote,
    expose,
    __param(1, meta),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], _WebRTCSignaling, "offer", null);
__decorate([
    remote,
    expose,
    __param(1, meta),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], _WebRTCSignaling, "accept", null);
__decorate([
    remote,
    expose,
    __param(1, meta),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], _WebRTCSignaling, "candidate", null);
_WebRTCSignaling = __decorate([
    scope("webrtc")
], _WebRTCSignaling);
const WebRTCSignaling = datex_advanced(_WebRTCSignaling);
export class DatexCommonInterface {
    static endpoint_connection_points = new Map();
    static indirect_endpoint_connection_points = new Map();
    static virtual_endpoint_connection_points = new Map();
    static addInterfaceForEndpoint(endpoint, com_interface) {
        if (!this.endpoint_connection_points.has(endpoint))
            this.endpoint_connection_points.set(endpoint, new Set());
        this.endpoint_connection_points.get(endpoint).add(com_interface);
    }
    static hasDirectInterfaceForEndpoint(endpoint) {
        return this.endpoint_connection_points.has(endpoint) && this.endpoint_connection_points.get(endpoint)?.size != 0;
    }
    static getInterfacesForEndpoint(endpoint, interface_type) {
        return this.endpoint_connection_points.get(endpoint) || new Set();
    }
    static addIndirectInterfaceForEndpoint(endpoint, com_interface) {
        if (!this.indirect_endpoint_connection_points.has(endpoint))
            this.indirect_endpoint_connection_points.set(endpoint, new Set());
        this.indirect_endpoint_connection_points.get(endpoint).add(com_interface);
    }
    static isEndpointReachableViaInterface(endpoint) {
        return this.indirect_endpoint_connection_points.has(endpoint) && this.indirect_endpoint_connection_points.get(endpoint)?.size != 0;
    }
    static getIndirectInterfacesForEndpoint(endpoint, interface_type) {
        return this.indirect_endpoint_connection_points.get(endpoint) || new Set();
    }
    static addVirtualInterfaceForEndpoint(endpoint, com_interface) {
        if (!this.virtual_endpoint_connection_points.has(endpoint))
            this.virtual_endpoint_connection_points.set(endpoint, new Set());
        this.virtual_endpoint_connection_points.get(endpoint).add(com_interface);
    }
    static getVirtualInterfacesForEndpoint(endpoint, interface_type) {
        return this.virtual_endpoint_connection_points.get(endpoint) || new Set();
    }
    static getDirectInterfaces() {
        let all = new Set();
        for (let e of this.endpoint_connection_points) {
            for (let interf of e[1]) {
                all.add(interf);
            }
        }
        return all;
    }
    static resetEndpointConnectionPoints() {
        this.endpoint_connection_points.clear();
        this.indirect_endpoint_connection_points.clear();
    }
    logger;
    static default_interface;
    type = "local";
    persistent = false;
    authorization_required = true;
    endpoint;
    endpoints = new Set();
    virtual = false;
    in = true;
    out = true;
    global = true;
    initial_arguments;
    constructor(endpoint) {
        this.logger = new Logger(this.constructor.name);
        this.endpoint = endpoint;
    }
    async init(...args) {
        this.initial_arguments = args;
        this.connected = await this.connect();
        if (this.connected && this.endpoint) {
            if (this.virtual)
                DatexCommonInterface.addVirtualInterfaceForEndpoint(this.endpoint, this);
            else
                DatexCommonInterface.addInterfaceForEndpoint(this.endpoint, this);
        }
        return this.connected;
    }
    static CONNECTED = Symbol("connected");
    set connected(connected) {
        if (this.connected === connected)
            return;
        this[DatexCommonInterface.CONNECTED] = connected;
        if (!connected)
            DatexInterfaceManager.handleInterfaceDisconnect(this);
        else
            DatexInterfaceManager.handleInterfaceConnect(this);
    }
    get connected() { return this[DatexCommonInterface.CONNECTED] ? true : false; }
    connecting = false;
    reconnecting = false;
    reconnect() {
        if (this.connected)
            this.connected = false;
        if (this.reconnecting)
            return;
        this.reconnecting = true;
        this.logger.info("trying to reconnnect...");
        return new Promise(resolve => {
            setTimeout(async () => {
                this.reconnecting = false;
                let connected = await this.connect();
                this.connected = connected;
                resolve(connected);
            }, 3000);
        });
    }
    disconnect() {
        this.logger.error("Disconnect interface: " + this.type);
    }
    async onConnected() {
    }
    addEndpoint(endpoint) {
        this.endpoints.add(endpoint);
        DatexCommonInterface.addInterfaceForEndpoint(endpoint, this);
    }
    async send(datex) {
        await this.sendBlock(datex);
    }
}
class HttpClientInterface extends DatexCommonInterface {
    type = "http";
    authorization_required = false;
    in = false;
    out = true;
    global = false;
    async connect() {
        return true;
    }
    async sendBlock(datex) {
        let res = await (await fetch("https://" + this.endpoint + "/http/" + fixedEncodeURIComponent("...todo..."))).text();
    }
}
export class LocalClientInterface extends DatexCommonInterface {
    type = "local";
    persistent = true;
    authorization_required = false;
    in = true;
    out = true;
    global = false;
    async connect() {
        return true;
    }
    datex_in_handler = Datex.Runtime.getDatexInputHandler();
    async sendBlock(datex) {
        this.datex_in_handler(datex, Datex.Runtime.endpoint);
    }
}
export class RelayedClientInterface extends DatexCommonInterface {
    type = "relayed";
    authorization_required = false;
    in = true;
    out = true;
    global = false;
    virtual = true;
    async connect() {
        return true;
    }
    async sendBlock(datex) {
        this.logger.error("invalid");
    }
    async send(datex) {
        DatexInterfaceManager.send(datex, this.endpoint);
    }
}
export class BluetoothClientInterface extends DatexCommonInterface {
    type = "bluetooth";
    authorization_required = false;
    in = true;
    out = true;
    global = false;
    async connect() {
        console.log("connecting to bluetooth", this.initial_arguments);
        return true;
    }
    async sendBlock(datex) {
        console.log("bluetooth send block", datex);
    }
}
export class SerialClientInterface extends DatexCommonInterface {
    type = "serial";
    authorization_required = false;
    in = true;
    out = true;
    global = false;
    baudRate = 9600;
    bufferSize = 255;
    port;
    writer;
    async connect() {
        if (!this.initial_arguments[0])
            return false;
        if (this.initial_arguments[0])
            this.port = this.initial_arguments[0];
        if (this.initial_arguments[1])
            this.baudRate = this.initial_arguments[1];
        if (this.initial_arguments[2])
            this.bufferSize = this.initial_arguments[2];
        await this.port.open({ baudRate: this.baudRate, bufferSize: this.bufferSize });
        this.in = this.port.readable;
        this.in = this.port.writable;
        (async () => {
            while (this.port.readable) {
                const reader = this.port.readable.getReader();
                await DatexInterfaceManager.handleReceiveContinuosStream(reader, this.endpoint);
            }
        })();
        if (this.port.writable) {
            this.writer = this.port.writable.getWriter();
        }
        return true;
    }
    async disconnect() {
        super.disconnect();
        await this.port.close();
    }
    async sendBlock(datex) {
        return this.writer.write(datex);
    }
}
export class WebRTCClientInterface extends DatexCommonInterface {
    type = "webrtc";
    connection;
    data_channel_out;
    data_channel_in;
    in = true;
    out = true;
    global = false;
    static client_type = globalThis.process?.release?.name || 'browser';
    static waiting_interfaces_by_endpoint = new Map();
    constructor(endpoint) {
        super(endpoint);
        if (WebRTCClientInterface.client_type != "browser")
            return;
        WebRTCClientInterface.waiting_interfaces_by_endpoint.set(endpoint, this);
    }
    disconnect() {
        super.disconnect();
        this.connection.close();
    }
    async connect() {
        let description = this.initial_arguments[0];
        return new Promise(async (resolve) => {
            this.connection = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
            });
            this.connection.onicecandidate = (e) => {
                if (e.candidate)
                    WebRTCSignaling.to(this.endpoint).candidate(e.candidate.toJSON());
            };
            this.connection.addEventListener('connectionstatechange', event => {
                switch (this.connection.connectionState) {
                    case "connected":
                        WebRTCClientInterface.waiting_interfaces_by_endpoint.delete(this.endpoint);
                        resolve(true);
                        break;
                    case "disconnected": this.connected = false;
                    case "closed": this.connected = false;
                    case "failed":
                        resolve(false);
                }
            });
            this.connection.ondatachannel = (event) => {
                this.data_channel_in = event.channel;
                this.logger.success("received data channel", this.data_channel_in);
                this.data_channel_in.onmessage = (event) => {
                    DatexInterfaceManager.handleReceiveBlock(event.data, this.endpoint);
                };
                this.connected = true;
            };
            if (!description) {
                this.logger.success("initializing a WebRTC connection ...", this.connection);
                this.data_channel_out = this.connection.createDataChannel("datex");
                this.data_channel_out.addEventListener('onopen', e => console.warn('local data chann opened', e));
                this.data_channel_out.addEventListener('onclose', e => console.warn('local data channel closed'));
                let offer = await this.connection.createOffer();
                await this.connection.setLocalDescription(offer);
                WebRTCSignaling.to(this.endpoint).offer(this.connection.localDescription.toJSON());
            }
            else {
                this.logger.success("accepting a WebRTC connection request ...");
                this.data_channel_out = this.connection.createDataChannel("datex");
                await this.connection.setRemoteDescription(description);
                let answer = await this.connection.createAnswer();
                await this.connection.setLocalDescription(answer);
                WebRTCSignaling.to(this.endpoint).accept(this.connection.localDescription.toJSON());
            }
        });
    }
    async setRemoteDescription(description) {
        await this.connection?.setRemoteDescription(description);
    }
    async addICECandidate(candidate) {
        await this.connection?.addIceCandidate(new RTCIceCandidate(candidate));
    }
    async sendBlock(datex) {
        this.data_channel_out?.send(datex);
    }
}
class WebsocketStreamClientInterface extends DatexCommonInterface {
    type = "websocketstream";
    in = true;
    out = true;
    global = true;
    host;
    stream_writer;
    wss;
    closed = false;
    is_node_js;
    static nodejs_websocket_stream;
    static client_type = globalThis.process?.release?.name || 'browser';
    async _nodeModules() {
        if (WebsocketStreamClientInterface.nodejs_websocket_stream)
            return;
        WebsocketStreamClientInterface.nodejs_websocket_stream = (await import('websocket-stream')).default;
    }
    async init() {
        if (WebsocketStreamClientInterface.client_type != "browser") {
            this.is_node_js = true;
            await this._nodeModules();
        }
        ;
        this.host = this.endpoint.getInterfaceChannelInfo("websocketstream");
        if (!this.host)
            return false;
        return super.init();
    }
    async connect_node_js() {
        this.connecting = true;
        this.wss = WebsocketStreamClientInterface.nodejs_websocket_stream("wss://" + this.host);
        this.wss.on('data', (dmx_block) => {
            DatexInterfaceManager.handleReceiveBlock(new Uint8Array(dmx_block).buffer, this.endpoint);
        });
        let has_error = false;
        this.wss.on('error', (e) => {
            if (has_error)
                return;
            has_error = true;
            this.logger.error("connection closed 1");
            this.stream_writer.end();
            this.connecting = false;
            this.reconnect();
        });
        this.wss.on('finish', (e) => {
            if (has_error)
                return;
            has_error = true;
            this.logger.error("connection closed 2");
            this.stream_writer.end();
            this.connecting = false;
            this.reconnect();
        });
        this.stream_writer = this.wss;
        this.connecting = false;
        return true;
    }
    async connect() {
        if (this.closed)
            return false;
        if (this.connecting)
            return false;
        if (WebsocketStreamClientInterface.client_type != "browser") {
            return this.connect_node_js();
        }
        ;
        if (!WebSocketStream)
            return false;
        this.connecting = true;
        try {
            this.wss = new WebSocketStream("wss://" + this.host, { protocols: ['datex'] });
            (async () => {
                try {
                    const { code, reason } = await this.wss.closed;
                    this.logger.error("connection closed");
                    this.connecting = false;
                    this.reconnect();
                }
                catch (e) { }
            })();
            let x = await this.wss.connection;
            const { readable, writable } = x;
            const reader = readable.getReader();
            this.stream_writer = writable.getWriter();
            (async () => {
                try {
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) {
                            this.logger.error("stream done");
                            break;
                        }
                        DatexInterfaceManager.handleReceiveBlock(value, this.endpoint);
                    }
                }
                catch (e) {
                    this.logger.error("connection error: " + "wss://" + this.host);
                    this.connecting = false;
                    this.reconnect();
                }
            })();
            this.connecting = false;
            return true;
        }
        catch (e) {
            this.logger.error("connection error:" + "wss://" + this.host);
            this.connecting = false;
            return this.reconnect();
        }
    }
    async sendBlock(block) {
        try {
            if (this.is_node_js)
                this.stream_writer.write(new Uint8Array(block));
            else
                await this.stream_writer.write(block);
        }
        catch (e) {
            console.log(e);
            throw new Datex.NetworkError("No connection");
        }
    }
    disconnect() {
        super.disconnect();
        this.wss.close();
        this.closed = true;
    }
}
class WebsocketClientInterface extends DatexCommonInterface {
    host;
    socket;
    in = true;
    out = true;
    type = "websocket";
    closed = false;
    async _nodeModules() {
        WebSocket = (await import('isomorphic-ws')).default;
    }
    async init() {
        if (globalThis.process?.release?.name) {
            await this._nodeModules();
        }
        this.host = this.endpoint.getInterfaceChannelInfo("websocket");
        if (!this.host)
            return false;
        return super.init();
    }
    async connect() {
        if (this.closed)
            return false;
        if (this.connecting)
            return false;
        this.connecting = true;
        try {
            this.socket = new WebSocket("wss://" + this.host);
            this.socket.binaryType = 'arraybuffer';
            return new Promise(resolve => {
                this.socket.addEventListener('open', async () => {
                    this.connecting = false;
                    resolve(true);
                });
                this.socket.addEventListener('close', (event) => {
                    this.connecting = false;
                    this.logger.error("connection closed");
                    this.reconnect();
                });
                this.socket.addEventListener('error', async (event) => {
                    this.connecting = false;
                    this.logger.error("connection error:" + "wss://" + this.host);
                    resolve(await this.reconnect());
                });
                this.socket.addEventListener('message', (event) => {
                    DatexInterfaceManager.handleReceiveBlock(event.data, this.endpoint);
                });
            });
        }
        catch (e) {
            this.logger.error("connection error:" + "wss://" + this.host);
            this.connecting = false;
            return this.reconnect();
        }
    }
    sendBlock(block) {
        try {
            this.socket.send(block);
        }
        catch (e) {
            throw new Datex.NetworkError("No connection");
        }
    }
    disconnect() {
        super.disconnect();
        this.socket.close();
        this.closed = true;
    }
}
export class DatexInterfaceManager {
    static logger = new Logger("DATEX Interface Manager");
    static datex_in_handler;
    static local_interface;
    static interfaces = new Map();
    static registerInterface(channel_type, interf) {
        this.interfaces.set(channel_type, interf);
    }
    static receive_listeners = new Set();
    static new_interface_listeners = new Set();
    static interface_connected_listeners = new Set();
    static interface_disconnected_listeners = new Set();
    static active_interfaces;
    static handleReceiveBlock(dxb, last_endpoint, header_callback, new_endpoint_callback) {
        if (header_callback || new_endpoint_callback)
            this.datex_in_handler({ dxb, header_callback, new_endpoint_callback }, last_endpoint);
        else
            this.datex_in_handler(dxb, last_endpoint);
    }
    static handleReceiveContinuosStream(reader, last_endpoint, header_callback, new_endpoint_callback) {
        if (header_callback || new_endpoint_callback)
            return this.datex_in_handler({ dxb: reader, header_callback, new_endpoint_callback }, last_endpoint);
        else
            return this.datex_in_handler(reader, last_endpoint);
    }
    static addReceiveListener(listen) {
        this.receive_listeners.add(listen);
    }
    static initialized = false;
    static enabled = false;
    static async init() {
        if (this.initialized)
            return;
        this.initialized = true;
        this.datex_in_handler = Datex.Runtime.getDatexInputHandler((sid, scope) => {
            for (let p of this.receive_listeners)
                p(scope);
        });
        if (!this.active_interfaces)
            this.active_interfaces = pointer(new Set());
    }
    static enable() {
        if (this.enabled)
            return;
        Datex.Runtime.setDatexOut(DatexInterfaceManager.send);
        this.enabled = true;
    }
    static onNewInterface(listener) {
        this.new_interface_listeners.add(listener);
    }
    static onInterfaceConnected(listener) {
        this.interface_connected_listeners.add(listener);
    }
    static onInterfaceDisconnected(listener) {
        this.interface_disconnected_listeners.add(listener);
    }
    static async enableLocalInterface(endpoint = Datex.Runtime.endpoint) {
        if (this.local_interface)
            return;
        this.local_interface = new LocalClientInterface(endpoint);
        let res = await this.local_interface.init();
        if (res)
            this.addInterface(this.local_interface);
        return this.local_interface;
    }
    static async disconnect() {
        DatexCommonInterface.default_interface = null;
        DatexCommonInterface.resetEndpointConnectionPoints();
        for (let interf of this.active_interfaces || []) {
            await interf.disconnect();
            this.active_interfaces.delete(interf);
        }
    }
    static async connect(channel_type, endpoint, init_args, set_as_default_interface = true) {
        this.logger.info("Connecting via interface: " + channel_type);
        await this.init();
        const interface_class = DatexInterfaceManager.interfaces.get(channel_type);
        if (!interface_class)
            throw "Channel type not found: " + channel_type;
        let c_interface = new interface_class(endpoint);
        this.logger.success("new interface: " + channel_type);
        let res = await c_interface.init(...(init_args || []));
        if (res)
            this.addInterface(c_interface);
        if (set_as_default_interface && c_interface.global)
            DatexCommonInterface.default_interface = c_interface;
        this.enable();
        return res;
    }
    static addInterface(i) {
        if (!this.active_interfaces)
            this.active_interfaces = pointer(new Set());
        for (let l of this.new_interface_listeners)
            l(i);
        this.active_interfaces.add(i);
    }
    static removeInterface(i) {
        if (!this.active_interfaces)
            this.active_interfaces = pointer(new Set());
        this.active_interfaces.delete(i);
    }
    static handleInterfaceDisconnect(i) {
        for (let l of this.interface_disconnected_listeners)
            l(i);
    }
    static handleInterfaceConnect(i) {
        for (let l of this.interface_connected_listeners)
            l(i);
    }
    static async send(datex, receiver, flood = false) {
        if (!DatexInterfaceManager.checkRedirectPermission(receiver))
            return;
        if (flood) {
            return DatexInterfaceManager.flood(datex, receiver);
        }
        let addressed_datex = DatexCompiler.updateHeaderReceiver(datex, receiver);
        if (receiver instanceof Datex.Addresses.Endpoint && Datex.Runtime.endpoint.equals(receiver)) {
            await DatexInterfaceManager.datex_in_handler(addressed_datex, Datex.Runtime.endpoint);
            return;
        }
        if (DatexCommonInterface.hasDirectInterfaceForEndpoint(receiver)) {
            let i = [...DatexCommonInterface.getInterfacesForEndpoint(receiver)][0];
            return await i.send(addressed_datex, receiver);
        }
        if (DatexCommonInterface.isEndpointReachableViaInterface(receiver)) {
            let i = [...DatexCommonInterface.getIndirectInterfacesForEndpoint(receiver)][0];
            return await i.send(addressed_datex, receiver);
        }
        if (!DatexCommonInterface.default_interface) {
            return DatexInterfaceManager.handleNoRedirectFound(receiver);
        }
        return await DatexCommonInterface.default_interface.send(addressed_datex, receiver);
    }
    static flood(datex, exclude) {
        let exclude_endpoints = new Set([exclude]);
        for (let interf of this.active_interfaces) {
            if (interf.endpoint && !exclude_endpoints.has(interf.endpoint) && !interf.endpoint.equals(Datex.Runtime.endpoint)) {
                exclude_endpoints.add(interf.endpoint);
                interf.send(datex, interf.endpoint);
            }
            for (let endpoint of interf.endpoints ?? []) {
                if (!exclude_endpoints.has(endpoint) && !interf.endpoint.equals(Datex.Runtime.endpoint)) {
                    exclude_endpoints.add(endpoint);
                    interf.send(datex, endpoint);
                }
            }
        }
    }
    static checkRedirectPermission(receiver) {
        return true;
    }
    static handleNoRedirectFound(receiver) {
        throw new Datex.NetworkError("no active client interface found");
    }
}
DatexInterfaceManager.registerInterface("websocketstream", WebsocketStreamClientInterface);
DatexInterfaceManager.registerInterface("websocket", WebsocketClientInterface);
DatexInterfaceManager.registerInterface("local", LocalClientInterface);
DatexInterfaceManager.registerInterface("relayed", RelayedClientInterface);
DatexInterfaceManager.registerInterface("webrtc", WebRTCClientInterface);
DatexInterfaceManager.registerInterface("bluetooth", BluetoothClientInterface);
DatexInterfaceManager.registerInterface("serial", SerialClientInterface);
globalThis.DatexInterfaceManager = DatexInterfaceManager;
globalThis.DatexCommonInterface = DatexCommonInterface;
export default DatexInterfaceManager;
function fixedEncodeURIComponent(str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
        return '%' + c.charCodeAt(0).toString(16);
    });
}
