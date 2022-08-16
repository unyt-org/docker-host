/**
 ╔══════════════════════════════════════════════════════════════════════════════════════╗
 ║  Datex Client                                                                        ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  Default JS client for datex protocol (support WebSockets, Get Requests)             ║
 ║  Visit https://docs.unyt.cc/datex for more information                               ║
 ╠═════════════════════════════════════════╦════════════════════════════════════════════╣
 ║  © 2020 unyt.org                        ║                                            ║
 ╚═════════════════════════════════════════╩════════════════════════════════════════════╝
 */

 import Logger from "./logger.js";
 import {Datex, pointer} from "./datex_runtime.js";
 
 import { BinaryCode, DatexCompiler } from "./datex_compiler.js";
 import { datex_advanced, meta} from "./datex_js_class_adapter.js";
 import { expose, scope, remote} from "./legacy_decorators.js";
 import { sync } from "./legacy_decorators.js";
 
 let WebSocket = globalThis.WebSocket;
 let WebSocketStream = globalThis.WebSocketStream;
 
 
 
 // signaling for WebRTC connections (used by WebRTCClientInterface)
 @scope("webrtc") class _WebRTCSignaling {
     @remote @expose static offer(data:any , @meta meta?) {
         DatexInterfaceManager.connect("webrtc", meta.sender, [data]);
     }    
 
     @remote @expose static accept(data:any , @meta meta?) {
         WebRTCClientInterface.waiting_interfaces_by_endpoint.get(meta.sender)?.setRemoteDescription(data);
     }  
 
     @remote @expose static candidate(data:any , @meta meta?) {
         WebRTCClientInterface.waiting_interfaces_by_endpoint.get(meta.sender)?.addICECandidate(data);
     }  
 }
 const WebRTCSignaling = datex_advanced(_WebRTCSignaling);
 
 
 
 // general interface for all "datex interfaces" (client or server/router)
 export interface ComInterface {
     type: string
     persistent?: boolean // can be disconnected?
     endpoint?: Datex.Addresses.Endpoint // connected directly to a single endpoint
     endpoints?: Set<Datex.Addresses.Endpoint> // multiple endpoints
     in: boolean // can receive data
     out: boolean // can send data
     global?: boolean // has a connection to the global network, use as a default interface if possible
     send: (datex:ArrayBuffer, to?: Datex.Addresses.Target)=>Promise<void>
     disconnect: ()=>void|Promise<void>
 }
 
 
 /** common class for all client interfaces (WebSockets, TCP Sockets, GET Requests, ...)*/
 export abstract class DatexCommonInterface implements ComInterface {
 
     // endpoint interface mapping
     protected static endpoint_connection_points = new Map<Datex.Addresses.Target, Set<ComInterface>>();
     protected static indirect_endpoint_connection_points = new Map<Datex.Addresses.Target, Set<ComInterface>>();
     protected static virtual_endpoint_connection_points = new Map<Datex.Addresses.Target, Set<ComInterface>>();

     // DIRECT (direct end-to-end connection)
 
     public static addInterfaceForEndpoint(endpoint:Datex.Addresses.Target, com_interface:ComInterface) {
         if (!this.endpoint_connection_points.has(endpoint)) this.endpoint_connection_points.set(endpoint, new Set());
         this.endpoint_connection_points.get(endpoint).add(com_interface);
     }
     // does an endpoint have an explicit (direct) interface on this endpoint
     public static hasDirectInterfaceForEndpoint(endpoint:Datex.Addresses.Target):boolean {
         return this.endpoint_connection_points.has(endpoint) && this.endpoint_connection_points.get(endpoint)?.size != 0;
     }
     // get a list of all currently available direct interfaces for an endpoint
     public static getInterfacesForEndpoint(endpoint:Datex.Addresses.Target, interface_type?:string) {
         return this.endpoint_connection_points.get(endpoint) || new Set();
     }
 
 
     // INDIRECT (connected via a node)
 
     public static addIndirectInterfaceForEndpoint(endpoint:Datex.Addresses.Target, com_interface:ComInterface) {
         if (!this.indirect_endpoint_connection_points.has(endpoint)) this.indirect_endpoint_connection_points.set(endpoint, new Set());
         this.indirect_endpoint_connection_points.get(endpoint).add(com_interface);
     }
     // is an endpoint reachable via a specific endpoint (indirectly)
     public static isEndpointReachableViaInterface(endpoint:Datex.Addresses.Target):boolean {
         return this.indirect_endpoint_connection_points.has(endpoint) && this.indirect_endpoint_connection_points.get(endpoint)?.size != 0;
     }
     // get a list of all currently available indirect interfaces for an endpoint
     public static getIndirectInterfacesForEndpoint(endpoint:Datex.Addresses.Target, interface_type?:string) {
         return this.indirect_endpoint_connection_points.get(endpoint) || new Set();
     }



     // VIRTUAL (just a relay connection, ignore for rooting)
 
    public static addVirtualInterfaceForEndpoint(endpoint:Datex.Addresses.Target, com_interface:ComInterface) {
        if (!this.virtual_endpoint_connection_points.has(endpoint)) this.virtual_endpoint_connection_points.set(endpoint, new Set());
        this.virtual_endpoint_connection_points.get(endpoint).add(com_interface);
    }
    // get a list of all currently available virtual interfaces for an endpoint
    public static getVirtualInterfacesForEndpoint(endpoint:Datex.Addresses.Target, interface_type?:string) {
        return this.virtual_endpoint_connection_points.get(endpoint) || new Set();
    }


 
 
     // get a list of all currently available direct interfaces
     public static getDirectInterfaces(): Set<ComInterface>{
         let all = new Set<ComInterface>();
         for (let e of this.endpoint_connection_points) {
             for (let interf of e[1]) {
                 all.add(interf);
             }
         }
         return all;
     }
 
     public static resetEndpointConnectionPoints(){
         this.endpoint_connection_points.clear();
         this.indirect_endpoint_connection_points.clear()
     }
 
     protected logger:Logger;
 
     // use this per default for all outgoing datex requests
     public static default_interface:ComInterface;
 
     public type = "local"
     public persistent = false; // interface can be disconnected (per default)
     public authorization_required = true; // connect with public keys per default
     public endpoint:Datex.Addresses.Endpoint;
     public endpoints = new Set<Datex.Addresses.Endpoint>();
     public virtual = false; // only a relayed connection, don't use for DATEX rooting

     public in = true
     public out = true
     public global = true
 
     protected initial_arguments:any[];
 
     constructor(endpoint:Datex.Addresses.Endpoint) {
         this.logger = new Logger(this.constructor.name);
         this.endpoint = endpoint;
     }
 
     // initialize
     async init(...args):Promise<boolean> {
         this.initial_arguments = args;
 
         this.connected = await this.connect();
         if (this.connected && this.endpoint) {
            if (this.virtual) DatexCommonInterface.addVirtualInterfaceForEndpoint(this.endpoint, this);
            else DatexCommonInterface.addInterfaceForEndpoint(this.endpoint, this);
         }
         return this.connected;
     }
     
     // create 'connection'
     protected abstract connect():Promise<boolean>
 
     // handle connection changes
     static CONNECTED = Symbol("connected")
 
     set connected(connected:boolean) {
         if (this.connected === connected) return;
         this[DatexCommonInterface.CONNECTED] = connected
         if (!connected) DatexInterfaceManager.handleInterfaceDisconnect(this);
         else DatexInterfaceManager.handleInterfaceConnect(this);
     }
     get connected() {return this[DatexCommonInterface.CONNECTED]?true:false}
 
     protected connecting = false;
     protected reconnecting = false;
 
     protected reconnect():Promise<boolean>{
         if (this.connected) this.connected = false; // (still) not connected
         
         if (this.reconnecting) return;
         this.reconnecting = true;
         this.logger.info("trying to reconnnect...")
         return new Promise<boolean>(resolve=>{
             setTimeout(async ()=>{
                 this.reconnecting = false;
                 let connected = await this.connect();
                 this.connected = connected;
                 resolve(connected);
             }, 3000);
         })
     }
 
     public disconnect(){
         this.logger.error("Disconnect interface: " + this.type)
     }
 
     protected async onConnected(){
     }
 
     /** implement how to send a message to the server*/
     protected abstract sendBlock(datex:ArrayBuffer)
 
 
     protected addEndpoint(endpoint:Datex.Addresses.Endpoint) {
        this.endpoints.add(endpoint);
        DatexCommonInterface.addInterfaceForEndpoint(endpoint, this);
     }

     //private datex_generators = new Set<AsyncGenerator<ArrayBuffer, ArrayBuffer>>();
 
 
     /** called from outside for requests */
     public async send(datex:ArrayBuffer):Promise<any> {
         await this.sendBlock(datex);   
     }
 }
 
 
 /** HTTP interface */
 class HttpClientInterface extends DatexCommonInterface {
 
     override type = "http"
     override authorization_required = false; // don't connect with public keys
     override in = false
     override out = true
     override global = false
 
     async connect() {
         return true;
     }
 
     async sendBlock(datex:ArrayBuffer){
         let res = await (await fetch("https://"+this.endpoint+"/http/"+fixedEncodeURIComponent("...todo..."))).text();
     }
 }
 
 
 /** 'Local' interface */
 export class LocalClientInterface extends DatexCommonInterface {
 
     override type = "local"
     override persistent = true; // cannot be disconnected
     override authorization_required = false; // don't connect with public keys
     override in = true
     override out = true
     override global = false
 
     async connect(){
         return true;
     }
 
     datex_in_handler = Datex.Runtime.getDatexInputHandler();
 
     async sendBlock(datex:ArrayBuffer){
         this.datex_in_handler(datex, Datex.Runtime.endpoint);
     }
 }
 
 /** 'Relayed' interface */
 export class RelayedClientInterface extends DatexCommonInterface {
 
     override type = "relayed"
     override authorization_required = false; // don't connect with public keys
     override in = true
     override out = true
     override global = false
     override virtual = true
 
     async connect(){
         return true;
     }
 
     async sendBlock(datex:ArrayBuffer){
         this.logger.error("invalid")
     }
 
     public override async send(datex:ArrayBuffer):Promise<any> {
         DatexInterfaceManager.send(datex, this.endpoint);
     }
 }
 
 
 /** 'Bluetooth' interface */
 export class BluetoothClientInterface extends DatexCommonInterface {
 
     override type = "bluetooth"
     override authorization_required = false; // don't connect with public keys
     override in = true
     override out = true
     override global = false
 
     async connect(){
         console.log("connecting to bluetooth", this.initial_arguments);
 
 
 
         return true;
     }
 
     async sendBlock(datex:ArrayBuffer){
         console.log("bluetooth send block", datex)
     }
 }
 
 /** 'Serial' interface (USB, ...) */
 export class SerialClientInterface extends DatexCommonInterface {
 
     override type = "serial"
     override authorization_required = false; // don't connect with public keys
     override in = true
     override out = true
     override global = false
 
     private baudRate = 9600;
     private bufferSize = 255;
 
     private port: any
     private writer: any
 
 
     async connect(){
 
         if (!this.initial_arguments[0]) return false; // no port provided
 
         if (this.initial_arguments[0]) this.port = this.initial_arguments[0]
         if (this.initial_arguments[1]) this.baudRate = this.initial_arguments[1]
         if (this.initial_arguments[2]) this.bufferSize = this.initial_arguments[2]
 
         await this.port.open({ baudRate: this.baudRate, bufferSize:this.bufferSize});
 
         this.in = this.port.readable;
         this.in = this.port.writable;
 
 
         (async ()=>{
             while (this.port.readable) {
                 const reader = this.port.readable.getReader();
              
                 await DatexInterfaceManager.handleReceiveContinuosStream(reader, this.endpoint);
             }
         })()
 
         if (this.port.writable) {
             this.writer = this.port.writable.getWriter();
         }
 
         return true;
     }
 
     public override async disconnect() {
         super.disconnect();
         await this.port.close()
     }
 
     async sendBlock(datex:ArrayBuffer){
         return this.writer.write(datex);
     }
 }
 
 /** 'Relayed' interface */
 export class WebRTCClientInterface extends DatexCommonInterface {
 
     override type = "webrtc"
 
     connection: RTCPeerConnection
     data_channel_out: RTCDataChannel
     data_channel_in: RTCDataChannel
 
     override in = true
     override out = true
     override global = false
     
     private static client_type = globalThis.process?.release?.name || 'browser' // browser or node?
     static waiting_interfaces_by_endpoint:Map<Datex.Addresses.Target, WebRTCClientInterface> = new Map()
 
     constructor(endpoint: Datex.Addresses.Endpoint){
         super(endpoint);
         if (WebRTCClientInterface.client_type != "browser") return;
         WebRTCClientInterface.waiting_interfaces_by_endpoint.set(endpoint, this);
     }
 
     public override disconnect(){
         super.disconnect();
         this.connection.close()
     }
     
     async connect() {
         let description:RTCSessionDescription = this.initial_arguments[0];
 
         return new Promise<boolean>(async resolve=>{
 
             // try to establish a WebRTC connection, exchange keys first
             this.connection = new RTCPeerConnection({
                 iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
             });
 
             // listeners
             this.connection.onicecandidate = (e) => {
                 if (e.candidate) WebRTCSignaling.to(this.endpoint).candidate(e.candidate.toJSON())
             };
 
             // connected
             this.connection.addEventListener('connectionstatechange', event => {
                 switch(this.connection.connectionState) {
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
 
             // received data channel 
             this.connection.ondatachannel = (event) => {
                 this.data_channel_in = event.channel;
                 this.logger.success("received data channel", this.data_channel_in);
                 this.data_channel_in.onmessage = (event)=>{
                     DatexInterfaceManager.handleReceiveBlock(event.data, this.endpoint);
                 }
                 this.connected = true;
             };
 
             // create an offer
             if (!description) {
                 this.logger.success("initializing a WebRTC connection ...", this.connection);
                 
                 this.data_channel_out = this.connection.createDataChannel("datex");
 
                 this.data_channel_out.addEventListener('onopen', e => console.warn('local data chann opened', e));
                 this.data_channel_out.addEventListener('onclose', e => console.warn('local data channel closed'));
 
                 let offer = await this.connection.createOffer();
                 await this.connection.setLocalDescription(offer);
                 WebRTCSignaling.to(this.endpoint).offer(this.connection.localDescription.toJSON())
             }
 
             // accept offer
             else {
                 this.logger.success("accepting a WebRTC connection request ...");
 
                 this.data_channel_out = this.connection.createDataChannel("datex");
 
                 await this.connection.setRemoteDescription(description)
                 let answer = await this.connection.createAnswer();
                 await this.connection.setLocalDescription(answer);
 
                 WebRTCSignaling.to(this.endpoint).accept(this.connection.localDescription.toJSON())
             }
         })
 
     }
 
     async setRemoteDescription(description:any) {
         await this.connection?.setRemoteDescription(description)
     }
 
     async addICECandidate(candidate:object) {
         await this.connection?.addIceCandidate(new RTCIceCandidate(candidate));
     }
 
     async sendBlock(datex:ArrayBuffer){
         this.data_channel_out?.send(datex)
     }
 }
 
 
 /** Websocket stream interface */
 class WebsocketStreamClientInterface extends DatexCommonInterface {
 
     override type = "websocketstream"
     override in = true
     override out = true
     
     override global = true

     public host:string
     private stream_writer
     private wss
 
     closed = false;
 
     private is_node_js
 
 
 
     private static nodejs_websocket_stream;
     private static client_type = globalThis.process?.release?.name || 'browser' // browser or node?
 
     async _nodeModules(){
         // @ts-ignore
         if (WebsocketStreamClientInterface.nodejs_websocket_stream) return;
         // @ts-ignore
         WebsocketStreamClientInterface.nodejs_websocket_stream = (await import('websocket-stream')).default;
     }
 
     override async init() {
         // is node.js?
         if (WebsocketStreamClientInterface.client_type!="browser") {
             this.is_node_js = true;
             await this._nodeModules();
         };
 
         this.host = this.endpoint.getInterfaceChannelInfo("websocketstream");
         if (!this.host) return false;
 
         return super.init();
     }
     
     protected async connect_node_js(): Promise<boolean>{
         this.connecting = true;
 
         this.wss = WebsocketStreamClientInterface.nodejs_websocket_stream("wss://"+this.host)
         // handle receiving blocks
         this.wss.on('data', (dmx_block:Buffer) => {
             DatexInterfaceManager.handleReceiveBlock(new Uint8Array(dmx_block).buffer, this.endpoint);
         });
 
         // error listeners
         let has_error = false;
         this.wss.on('error', (e) => {
             if (has_error) return;
             has_error = true;
             this.logger.error("connection closed 1");
             this.stream_writer.end();
             this.connecting = false;
             this.reconnect();
         });
         this.wss.on('finish', (e) => {
             if (has_error) return;
             has_error = true;
             this.logger.error("connection closed 2");
             this.stream_writer.end();
             this.connecting = false;
             this.reconnect();
         });
 
         this.stream_writer = this.wss; // use also as input stream
 
         this.connecting = false;
         return true;
     }
 
 
     protected async connect():Promise<boolean> {
         if (this.closed) return false;
         if (this.connecting) return false;
 
         if (WebsocketStreamClientInterface.client_type!="browser") {
             return this.connect_node_js();
         };
 
         if (!WebSocketStream) return false;
 
         this.connecting = true;
 
         try {
             this.wss = new WebSocketStream("wss://"+this.host, {protocols: ['datex']});
                
             (async ()=>{
                 try {
                     const {code, reason} = await this.wss.closed;
                     this.logger.error("connection closed");
                     this.connecting = false;
                     this.reconnect();
                 } catch(e) { }
             })();
 
             // connect, get reader and writer
             let x = await this.wss.connection;
             const {readable, writable} = x;
             const reader = readable.getReader();
             this.stream_writer = writable.getWriter();
 
             (async ()=>{
                 try {
                     while (true) {
                         const {value, done} = await reader.read();        
                         if (done) {
                             this.logger.error("stream done")
                             break;
                         } 
                         DatexInterfaceManager.handleReceiveBlock(value, this.endpoint);
                     }
                 } catch (e) {
                     this.logger.error("connection error: " + "wss://"+this.host);
                     this.connecting = false;
                     this.reconnect();
                 }
             })();
 
             this.connecting = false;
             return true
         }
         
         catch (e) {
             this.logger.error("connection error:" + "wss://"+this.host);
             this.connecting = false;
             return this.reconnect();
          }
        
     }
 
     async sendBlock(block:ArrayBuffer) {
         try {
             if (this.is_node_js) this.stream_writer.write(new Uint8Array(block));
             else await this.stream_writer.write(block);
         } catch(e) {
             console.log(e);
             throw new Datex.NetworkError("No connection");
         }
     }
 
     public override disconnect(){
         super.disconnect();
         this.wss.close()
         this.closed = true;
     }
 }
 
 /** Websocket interface */
 class WebsocketClientInterface extends DatexCommonInterface {
 
     public host:string
 
     private socket;
 
     override in = true
     override out = true
     override type = "websocket"
 
     closed = false;
 
     async _nodeModules(){
         // @ts-ignore
         WebSocket = (await import('isomorphic-ws')).default;
     }
 
     override async init() {
 
         // is node.js?
         if (globalThis.process?.release?.name) {
             await this._nodeModules();
         }
 
         this.host = this.endpoint.getInterfaceChannelInfo("websocket");
         if (!this.host) return false;
 
         return super.init();
     }
 
     protected async connect():Promise<boolean> {
         if (this.closed) return false;
         if (this.connecting) return false;
         this.connecting = true;
 
         try {
             this.socket = new WebSocket("wss://"+this.host);    
             this.socket.binaryType = 'arraybuffer';
 
             return new Promise(resolve=>{
                 // Connection opened
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
                     this.logger.error("connection error:" +"wss://"+this.host);
                     resolve(await this.reconnect());
                 });
 
                 this.socket.addEventListener('message', (event:any) => {
                     DatexInterfaceManager.handleReceiveBlock(event.data, this.endpoint);
                 });
 
             })
         }
         
         catch (e) {
             this.logger.error("connection error:" + "wss://"+this.host);
             this.connecting = false;
             return this.reconnect();
         }
        
     }
 
     sendBlock(block:ArrayBuffer) {
         try {
             this.socket.send(block);
         } catch(e) {
             throw new Datex.NetworkError("No connection");
         }
     }
 
     public override disconnect(){
         super.disconnect();
         this.socket.close()
         this.closed = true;
     }
 }
 
 
 
 export class DatexInterfaceManager {
 
     static logger = new Logger("DATEX Interface Manager");
 
     static datex_in_handler: (dxb: ArrayBuffer|ReadableStreamDefaultReader<Uint8Array> | {dxb: ArrayBuffer|ReadableStreamDefaultReader<Uint8Array>; variables?: any; header_callback?: (header: Datex.dxb_header) => void, new_endpoint_callback?: (endpoint: Datex.Addresses.Endpoint) => void}, last_endpoint:Datex.Addresses.Endpoint) => Promise<Datex.dxb_header|void>
 
     static local_interface:LocalClientInterface;
 
     static interfaces = new Map<string, typeof DatexCommonInterface>();
 
     // register new DatexCommonInterface
     static registerInterface(channel_type:string, interf:typeof DatexCommonInterface) {
         this.interfaces.set(channel_type,interf);
     }
 
     static receive_listeners = new Set<Function>();
     static new_interface_listeners = new Set<Function>();
     static interface_connected_listeners = new Set<Function>();
     static interface_disconnected_listeners = new Set<Function>();
 
     static active_interfaces: Set<ComInterface>
 
 
     static handleReceiveBlock(dxb:ArrayBuffer, last_endpoint:Datex.Addresses.Endpoint, header_callback?: (header: Datex.dxb_header) => void, new_endpoint_callback?: (endpoint: Datex.Addresses.Endpoint) => void){
         if (header_callback || new_endpoint_callback) this.datex_in_handler({dxb, header_callback, new_endpoint_callback}, last_endpoint);
         else this.datex_in_handler(dxb, last_endpoint);
     }
 
     static handleReceiveContinuosStream(reader:ReadableStreamDefaultReader<Uint8Array>, last_endpoint, header_callback?: (header: Datex.dxb_header) => void, new_endpoint_callback?: (endpoint: Datex.Addresses.Endpoint) => void) {
         if (header_callback || new_endpoint_callback) return this.datex_in_handler({dxb:reader, header_callback, new_endpoint_callback}, last_endpoint);
         else return this.datex_in_handler(reader, last_endpoint);
     }
 
     static addReceiveListener(listen:(datex:ArrayBuffer)=>void){
         this.receive_listeners.add(listen);
     }
 
     // connect to datex runtime (in/out)
     private static initialized = false;
     private static enabled = false;
 
     public static async init() {
         if (this.initialized) return;
 
         this.initialized = true;
         this.datex_in_handler = Datex.Runtime.getDatexInputHandler((sid, scope)=>{
             for (let p of this.receive_listeners) p(scope);
         });
 
         if (!this.active_interfaces) this.active_interfaces = pointer(new Set<ComInterface>());
     }
 
 
     // datex out is now redirected to this interface
     public static enable(){
         if (this.enabled) return;
         Datex.Runtime.setDatexOut(DatexInterfaceManager.send);
         this.enabled = true;
     }
 
 
     static onNewInterface(listener:(interf:ComInterface)=>void) {
         this.new_interface_listeners.add(listener);
     }
 
     static onInterfaceConnected(listener:(interf:ComInterface)=>void) {
         this.interface_connected_listeners.add(listener);
     }
     static onInterfaceDisconnected(listener:(interf:ComInterface)=>void) {
         this.interface_disconnected_listeners.add(listener);
     }
 
     static async enableLocalInterface(endpoint:Datex.Addresses.Endpoint=Datex.Runtime.endpoint):Promise<LocalClientInterface> {
         if (this.local_interface) return;
         this.local_interface = new LocalClientInterface(endpoint);
         // init requested interface
         let res = await this.local_interface.init();
         if (res) this.addInterface(this.local_interface);
         return this.local_interface
     }
 
     static async disconnect(){
        DatexCommonInterface.default_interface = null;
        DatexCommonInterface.resetEndpointConnectionPoints();

        for (let interf of this.active_interfaces || []) {
            await interf.disconnect()
            this.active_interfaces.delete(interf);
        } 
     }
 
     // create a new connection with a interface type (e.g. websocket, relayed...)
     static async connect(channel_type:string, endpoint?:Datex.Addresses.Endpoint, init_args?:any[], set_as_default_interface = true):Promise<boolean> {
         this.logger.info("Connecting via interface: " + channel_type);
 
         await this.init();
 
         // get requested interface
         const interface_class = (<any>DatexInterfaceManager.interfaces.get(channel_type));
         if (!interface_class) throw "Channel type not found: " + channel_type;
         let c_interface:DatexCommonInterface = new interface_class(endpoint);
         this.logger.success("new interface: " + channel_type)
         // init requested interface
         let res = await c_interface.init(...(init_args||[]));
         if (res) this.addInterface(c_interface);
 
         // set as new default interface? - local or relayed create a feedback loop, dont use webrtc as default interface
         if (set_as_default_interface && c_interface.global) DatexCommonInterface.default_interface = c_interface
 
         this.enable();
 
         return res
     }
 
     // add an existing interface to the interface list
     static addInterface(i: ComInterface) {
         if (!this.active_interfaces) this.active_interfaces = pointer(new Set<ComInterface>());
         for (let l of this.new_interface_listeners) l(i)
         this.active_interfaces.add(i)
     }
     // remove an interface from the list
     static removeInterface(i: ComInterface) {
         if (!this.active_interfaces) this.active_interfaces = pointer(new Set<ComInterface>());
         this.active_interfaces.delete(i)
     }
 
     // disconnected
     static handleInterfaceDisconnect(i: ComInterface){
         for (let l of this.interface_disconnected_listeners) l(i)
     }
     // (re)connected
     static handleInterfaceConnect(i: ComInterface){
         for (let l of this.interface_connected_listeners) l(i)
     }
 
     /** main method to call send */
     static async send(datex:ArrayBuffer, receiver:Datex.Addresses.Target, flood = false) {
         if (!DatexInterfaceManager.checkRedirectPermission(receiver)) return;
 
         // flooding instead of sending to a receiver
         if (flood) {
             return DatexInterfaceManager.flood(datex, receiver);
         }
 
         // currently only sending to one target at a time here! TODO improve
         let addressed_datex = DatexCompiler.updateHeaderReceiver(datex, receiver); // set right receiver
 
         // is self
         if (receiver instanceof Datex.Addresses.Endpoint && Datex.Runtime.endpoint.equals(receiver)) {
             await DatexInterfaceManager.datex_in_handler(addressed_datex, Datex.Runtime.endpoint);
             return;
         }
         // send via direct connection
         if (DatexCommonInterface.hasDirectInterfaceForEndpoint(receiver)) {
             let i = [...DatexCommonInterface.getInterfacesForEndpoint(receiver)][0];
             return await i.send(addressed_datex, receiver);  // send to first available interface (todo)
         }
         // send via indirect connection
         if (DatexCommonInterface.isEndpointReachableViaInterface(receiver)) {
             let i = [...DatexCommonInterface.getIndirectInterfacesForEndpoint(receiver)][0];
             return await i.send(addressed_datex, receiver); // send to first available interface (todo)
         }
 
         // indirect connection - send per default interface
         if (!DatexCommonInterface.default_interface) {
             return DatexInterfaceManager.handleNoRedirectFound(receiver);
         }
 
         //console.warn("sending to " + receiver + " via ", DatexCommonInterface.default_interface.type);
         return await DatexCommonInterface.default_interface.send(addressed_datex, receiver);
     }
 
     // flood to all currently directly connected nodes (only nodes!)
     static flood(datex: ArrayBuffer, exclude: Datex.Addresses.Target) {
         let exclude_endpoints = new Set([exclude]);
 
         // iterate over all active endpoints
         for (let interf of this.active_interfaces) {
             if (interf.endpoint && !exclude_endpoints.has(interf.endpoint) && !interf.endpoint.equals(Datex.Runtime.endpoint)) {
                exclude_endpoints.add(interf.endpoint);
                //console.log("FLOOD > " + interf.endpoint)
                interf.send(datex, interf.endpoint);
             }
             for (let endpoint of interf.endpoints??[]){
                 if (!exclude_endpoints.has(endpoint)  && !interf.endpoint.equals(Datex.Runtime.endpoint)) {
                    exclude_endpoints.add(endpoint);
                    //console.log("FLOOD > " + endpoint)
                    interf.send(datex, endpoint);
                 }
             }
         }
     }
 
     // can be overwritten for clients
     static checkRedirectPermission(receiver: Datex.Addresses.Target){
         return true; // allow all redirects per default
     }
 
     static handleNoRedirectFound(receiver:Datex.Addresses.Target){
         throw new Datex.NetworkError("no active client interface found");
     }
 }
 

 // register interfaces
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
     return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
         return '%' + c.charCodeAt(0).toString(16);
     });
 }
 
 