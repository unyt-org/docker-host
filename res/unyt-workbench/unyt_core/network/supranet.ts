
/**
 ╔══════════════════════════════════════════════════════════════════════════════════════╗
 ║  Datex Cloud - Entrypoint                                                            ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  Visit https://docs.unyt.org/datex for more information                              ║
 ╠═════════════════════════════════════════╦════════════════════════════════════════════╣
 ║  © 2021 unyt.org                        ║                                            ║
 ╚═════════════════════════════════════════╩════════════════════════════════════════════╝
 */

import InterfaceManager, { CommonInterface } from "./client.js"
import { Compiler } from "../compiler/compiler.js";
import { Runtime } from "../runtime/runtime.js";
import { Crypto } from "../runtime/crypto.js";
import { Storage } from "../runtime/storage.js";
import { f } from "../datex_short.js";
import { Pointer } from "../runtime/pointers.js";

import { Bot, Endpoint, filter_target_name_id, IdEndpoint, Target } from "../types/addressing.js";


import { Logger } from "../utils/logger.js";
import { ProtocolDataType } from "../compiler/protocol_types.js";
import { buffer2hex, getFileContent } from "../utils/utils.js";
import { endpoint_config } from "../runtime/endpoint_config.js";
const logger = new Logger("DATEX Cloud");


// entry point to connect to the datex network
export class Supranet {

    static NODES_LIST_URL =  '/unyt_core/dx_data/nodes.dx' //'https://docs.unyt.org/unyt_web/unyt_core/dx_data/nodes.dx';

    static available_channel_types = []; // all available interface channel types, sorted by preference
    static client_type = globalThis.process?.release?.name || 'browser' // browser or node?

    // list of available nodes with public keys
    private static node_channels_by_type = new Map<string, [Bot, any][]>();

    // add listeners for interface changes
    private static listeners_set = false;
    private static setListeners(){
        if (this.listeners_set) return;
        this.listeners_set = true;
        // say hello when (re)connected
        InterfaceManager.onInterfaceConnected((i)=>{
            logger.debug("interface connected: "+ i.endpoint + " - " + i.type);
            if (i.type != "local") this.sayHello(i.endpoint)
        })
        InterfaceManager.onInterfaceDisconnected((i)=>{
            logger.debug("interface disconnected: "+ i.endpoint + " - " + i.type);
        })
    }

    // connect without cache and random endpoint id
    public static async connectAnonymous(){
        return this.connect(undefined, undefined, false);
    }

    // connect without cache
    public static async connectTemporary(endpoint?:Endpoint, id_endpoint?:IdEndpoint){
        return this.connect(endpoint, id_endpoint, false);
    }

    // connect to cloud, say hello with public key
    // if local_cache=false, a new endpoint is created and not saved in the cache, even if an endpoint is stored in the cache
    // TODO problem: using same keys as stored endpoint!
    public static async connect(endpoint?:Endpoint, id_endpoint?:IdEndpoint, local_cache = true, sign_keys?:[ArrayBuffer|CryptoKey,ArrayBuffer|CryptoKey], enc_keys?:[ArrayBuffer|CryptoKey,ArrayBuffer|CryptoKey], via_node?:Bot) {

        // load runtime, own endpoint, nodes
        endpoint = await this.init(endpoint, id_endpoint, local_cache, sign_keys, enc_keys)

        // channel types?
        if (globalThis.WebSocketStream || this.client_type!="browser") this.available_channel_types.push("websocketstream")
        this.available_channel_types.push("websocket");

        // find node for available channel
        let [node, channel_type] = <[Bot,string]> this.getNodeWithChannelType(this.available_channel_types, via_node);
        if (!node) throw ("Cannot find a node that support any channel type of: " + this.available_channel_types + (via_node ? " via " + via_node : ''));
        if (!channel_type) throw("No channel type for node: " + node);


        await InterfaceManager.disconnect() // first disconnect completely
        let connected = await InterfaceManager.connect(channel_type, node)

        Runtime.setMainNode(node);

        if (!connected) logger.error("connectionn failed")
        else if (this.onConnect) this.onConnect();
        return connected;
    }

