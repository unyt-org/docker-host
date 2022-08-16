/**
 ╔══════════════════════════════════════════════════════════════════════════════════════╗
 ║  DATEX Server - unyt internal                                                        ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  DATEX communication interface for node js servers                                   ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  © 2022 Jonas & Benedikt Strehle        ║                                            ║
 ╚═════════════════════════════════════════╩════════════════════════════════════════════╝
 */

import WebServer from "./web_server.js";
import Logger from "../unyt_core/logger.js";

import TCP from "net"

// @ts-ignore
import WebSocket from 'isomorphic-ws';
// @ts-ignore
import websocketStream from 'websocket-stream';
// @ts-ignore
import systeminformation from 'systeminformation';
// @ts-ignore
import webpush from 'web-push';


import {btoa, datex, Datex, pointer} from "../unyt_core/datex_runtime.js";

import { DatexCompiler } from "../unyt_core/datex_compiler.js";
import { meta } from "../unyt_core/datex_js_class_adapter.js";
import {sealed, expose, scope} from "../unyt_core/legacy_decorators.js";

import DatexInterfaceManager, { DatexCommonInterface, ComInterface } from "../unyt_core/datex_client.js";
import DatexCloud from "../unyt_core/datex_cloud.js";
import { BlockchainSimAdapter } from "./blockchain_sim_adapter.js";


/** common class for all interfaces (WebSockets, TCP Sockets, GET Requests, ...)*/
export abstract class ServerDatexInterface implements ComInterface {

    type = "unknown";

    in = true
    out = true

    endpoints: Set<Datex.Addresses.Endpoint> = pointer(new Set<Datex.Addresses.Endpoint>());
    reachable_endpoints: Map<Datex.Addresses.Endpoint, Datex.Addresses.Endpoint> = pointer(new Map()); // <requested_endpoint, reachable_via_endpoint connection>

    private static instance: ServerDatexInterface;
    protected logger:Logger;
    protected datex_in_handler:(dxb: ArrayBuffer|ReadableStreamDefaultReader<Uint8Array> | {dxb: ArrayBuffer|ReadableStreamDefaultReader<Uint8Array>; variables?: any; header_callback?: (header: Datex.dxb_header) => void}, last_endpoint: Datex.Addresses.Endpoint) => Promise<Datex.dxb_header|void>;

    public static getInstance() {
        // @ts-ignore
        if (!this.instance) this.instance = new this();
        return this.instance;
    }

    public disconnect(){
        // TODO what to do on disconnect?
    }

