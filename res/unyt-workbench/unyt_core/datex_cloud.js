import DatexInterfaceManager, { DatexCommonInterface } from "./datex_client.js";
import { DatexCompiler, DatexProtocolDataType } from "./datex_compiler.js";
import { Datex, storage } from "./datex_runtime.js";
import Logger from "./logger.js";
const logger = new Logger("DATEX Cloud");
export default class DatexCloud {
    static NODES_LIST_URL = '/unyt_core/dx_data/nodes.dx';
    static available_channel_types = [];
    static client_type = globalThis.process?.release?.name || 'browser';
    static node_channels_by_type = new Map();
    static listeners_set = false;
    static setListeners() {
        if (this.listeners_set)
            return;
        this.listeners_set = true;
        DatexInterfaceManager.onInterfaceConnected((i) => {
            if (i.type != "local")
                this.sayHello(i.endpoint);
        });
        DatexInterfaceManager.onInterfaceDisconnected((i) => {
            console.log("disconnected: " + i.endpoint + " - " + i.type);
        });
    }
    static async connectAnonymous() {
        return this.connect(undefined, undefined, false);
    }
    static async connectTemporary(endpoint, id_endpoint) {
        return this.connect(endpoint, id_endpoint, false);
    }
    static async connect(endpoint, id_endpoint, local_cache = true, sign_keys, enc_keys, via_node) {
        endpoint = await this.init(endpoint, id_endpoint, local_cache, sign_keys, enc_keys);
        if (globalThis.WebSocketStream || this.client_type != "browser")
            this.available_channel_types.push("websocketstream");
        this.available_channel_types.push("websocket");
        let [node, channel_type] = this.getNodeWithChannelType(this.available_channel_types, via_node);
        if (!node)
            throw ("Cannot find a node that support any channel type of: " + this.available_channel_types + (via_node ? " via " + via_node : ''));
        if (!channel_type)
            throw ("No channel type for node: " + node);
        this.setListeners();
        await DatexInterfaceManager.disconnect();
        let connected = await DatexInterfaceManager.connect(channel_type, node);
        Datex.Runtime.setMainNode(node);
        if (!connected)
            logger.error("connectionn failed");
        else if (this.onConnect)
            this.onConnect();
        return connected;
    }
    static onConnect = () => {
        logger.success("Connected as **" + Datex.Runtime.endpoint + "** (" + Datex.Runtime.endpoint.id_endpoint + ") to DATEX cloud via **" + DatexCommonInterface.default_interface.endpoint + "** (" + DatexCommonInterface.default_interface.type + ")");
    };
    static async init(endpoint, id_endpoint, local_cache = true, sign_keys, enc_keys) {
        if (!endpoint) {
            if (local_cache)
                [endpoint, sign_keys, enc_keys] = await this.getLocalEndpointAndKeys();
            else
                endpoint = Datex.Addresses.Target.get(this.createEndpointId());
        }
        if (!sign_keys || !enc_keys)
            [sign_keys, enc_keys] = await this.generateKeys();
        else {
            let sign_key_base64 = typeof sign_keys[1] == "string" ? sign_keys[1] : await Datex.Crypto.exportPrivateKey(sign_keys[1]);
            let dec_key_base64 = typeof enc_keys[1] == "string" ? enc_keys[1] : await Datex.Crypto.exportPrivateKey(enc_keys[1]);
            let verify_key_base64 = typeof sign_keys[0] == "string" ? sign_keys[0] : await Datex.Crypto.exportPublicKey(sign_keys[0]);
            let enc_key_base64 = typeof enc_keys[0] == "string" ? enc_keys[0] : await Datex.Crypto.exportPublicKey(enc_keys[0]);
            if (local_cache) {
                await storage.setItem("verify_key", verify_key_base64);
                await storage.setItem("sign_key", sign_key_base64);
                await storage.setItem("enc_key", enc_key_base64);
                await storage.setItem("dec_key", dec_key_base64);
            }
        }
        if (endpoint && !endpoint.id_endpoint) {
            id_endpoint = id_endpoint ?? Datex.Addresses.IdEndpoint.get((local_cache ? await storage.getItem("id_endpoint") : undefined) ?? this.createEndpointId(), null, endpoint.instance);
            endpoint.setIdEndpoint(id_endpoint);
        }
        if (local_cache) {
            await storage.setItem("endpoint", endpoint.toString());
            await storage.setItem("id_endpoint", endpoint.id_endpoint.toString());
        }
        await Datex.Runtime.init(endpoint);
        await Datex.Crypto.loadOwnKeys(...sign_keys, ...enc_keys);
        await DatexInterfaceManager.init();
        await this.loadNodesList();
        return endpoint;
    }
    static createEndpointId() {
        const id = new DataView(new ArrayBuffer(12));
        const timestamp = Math.round((new Date().getTime() - DatexCompiler.BIG_BANG_TIME) / 1000);
        id.setUint32(0, timestamp);
        id.setBigUint64(4, BigInt(Math.floor(Math.random() * (2 ** 64))));
        return `@@${Datex.Pointer.buffer2hex(new Uint8Array(id.buffer))}`;
    }
    static async getLocalEndpointAndKeys() {
        let endpoint;
        if (globalThis.process?.env?.UNYT_NAME && !await storage.getItem("endpoint")) {
            await storage.setItem("endpoint", "*" + process.env.UNYT_NAME.replace("ROUDINI-", "").replace(/\./g, "-"));
        }
        let endpoint_string;
        if (!(await storage.getItem("endpoint")))
            endpoint_string = this.createEndpointId();
        else
            endpoint_string = await storage.getItem("endpoint");
        try {
            endpoint = Datex.Addresses.Target.get(endpoint_string);
        }
        catch (e) {
            logger.error("currently saved endpoint is invalid");
            endpoint_string = this.createEndpointId();
            endpoint = Datex.Addresses.Target.get(endpoint_string);
        }
        storage.setItem("endpoint", endpoint_string);
        return [endpoint, ...await this.generateKeys()];
    }
    static async generateKeys() {
        if (!await storage.getItem("verify_key") || !await storage.getItem("sign_key") || !await storage.getItem("enc_key") || !await storage.getItem("dec_key")) {
            let keys = await Datex.Crypto.createOwnKeys();
            await storage.setItem("verify_key", keys[0]);
            await storage.setItem("sign_key", keys[1]);
            await storage.setItem("enc_key", keys[2]);
            await storage.setItem("dec_key", keys[3]);
        }
        let sign_keys = [await storage.getItem("verify_key"), await storage.getItem("sign_key")];
        let enc_keys = [await storage.getItem("enc_key"), await storage.getItem("dec_key")];
        return [sign_keys, enc_keys];
    }
    static nodes_loaded = false;
    static async loadNodesList() {
        if (this.nodes_loaded)
            return;
        this.nodes_loaded = true;
        let nodes = await Datex.Runtime.parseDatexData(await Datex.getFileContent(this.NODES_LIST_URL, './dx_data/nodes.dx'));
        for (let [node, { channels, keys: [verify_key, enc_key] }] of nodes.entries()) {
            Datex.Crypto.bindKeys(node, verify_key, enc_key);
            node.setInterfaceChannels(channels);
            for (let [channel_name, channel_data] of Object.entries(channels || {})) {
                if (!this.node_channels_by_type.has(channel_name))
                    this.node_channels_by_type.set(channel_name, []);
                this.node_channels_by_type.get(channel_name).push([node, channel_data]);
            }
        }
    }
    static getNodeWithChannelType(types, force_use_node) {
        for (let type of types) {
            let list = this.node_channels_by_type.get(type);
            if (list?.length) {
                if (!force_use_node)
                    return [list[0][0], type];
                else {
                    for (let [node, data] of list) {
                        if (node == force_use_node)
                            return [node, type];
                    }
                }
            }
        }
        return [null, null];
    }
    static async sayHello(node = Datex.Runtime.main_node) {
        let keys = Datex.Crypto.getOwnPublicKeysBase64();
        await Datex.Runtime.datexOut(['?', [keys], { type: DatexProtocolDataType.HELLO, sign: false, flood: true, __routing_ttl: 1 }], undefined, undefined, false, false);
        await Datex.Runtime.datexOut(['?', [keys], { type: DatexProtocolDataType.HELLO, sign: false, flood: true, force_id: true, __routing_ttl: 1 }], undefined, undefined, false, false);
    }
    static async findOnlineEndpoints(endpoint) {
    }
    static async pingEndpoint(endpoint_or_string, sign = false, encrypt = false) {
        let endpoint = endpoint_or_string instanceof Datex.Addresses.Endpoint ? endpoint_or_string : Datex.Addresses.Endpoint.get(endpoint_or_string);
        const start_time = new Date().getTime();
        const half_time = (await Datex.Runtime.datexOut(['<Time>()', null, { sign, encrypt }], endpoint)).getTime();
        const roundtrip_time = new Date().getTime();
        logger.success(`

    Endpoint:       ${endpoint}
    Roundtrip time: ${roundtrip_time - start_time} ms
        `);
    }
}
globalThis.DatexCloud = DatexCloud;