    // @override
    public static onConnect = ()=>{
        logger.success("Connected as **"+Runtime.endpoint+"** ("+Runtime.endpoint.id_endpoint+") to DATEX cloud via **" +  CommonInterface.default_interface.endpoint + "** (" + CommonInterface.default_interface.type + ")" )
    }

    // only init, don't (re)connect
    public static async init(endpoint?:Endpoint, id_endpoint?:IdEndpoint, local_cache = true, sign_keys?:[ArrayBuffer|CryptoKey,ArrayBuffer|CryptoKey], enc_keys?:[ArrayBuffer|CryptoKey,ArrayBuffer|CryptoKey]):Promise<Endpoint>  {

        await endpoint_config.load(); // load config from storage/file

        let keys:Crypto.ExportedKeySet;

        // load/create endpoint from cache?
        if (!endpoint) {
            if (local_cache) {
                [endpoint, keys] = await this.getLocalEndpointAndKeys();
                sign_keys = keys.sign;
                enc_keys = keys.encrypt;
            }
            else endpoint = <Endpoint>Target.get(this.createEndpointId());
        } 
        // load/create keys, even if endpoint was provided?
        if (!sign_keys || !enc_keys) {
            keys = await this.getKeysOrGenerateNew();
            sign_keys = keys.sign;
            enc_keys = keys.encrypt;
        }
        else if (local_cache) { // new keys were provided, save in storage
            const keys:Crypto.ExportedKeySet = {
                sign: [
                    sign_keys[0] instanceof ArrayBuffer ? sign_keys[0] : await Crypto.exportPublicKey(sign_keys[0]),
                    sign_keys[1] instanceof ArrayBuffer ? sign_keys[1] : await Crypto.exportPrivateKey(sign_keys[1]),
                ],
                encrypt: [
                    enc_keys[0] instanceof ArrayBuffer ? enc_keys[0] : await Crypto.exportPublicKey(enc_keys[0]),
                    enc_keys[1] instanceof ArrayBuffer ? enc_keys[1] : await Crypto.exportPrivateKey(enc_keys[1]),
                ]
            }    
        }
     
        // bind id endpoint to endpoint
        if (endpoint && !endpoint.id_endpoint){ 
            id_endpoint = id_endpoint ?? ( (local_cache ? endpoint_config.id_endpoint : null) ?? f(this.createEndpointId()) ).getInstance(endpoint.instance);
            endpoint.setIdEndpoint(id_endpoint);
        }

        if (local_cache) {
            endpoint_config.endpoint = endpoint;
            endpoint_config.id_endpoint = id_endpoint;
            endpoint_config.keys = keys;
            endpoint_config.save();
        }

        // start runtime + set endpoint
        await Runtime.init(endpoint);

        // save own keys
        await Crypto.loadOwnKeys(...sign_keys, ...enc_keys);
     
        // setup interface manager
        await InterfaceManager.init()
        // load nodes
        await this.loadNodesList();

        this.setListeners();

        return endpoint;
    }


    // load stuff ...

    // 4 bytes timestamp + 8 bytes random number
    private static createEndpointId():filter_target_name_id{
        const id = new DataView(new ArrayBuffer(12));
        const timestamp = Math.round((new Date().getTime() - Compiler.BIG_BANG_TIME)/1000);
        id.setUint32(0,timestamp); // timestamp
        id.setBigUint64(4, BigInt(Math.floor(Math.random() * (2**64)))); // random number
        return `@@${buffer2hex(new Uint8Array(id.buffer))}`;
    }

    public static async getLocalEndpointAndKeys():Promise<[Endpoint, Crypto.ExportedKeySet]> {
        let endpoint:Endpoint;

        // is ROUDINI node & has no endpoint name
        if (globalThis.process?.env?.UNYT_NAME && !endpoint_config.endpoint) {
            endpoint_config.endpoint = f(`@+${process.env.UNYT_NAME.replace("ROUDINI-", "").replace(/\./g, "-")}`);
            endpoint_config.save();
        }
        
        // create new endpoint
        if (!endpoint_config.endpoint) endpoint = await this.createAndSaveNewEndpoint();
        // existing endpoint already in cache
        else {
            try {endpoint = endpoint_config.endpoint;}
            catch (e) {
                logger.error("Error getting Config Value 'endpoint'");
                endpoint = await this.createAndSaveNewEndpoint();
            }
        }

        if (!(endpoint instanceof Endpoint)) {
            logger.error("Config Value 'endpoint' is not of type <Endpoint>");
            endpoint = await this.createAndSaveNewEndpoint();
        } 
   
        // return endpoint + keys
        return [endpoint, await this.getKeysOrGenerateNew()];
    }