    protected endpointWelcomeMessage(endpoint: Datex.Addresses.Target) {
        return;
        /*this.sendRequest(DatexCompiler.compile(`
        printf (<image/svg+xml>(<Buffer>'<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
        <svg width="100%" height="100%" viewBox="0 0 648 513" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:1.5;">
            <g id="Artboard1" transform="matrix(1,0,0,1,-17.1153,-36.8934)">
                <rect x="17.115" y="36.893" width="647.785" height="512.384" style="fill:none;"/>
                <clipPath id="_clip1">
                    <rect x="17.115" y="36.893" width="647.785" height="512.384"/>
                </clipPath>
                <g clip-path="url(#_clip1)">
                    <g transform="matrix(0.699517,0,0,0.699517,275.27,154.656)">
                        <g transform="matrix(1,0,0,1,-376,-165)">
                            <g serif:id="Artboard1" transform="matrix(0.978389,0,0,0.982981,-18.8476,-128.716)">
                                <rect x="19.264" y="130.945" width="768.489" height="335.033" style="fill:none;"/>
                                <g transform="matrix(1.02209,0,0,1.01731,-17.1301,-7.10669)">
                                    <g transform="matrix(0.470253,0,0,0.470253,-5.86419,62.6463)">
                                        <circle cx="461.453" cy="512.042" r="278.081" style="fill:rgb(42,42,42);stroke:white;stroke-width:9.57px;"/>
                                    </g>
                                    <g transform="matrix(2.66926,0,-1.85999e-16,2.80415,-833.638,-1450.05)">
                                        <ellipse cx="382.029" cy="632.834" rx="16.147" ry="15.357" style="fill:rgb(42,170,215);"/>
                                    </g>
                                    <g transform="matrix(2.66926,0,-1.85999e-16,2.80415,-777.781,-1449.74)">
                                        <ellipse cx="382.029" cy="632.834" rx="16.147" ry="15.357" style="fill:rgb(255,0,89);"/>
                                    </g>
                                    <g transform="matrix(3.35067,0,0,3.35067,-1441.41,-1780.79)">
                                        <path d="M494.114,618.584C496.853,620.942 498.589,624.432 498.589,628.324C498.589,632.267 496.807,635.798 494.006,638.155C491.267,635.798 489.532,632.308 489.532,628.416C489.532,624.473 491.313,620.942 494.114,618.584Z" style="fill:rgb(195,132,203);"/>
                                    </g>
                                </g>
                                <g transform="matrix(2.72822,0,-1.90107e-16,2.8527,-843.002,-1528.62)">
                                    <ellipse cx="382.029" cy="632.834" rx="16.147" ry="15.357" style="fill:white;"/>
                                </g>
                                <g transform="matrix(3.42468,0,0,3.40868,-1490.38,-1818.73)">
                                    <path d="M489.608,627.016C490.307,620.58 495.77,615.564 502.396,615.564C503.704,615.564 504.967,615.76 506.157,616.123C505.458,622.559 499.995,627.575 493.369,627.575C492.061,627.575 490.798,627.379 489.608,627.016Z" style="fill:rgb(238,133,170);"/>
                                </g>
                                <g transform="matrix(3.42468,0,0,3.40868,-1490.38,-1818.73)">
                                    <path d="M480.631,616.521C482.194,615.846 483.916,615.472 485.725,615.472C492.214,615.472 497.587,620.283 498.464,626.526C496.901,627.201 495.178,627.575 493.369,627.575C486.88,627.575 481.507,622.764 480.631,616.521Z" style="fill:rgb(159,230,255);"/>
                                </g>
                                <g transform="matrix(3.42468,0,0,3.40868,-1490.38,-1818.73)">
                                    <path d="M494.114,618.584C496.424,620.572 498.02,623.366 498.464,626.526C496.901,627.201 495.178,627.575 493.369,627.575C492.061,627.575 490.798,627.379 489.608,627.016C489.974,623.643 491.649,620.66 494.114,618.584Z" style="fill:white;"/>
                                </g>
                                <g transform="matrix(1.46106,0,0,1.45424,377.481,353.096)">
                                    <text x="0px" y="0px" style="font-family:\\'ArialRoundedMTBold\\', \\'Arial Rounded MT Bold\\', sans-serif;font-size:114.167px;fill:white;">unyt</text>
                                </g>
                            </g>
                        </g>
                    </g>
                    <g transform="matrix(0.97318,0,0,0.97318,3.7554,11.0291)">
                        <text x="49.09px" y="304.464px" style="font-family:\\'ArialMT\\', \\'Arial\\', sans-serif;font-size:21.181px;fill:rgb(217,217,217);">Connected to DA<tspan x="208.827px 221.765px " y="304.464px 304.464px ">TE</tspan>X node</text>
                    </g>
                    <g transform="matrix(0.97318,0,0,0.97318,161.08,52.0315)">
                        <text x="31.436px" y="304.464px" style="font-family:\\'ArialMT\\', \\'Arial\\', sans-serif;font-size:21.181px;fill:rgb(217,217,217);">{^1}</text>
                    </g>
                    <g transform="matrix(0.97318,0,0,0.97318,161.08,83.8163)">
                        <text x="31.436px" y="304.464px" style="font-family:\\'ArialMT\\', \\'Arial\\', sans-serif;font-size:21.181px;fill:rgb(217,217,217);">{^2}</text>
                    </g>
                    <g transform="matrix(0.97318,0,0,0.97318,161.08,115.357)">
                        <text x="31.436px" y="304.464px" style="font-family:\\'ArialMT\\', \\'Arial\\', sans-serif;font-size:21.181px;fill:rgb(217,217,217);">{^3}</text>
                    </g>
                    <g transform="matrix(0.97318,0,0,0.97318,161.08,145.439)">
                        <text x="31.436px" y="304.464px" style="font-family:\\'ArialMT\\', \\'Arial\\', sans-serif;font-size:21.181px;fill:rgb(217,217,217);">{current}</text>
                    </g>
                    <g transform="matrix(0.97318,0,0,0.97318,274.83,10.3463)">
                        <text x="31.436px" y="304.464px" style="font-family:\\'ArialMT\\', \\'Arial\\', sans-serif;font-size:21.181px;fill:rgb(217,217,217);">{sender}</text>
                    </g>
                    <g transform="matrix(1.62112,0,0,1.62112,431.693,-267.403)">
                        <text x="31.436px" y="304.464px" style="font-family:\\'ArialMT\\', \\'Arial\\', sans-serif;font-size:21.181px;fill:rgb(217,217,217);">{^4}</text>
                    </g>
                    <g transform="matrix(0.97318,0,0,0.97318,3.7554,194.405)">
                        <text x="49.09px" y="304.464px" style="font-family:\\'ArialMT\\', \\'Arial\\', sans-serif;font-size:21.181px;fill:rgb(0,172,255);">Enable debug mode for this endpoint: https://r<tspan x="476.526px 482.411px " y="304.464px 304.464px ">.u</tspan>nyt.org/</text>
                    </g>
                    <g transform="matrix(0.97318,0,0,0.97318,3.7554,223.934)">
                        <text x="49.09px" y="304.464px" style="font-family:\\'ArialMT\\', \\'Arial\\', sans-serif;font-size:21.181px;fill:rgb(217,217,217);">© 2021 Jonas &amp; Benedikt Strehle</text>
                    </g>
                    <g transform="matrix(0.97318,0,0,0.97318,3.7554,53.699)">
                        <text x="49.09px" y="304.464px" style="font-family:\\'ArialMT\\', \\'Arial\\', sans-serif;font-size:21.181px;fill:rgb(41,199,61);">[MODE]</text>
                    </g>
                    <g transform="matrix(0.97318,0,0,0.97318,3.7554,85.6357)">
                        <text x="49.09px" y="304.464px" style="font-family:\\'ArialMT\\', \\'Arial\\', sans-serif;font-size:21.181px;fill:rgb(41,199,61);">[APP]</text>
                    </g>
                    <g transform="matrix(0.97318,0,0,0.97318,3.7554,116.058)">
                        <text x="49.09px" y="304.464px" style="font-family:\\'ArialMT\\', \\'Arial\\', sans-serif;font-size:21.181px;fill:rgb(41,199,61);">[LICENSE]</text>
                    </g>
                    <g transform="matrix(0.97318,0,0,0.97318,3.7554,147.005)">
                        <text x="49.09px" y="304.464px" style="font-family:\\'ArialMT\\', \\'Arial\\', sans-serif;font-size:21.181px;fill:rgb(41,199,61);">[ST<tspan x="80.469px 93.024px 105.962px " y="304.464px 304.464px 304.464px ">ATI</tspan>ON]</text>
                    </g>
                    <g transform="matrix(1.08786,0,0,1.08786,554.659,475.808)">
                        <text x="0px" y="13.573px" style="font-family:\\'ArialMT\\', \\'Arial\\', sans-serif;font-size:18.948px;fill:rgb(0,172,255);">{current}</text>
                    </g>
                </g>
            </g>
        </svg>        
        '));
        `, [endpoint, "Production", ":unyt", "unyt.org", "0.1.0b"]), endpoint)*/
    }
    

