import DatexInterfaceManager, { DatexCommonInterface } from "./datex_client.js";
import { DatexCompiler, DatexProtocolDataType } from "./datex_compiler.js";
import { Datex, f } from "./datex_runtime.js";
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
        let keys;
        if (!endpoint) {
            if (local_cache) {
                [endpoint, keys] = await this.getLocalEndpointAndKeys();
                sign_keys = keys.sign;
                enc_keys = keys.encrypt;
            }
            else
                endpoint = Datex.Addresses.Target.get(this.createEndpointId());
        }
        if (!sign_keys || !enc_keys) {
            keys = await this.getKeysOrGenerateNew();
            sign_keys = keys.sign;
            enc_keys = keys.encrypt;
        }
        else if (local_cache) {
            const keys = {
                sign: [
                    sign_keys[0] instanceof ArrayBuffer ? sign_keys[0] : await Datex.Crypto.exportPublicKey(sign_keys[0]),
                    sign_keys[1] instanceof ArrayBuffer ? sign_keys[1] : await Datex.Crypto.exportPrivateKey(sign_keys[1]),
                ],
                encrypt: [
                    enc_keys[0] instanceof ArrayBuffer ? enc_keys[0] : await Datex.Crypto.exportPublicKey(enc_keys[0]),
                    enc_keys[1] instanceof ArrayBuffer ? enc_keys[1] : await Datex.Crypto.exportPrivateKey(enc_keys[1]),
                ]
            };
        }
        if (endpoint && !endpoint.id_endpoint) {
            id_endpoint = id_endpoint ?? ((local_cache ? await Datex.Storage.getConfigValue("id_endpoint") : null) ?? f(this.createEndpointId())).getInstance(endpoint.instance);
            endpoint.setIdEndpoint(id_endpoint);
        }
        if (local_cache) {
            await Datex.Storage.setConfigValue("endpoint", endpoint);
            await Datex.Storage.setConfigValue("id_endpoint", endpoint.id_endpoint);
            await Datex.Storage.setConfigValue('keys', keys);
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
        if (globalThis.process?.env?.UNYT_NAME && !await Datex.Storage.hasConfigValue("endpoint")) {
            await Datex.Storage.setConfigValue("endpoint", f(`@+${process.env.UNYT_NAME.replace("ROUDINI-", "").replace(/\./g, "-")}`));
        }
        if (!await Datex.Storage.hasConfigValue("endpoint"))
            endpoint = await this.createAndSaveNewEndpoint();
        else {
            try {
                endpoint = await Datex.Storage.getConfigValue("endpoint");
            }
            catch (e) {
                logger.error("Error getting Config Value 'endpoint'");
                endpoint = await this.createAndSaveNewEndpoint();
            }
        }
        if (!(endpoint instanceof Datex.Addresses.Endpoint)) {
            logger.error("Config Value 'endpoint' is not of type <Endpoint>");
            endpoint = await this.createAndSaveNewEndpoint();
        }
        return [endpoint, await this.getKeysOrGenerateNew()];
    }
    static async createAndSaveNewEndpoint() {
        const endpoint = f(this.createEndpointId());
        await Datex.Storage.setConfigValue('endpoint', endpoint);
        return endpoint;
    }
    static async getKeysOrGenerateNew() {
        let keys = await Datex.Storage.getConfigValue('keys');
        if (!keys || !keys.sign?.[0] || !keys.sign?.[1] || !keys.encrypt?.[0] || !keys.encrypt?.[1]) {
            logger.info("creating new keys");
            keys = await Datex.Crypto.createOwnKeys();
        }
        return keys;
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
        let keys = Datex.Crypto.getOwnPublicKeysExported();
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