    private static async createAndSaveNewEndpoint(){
        const endpoint = f(this.createEndpointId());
        endpoint_config.endpoint = endpoint;
        endpoint_config.save();
        return endpoint;
    }

    private static async getKeysOrGenerateNew(): Promise<Crypto.ExportedKeySet>{
        // get existing sign + enc keys
        let keys:Crypto.ExportedKeySet = endpoint_config.keys;
        // invalid, create new
        if (!keys || !keys.sign?.[0] || !keys.sign?.[1] || !keys.encrypt?.[0] || !keys.encrypt?.[1]) {
            logger.info("creating new keys");
            keys = await Crypto.createOwnKeys();
        }

        return keys;
    }

    // handle nodes
    private static nodes_loaded = false;
    private static async loadNodesList(){
        if (this.nodes_loaded) return;
        this.nodes_loaded = true;
        let nodes = <Map<Endpoint, any>> await Runtime.parseDatexData(await getFileContent(this.NODES_LIST_URL, './unyt_core/dx_data/nodes.dx'));
        
        for (let [node, {channels, keys:[verify_key, enc_key]}] of nodes.entries()) {
            // save keys
            Crypto.bindKeys(node, verify_key, enc_key);

            // save interface info in node
            node.setInterfaceChannels(channels);
            // save in list
            for (let [channel_name, channel_data] of Object.entries(channels||{})) {
                if (!this.node_channels_by_type.has(channel_name)) this.node_channels_by_type.set(channel_name, []);
                this.node_channels_by_type.get(channel_name).push([node, channel_data]);
            }
        }
    }
    // select a node that provides a channel of the requested type
    private static getNodeWithChannelType(types:string[], force_use_node:Endpoint):[Endpoint, string] {
        for (let type of types) {
            let list = this.node_channels_by_type.get(type);
            if (list?.length) {
                if (!force_use_node) return [list[0][0], type]; // select first node
                else { // check if the force_use_node is in the list
                    for (let [node, data] of list) {
                        if (node == force_use_node) return [node, type];
                    }
                }
            }
        }
        return [null, null];       
    }


    // important network methods

    public static sayHello(node:Endpoint = Runtime.main_node){
        // TODO REPLACE, only temporary as placeholder to inform router about own public keys
        let keys = Crypto.getOwnPublicKeysExported();
        Runtime.datexOut(['?', [keys], {type:ProtocolDataType.HELLO, sign:false, flood:true, __routing_ttl:1}], undefined, undefined, false, false)
        // send with plain endpoint id as sender
        if (Runtime.endpoint.id_endpoint !== Runtime.endpoint) Runtime.datexOut(['?', [keys], {type:ProtocolDataType.HELLO, sign:false, flood:true, force_id:true, __routing_ttl:1}], undefined, undefined, false, false)
    }

    // ping all endpoints with same base (@endpoint/*) 
    public static async findOnlineEndpoints(endpoint:Endpoint){
        // TODO
        //await this.pingEndpoint(Target.get(<Endpoint_name>endpoint.toString()))
    }


    // get DATEX roundtime/ping for endpoint
    public static async pingEndpoint(endpoint_or_string:string|Endpoint, sign=false, encrypt=false) {
        let endpoint = endpoint_or_string instanceof Endpoint ? endpoint_or_string : Endpoint.get(endpoint_or_string);
        const start_time = new Date().getTime();
        const half_time = (await Runtime.datexOut(['<time>()', null, {sign, encrypt}], endpoint)).getTime()
        const roundtrip_time = new Date().getTime();
        logger.success(`

    Endpoint:       ${endpoint}
    Roundtrip time: ${roundtrip_time-start_time } ms
        `);
        /*
            ---> ${half_time-start_time} ms
            <--- ${roundtrip_time-half_time} ms
        */
    }
    
}

globalThis.DatexCloud = Supranet;