    protected constructor() {
        this.logger = new Logger(this.constructor.name);
        this.datex_in_handler = Datex.Runtime.getDatexInputHandler();
    }

    abstract init()

    protected handleBlock(dxb:ArrayBuffer, last_endpoint: Datex.Addresses.Endpoint, header_callback?:(header:Datex.dxb_header)=>void):Promise<Datex.dxb_header> {
        if (header_callback) return <Promise<Datex.dxb_header>>this.datex_in_handler({dxb, header_callback}, last_endpoint);
        else return <Promise<Datex.dxb_header>>this.datex_in_handler(dxb, last_endpoint);
    }

    /** implement how to send a message to a connected node*/
    protected abstract sendRequest(dx:ArrayBuffer, to:Datex.Addresses.Endpoint):Promise<void>

    /** called from outside for requests */
    public send(dx:ArrayBuffer, to:Datex.Addresses.Endpoint):Promise<void> {
        return this.sendRequest(dx, to)
    }

    // TODO should find the right communication way (sockets, ... ) depending on station!
    /*public static async send(dx:AsyncGenerator<ArrayBuffer,ArrayBuffer>, to:DatexFilterTarget):Promise<void> {
        let com_interface = RouterDatexInterface.endpoints_connection_points.get(to);
        if (com_interface) return com_interface.send(dx, to);
    }*/

}



/** HTTP interface */
class HttpComInterface extends ServerDatexInterface {

    override type = "http";

    override in = true
    override out = false

    init() {
        this.logger.success("init")

        WebServer.express.get("/", (req, res)=>{
            res.send(`<div style='font-family:"Courier New", Courier, monospace;width:100%;height:100%;display:flex;justify-content:center;align-items:center'><div style='text-align:center'><h3 style='margin-bottom: 0'>DATEX Node <span style='color:#0774de'>${Datex.Runtime.endpoint}</span></h3><br>© 2022 <a style='color: black;text-decoration: none;' href="https://unyt.org">unyt.org</a></div></div>`)
        })

        WebServer.express.get("/http/:dmx", async (req, res)=>{

            let message_string = req.params.dmx.toString();
            console.log("==> A Connection says:\n%s", message_string)
            this.datex_in_handler(<ArrayBuffer>await DatexCompiler.compile(message_string), Datex.Runtime.endpoint);
            let result = "[OK]"
            res.type('text/plain');
            res.send(result)
        })

    }

    protected async sendRequest(dx:ArrayBuffer, to:Datex.Addresses.Target) {
        return null;
        // TODO cache requests
    }

}


type push_data = {endpoint:string, expirationTime:any, keys:{p256dh:string, auth:string}};

/** Web push interface */
class WebPushInterface extends ServerDatexInterface  {

    override type = "webpush";

    override in = false
    override out = true

    private static publicKey = 'BEurqeNZ1qqnY3BzL17tu-pMusRWr2zIxw4nau7nkTYQqeMYjV31s_l6DUP-AaV1VDYvOJYRfxfQQqlFvITg01s'
    private static privateKey = 'hshlp0C6kowCz6tgs8g-ZDRyyqHJXEcY1orM8AAe2WU'

    private saved_push_connections = new Map<Datex.Addresses.Target, push_data>();

    init() {
        this.logger.success("init")
        webpush.setVapidDetails('mailto:admin@unyt.org', WebPushInterface.publicKey, WebPushInterface.privateKey);
    }

    public registerChannel(endpoint:Datex.Addresses.Target, data:push_data): boolean{
        this.saved_push_connections.set(endpoint, data);

        // assign interface officially to this endpoint
        DatexCommonInterface.addInterfaceForEndpoint(endpoint, this);

        return true;
    }

    protected async sendRequest(dx:ArrayBuffer, to:Datex.Addresses.Target) {

        // check if push subscription exists
        if (this.saved_push_connections.has(to)) {
            let subscription = this.saved_push_connections.get(to);
            //let buffer = Buffer.from(dx);
            let base64 = btoa(String.fromCharCode(...new Uint8Array(dx)));
            let result = await webpush.sendNotification(subscription, base64)//DatexRuntime.decompile(dx, false, false));
            this.logger.success("-> push notification to " + to.toString(), result);
        }

        return null;
        // TODO cache requests
    }

}


/** TCP CLI (e.g. via netcat) */
class TCPCLI extends ServerDatexInterface  {

    override type = "tcp_cli";

    override in = true
    override out = true

    private tcp_server;

    private introText(){
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



[97m> [0m`
    }

    init() {
        this.logger.success("init")

        this.tcp_server = TCP.createServer((conn) => {

            conn.setEncoding('utf8')
                    
            conn.write(this.introText(), async function () {
                //console.log("input")
            })
          
            conn.on("error", console.log)
          
            conn.on("end", () => {

            })
          
            conn.on("data", async (message) => {
                let message_string = message.toString();
                console.log("==> A Connection says:\n%s", message);
                // fixme: executes locally
                try {
                    let res = await datex(message_string);
                    if (res !== Datex.VOID) conn.write(res + "\n");
                } catch (e) {
                    conn.write("[30;31m" + e + "[0m\n");
                }
                conn.write("[97m> [0m");
            })
        })
        
        const port = process.env.UNYT_TCP_PORT;

        this.tcp_server.listen(port, () => {
            this.logger.success(`TCP CLI Server is listening on port ${port}`)
        });
    }

    protected async sendRequest(dx:ArrayBuffer, to:Datex.Addresses.Target) {

    }
}

type TCPSocket = TCP.Socket;


/** TCP server interface */
class TCPComInterface extends ServerDatexInterface  {

    override type = "tcp";

    override in = true
    override out = true

    private tcp_server;

    private connection_endpoint_map: Map<TCPSocket, Datex.Addresses.Endpoint> = new Map()
    private endpoint_connection_map: Map<Datex.Addresses.Endpoint, TCPSocket> = new Map()

    init() {
        this.logger.success("init")

        this.tcp_server = TCP.createServer((conn) => {
        
            conn.on("error", console.log)
          
            conn.on("end", () => {

            })
          
            conn.on("data", async (dx_block) => {
                // convert Buffer to ArrayBuffer and parse block
                let header:Datex.dxb_header;

                console.log("TCP data:", dx_block)

                let conn_endpoint = this.connection_endpoint_map.get(conn);

                // bind alias to this socket connection
                if (!conn_endpoint) {
                    header = await this.handleBlock(new Uint8Array(dx_block).buffer, null, header => {
                        this.logger.debug("tcp endpoint registered: " + header.sender);

                        this.endpoints.add(header.sender)
                        // assign interface officially to this endpoint
                        DatexCommonInterface.addInterfaceForEndpoint(header.sender, this);
                        this.endpoint_connection_map.set(header.sender, conn);
                        this.connection_endpoint_map.set(conn, header.sender);
                        this.endpointWelcomeMessage(header.sender);
                    })
                }
                else {
                    header = await this.handleBlock(new Uint8Array(dx_block).buffer, conn_endpoint, null)
                }

                /* an other endpoint is reachable over this interface*/
                if (header && header.sender!=conn_endpoint && !this.reachable_endpoints.has(header.sender)) {
                    this.reachable_endpoints.set(header.sender, conn_endpoint)
                    DatexCommonInterface.addIndirectInterfaceForEndpoint(header.sender, this)
                }
                

            })
        })
        
        const port = process.env.UNYT_TCP_PORT;

        this.tcp_server.listen(port, () => {
            this.logger.success(`TCP Server is listening on port ${port}`)
        });
    }

    protected async sendRequest(dx:ArrayBuffer, to:Datex.Addresses.Endpoint) {
        let buffer = Buffer.from(dx);

        // try to find an other endpoint over which the requested endpoint is connected
        if (!this.endpoint_connection_map.has(to)) {
            if (this.reachable_endpoints.has(to)) to = this.reachable_endpoints.get(to);
            else {this.logger.error("alias " + to + " not connected");return;}
        }

        // send to a connected endpoint
        else this.endpoint_connection_map.get(to).write(buffer)
    }
}

/** Websocket stream interface */
class WebsocketStreamComInterface extends ServerDatexInterface {

    private wss;

    override in = true
    override out = true

    override type = "wss";

    private connected_endpoint_streams = new Map<Datex.Addresses.Target, any>();

    init() {
        this.logger.success("init")


        this.wss = new WebSocket.Server({
            //port: port,
            server: WebServer.http,
            perMessageDeflate: {
                zlibDeflateOptions: {
                    // See zlib defaults.
                    chunkSize: 1024,
                    memLevel: 7,
                    level: 3
                },
                zlibInflateOptions: {
                    chunkSize: 10 * 1024
                },
                // Other options settable:
                clientNoContextTakeover: true, // Defaults to negotiated value.
                serverNoContextTakeover: true, // Defaults to negotiated value.
                serverMaxWindowBits: 10, // Defaults to negotiated value.
                // Below options specified as default values.
                concurrencyLimit: 10, // Limits zlib concurrency for perf.
                threshold: 1024 // Size (in bytes) below which messages
                // should not be compressed.
            }
        });
        this.logger.success(`WebSocket stream server is listening`)


        this.wss.on('connection', async ws => {
            console.log("new connection")

            let ws_stream = websocketStream(ws);

            ws_stream.on('data', async (dx_block :Buffer) => {
                // convert Buffer to ArrayBuffer and parse block
                let header:Datex.dxb_header;

                // bind alias to this socket connection
                if (!ws_stream.endpoint) {
                    header = await this.handleBlock(new Uint8Array(dx_block).buffer, ws_stream.endpoint, header => {
                        
                        this.connected_endpoint_streams.set(header.sender, ws_stream);
                        this.endpoints.add(header.sender)
                        // assign interface officially to this endpoint
                        DatexCommonInterface.addInterfaceForEndpoint(header.sender, this);
                        
                        ws_stream.endpoint = header.sender;
                        this.endpointWelcomeMessage(header.sender);
                    })
                }
                else {
                    header = await this.handleBlock(new Uint8Array(dx_block).buffer, ws_stream.endpoint, null)
                }

                /* an other endpoint is reachable over this interface*/
                if (header && header.sender!=ws_stream.endpoint && !this.reachable_endpoints.has(header.sender)) {
                    this.reachable_endpoints.set(header.sender, ws_stream.endpoint)
                    DatexCommonInterface.addIndirectInterfaceForEndpoint(header.sender, this)
                }
               
            });
        });
    }

    protected async sendRequest(dx:ArrayBuffer, to:Datex.Addresses.Endpoint) {

        let buffer = Buffer.from(dx);

        // try to find an other endpoint over which the requested endpoint is connected
        if (!this.connected_endpoint_streams.has(to)) {
            if (this.reachable_endpoints.has(to)) to = this.reachable_endpoints.get(to);
            else {this.logger.error("alias " + to + " not connected");return;}
        }

        // send to a connected endpoint
        else this.connected_endpoint_streams.get(to).write(buffer)
    }
}

/** Websocket interface */
class WebsocketComInterface extends ServerDatexInterface {

    override type = "websocket";

    override in = true
    override out = true

    private wss
    private connected_endpoints = new Map<Datex.Addresses.Target, any>();

    init() {
        this.logger.success("init");

        this.wss = new WebSocket.Server({
            //port: port,
            server: WebServer.http,
            perMessageDeflate: {
                zlibDeflateOptions: {
                    // See zlib defaults.
                    chunkSize: 1024,
                    memLevel: 7,
                    level: 3
                },
                zlibInflateOptions: {
                    chunkSize: 10 * 1024
                },
                // Other options settable:
                clientNoContextTakeover: true, // Defaults to negotiated value.
                serverNoContextTakeover: true, // Defaults to negotiated value.
                serverMaxWindowBits: 10, // Defaults to negotiated value.
                // Below options specified as default values.
                concurrencyLimit: 10, // Limits zlib concurrency for perf.
                threshold: 1024 // Size (in bytes) below which messages
                // should not be compressed.
            }
        });
        this.logger.success(`WebSocket server is listening`)


        this.wss.on('connection', async ws => {
            console.log("new connection")

            ws.on('message', async (dmx_block: Buffer) => {

                let header: Datex.dxb_header;

                // bind endpoint to this socket connection
                if (!ws.endpoint) {
                    ws.endpoint = true;
                    header = await this.handleBlock(new Uint8Array(dmx_block).buffer, ws.endpoint, header => {
                        this.logger.debug("endpoint registered: " + header.sender);
                        
                        this.connected_endpoints.set(header.sender, ws);
                        this.endpoints.add(header.sender)

                        // assign interface officially to this endpoint
                        DatexCommonInterface.addInterfaceForEndpoint(header.sender, this);

                        ws.endpoint = header.sender;
                    })
                }
                else {
                    header = await this.handleBlock(new Uint8Array(dmx_block).buffer, ws.endpoint, null)
                }

                /* an other endpoint is reachable over this interface*/
                if (header && header.sender!=ws.endpoint && !this.reachable_endpoints.has(header.sender)) {
                    this.logger.debug("reachable endpoint registered: " + header.sender);
                    this.reachable_endpoints.set(header.sender, ws.endpoint)
                    DatexCommonInterface.addIndirectInterfaceForEndpoint(header.sender, this)
                }
            });
        });

    }

    protected async sendRequest(dx:ArrayBuffer, to:Datex.Addresses.Endpoint) {
        let buffer = Buffer.from(dx);

        // try to find an other endpoint over which the requested endpoint is connected
        if (!this.connected_endpoints.has(to)) {
            if (this.reachable_endpoints.has(to)) to = this.reachable_endpoints.get(to);
            else {this.logger.error("alias " + to + " not connected");return;}
        }

        // send to a connected endpoint
        if (this.connected_endpoints.has(to)) this.connected_endpoints.get(to).send(buffer)
    }
}


namespace Server {

    export const http_com_interface = <HttpComInterface> HttpComInterface.getInstance();
    export const websocket_stream_com_interface = <WebsocketStreamComInterface> WebsocketStreamComInterface.getInstance();
    export const websocket_com_interface = <WebsocketComInterface> WebsocketComInterface.getInstance();
    export const tcp_com_interface  = <TCPComInterface> TCPComInterface.getInstance();
    export const tcp_cli_com_interface  = <TCPCLI> TCPCLI.getInstance();

    export const web_push_interface = <WebPushInterface> WebPushInterface.getInstance();
    
    export async function init(interfaces=["http", "tcp", "tcp_cli", "websocket", "websocketstream", "webpush"], parent_node?:Datex.Addresses.Endpoint) {

        // set blockchain interface
        Datex.Runtime.blockchain_interface = new BlockchainSimAdapter();

        if (parent_node) {
            console.log("Connecting to parent node: " + parent_node);
            await DatexCloud.connect(undefined, undefined, true, undefined, undefined, parent_node);
        }
        else {
            await DatexCloud.init();
        }

        WebServer.launch();
        
        // init all interfaces
        if (interfaces.includes("http")) {
            http_com_interface.init();
            DatexInterfaceManager.addInterface(http_com_interface);
        }
        if (interfaces.includes("tcp")) {
            tcp_com_interface.init();
            DatexInterfaceManager.addInterface(tcp_com_interface);
        }
        if (interfaces.includes("tcp_cli")) {
            tcp_cli_com_interface.init();
            DatexInterfaceManager.addInterface(tcp_com_interface);
        }
        if (interfaces.includes("websocket")) {
            websocket_com_interface.init();
            DatexInterfaceManager.addInterface(websocket_com_interface);
        }
        if (interfaces.includes("websocketstream")) {
            websocket_stream_com_interface.init();
            DatexInterfaceManager.addInterface(websocket_stream_com_interface);
        }
        if (interfaces.includes("webpush")) {
            web_push_interface.init();
            DatexInterfaceManager.addInterface(web_push_interface);
        }

        DatexInterfaceManager.enable();
    }
    
}


// override interface manager methods

DatexInterfaceManager.handleNoRedirectFound = function(receiver){
    console.log("cannot redirect to " + receiver);
}


export default Server;





/** Custom ROUDINI stuff */

@scope("network") abstract class network {
    
    /** add push notification channel connection data */
    @expose static async add_push_channel (channel:string, data:push_data, @meta meta, ...more:number[]) {
        console.log("new push endpoint: " + meta.sender.getInstance(channel).toString());
        return Server.web_push_interface.registerChannel(meta.sender.getInstance(channel), data);
    }

    /** get sign and encryption keys for an alias */
    @expose static async get_keys (endpoint:Datex.Addresses.Person) {
        console.log("GET keys for " +endpoint)
        let keys = await Datex.Crypto.getEndpointPublicKeys2(endpoint);
        return keys;
    }
}



/** Network admin stuff */


const system = await systeminformation.baseboard();
const os = await systeminformation.osInfo();

@scope('roudini') abstract class Roudini {
    //@expose static CPU_USAGE = new DataStream()

    @expose static ABOUT = {
        datex_version: Datex.Runtime.VERSION,
        system: system,
        os: os
    }

    @expose static STATUS = pointer({
        uptime: 0,
        connections: 42
    });

    @expose static INTERFACES = pointer(new Set<any>());

    @expose static ping() {return 'pong'}
}



/*setInterval(async ()=>Roudini.CPU_USAGE.push(
    new Datum({time: Date.now(), value:(await systeminformation.cpuCurrentSpeed()).avg})
), 5000*1000);*/


setInterval(()=>Roudini.STATUS.uptime = Math.round(process.uptime()), 1000);


DatexInterfaceManager.onNewInterface(interf =>{
    console.log("new interface: " + interf.type)
    let i:any = {
        type: interf.type,
        in: interf.in,
        out: interf.out
    };
    if (interf.endpoints) i.endpoints = interf.endpoints
    if (interf.endpoint)  i.endpoint = interf.endpoint

    Roudini.INTERFACES.add(i)
})


export const NETWORK = [
    [1, 1, 0],
    [0, 0, 0],
    [0, 1, 0]
]