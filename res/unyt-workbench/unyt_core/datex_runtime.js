import Logger from "./logger.js";
const logger = new Logger("DATEX Runtime");
logger.info("initializing ...");
export class DatexRuntimePerformance {
    static enabled = false;
    static marker(description, new_marker, start_marker) {
        if (!globalThis.performance?.getEntriesByName)
            return;
        if (!globalThis.performance.getEntriesByName("runtime_start").length)
            globalThis.performance.mark("runtime_start");
        const meas_name = start_marker + "-" + new_marker;
        globalThis.performance.mark(new_marker);
        globalThis.performance.measure(meas_name, start_marker);
        logger.info(`${description}: ${Math.round(globalThis.performance.getEntriesByName(meas_name, 'measure')[0]?.duration)}ms`);
    }
    static #marker_count = new Map();
    static #measurements_groups = new Map();
    static MEAS_COUNT = Symbol("MEAS_COUNT");
    static createMeasureGroup(name, measurement_names = []) {
        const obj = Object.fromEntries(measurement_names.map(n => [n, 0]));
        const group = Datex.DatexObject.seal({ [this.MEAS_COUNT]: obj, ...obj });
        this.#measurements_groups.set(name, group);
        return group;
    }
    static getMeasureGroup(name) {
        return this.#measurements_groups.get(name);
    }
    static startMeasure(group, name) {
        if (!globalThis.performance?.getEntriesByName || !DatexRuntimePerformance.enabled)
            return;
        if (!this.#measurements_groups.has(group))
            throw new Error("Measurement group '" + group + "' is not defined");
        const count = (this.#marker_count.get(name) ?? 0);
        this.#marker_count.set(name, count + 1);
        const marker = globalThis.performance.mark(group + '_' + name + '_' + count, { detail: { group, name } });
        return marker;
    }
    static endMeasure(mark) {
        if (!globalThis.performance?.getEntriesByName || !DatexRuntimePerformance.enabled)
            return;
        const performance_mark = mark instanceof PerformanceMark ? mark : globalThis.performance.getEntriesByName(mark, 'mark')[0];
        const mark_name = performance_mark.name;
        const name = performance_mark.detail.name;
        if (!performance_mark.detail.group)
            throw new Error("Performance mark has no assigned measurment group");
        const duration = globalThis.performance.measure(mark_name, mark_name).duration;
        const group = this.#measurements_groups.get(performance_mark.detail.group);
        const count = ++group[this.MEAS_COUNT][name];
        group[name] = group[name] + (duration - group[name]) / count;
        return group;
    }
}
globalThis.performance?.mark("runtime_start");
globalThis.DatexRuntimePerformance = DatexRuntimePerformance;
BigInt.prototype.toJSON = function () { return globalThis.String(this) + "n"; };
Symbol.prototype.toJSON = function () { return globalThis.String(this); };
import { DatexCompiler, DatexProtocolDataType, Regex, BinaryCode, PrecompiledDXB } from "./datex_compiler.js";
import "./lib/marked.js";
const client_type = globalThis.process?.release?.name ? 'node' : 'browser';
let datex_storage;
let datex_item_storage;
let datex_pointer_storage;
let localStorage = globalThis.localStorage;
const site_suffix = globalThis.location?.pathname ?? '';
if (client_type == "node") {
    const node_localstorage = (await import("node-localstorage")).default.LocalStorage;
    datex_storage = new node_localstorage('.datex');
    localStorage = new node_localstorage('./.datex-cache');
}
else {
    const localforage = (await import("./lib/localforage/localforage.js")).default;
    datex_storage = localforage.createInstance({ name: "dx::" + site_suffix });
    datex_item_storage = localforage.createInstance({ name: "dxitem::" + site_suffix });
    datex_pointer_storage = localforage.createInstance({ name: "dxptr::" + site_suffix });
}
globalThis.storage = datex_storage;
globalThis.datex_storage = datex_item_storage;
globalThis.datex_pointer_storage = datex_pointer_storage;
if (client_type == 'browser' && !globalThis.crypto)
    throw new Error("The Web Crypto API is required for the DATEX Runtime");
const crypto = globalThis.crypto ?? (await import("crypto")).webcrypto;
if (!crypto)
    throw new Error("Newer version of node crypto library required");
const fetch = client_type == "browser" ? globalThis.fetch : (await import("node-fetch")).default;
const fs = client_type == "node" ? (await import("fs")).default : null;
export const ReadableStream = (globalThis.ReadableStream ?? (await import("node-web-streams")).ReadableStream);
DatexRuntimePerformance.marker("module loading time", "modules_loaded", "runtime_start");
const ReadableStreamDefaultReader = globalThis.ReadableStreamDefaultReader ?? class {
};
const NodeBuffer = globalThis.Buffer || class {
};
export const btoa = typeof globalThis.btoa !== 'undefined' ? globalThis.btoa : (b) => NodeBuffer.from(b).toString('base64');
export const atob = typeof globalThis.atob !== 'undefined' ? globalThis.atob : (base64) => NodeBuffer.from(base64, 'base64').toString('binary');
export function arrayBufferToBase64(buffer) {
    let binary = '';
    let bytes = new Uint8Array(buffer);
    let len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += globalThis.String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
export function base64ToArrayBuffer(base64) {
    let binary_string = atob(base64);
    let len = binary_string.length;
    let bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}
export const TypedArray = Object.getPrototypeOf(Uint8Array);
export class Observers {
    static #observers = new WeakMap();
    static register(parent, key) {
        if (!this.#observers.has(parent))
            this.#observers.set(parent, new Map());
        const observers = this.#observers.get(parent);
        if (!observers.has(key))
            observers.set(key, new Set());
    }
    static add(parent, key, observer) {
        if (!this.#observers.has(parent))
            this.#observers.set(parent, new Map());
        const observers = this.#observers.get(parent);
        if (!observers.has(key))
            observers.set(key, new Set());
        observers.get(key).add(observer);
    }
    static call(parent, key, ...args) {
        if (!this.#observers.has(parent))
            throw Error("Observers for this object do not exist");
        const observers = this.#observers.get(parent);
        if (!observers.has(key))
            throw Error("Observers for this key do not exist");
        for (let o of observers.get(key))
            o(...args);
    }
    static callAsync(parent, key, ...args) {
        if (!this.#observers.has(parent))
            throw Error("Observers for this object do not exist");
        const observers = this.#observers.get(parent);
        if (!observers.has(key))
            throw Error("Observers for this key do not exist");
        const promises = [];
        for (let o of observers.get(key))
            promises.push(o(...args));
        return Promise.all(promises);
    }
    static clear(parent, key, observer) {
        if (!this.#observers.has(parent))
            throw Error("Observers for this object do not exist");
        if (key === undefined)
            this.#observers.delete(parent);
        else {
            const observers = this.#observers.get(parent);
            if (!observers.has(key))
                throw Error("Observers for this key do not exist");
            if (observer) {
                observers.get(key).delete(observer);
            }
            else {
                observers.delete(key);
            }
        }
    }
}
const DEFAULT_CLASS = Symbol('DEFAULT_CLASS');
const DEFAULT_IS_CLASS = Symbol('DEFAULT_IS_CLASS');
const DEFAULT_CLASS_PRIMITIVE = Symbol('DEFAULT_CLASS_PRIMITIVE');
const DEFAULT_CREATOR_FUNCTION = Symbol('DEFAULT_CREATOR_FUNCTION');
const DEFAULT_VALUE = Symbol('DEFAULT_VALUE');
Map.prototype.setAutoDefault = function (default_class_or_creator_function_or_value) {
    if (typeof default_class_or_creator_function_or_value === "function" && default_class_or_creator_function_or_value.prototype !== undefined) {
        this[DEFAULT_CLASS] = default_class_or_creator_function_or_value;
        this[DEFAULT_IS_CLASS] = true;
        this[DEFAULT_CLASS_PRIMITIVE] = this[DEFAULT_CLASS] == String || this[DEFAULT_CLASS] == Number || this[DEFAULT_CLASS] == BigInt || this[DEFAULT_CLASS] == Boolean;
    }
    else if (typeof default_class_or_creator_function_or_value === "function") {
        this[DEFAULT_CREATOR_FUNCTION] = default_class_or_creator_function_or_value;
    }
    else
        this[DEFAULT_VALUE] = default_class_or_creator_function_or_value;
    return this;
};
Map.prototype.getAuto = function (key) {
    if (!this.has(key))
        this.set(key, this[DEFAULT_CREATOR_FUNCTION] ?
            this[DEFAULT_CREATOR_FUNCTION]() :
            (this[DEFAULT_IS_CLASS] ?
                (this[DEFAULT_CLASS_PRIMITIVE] ?
                    (this[DEFAULT_CLASS_PRIMITIVE] == BigInt ?
                        this[DEFAULT_CLASS](0) :
                        this[DEFAULT_CLASS]()) :
                    new this[DEFAULT_CLASS]()) :
                this[DEFAULT_VALUE]));
    return this.get(key);
};
export var Datex;
(function (Datex) {
    class Storage {
        static cache = new Map();
        static state_prefix = "dxstate::" + site_suffix + "::";
        static pointer_prefix = "dxptr::" + site_suffix + "::";
        static item_prefix = "dxitem::" + site_suffix + "::";
        static label_prefix = "dxlbl::" + site_suffix + "::";
        static #location;
        static get location() { return this.#location; }
        static set location(location) {
            if (client_type == "browser" && Storage.mode == Storage.Mode.SAVE_ON_EXIT && location == Storage.Location.DATABASE)
                throw new Datex.Error("Invalid DATEX Storage location: DATABASE with SAVE_ON_EXIT mode");
            this.#location = location;
        }
        static #mode;
        static set mode(mode) {
            this.#mode = mode;
            if (Storage.mode == Storage.Mode.SAVE_ON_EXIT) {
                if (client_type == "browser") {
                    addEventListener("beforeunload", () => {
                        console.log(`Page exit. Saving DATEX Values in cache...`);
                        this.updateLocalStorage();
                    }, { capture: true });
                }
                else {
                    process.on('exit', (code) => {
                        console.log(`Process exit: ${code}. Saving DATEX Values in cache...`);
                        this.updateLocalStorage();
                    });
                    process.on('SIGINT', () => process.exit());
                }
            }
        }
        static get mode() {
            return this.#mode;
        }
        static #exit_without_save = false;
        static allowExitWithoutSave() {
            this.#exit_without_save = true;
        }
        static updateLocalStorage() {
            if (this.#exit_without_save) {
                console.log(`Exiting without save`);
                return;
            }
            for (let [key, val] of Storage.cache) {
                this.setItem(key, val);
            }
            for (let ptr of this.#local_storage_active_pointers) {
                this.setPointer(ptr);
            }
            for (let id of this.#local_storage_active_pointer_ids) {
                this.setPointer(Pointer.get(id));
            }
        }
        static setItem(key, value, listen_for_pointer_changes = true) {
            Storage.cache.set(key, value);
            const pointer = value instanceof Pointer ? value : Pointer.getByValue(value);
            if (this.location == Storage.Location.DATABASE)
                return this.setItemDB(key, value, pointer, listen_for_pointer_changes);
            else if (this.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE)
                return this.setItemLocalStorage(key, value, pointer, listen_for_pointer_changes);
        }
        static setItemLocalStorage(key, value, pointer, listen_for_pointer_changes = true) {
            if (pointer) {
                let res = this.setPointer(pointer, listen_for_pointer_changes);
                if (!res)
                    return false;
            }
            logger.debug("storing item in local storage: " + key);
            localStorage.setItem(this.item_prefix + key, DatexCompiler.encodeValueBase64(value));
            return true;
        }
        static async setItemDB(key, value, pointer, listen_for_pointer_changes = true) {
            if (pointer) {
                let res = await this.setPointer(pointer, listen_for_pointer_changes);
                if (!res)
                    return false;
            }
            logger.debug("storing item in db storage: " + key);
            await datex_item_storage.setItem(key, DatexCompiler.encodeValue(value));
            return true;
        }
        static setPointer(pointer, listen_for_changes = true) {
            if (this.location == Storage.Location.DATABASE)
                return this.setPointerDB(pointer, listen_for_changes);
            else if (this.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE)
                return this.setPointerLocalStorage(pointer, listen_for_changes);
        }
        static #local_storage_active_pointers = new Set();
        static #local_storage_active_pointer_ids = new Set();
        static setPointerLocalStorage(pointer, listen_for_changes = true) {
            logger.debug("storing pointer in local storage: " + pointer);
            const serialized_value = pointer.getSerializedValue();
            const inserted_ptrs = new Set();
            localStorage.setItem(this.pointer_prefix + pointer.id, DatexCompiler.encodeValueBase64(serialized_value, inserted_ptrs, true));
            for (let ptr of inserted_ptrs) {
                if (ptr != pointer && ptr.is_origin && !localStorage.getItem(this.pointer_prefix + ptr.id))
                    this.setPointer(ptr, listen_for_changes);
            }
            this.#local_storage_active_pointers.add(pointer);
            return true;
        }
        static async setPointerDB(pointer, listen_for_changes = true) {
            if (this.synced_pointers.has(pointer))
                return;
            logger.debug("storing pointer in db storage: " + pointer);
            const serialized_value = pointer.getSerializedValue();
            const inserted_ptrs = new Set();
            await datex_pointer_storage.setItem(pointer.id, DatexCompiler.encodeValue(serialized_value, inserted_ptrs, true));
            for (let ptr of inserted_ptrs) {
                if (ptr != pointer && ptr.is_origin && !await this.hasPointer(ptr))
                    await this.setPointer(ptr, listen_for_changes);
            }
            if (listen_for_changes)
                this.syncPointer(pointer);
            return true;
        }
        static synced_pointers = new Set();
        static syncPointer(pointer) {
            if (this.mode != Storage.Mode.SAVE_AUTOMATICALLY)
                return;
            if (!pointer) {
                logger.error("tried to sync non-existing pointer with storage");
                return;
            }
            if (this.synced_pointers.has(pointer))
                return;
            this.synced_pointers.add(pointer);
            const serialized_value = pointer.getSerializedValue();
            pointer.observe(async () => {
                const inserted_ptrs = new Set();
                datex_pointer_storage.setItem(pointer.id, DatexCompiler.encodeValue(serialized_value, inserted_ptrs, true));
                for (let ptr of inserted_ptrs) {
                    this.setPointer(ptr);
                }
            });
        }
        static async hasPointer(pointer) {
            if (this.location == Storage.Location.DATABASE)
                return (await datex_pointer_storage.getItem(pointer.id)) !== null;
            else if (this.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE)
                return localStorage.getItem(this.pointer_prefix + pointer.id) != null;
        }
        static getPointer(pointer_id, pointerify) {
            if (this.location == Storage.Location.DATABASE)
                return this.getPointerDB(pointer_id, pointerify);
            else if (this.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE)
                return this.getPointerLocalStorage(pointer_id, pointerify);
        }
        static async getPointerLocalStorage(pointer_id, pointerify) {
            let pointer;
            if (pointerify && (pointer = Pointer.get(pointer_id)))
                return pointer.value;
            let base64 = localStorage.getItem(this.pointer_prefix + pointer_id);
            if (base64 == null)
                return Datex.NOT_EXISTING;
            const val = await Runtime.decodeValueBase64(base64);
            if (pointerify) {
                const pointer = Pointer.create(pointer_id, val, false, Runtime.endpoint);
                this.#local_storage_active_pointers.add(pointer);
                if (pointer instanceof PrimitivePointer)
                    return pointer;
                else
                    return pointer.value;
            }
            else {
                this.#local_storage_active_pointer_ids.add(pointer_id);
                return val;
            }
        }
        static async getPointerDB(pointer_id, pointerify) {
            let pointer;
            if (pointerify && (pointer = Pointer.get(pointer_id)))
                return pointer.value;
            let buffer = await datex_pointer_storage.getItem(pointer_id);
            if (buffer == null)
                return Datex.NOT_EXISTING;
            const val = await Runtime.decodeValue(buffer);
            if (pointerify) {
                const pointer = Pointer.create(pointer_id, val, false, Runtime.endpoint);
                this.syncPointer(pointer);
                if (pointer instanceof PrimitivePointer)
                    return pointer;
                else
                    return pointer.value;
            }
            else
                return val;
        }
        static async removePointer(pointer_id) {
            if (Storage.location == Storage.Location.DATABASE) {
                await datex_pointer_storage.removeItem(pointer_id);
            }
            else if (Storage.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) {
                localStorage.removeItem(this.pointer_prefix + pointer_id);
            }
        }
        static async getPointerDecompiled(key) {
            if (Storage.location == Storage.Location.DATABASE) {
                let buffer = await datex_pointer_storage.getItem(key);
                if (buffer == null)
                    return null;
                return Runtime.decompile(buffer, true, false, true, false);
            }
            else if (Storage.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) {
                const base64 = localStorage.getItem(this.pointer_prefix + key);
                if (base64 == null)
                    return null;
                return Runtime.decompile(base64ToArrayBuffer(base64), true, false, true, false);
            }
        }
        static async getItemDecompiled(key) {
            if (Storage.location == Storage.Location.DATABASE) {
                let buffer = await datex_item_storage.getItem(key);
                if (buffer == null)
                    return null;
                return Runtime.decompile(buffer, true, false, true, false);
            }
            else if (Storage.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) {
                const base64 = localStorage.getItem(this.item_prefix + key);
                if (base64 == null)
                    return null;
                return Runtime.decompile(base64ToArrayBuffer(base64), true, false, true, false);
            }
        }
        static async getItemKeys() {
            if (Storage.location == Storage.Location.DATABASE)
                return await datex_item_storage.keys();
            else if (Storage.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) {
                const keys = [];
                for (let key of Object.keys(localStorage)) {
                    if (key.startsWith(this.item_prefix))
                        keys.push(key.replace(this.item_prefix, ""));
                }
                return keys;
            }
        }
        static async getPointerKeys() {
            if (Storage.location == Storage.Location.DATABASE)
                return await datex_pointer_storage.keys();
            else if (Storage.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) {
                const keys = [];
                for (let key of Object.keys(localStorage)) {
                    if (key.startsWith(this.pointer_prefix))
                        keys.push(key.replace(this.pointer_prefix, ""));
                }
                return keys;
            }
        }
        static async getItem(key) {
            let val;
            if (Storage.cache.has(key))
                return Storage.cache.get(key);
            else if (Storage.location == Storage.Location.DATABASE) {
                let buffer = await datex_item_storage.getItem(key);
                if (buffer == null)
                    return null;
                val = await Runtime.decodeValue(buffer);
            }
            else if (Storage.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) {
                const base64 = localStorage.getItem(this.item_prefix + key);
                if (base64 == null)
                    return null;
                val = await Runtime.decodeValueBase64(base64);
            }
            Storage.cache.set(key, val);
            return val;
        }
        static async hasItem(key) {
            if (Storage.cache.has(key))
                return true;
            else if (Storage.location == Storage.Location.DATABASE) {
                return (await datex_item_storage.getItem(key) != null);
            }
            else if (Storage.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) {
                return localStorage.getItem(this.item_prefix + key) != null;
            }
            return false;
        }
        static async removeItem(key) {
            if (Storage.cache.has(key))
                Storage.cache.delete(key);
            if (Storage.location == Storage.Location.DATABASE) {
                await datex_item_storage.removeItem(key);
            }
            else if (Storage.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) {
                await localStorage.removeItem(this.item_prefix + key);
            }
        }
        static async clear() {
            await datex_item_storage?.clear();
            await datex_pointer_storage?.clear();
            await datex_storage?.clear();
            for (let key of Object.keys(localStorage)) {
                if (key.startsWith(this.item_prefix) || key.startsWith(this.pointer_prefix) || key.startsWith(this.label_prefix))
                    localStorage.removeItem(key);
            }
        }
        static async loadOrCreate(id, create) {
            const state_name = this.state_prefix + id.toString();
            if (await this.hasItem(state_name)) {
                return await this.getItem(state_name);
            }
            else if (create) {
                const state = pointer(await create());
                await this.setItem(state_name, state, true);
                return state;
            }
            else
                throw new Error("Cannot find or create the state '" + id + "'");
        }
        static async setConfigValue(key, value) {
            await datex_storage.setItem(key, Datex.Runtime.valueToDatexStringExperimental(value));
        }
        static async getConfigValue(key) {
            const datex = await datex_storage.getItem(key);
            if (typeof datex != "string" || !datex)
                return null;
            else
                return Datex.Runtime.executeDatexLocally(datex);
        }
        static async hasConfigValue(key) {
            return (await datex_storage.getItem(key)) != null;
        }
    }
    Datex.Storage = Storage;
    (function (Storage) {
        let Mode;
        (function (Mode) {
            Mode[Mode["SAVE_ON_EXIT"] = 0] = "SAVE_ON_EXIT";
            Mode[Mode["SAVE_AUTOMATICALLY"] = 1] = "SAVE_AUTOMATICALLY";
        })(Mode = Storage.Mode || (Storage.Mode = {}));
        let Location;
        (function (Location) {
            Location[Location["DATABASE"] = 0] = "DATABASE";
            Location[Location["FILESYSTEM_OR_LOCALSTORAGE"] = 1] = "FILESYSTEM_OR_LOCALSTORAGE";
        })(Location = Storage.Location || (Storage.Location = {}));
    })(Storage = Datex.Storage || (Datex.Storage = {}));
    Storage.mode = Storage.Mode.SAVE_ON_EXIT;
    Storage.location = Storage.Location.FILESYSTEM_OR_LOCALSTORAGE;
    class DatexStoragePointerSource {
        getPointer(pointer_id, pointerify) {
            return Storage.getPointer(pointer_id, pointerify);
        }
        syncPointer(pointer) {
            return Storage.syncPointer(pointer);
        }
    }
    class Crypto {
        static public_keys = new Map();
        static public_keys_exported = new Map();
        static rsa_sign_key;
        static rsa_verify_key;
        static rsa_dec_key;
        static rsa_enc_key;
        static rsa_sign_key_exported;
        static rsa_verify_key_exported;
        static rsa_dec_key_exported;
        static rsa_enc_key_exported;
        static available = false;
        static sign_key_options = {
            name: "ECDSA",
            hash: { name: "SHA-384" },
        };
        static sign_key_generator = {
            name: "ECDSA",
            namedCurve: "P-384"
        };
        static enc_key_options = {
            name: "RSA-OAEP",
            modulusLength: 4096,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256"
        };
        static enc_key_import = {
            name: "RSA-OAEP",
            hash: "SHA-256"
        };
        static SIGN_BUFFER_SIZE = 96;
        static IV_BUFFER_SIZE = 16;
        static async sign(buffer) {
            if (!this.available)
                throw new SecurityError("Cannot sign DATEX requests, missing private keys");
            return await crypto.subtle.sign(this.sign_key_options, this.rsa_sign_key, buffer);
        }
        static async verify(data, signature, endpoint) {
            let keys = await this.getKeysForEndpoint(endpoint);
            if (!keys || !keys[0])
                return false;
            return await crypto.subtle.verify(this.sign_key_options, keys[0], signature, data);
        }
        static async encrypt(buffer, endpoint) {
            if (!this.available)
                throw new SecurityError("Cannot encrypt DATEX requests, missing private keys");
            let keys = await this.getKeysForEndpoint(endpoint);
            if (!keys || keys[1] == null)
                return null;
            return await crypto.subtle.encrypt("RSA-OAEP", keys[1], buffer);
        }
        static async decrypt(data) {
            return await crypto.subtle.decrypt("RSA-OAEP", this.rsa_dec_key, data);
        }
        static async encryptSymmetric(data, key) {
            let iv = crypto.getRandomValues(new Uint8Array(this.IV_BUFFER_SIZE));
            return [await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, data), iv];
        }
        static async decryptSymmetric(encrypted, key, iv) {
            try {
                return await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, encrypted);
            }
            catch (e) {
                throw new SecurityError("Invalid encrypted DATEX");
            }
        }
        static async encryptSymmetricKeyForEndpoint(key, endpoint) {
            let exported_key = await crypto.subtle.exportKey("raw", key);
            return this.encrypt(exported_key, endpoint);
        }
        static async extractEncryptedKey(encrypted) {
            let key_data = await this.decrypt(encrypted);
            return crypto.subtle.importKey("raw", key_data, "AES-GCM", true, ["encrypt", "decrypt"]);
        }
        static generateSymmetricKey() {
            return crypto.subtle.generateKey({
                name: "AES-GCM",
                length: 256
            }, true, ["encrypt", "decrypt"]);
        }
        static async getKeysForEndpoint(endpoint) {
            if (this.public_keys.has(endpoint))
                return this.public_keys.get(endpoint);
            else
                return this.requestKeys(endpoint);
        }
        static async bindKeys(endpoint, verify_key, enc_key) {
            if (!(endpoint instanceof Datex.Addresses.Endpoint))
                throw new ValueError("Invalid endpoint");
            if (verify_key && !(verify_key instanceof ArrayBuffer))
                throw new ValueError("Invalid verify key");
            if (enc_key && !(enc_key instanceof ArrayBuffer))
                throw new ValueError("Invalid encryption key");
            if (this.public_keys.has(endpoint))
                return false;
            try {
                this.public_keys.set(endpoint, [
                    verify_key ? await Crypto.importVerifyKey(verify_key) : null,
                    enc_key ? await Crypto.importEncKey(enc_key) : null
                ]);
                this.public_keys_exported.set(endpoint, [verify_key, enc_key]);
                await Datex.Storage.setItem("keys_" + endpoint, [verify_key, enc_key]);
                return true;
            }
            catch (e) {
                logger.error(e);
                throw new Error("Could not register keys for endpoint " + endpoint + " (invalid keys or no permisssion)");
            }
        }
        static #waiting_key_requests = new Map();
        static async requestKeys(endpoint) {
            if (this.#waiting_key_requests.has(endpoint))
                return this.#waiting_key_requests.get(endpoint);
            let keyPromise;
            this.#waiting_key_requests.set(endpoint, keyPromise = new Promise(async (resolve, reject) => {
                let exported_keys;
                if (exported_keys = await Datex.Storage.getItem("keys_" + endpoint)) {
                    logger.info("getting keys from cache for " + endpoint);
                }
                if (!exported_keys) {
                    logger.info("requesting keys for " + endpoint);
                    exported_keys = await NetworkUtils.get_keys(endpoint);
                    if (exported_keys)
                        await Datex.Storage.setItem("keys_" + endpoint, exported_keys);
                    else {
                        reject(new Error("could not get keys from network"));
                        this.#waiting_key_requests.delete(endpoint);
                        return;
                    }
                }
                try {
                    let keys = [await this.importVerifyKey(exported_keys[0]) || null, await this.importEncKey(exported_keys[1]) || null];
                    this.public_keys.set(endpoint, keys);
                    resolve(keys);
                    this.#waiting_key_requests.delete(endpoint);
                    return;
                }
                catch (e) {
                    reject(new Error("Error importing keys"));
                    await Datex.Storage.removeItem("keys_" + endpoint);
                    this.#waiting_key_requests.delete(endpoint);
                    return;
                }
            }));
            return keyPromise;
        }
        static async loadOwnKeys(verify_key, sign_key, enc_key, dec_key) {
            if (verify_key instanceof ArrayBuffer) {
                this.rsa_verify_key_exported = verify_key;
                this.rsa_verify_key = await this.importVerifyKey(this.rsa_verify_key_exported);
            }
            else {
                this.rsa_verify_key_exported = await this.exportPublicKey(verify_key);
                this.rsa_verify_key = verify_key;
            }
            if (sign_key instanceof ArrayBuffer) {
                this.rsa_sign_key_exported = sign_key;
                this.rsa_sign_key = await this.importSignKey(this.rsa_sign_key_exported);
            }
            else {
                this.rsa_sign_key_exported = await this.exportPrivateKey(sign_key);
                this.rsa_sign_key = sign_key;
            }
            if (enc_key instanceof ArrayBuffer) {
                this.rsa_enc_key_exported = enc_key;
                this.rsa_enc_key = await this.importEncKey(this.rsa_enc_key_exported);
            }
            else {
                this.rsa_enc_key_exported = await this.exportPublicKey(enc_key);
                this.rsa_enc_key = enc_key;
            }
            if (dec_key instanceof ArrayBuffer) {
                this.rsa_dec_key_exported = dec_key;
                this.rsa_dec_key = await this.importDecKey(this.rsa_dec_key_exported);
            }
            else {
                this.rsa_dec_key_exported = await this.exportPrivateKey(dec_key);
                this.rsa_dec_key = dec_key;
            }
            this.saveOwnPublicKeysInEndpointKeyMap();
            this.available = true;
            return [this.rsa_verify_key_exported, this.rsa_sign_key_exported, this.rsa_enc_key_exported, this.rsa_dec_key_exported];
        }
        static saveOwnPublicKeysInEndpointKeyMap() {
            if (!this.public_keys.has(Runtime.endpoint))
                this.public_keys.set(Runtime.endpoint, [null, null]);
            this.public_keys.get(Runtime.endpoint)[0] = this.rsa_verify_key;
            this.public_keys.get(Runtime.endpoint)[1] = this.rsa_enc_key;
        }
        static getOwnPublicKeysExported() {
            return [this.rsa_verify_key_exported, this.rsa_enc_key_exported];
        }
        static getOwnPublicKeys() {
            return [this.rsa_verify_key, this.rsa_enc_key];
        }
        static getOwnPrivateKeysExported() {
            return [this.rsa_sign_key_exported, this.rsa_dec_key_exported];
        }
        static getOwnPrivateKeys() {
            return [this.rsa_sign_key, this.rsa_dec_key];
        }
        static async getEndpointPublicKeys(endpoint) {
            let keys;
            if (this.public_keys.has(endpoint))
                keys = this.public_keys.get(endpoint);
            else
                throw new Error("No public keys available for this endpoint");
            return [
                keys[0] ? await this.exportPublicKey(keys[0]) : null,
                keys[1] ? await this.exportPublicKey(keys[1]) : null
            ];
        }
        static async getEndpointPublicKeys2(endpoint) {
            if (this.public_keys_exported.has(endpoint))
                return this.public_keys_exported.get(endpoint);
            else
                throw new Error("No public keys available for this endpoint");
        }
        static async createOwnKeys() {
            let enc_key_pair = await crypto.subtle.generateKey(this.enc_key_options, true, ["encrypt", "decrypt"]);
            let sign_key_pair = await crypto.subtle.generateKey(this.sign_key_generator, true, ["sign", "verify"]);
            this.rsa_dec_key = enc_key_pair.privateKey;
            this.rsa_enc_key = enc_key_pair.publicKey;
            this.rsa_sign_key = sign_key_pair.privateKey;
            this.rsa_verify_key = sign_key_pair.publicKey;
            this.rsa_enc_key_exported = await this.exportPublicKey(this.rsa_enc_key);
            this.rsa_dec_key_exported = await this.exportPrivateKey(this.rsa_dec_key);
            this.rsa_verify_key_exported = await this.exportPublicKey(this.rsa_verify_key);
            this.rsa_sign_key_exported = await this.exportPrivateKey(this.rsa_sign_key);
            this.saveOwnPublicKeysInEndpointKeyMap();
            this.available = true;
            return {
                sign: [this.rsa_verify_key_exported, this.rsa_sign_key_exported],
                encrypt: [this.rsa_enc_key_exported, this.rsa_dec_key_exported]
            };
        }
        static async exportPublicKeyBase64(key) {
            return btoa(globalThis.String.fromCharCode.apply(null, new Uint8Array(await this.exportPublicKey(key))));
        }
        static async exportPrivateKeyBase64(key) {
            return btoa(globalThis.String.fromCharCode.apply(null, new Uint8Array(await this.exportPrivateKey(key))));
        }
        static async exportPublicKey(key) {
            return crypto.subtle.exportKey("spki", key);
        }
        static async exportPrivateKey(key) {
            return crypto.subtle.exportKey("pkcs8", key);
        }
        static async importSignKey(key) {
            let key_buffer = key instanceof ArrayBuffer ? new Uint8Array(key) : Uint8Array.from(atob(key), c => c.charCodeAt(0)).buffer;
            return await crypto.subtle.importKey("pkcs8", key_buffer, this.sign_key_generator, true, ["sign"]);
        }
        static async importDecKey(key) {
            let key_buffer = key instanceof ArrayBuffer ? new Uint8Array(key) : Uint8Array.from(atob(key), c => c.charCodeAt(0)).buffer;
            return await crypto.subtle.importKey("pkcs8", key_buffer, this.enc_key_import, true, ["decrypt"]);
        }
        static async importVerifyKey(key) {
            let key_buffer = key instanceof ArrayBuffer ? new Uint8Array(key) : Uint8Array.from(atob(key), c => c.charCodeAt(0)).buffer;
            return await crypto.subtle.importKey("spki", key_buffer, this.sign_key_generator, true, ["verify"]);
        }
        static async importEncKey(key) {
            let key_buffer = key instanceof ArrayBuffer ? new Uint8Array(key) : Uint8Array.from(atob(key), c => c.charCodeAt(0));
            return await crypto.subtle.importKey("spki", key_buffer, this.enc_key_import, true, ["encrypt"]);
        }
    }
    Datex.Crypto = Crypto;
    class NetworkUtils {
        static _get_keys;
        static get_keys(endpoint) {
            if (!this._get_keys)
                this._get_keys = getProxyFunction("get_keys", { scope_name: "network", sign: false, filter: Runtime.main_node });
            return this._get_keys(endpoint);
        }
        static _add_push_channel;
        static add_push_channel(channel, data) {
            if (!this._add_push_channel)
                this._add_push_channel = getProxyFunction("add_push_channel", { scope_name: "network", sign: false, filter: Runtime.main_node });
            return this._add_push_channel(channel, data);
        }
    }
    Datex.NetworkUtils = NetworkUtils;
    const iterateMapReverse = function () {
        const values = Array.from(this.entries());
        let index = values.length;
        return {
            next: function () {
                return {
                    done: index === 0,
                    value: values[--index]
                };
            }
        };
    };
    const iterateSetReverse = function () {
        const values = Array.from(this.values());
        let index = values.length;
        return {
            next: function () {
                return {
                    done: index === 0,
                    value: values[--index]
                };
            }
        };
    };
    class JSInterface {
        static configurations_by_type = new Map();
        static configurations_by_class = new Map();
        static configurations_by_prototype = new Map();
        static configurations_loaders_by_namespace = new Map();
        static async loadTypeConfiguration(type) {
            if (JSInterface.configurations_by_type.has(type))
                return true;
            else {
                if (JSInterface.configurations_loaders_by_namespace.has(type.namespace)) {
                    const config = await JSInterface.configurations_loaders_by_namespace.get(type.namespace)(type);
                    if (typeof config == "boolean")
                        return config;
                    else if (config)
                        type.setJSInterface(config);
                    else
                        return false;
                    return true;
                }
                else
                    return false;
            }
        }
        static typeConfigurationLoader(namespace, loader) {
            if (namespace instanceof Array) {
                for (let n of namespace)
                    JSInterface.configurations_loaders_by_namespace.set(n, loader);
            }
            else
                JSInterface.configurations_loaders_by_namespace.set(namespace, loader);
        }
        static async getClassForType(type) {
            if (!JSInterface.loadTypeConfiguration(type))
                throw new TypeError("Could not load type " + type);
            else
                return JSInterface.configurations_by_type.get(type).class;
        }
        static updateJSInterfaceConfiguration(type, key, value) {
            let config = JSInterface.configurations_by_type.get(type);
            if (!config) {
                config = {};
                JSInterface.configurations_by_type.set(type, config);
            }
            else {
                config[key] = value;
            }
            JSInterface.handleConfigUpdate(type, config);
        }
        static handleConfigUpdate(type, config) {
            if (!type)
                throw new Error("A type is required for a type configuration");
            if (!config.class && !config.prototype)
                throw new Error("The  'class' or 'prototype' property is required for a type configuration");
            config.__type = type;
            JSInterface.configurations_by_type.set(type, config);
            if (config.prototype)
                JSInterface.configurations_by_prototype.set(config.prototype, config);
            if (config.class)
                JSInterface.configurations_by_class.set(config.class, config);
        }
        static applyMethod(type, parent, method_name, args) {
            const config = this.configurations_by_type.get(type);
            if (!config)
                return Datex.NOT_EXISTING;
            if (config.is_normal_object && !(method_name in config))
                return Datex.NOT_EXISTING;
            if (config.detect_class instanceof globalThis.Function && !config.detect_class(parent))
                return Datex.NOT_EXISTING;
            if (config[method_name] instanceof globalThis.Function)
                return config[method_name](...args);
            return Datex.INVALID;
        }
        static hasPseudoClass(value) {
            for (let [_class, config] of this.configurations_by_class) {
                if (value instanceof _class) {
                    if (config.detect_class instanceof globalThis.Function && !config.detect_class(value))
                        return false;
                    return true;
                }
            }
            for (let [proto, config] of this.configurations_by_prototype) {
                if (proto.isPrototypeOf(value)) {
                    if (config.detect_class instanceof globalThis.Function && !config.detect_class(value))
                        return false;
                    return true;
                }
            }
            return false;
        }
        static handleSetProperty(parent, key, value, type = Type.getValueDatexType(parent)) {
            return this.applyMethod(type, parent, "set_property", [parent, key, value]);
        }
        static handleCount(parent, type = Type.getValueDatexType(parent)) {
            return this.applyMethod(type, parent, "count", [parent]);
        }
        static handleHasProperty(parent, property, type = Type.getValueDatexType(parent)) {
            return this.applyMethod(type, parent, "has_property", [parent, property]);
        }
        static handleGetProperty(parent, key, type = Type.getValueDatexType(parent)) {
            return this.applyMethod(type, parent, "get_property", [parent, key]);
        }
        static handlePropertyAction(action_type, parent, value, type = Type.getValueDatexType(parent)) {
            return this.applyMethod(type, parent, "property_action", [action_type, parent, value]);
        }
        static handleDeleteProperty(parent, value, type = Type.getValueDatexType(parent)) {
            return this.applyMethod(type, parent, "delete_property", [parent, value]);
        }
        static handleGetAllValues(parent, type = Type.getValueDatexType(parent)) {
            return this.applyMethod(type, parent, "values", [parent]);
        }
        static handleClear(parent, type = Type.getValueDatexType(parent)) {
            return this.applyMethod(type, parent, "clear", [parent]);
        }
        static handleKeys(parent, type = Type.getValueDatexType(parent)) {
            return this.applyMethod(type, parent, "keys", [parent]);
        }
        static serializeValue(value, type = Type.getValueDatexType(value)) {
            return this.applyMethod(type, value, "serialize", [value]);
        }
        static createProxy(value, pointer, type = Type.getValueDatexType(value)) {
            return this.applyMethod(type, value, "create_proxy", [value, pointer]);
        }
        static handleSetPropertySilently(parent, key, value, pointer, type = Type.getValueDatexType(parent)) {
            return this.applyMethod(type, parent, "set_property_silently", [parent, key, value, pointer]);
        }
        static handlePropertyActionSilently(action_type, parent, value, pointer, type = Type.getValueDatexType(parent)) {
            return this.applyMethod(type, parent, "property_action_silently", [action_type, parent, value, pointer]);
        }
        static handleDeletePropertySilently(parent, key, pointer, type = Type.getValueDatexType(parent)) {
            return this.applyMethod(type, parent, "delete_property_silently", [parent, key, pointer]);
        }
        static handleClearSilently(parent, pointer, type = Type.getValueDatexType(parent)) {
            return this.applyMethod(type, parent, "clear_silently", [parent, pointer]);
        }
        static getValueDatexType(value) {
            for (let [_class, config] of this.configurations_by_class) {
                if (value instanceof _class) {
                    return config.get_type ? config.get_type(value) : config.__type;
                }
            }
            for (let [proto, config] of this.configurations_by_prototype) {
                if (proto.isPrototypeOf(value)) {
                    return config.get_type ? config.get_type(value) : config.__type;
                }
            }
            for (let [_class, config] of this.configurations_by_class) {
                if (config.detect_class instanceof globalThis.Function && config.detect_class(value)) {
                    return config.get_type ? config.get_type(value) : config.__type;
                }
            }
        }
        static getClassDatexType(class_constructor) {
            let config;
            if (config = this.configurations_by_class.get(class_constructor))
                return config.__type;
            if (config = this.configurations_by_class.get(Object.getPrototypeOf(class_constructor)))
                return config.__type;
        }
    }
    JSInterface.configurations_by_class[Symbol.iterator] = iterateMapReverse;
    JSInterface.configurations_by_type[Symbol.iterator] = iterateSetReverse;
    JSInterface.configurations_by_prototype[Symbol.iterator] = iterateMapReverse;
    Datex.typeConfigurationLoader = JSInterface.typeConfigurationLoader;
    Datex.updateJSInterfaceConfiguration = JSInterface.updateJSInterfaceConfiguration;
    function DX_CLASS(type) {
        return JSInterface.getClassForType(type instanceof Type ? type : Type.get(type));
    }
    Datex.DX_CLASS = DX_CLASS;
    class IOHandler {
        static std_out = async (data) => {
            for (let d = 0; d < data.length; d++) {
                data[d] = await Runtime.castValue(Type.std.String, data[d]);
            }
            client_type == "browser" ? console.log(...data) : console.log("\n std/print > ", ...data, "\n");
        };
        static std_outf = (data) => {
            client_type == "browser" ? console.log(...data) : console.log("\n std/printf > ", ...data.map(v => Runtime.valueToDatexString(v)), "\n");
        };
        static std_in = () => { throw new RuntimeError("No input available"); };
        static e_std_outs = new Map();
        static e_std_outfs = new Map();
        ;
        static e_std_ins = new Map();
        static datex_in_handler;
        static datex_in_handlers_per_endpoint = new Map();
        static datex_out_handler;
        static datex_out_handlers_per_endpoint = new Map();
        static scope_result_listeners = new Map();
        static setStdOut(output_callback, endpoint) {
            if (endpoint)
                this.e_std_outs.set(endpoint, output_callback);
            else
                this.std_out = output_callback;
        }
        static setStdOutF(output_callback, endpoint) {
            if (endpoint)
                this.e_std_outfs.set(endpoint, output_callback);
            else
                this.std_outf = output_callback;
        }
        static setStdIn(output_callback, endpoint) {
            if (endpoint)
                this.e_std_ins.set(endpoint, output_callback);
            else
                this.std_in = output_callback;
        }
        static onDatexReceived(handler, endpoint) {
            if (endpoint)
                this.datex_in_handlers_per_endpoint.set(endpoint, handler);
            else
                this.datex_in_handler = handler;
        }
        static onDatexSent(handler, endpoint) {
            if (endpoint)
                this.datex_out_handlers_per_endpoint.set(endpoint, handler);
            else
                this.datex_out_handler = handler;
        }
        static addScopeResultListener(sid, output_callback) {
            this.scope_result_listeners.set(sid, output_callback);
        }
        static async stdOutF(params, endpoint) {
            if (this.e_std_outfs.has(endpoint))
                await this.e_std_outfs.get(endpoint)(params);
            else if (this.std_outf)
                await this.std_outf(params);
        }
        static stdOut(params, endpoint) {
            if (this.e_std_outs.has(endpoint))
                this.e_std_outs.get(endpoint)(params);
            else if (this.std_out)
                this.std_out(params);
        }
        static async stdIn(msg_start, msg_end, endpoint) {
            if (this.e_std_ins.has(endpoint))
                return this.e_std_ins.get(endpoint)([msg_start, msg_end]);
            else
                return this.std_in([msg_start, msg_end]);
        }
        static handleDatexReceived(scope, dxb) {
            let endpoint = scope.sender;
            if (this.datex_in_handlers_per_endpoint.has(endpoint))
                this.datex_in_handlers_per_endpoint.get(endpoint)(scope.header, dxb);
            if (this.datex_in_handler)
                this.datex_in_handler(scope.header, dxb);
        }
        static async handleDatexSent(dxb, to) {
            if (this.datex_out_handler || this.datex_out_handlers_per_endpoint.has(to)) {
                let header = (await Runtime.parseHeader(dxb, null, true));
                if (this.datex_out_handler)
                    this.datex_out_handler(header, dxb);
                if (this.datex_out_handlers_per_endpoint.has(to))
                    this.datex_out_handlers_per_endpoint.get(to)(header, dxb);
            }
        }
        static handleScopeFinished(sid, scope) {
            if (this.scope_result_listeners.has(sid)) {
                this.scope_result_listeners.get(sid)(scope);
                this.scope_result_listeners.delete(sid);
            }
        }
    }
    Datex.IOHandler = IOHandler;
    class Markdown {
        content;
        constructor(content) {
            this.content = content;
        }
        toString() {
            return this.content;
        }
        static code_colorizer;
        static setCodeColorizer(code_colorizer) {
            this.code_colorizer = code_colorizer;
        }
        async getHTML() {
            if (!globalThis['$']) {
                throw new Error("JQuery not available");
            }
            let code = $("<code style='padding-left:10px;padding-right:10px;margin-top:10px;margin-bottom:10px'>" + marked(this.content) + "</code>");
            if (Markdown.code_colorizer) {
                for (let c of code.find("code")) {
                    let jc = $(c);
                    let lang = jc.attr("class")?.replace("language-", "") || "datex";
                    if (lang)
                        jc.html(await Markdown.code_colorizer(jc.text(), lang));
                }
            }
            return code;
        }
    }
    Datex.Markdown = Markdown;
    Datex.WITH = 'w';
    class Scope {
        internal_vars = [];
        compiled;
        parent_variables;
        _decompiled = "### DATEX ###";
        _decompiled_f = "### DATEX ###";
        constructor(internal_vars, compiled, generate_decompiled = true) {
            this.internal_vars = internal_vars;
            this.compiled = compiled;
            if (generate_decompiled) {
                this._decompiled_f = Runtime.decompile(this.compiled, false, true, false, false);
                this._decompiled = Runtime.decompile(this.compiled, false, false, true, false);
            }
        }
        async execute(variables, executed_by, context, it) {
            const header = {
                sender: executed_by,
                type: DatexProtocolDataType.LOCAL_REQ,
                executable: true,
                sid: DatexCompiler.generateSID()
            };
            const scope = Runtime.createNewInitialScope(header, variables, this.internal_vars, context, it);
            Runtime.updateScope(scope, this.compiled, header);
            return Runtime.simpleScopeExecution(scope);
        }
        get decompiled() {
            return this._decompiled;
        }
        get decompiled_formatted() {
            return this._decompiled_f;
        }
        bodyToString(formatted = false, parentheses = true, spaces = '  ') {
            return (parentheses ? '(' : '') + (formatted && parentheses ? "\n" : "") + (formatted ? this.decompiled_formatted?.replace(/^/gm, spaces) : this.decompiled).replace(/ *$/, '') + (parentheses ? ')' : '');
        }
        toString(formatted = false, spaces = '  ') {
            return `scope ${this.bodyToString(formatted, true, spaces)}`;
        }
    }
    Datex.Scope = Scope;
    class Stream {
        controller;
        readable_stream;
        constructor(readable_stream) {
            this.readable_stream = readable_stream ?? new ReadableStream({
                start: controller => this.controller = controller
            });
        }
        started_ptr_stream = false;
        write(chunk, scope) {
            if (chunk instanceof TypedArray)
                chunk = chunk.buffer;
            if (!this.started_ptr_stream && !scope) {
                this.started_ptr_stream = true;
                const ptr = Pointer.getByValue(this);
                if (ptr instanceof Pointer) {
                    console.log("Start stream out for " + ptr);
                    ptr.startStreamOut();
                }
            }
            this.controller.enqueue(chunk);
        }
        async pipe(in_stream, scope) {
            const reader = in_stream.getReader();
            let next;
            while (true) {
                next = await reader.read();
                if (next.done)
                    break;
                this.write(next.value, scope);
            }
        }
        close() {
            this.controller.close();
        }
        getReader() {
            let streams = this.readable_stream.tee();
            this.readable_stream = streams[1];
            return streams[0].getReader();
        }
    }
    Datex.Stream = Stream;
    class Value {
        #observers;
        #observers_bound_objects;
        #value;
        constructor(value) {
            value = Value.collapseValue(value);
            if (value != undefined)
                this.value = value;
        }
        get value() {
            return this.#value;
        }
        set value(value) {
            this.#value = Value.collapseValue(value);
            for (let o of this.#observers ?? []) {
                o(this.#value, Datex.VOID, Value.UPDATE_TYPE.INIT);
            }
            for (let [object, observers] of this.#observers_bound_objects ?? []) {
                for (let o of observers ?? []) {
                    o.call(object, this.#value, Datex.VOID, Value.UPDATE_TYPE.INIT);
                }
            }
        }
        static observe(value, handler, bound_object, key) {
            let pointer = Pointer.pointerifyValue(value);
            if (pointer instanceof Pointer)
                pointer.observe(handler, bound_object, key);
            else if (pointer instanceof Value)
                pointer.observe(handler, bound_object);
            else
                throw new ValueError("Cannot observe this value because it has no pointer");
        }
        static unobserve(value, handler, bound_object, key) {
            let pointer = Pointer.pointerifyValue(value);
            if (pointer instanceof Pointer)
                pointer.unobserve(handler, bound_object, key);
            else if (pointer instanceof Value)
                pointer.unobserve(handler, bound_object);
            else
                throw new ValueError("Cannot unobserve this value because it has no pointer");
        }
        observe(handler, bound_object) {
            if (!handler)
                throw new ValueError("Missing observer handler");
            if (bound_object) {
                if (!this.#observers_bound_objects)
                    this.#observers_bound_objects = new Map();
                if (!this.#observers_bound_objects.has(bound_object))
                    this.#observers_bound_objects.set(bound_object, new Set());
                this.#observers_bound_objects.get(bound_object).add(handler);
            }
            else {
                if (!this.#observers)
                    this.#observers = new Set();
                this.#observers.add(handler);
            }
        }
        unobserve(handler_or_bound_object, bound_object) {
            let handler;
            if (handler_or_bound_object instanceof globalThis.Function)
                handler = handler_or_bound_object;
            else
                bound_object = handler_or_bound_object;
            if (bound_object) {
                if (handler) {
                    this.#observers_bound_objects.get(bound_object)?.delete(handler);
                    if (this.#observers_bound_objects.get(bound_object).size == 0)
                        this.#observers_bound_objects.delete(bound_object);
                }
                else
                    this.#observers_bound_objects.delete(bound_object);
            }
            else
                this.#observers.delete(handler_or_bound_object);
        }
        toString() {
            return this.value?.toString();
        }
        toJSON() {
            return this.value;
        }
        valueOf() {
            return this.value;
        }
        static collapseValue(value, collapse_pointer_properties = false, collapse_primitive_pointers = false) {
            if (value instanceof Value && (collapse_primitive_pointers || !(value instanceof PrimitivePointer)) && (collapse_pointer_properties || !(value instanceof PointerProperty)))
                return value.value;
            else
                return value;
        }
        static transform(value, transform) {
            const initialValue = transform(Value.collapseValue(value, true, true));
            if (initialValue === Datex.VOID)
                throw new ValueError("initial tranform value cannot be void");
            const dx_value = Pointer.create(undefined, initialValue);
            if (value instanceof Value)
                value.observe(() => {
                    const newValue = transform(value.value);
                    if (newValue !== Datex.VOID)
                        dx_value.value = newValue;
                });
            return dx_value;
        }
        static async transformMultiple(values, transform) {
            const initialValue = transform(...values.map(v => Value.collapseValue(v, true, true)));
            if (initialValue === Datex.VOID)
                throw new ValueError("initial tranform value cannot be void");
            const dx_value = Pointer.create(undefined, initialValue);
            for (let value of values) {
                if (value instanceof Value)
                    value.observe(async () => {
                        const newValue = transform(...values.map(v => Value.collapseValue(v, true, true)));
                        if (newValue !== Datex.VOID)
                            dx_value.value = newValue;
                    });
            }
            return dx_value;
        }
        static async transformAsync(value, transform) {
            const initialValue = await transform(Value.collapseValue(value, true, true));
            if (initialValue === Datex.VOID)
                throw new ValueError("initial tranform value cannot be void");
            const dx_value = Pointer.create(undefined, initialValue);
            if (value instanceof Value)
                value.observe(async () => {
                    const newValue = await transform(value.value);
                    if (newValue !== Datex.VOID)
                        dx_value.value = newValue;
                });
            return dx_value;
        }
        static async transformMultipleAsync(values, transform) {
            const initialValue = await transform(...values.map(v => Value.collapseValue(v, true, true)));
            if (initialValue === Datex.VOID)
                throw new ValueError("initial tranform value cannot be void");
            const dx_value = Pointer.create(undefined, initialValue);
            for (let value of values) {
                if (value instanceof Value)
                    value.observe(async () => {
                        const newValue = await transform(...values.map(v => Value.collapseValue(v, true, true)));
                        if (newValue !== Datex.VOID)
                            dx_value.value = newValue;
                    });
            }
            return dx_value;
        }
        static mirror(from, to) {
            from.observe((v, k, p) => to.value = v);
        }
    }
    Datex.Value = Value;
    class PointerProperty extends Value {
        pointer;
        key;
        constructor(pointer, key) {
            super();
            this.pointer = pointer;
            this.key = key;
            PointerProperty.synced_pairs.get(pointer).set(key, this);
        }
        static synced_pairs = new WeakMap();
        static get(parent, key) {
            let pointer;
            if (parent instanceof Pointer)
                pointer = parent;
            else
                pointer = Pointer.createOrGet(parent);
            if (!this.synced_pairs.has(pointer))
                this.synced_pairs.set(pointer, new Map());
            if (this.synced_pairs.get(pointer).has(key))
                return this.synced_pairs.get(pointer).get(key);
            else
                return new PointerProperty(pointer, key);
        }
        get value() {
            return this.pointer.getProperty(this.key);
        }
        set value(value) {
            this.pointer.handleSet(this.key, Value.collapseValue(value, true, true));
        }
        #observer_internal_handlers = new WeakMap();
        #observer_internal_bound_handlers = new WeakMap();
        observe(handler, bound_object) {
            const value_pointer = Pointer.pointerifyValue(this.value);
            if (value_pointer instanceof Value)
                value_pointer.observe(handler, bound_object);
            const internal_handler = (v) => {
                const value_pointer = Pointer.pointerifyValue(v);
                if (value_pointer instanceof Value)
                    value_pointer.observe(handler);
                handler.call(bound_object, v, undefined, Value.UPDATE_TYPE.INIT);
            };
            this.pointer.observe(internal_handler, bound_object, this.key);
            if (bound_object) {
                if (!this.#observer_internal_bound_handlers.has(bound_object))
                    this.#observer_internal_bound_handlers.set(bound_object, new WeakMap);
                this.#observer_internal_bound_handlers.get(bound_object).set(handler, internal_handler);
            }
            else
                this.#observer_internal_handlers.set(handler, internal_handler);
        }
        unobserve(handler, bound_object) {
            const value_pointer = Pointer.pointerifyValue(this.value);
            if (value_pointer instanceof Value)
                value_pointer.unobserve(handler, bound_object);
            let internal_handler;
            if (bound_object) {
                internal_handler = this.#observer_internal_bound_handlers.get(bound_object)?.get(handler);
                this.#observer_internal_bound_handlers.get(bound_object)?.delete(handler);
            }
            else {
                internal_handler = this.#observer_internal_handlers.get(handler);
                this.#observer_internal_handlers.delete(handler);
            }
            if (internal_handler)
                this.pointer.unobserve(internal_handler, bound_object, this.key);
        }
    }
    Datex.PointerProperty = PointerProperty;
    class UpdateScheduler {
        updates_per_receiver = new Map();
        update_interval;
        active = false;
        #interval;
        datex_timeout;
        constructor(update_interval) {
            this.update_interval = update_interval;
            this.start();
        }
        setUpdateInterval() {
            if (this.update_interval != null) {
                this.#interval = setInterval(() => {
                    this.trigger();
                }, this.update_interval);
            }
        }
        clearUpdateInterval() {
            if (this.update_interval != null)
                clearInterval(this.#interval);
        }
        start() {
            this.active = true;
            this.setUpdateInterval();
        }
        stop() {
            this.active = false;
            this.clearUpdateInterval();
        }
        async trigger() {
            if (!this.active)
                return;
            for (let [receiver, map] of this.updates_per_receiver) {
                let data = [];
                let datex = '';
                let pdxb_array = [];
                let is_datex_strings = true;
                for (let [ptr, entries] of map) {
                    if (!entries.size)
                        continue;
                    for (let [entry_datex, entry_data] of entries.values()) {
                        if (is_datex_strings && entry_datex instanceof PrecompiledDXB)
                            is_datex_strings = false;
                        if (typeof entry_datex == "string") {
                            datex += entry_datex + ';';
                        }
                        else if (entry_datex instanceof PrecompiledDXB) {
                            pdxb_array.push(entry_datex);
                        }
                        data.push(...entry_data);
                    }
                    entries.clear();
                }
                if (is_datex_strings && !datex)
                    continue;
                else if (!is_datex_strings) {
                    if (pdxb_array.length == 0)
                        continue;
                    if (pdxb_array.length == 0)
                        datex = pdxb_array[0];
                    else
                        datex = PrecompiledDXB.combine(...pdxb_array);
                }
                try {
                    await Runtime.datexOut([datex, data, { end_of_scope: false }], receiver, undefined, false, undefined, undefined, false, undefined, this.datex_timeout);
                }
                catch (e) {
                    logger.error("forwarding failed", e);
                }
            }
        }
        intermediate_updates_pointers = new Set();
        addPointer(ptr, intermediate_updates = false) {
            if (!(ptr instanceof Pointer))
                ptr = Pointer.pointerifyValue(ptr);
            if (!(ptr instanceof Pointer))
                throw new RuntimeError("value is not a pointer");
            if (intermediate_updates)
                this.intermediate_updates_pointers.add(ptr);
            ptr.setScheduler(this);
            this.datex_timeout = ptr.datex_timeout;
        }
        removePointer(ptr) {
            if (!(ptr instanceof Pointer))
                ptr = Pointer.pointerifyValue(ptr);
            if (!(ptr instanceof Pointer))
                throw new RuntimeError("value is not a pointer");
            ptr.deleteScheduler();
        }
        addUpdate(pointer, identifier, datex, data, receiver) {
            if (!this.updates_per_receiver.has(receiver))
                this.updates_per_receiver.set(receiver, new Map());
            let ptr_map = this.updates_per_receiver.get(receiver);
            if (!ptr_map.has(pointer))
                ptr_map.set(pointer, new Map());
            ptr_map.get(pointer).set((!this.intermediate_updates_pointers.has(pointer) && identifier) ? identifier : Symbol(), [datex, data]);
        }
    }
    Datex.UpdateScheduler = UpdateScheduler;
    Datex.MAX_UINT_16 = 65535;
    Datex.VOID = undefined;
    Datex.WILDCARD = Symbol("*");
    Datex.INVALID = Symbol("Invalid");
    Datex.NOT_EXISTING = Symbol("Not existing");
    Datex.UNKNOWN_TYPE = Symbol("Unknown type");
    Datex.DX_PTR = Symbol("DX_PTR");
    Datex.DX_TYPE = Symbol("DX_TYPE");
    Datex.DX_VALUE = Symbol("DX_VALUE");
    Datex.DX_TEMPLATE = Symbol("DX_TEMPLATE");
    Datex.DX_PERMISSIONS = Symbol("DX_PERMISSIONS");
    Datex.DX_PERMISSIONS_R = Symbol("DX_PERMISSIONS_R");
    Datex.DX_PERMISSIONS_U = Symbol("DX_PERMISSIONS_U");
    Datex.DX_PERMISSIONS_X = Symbol("DX_PERMISSIONS_X");
    const DEFAULT_HIDDEN_OBJECT_PROPERTIES = new Set(Object.getOwnPropertyNames(Object.prototype));
    class Pointer extends Value {
        static pointer_add_listeners = new Set();
        static pointer_remove_listeners = new Set();
        static pointer_property_add_listeners = new Set();
        static pointer_property_change_listeners = new Set();
        static pointer_property_delete_listeners = new Set();
        static pointer_value_change_listeners = new Set();
        static pointer_for_value_created_listeners = new WeakMap();
        static onPointerAdded(listener) {
            this.pointer_add_listeners.add(listener);
        }
        static onPointerRemoved(listener) {
            this.pointer_remove_listeners.add(listener);
        }
        static onPointerPropertyAdded(listener) {
            this.pointer_property_add_listeners.add(listener);
        }
        static onPointerPropertyChanged(listener) {
            this.pointer_property_change_listeners.add(listener);
        }
        static onPointerPropertyDeleted(listener) {
            this.pointer_property_delete_listeners.add(listener);
        }
        static onPointerValueChanged(listener) {
            this.pointer_value_change_listeners.add(listener);
        }
        static onPointerForValueCreated(value, listener) {
            if (!this.pointer_for_value_created_listeners.has(value))
                this.pointer_for_value_created_listeners.set(value, new Set());
            this.pointer_for_value_created_listeners.get(value)?.add(listener);
        }
        static unsubscribeFromAllPointers() {
            for (let pointer of this.pointers.values()) {
                if (!pointer.is_anonymous && !pointer.is_origin)
                    pointer.unsubscribeFromPointerUpdates();
            }
        }
        static pointers = new Map();
        static pointer_value_map = new WeakMap();
        static pointer_label_map = new Map();
        static MAX_POINTER_ID_SIZE = 26;
        static STATIC_POINTER_SIZE = 18;
        static last_c = 0;
        static last_t = 0;
        static time_shift = 0;
        static POINTER_TYPE = {
            DEFAULT: 1,
            IPV6_ID: 2,
            STATIC: 3,
            BLOCKCHAIN_PTR: 0xBC,
            PUBLIC: 5,
        };
        static pointer_prefix = new Uint8Array(21);
        static #is_local = true;
        static #local_pointers = new Set();
        static set is_local(local) {
            this.#is_local = local;
            if (!this.#is_local) {
                for (let pointer of this.#local_pointers) {
                    pointer.id = Pointer.getUniquePointerID(pointer);
                }
                this.#local_pointers.clear();
            }
        }
        static get is_local() { return this.#is_local; }
        static getUniquePointerID(forPointer) {
            let id = new Uint8Array(this.MAX_POINTER_ID_SIZE);
            let id_view = new DataView(id.buffer);
            id.set(this.pointer_prefix);
            const timestamp = Math.round((new Date().getTime() - DatexCompiler.BIG_BANG_TIME) / 1000);
            if (timestamp !== this.last_t) {
                if (timestamp > this.last_t + this.time_shift)
                    this.time_shift = 0;
                if (this.time_shift == 0)
                    this.last_c = 0;
            }
            if (this.last_c > 255) {
                this.last_c = 0;
                this.time_shift++;
            }
            id_view.setUint32(21, timestamp + this.time_shift, true);
            id_view.setUint8(25, this.last_c++);
            this.last_t = timestamp;
            if (Pointer.is_local) {
                this.#local_pointers.add(forPointer);
            }
            return id;
        }
        static getStaticPointerId(endpoint, unique_id) {
            let id = new Uint8Array(this.STATIC_POINTER_SIZE);
            let id_view = new DataView(id.buffer);
            id.set(endpoint.getStaticPointerPrefix());
            id_view.setUint32(13, unique_id);
            return id;
        }
        static ANONYMOUS_ID = new Uint8Array(1);
        static pointerifyValue(value) {
            return value instanceof Pointer ? value : this.pointer_value_map.get(value) ?? value;
        }
        static getByValue(value) {
            return this.pointer_value_map.get(Pointer.collapseValue(value));
        }
        static getByLabel(label) {
            if (!this.pointer_label_map.has(label))
                throw new PointerError("Label " + Runtime.formatVariableName(label, '$') + " does not exist");
            return this.pointer_label_map.get(label);
        }
        static get(id) {
            return this.pointers.get(Pointer.normalizePointerId(id));
        }
        static #pointer_sources = new Set();
        static registerPointerSource(source) {
            this.#pointer_sources.add(source);
        }
        static loading_pointers = new WeakMap();
        static async load(id, SCOPE) {
            const id_string = Pointer.normalizePointerId(id);
            if (SCOPE && !this.loading_pointers.has(SCOPE))
                this.loading_pointers.set(SCOPE, new Set());
            const loading_pointers = SCOPE ? this.loading_pointers.get(SCOPE) : undefined;
            if (loading_pointers?.has(id_string)) {
                logger.error("recursive pointer loading: " + id_string);
                return null;
            }
            loading_pointers?.add(id_string);
            let pointer = Pointer.create(id, Datex.NOT_EXISTING, false);
            if (pointer.is_anonymous) {
                loading_pointers?.delete(id_string);
                throw new PointerError("The anonymous pointer has no value", SCOPE);
            }
            if (pointer.value === Datex.VOID) {
                let stored;
                let source;
                for (source of this.#pointer_sources) {
                    stored = await source.getPointer(pointer.id, !SCOPE);
                    if (stored != Datex.NOT_EXISTING)
                        break;
                }
                if (stored != Datex.NOT_EXISTING) {
                    pointer = pointer.setValue(stored);
                    if (source.syncPointer)
                        source.syncPointer(pointer);
                    pointer.origin = Runtime.endpoint;
                }
                else if (id_string.startsWith("BC")) {
                    try {
                        pointer = await pointer.subscribeForPointerUpdates(Runtime.main_node);
                    }
                    catch (e) {
                        loading_pointers?.delete(id_string);
                        pointer.delete();
                        throw e;
                    }
                }
                else if (!pointer.is_origin) {
                    if (SCOPE?.sync) {
                        loading_pointers?.delete(id_string);
                        throw new RuntimeError("Cannot subscribe to non-existing pointer", SCOPE);
                    }
                    else if (SCOPE?.unsubscribe) {
                        loading_pointers?.delete(id_string);
                        throw new RuntimeError("Cannot unsubscribe from non-existing pointer", SCOPE);
                    }
                    try {
                        pointer = await pointer.subscribeForPointerUpdates();
                    }
                    catch (e) {
                        loading_pointers?.delete(id_string);
                        pointer.delete();
                        throw e;
                    }
                }
                else {
                    loading_pointers?.delete(id_string);
                    throw new PointerError("Pointer has no assigned value", SCOPE);
                }
            }
            loading_pointers?.delete(id_string);
            return pointer;
        }
        static proxifyValue(value, sealed = false, allowed_access, anonymous = false, persistant = false) {
            if (value instanceof PrimitivePointer || value instanceof PointerProperty)
                return value;
            else if (value instanceof Value)
                return value.value;
            const type = Type.getValueDatexType(value);
            const collapsed_value = Value.collapseValue(value, true, true);
            if (type.is_primitive || collapsed_value instanceof Date) {
                return collapsed_value;
            }
            else
                return Pointer.createOrGet(collapsed_value, sealed, allowed_access, anonymous, persistant).value;
        }
        static createOrGet(value, sealed = false, allowed_access, anonymous = false, persistant = false) {
            const ptr = Pointer.getByValue(value);
            if (ptr) {
                if (ptr.is_placeholder)
                    ptr.unPlaceholder();
                return ptr;
            }
            else
                return Pointer.create(undefined, value, sealed, undefined, persistant, anonymous, false, allowed_access);
        }
        static createLabel(value, label) {
            let ptr = Pointer.getByValue(value);
            if (!ptr) {
                ptr = Pointer.create(undefined, value);
            }
            ptr.addLabel(label);
            return ptr;
        }
        static create(id, value = Datex.NOT_EXISTING, sealed = false, origin, persistant = false, anonymous = false, is_placeholder = false, allowed_access, timeout) {
            let p;
            value = Value.collapseValue(value, true, true);
            if ((Object(value) !== value && typeof value != "symbol") || value instanceof ArrayBuffer || value instanceof TypedArray || value instanceof NodeBuffer || value instanceof Addresses.Target) {
                if (value instanceof TypedArray || value instanceof NodeBuffer)
                    value = Runtime.serializeValue(value);
                if (typeof id != "symbol" && id && (p = this.pointers.get(this.normalizePointerId(id)))) {
                    if (p instanceof PrimitivePointer) {
                        if (value != Datex.NOT_EXISTING)
                            p.value = value;
                        if (origin)
                            p.origin = origin;
                    }
                    else {
                        throw new PointerError("Cannot assign a primitive value to a non-primitive pointer");
                    }
                }
                else {
                    let pp;
                    if (value instanceof ArrayBuffer)
                        pp = Buffer;
                    else if (value instanceof Addresses.Target)
                        pp = PrimitivePointer;
                    else
                        switch (typeof value) {
                            case "string":
                                pp = String;
                                break;
                            case "number":
                                pp = Float;
                                break;
                            case "bigint":
                                pp = Int;
                                break;
                            case "boolean":
                                pp = Boolean;
                                break;
                        }
                    if (!pp)
                        throw new PointerError("Cannot create a pointer for this value type");
                    return new pp(id, value, sealed, origin, persistant, anonymous, is_placeholder, allowed_access, timeout);
                }
            }
            else if (this.pointer_value_map.has(value)) {
                let existing_pointer = Pointer.pointer_value_map.get(value);
                if (existing_pointer.is_placeholder) {
                    existing_pointer.unPlaceholder(id);
                    return existing_pointer;
                }
                if (existing_pointer.is_anonymous)
                    return existing_pointer;
                else
                    throw new PointerError("A pointer has already been allocated to this value (" + Runtime.valueToDatexString(value) + ")");
            }
            else if (typeof id != "symbol" && id && (p = this.pointers.get(this.normalizePointerId(id)))) {
                if (value != Datex.NOT_EXISTING)
                    p.value = value;
                if (origin)
                    p.origin = origin;
                return p;
            }
            else {
                return new Pointer(id, value, sealed, origin, persistant, anonymous, is_placeholder, allowed_access, timeout);
            }
        }
        static normalizePointerId(id) {
            if (id instanceof Uint8Array) {
                if (id[0] == Pointer.POINTER_TYPE.STATIC)
                    return this.buffer2hex(id, null, Pointer.STATIC_POINTER_SIZE, true);
                else
                    return this.buffer2hex(id, null, Pointer.MAX_POINTER_ID_SIZE, true);
            }
            else
                return id;
        }
        static garbage_registry = new FinalizationRegistry(pointer_name => {
            if (!Pointer.pointers.has(pointer_name))
                return;
            let pointer = Pointer.pointers.get(pointer_name);
            logger.warn("garbage collected " + pointer.toString());
            Pointer.pointers.delete(pointer_name);
            if (pointer.value)
                Pointer.pointer_value_map.delete(pointer.value);
            if (pointer.original_value) {
                Pointer.pointer_value_map.delete(pointer.original_value);
                delete pointer.original_value[Datex.DX_PTR];
            }
            for (const label of pointer.labels) {
                this.pointer_label_map.delete(label);
            }
            if (!pointer.is_anonymous)
                for (let l of Pointer.pointer_remove_listeners)
                    l(pointer);
            if (!pointer.is_origin && pointer.origin)
                pointer.unsubscribeFromPointerUpdates();
        });
        static buffer2hex(buffer, seperator, pad_size_bytes, x_shorthand = false) {
            let array = Array.prototype.map.call(buffer, x => ('00' + x.toString(16).toUpperCase()).slice(-2));
            if (x_shorthand) {
                array = array.reduce((previous, current) => {
                    if (current == '00') {
                        if (previous.endsWith('00'))
                            return previous.slice(0, -2) + "x2";
                        else if (previous[previous.length - 2] == 'x') {
                            const count = (parseInt(previous[previous.length - 1], 16) + 1);
                            if (count <= 0xf)
                                return previous.slice(0, -1) + count.toString(16).toUpperCase();
                        }
                    }
                    return previous + current;
                }).split(/(..)/g).filter(s => !!s);
            }
            if (pad_size_bytes != undefined)
                array = Array.from({ ...array, length: pad_size_bytes });
            return array.join(seperator ?? '');
        }
        static hex2buffer(hex, pad_size_bytes, x_shorthand = false) {
            if (!hex)
                return new Uint8Array(0);
            hex = hex.replace(/[_-]/g, "");
            if (hex.length % 2 != 0)
                throw new ValueError('Invalid hexadecimal buffer: ' + hex);
            if ((x_shorthand && hex.match(/[G-WYZ\s]/i)) || (!x_shorthand && hex.match(/[G-Z\s]/i)))
                throw new ValueError('Invalid hexadecimal buffer: ' + hex);
            let array;
            if (!x_shorthand)
                array = hex.match(/[\dA-Fa-fxX]{2}/gi).map(s => parseInt(s, 16));
            else
                array = hex.match(/[\dA-Fa-fxX]{2}/gi).map((s, i, a) => {
                    s = s.toLowerCase();
                    if (s.startsWith("x") && s[1] != "x")
                        return Array(parseInt(s[1], 16)).fill(0);
                    else if (s.includes("x"))
                        throw new ValueError('Invalid buffer "x" shorthand: ' + hex.slice(0, 30));
                    return parseInt(s, 16);
                }).flat(1);
            if (pad_size_bytes != undefined)
                return new Uint8Array({ ...array, length: pad_size_bytes });
            else
                return new Uint8Array(array);
        }
        static convertNativeFunctionToDatexFunction(value, parent, key_in_parent, anonymize_result = false) {
            const parent_value = parent instanceof Pointer ? parent.value : parent;
            if (typeof value == "function" && !(value instanceof Function)) {
                let meta_param_index = this.property_type_assigner.getMethodMetaParamIndex(parent_value, key_in_parent);
                let method_params = this.property_type_assigner.getMethodParams(parent_value, key_in_parent, meta_param_index);
                return new Function(null, value, Datex.Runtime.endpoint, method_params, null, meta_param_index, parent, anonymize_result);
            }
            throw new ValueError("Cannot auto-cast native value to <Function>");
        }
        static arraySplice(start, deleteCount, ...items) {
            if (start == 0 && deleteCount == this.length && items.length == 0) {
                this[Datex.DX_PTR]?.handleClear();
                return [];
            }
            if (deleteCount && deleteCount < 0)
                deleteCount = 0;
            return this[Datex.DX_PTR]?.handleSplice(start, deleteCount, items);
        }
        constructor(id, value = Datex.NOT_EXISTING, sealed = false, origin, persistant = false, anonymous = false, is_placeholder = false, allowed_access, timeout) {
            super();
            if (is_placeholder) {
                this.#is_placeholder = true;
                anonymous = true;
            }
            if ((typeof id == "string" && id.match(/^0+$/)) || (id instanceof Uint8Array && id.every(x => x == 0))) {
                anonymous = true;
            }
            this.#is_persistent = persistant;
            this.sealed = sealed;
            if (origin)
                this.origin = origin;
            this.#is_anonymous = anonymous;
            this.#allowed_access = allowed_access;
            this.datex_timeout = timeout;
            if (anonymous) {
                this.id = Pointer.ANONYMOUS_ID;
            }
            else if (typeof id == "string" || id instanceof Uint8Array) {
                this.id = id;
            }
            else {
                this.id = Pointer.getUniquePointerID(this);
            }
            if (!this.origin && id && !anonymous && this.#id_buffer && this.pointer_type == Pointer.POINTER_TYPE.DEFAULT) {
                this.origin = Datex.Addresses.Target.get(this.#id_buffer.slice(1, 13), null, this.#id_buffer.slice(13, 21), null, BinaryCode.ENDPOINT);
            }
            else if (!this.origin)
                this.origin = Runtime.endpoint;
            if (value != Datex.NOT_EXISTING)
                this.value = value;
        }
        delete() {
            if (this.is_anonymous)
                logger.info("Deleting anoynmous pointer");
            else
                logger.error("Deleting pointer " + this);
            if (this.value) {
                Pointer.pointer_value_map.delete(this.value);
            }
            if (this.original_value) {
                Pointer.pointer_value_map.delete(this.original_value);
                delete this.original_value[Datex.DX_PTR];
            }
            for (let label of this.labels ?? [])
                Pointer.pointer_label_map.delete(label);
            Pointer.pointers.delete(this.#id);
            delete globalThis[this.toString()];
            if (!this.is_anonymous)
                for (let l of Pointer.pointer_remove_listeners)
                    l(this);
            if (!this.is_origin && this.origin)
                this.unsubscribeFromPointerUpdates();
        }
        #original_value;
        #shadow_object;
        #type;
        #value_updated = false;
        #is_placeholder = false;
        #is_persistent;
        #is_anonymous;
        #pointer_type;
        #id;
        #id_buffer;
        #origin;
        #is_origin = true;
        #subscribed;
        sealed = false;
        #scheduleder = null;
        #allowed_access;
        #garbage_collectable = false;
        #labels = new Set();
        get garbage_collectable() { return this.#garbage_collectable; }
        get allowed_access() { return this.#allowed_access; }
        get is_placeholder() { return this.#is_placeholder; }
        get id_buffer() { return this.#id_buffer; }
        get is_origin() { return this.#is_origin; }
        get is_anonymous() { return this.#is_anonymous; }
        get origin() { return this.#origin; }
        get is_persistant() { return this.#is_persistent; }
        get labels() { return this.#labels; }
        get pointer_type() { return this.#pointer_type; }
        _setType(type) { this.#type = type; }
        _setValue(value) {
            super.value = value;
            for (let l of Pointer.pointer_value_change_listeners)
                l(this);
        }
        _getValueUpdated() { return this.#value_updated; }
        set origin(origin) {
            this.#origin = origin;
            this.#is_origin = Runtime.endpoint.equals(this.#origin);
        }
        set is_persistant(persistant) {
            if (persistant && !this.#is_persistent) {
                super.value = this.value;
                this.#is_persistent = true;
                this.updateGarbageCollection();
            }
            else if (!persistant && this.#is_persistent) {
                super.value = new WeakRef(this.value);
                this.#is_persistent = false;
                this.updateGarbageCollection();
            }
        }
        setScheduler(scheduleder) {
            this.#scheduleder = scheduleder;
        }
        deleteScheduler() {
            this.#scheduleder = null;
        }
        addLabel(label) {
            if (Pointer.pointer_label_map.has(label))
                throw new PointerError("Label " + Runtime.formatVariableName(label, '$') + " is already assigned to a pointer");
            this.#labels.add(label);
            this.is_persistant = true;
            Pointer.pointer_label_map.set(label, this);
            Object.defineProperty(globalThis, Runtime.formatVariableName(label, '$'), { get: () => this.value, set: (value) => this.value = value, configurable: true });
        }
        async subscribeForPointerUpdates(override_endpoint) {
            if (this.#subscribed) {
                logger.info("already subscribed to " + this);
                return;
            }
            const endpoint = override_endpoint ?? this.origin;
            logger.info("subscribing to " + this + ", origin = " + endpoint);
            try {
                let result = await Runtime.datexOut(['subscribe ?', [this]], endpoint);
                this.#subscribed = true;
                let pointer_value = result;
                this.origin = endpoint;
                if (this.value == Datex.VOID)
                    return this.setValue(pointer_value);
                else
                    return this;
            }
            catch (e) {
                logger.error(e);
                try {
                    let origin = await Runtime.datexOut(['origin ?', [this]], endpoint);
                    if (origin instanceof Datex.Addresses.Endpoint)
                        return this.subscribeForPointerUpdates(origin);
                    else
                        throw new Error("Cannot find origin for pointer " + this);
                }
                catch (e) {
                    logger.error(e);
                }
            }
        }
        unsubscribeFromPointerUpdates() {
            if (!this.#subscribed)
                return;
            let endpoint = this.origin;
            logger.info("unsubscribing from " + this + " (" + endpoint + ")");
            Runtime.datexOut(['unsubscribe ?', [this]], endpoint);
            this.#subscribed = false;
        }
        unPlaceholder(id) {
            this.#is_anonymous = false;
            this.id = id ?? Pointer.getUniquePointerID(this);
            this.#is_placeholder = false;
            for (let l of Pointer.pointer_add_listeners)
                l(this);
        }
        get id() { return this.#id; }
        set id(id) {
            if (!this.is_placeholder && this.id !== undefined && !Pointer.#local_pointers.has(this)) {
                throw new PointerError("Cannot change the id of a pointer");
            }
            if (typeof id == "string") {
                try {
                    this.#id_buffer = Pointer.hex2buffer(id, Pointer.MAX_POINTER_ID_SIZE, true);
                }
                catch (e) {
                    throw new SyntaxError('Invalid pointer id: $' + id.slice(0, 48));
                }
                this.#id = id;
            }
            else if (id instanceof Uint8Array) {
                this.#id_buffer = id;
                this.#id = Pointer.normalizePointerId(id);
            }
            else
                this.#id = id;
            this.#pointer_type = this.#id_buffer[0];
            if (!this.is_anonymous)
                Object.defineProperty(globalThis, this.toString(), { get: () => this.value, set: (value) => this.value = value, configurable: true });
            if (!this.is_anonymous)
                Pointer.pointers.set(this.#id, this);
        }
        setValue(v) {
            if ((Object(v) !== v || v instanceof ArrayBuffer) && !(this instanceof PrimitivePointer)) {
                Pointer.pointers.delete(this.id);
                return Pointer.create(this.id, v, this.sealed, this.origin, this.is_persistant, this.is_anonymous, false, this.allowed_access, this.datex_timeout);
            }
            else if (Pointer.pointer_value_map.has(v)) {
                if (super.value != undefined) {
                    throw new PointerError("Cannot assign a new value to an already initialized pointer");
                }
                let existing_pointer = Pointer.pointer_value_map.get(v);
                existing_pointer.unPlaceholder(this.id);
                return existing_pointer;
            }
            else {
                this.value = v;
                return this;
            }
        }
        set value(_v) {
            const v = Value.collapseValue(_v, true, true);
            if (this.#value_updated)
                throw new PointerError("Cannot assign a new value to an already initialized non-primitive pointer");
            if (!this.is_anonymous) {
                try {
                    v[Datex.DX_PTR] = this;
                }
                catch (e) { }
            }
            this.#original_value = this.#shadow_object = new WeakRef(v);
            this.#type = Type.getValueDatexType(v);
            if (this.sealed)
                this.visible_children = new Set(Object.keys(v));
            else if (this.type.visible_children)
                this.visible_children = this.type.visible_children;
            Pointer.pointer_value_map.set(v, this);
            let value = this.addObjProxy((v instanceof UnresolvedValue) ? v[Datex.DX_VALUE] : v);
            if (v instanceof UnresolvedValue) {
                this.#shadow_object = new WeakRef(v[Datex.DX_VALUE]);
                v[Datex.DX_VALUE] = value;
                super.value = v;
            }
            else
                super.value = value;
            this.updateGarbageCollection();
            if (this.type.proxify_children)
                this.objProxifyChildren();
            Pointer.pointer_value_map.set(value, this);
            if (Pointer.pointer_for_value_created_listeners.has(v)) {
                for (let l of Pointer.pointer_for_value_created_listeners.get(v))
                    l(this);
            }
            if (this.sealed)
                Object.seal(this.original_value);
            this.afterFirstValueSet();
        }
        afterFirstValueSet() {
            this.#value_updated = true;
            if (this.type.timeout != undefined && this.datex_timeout == undefined)
                this.datex_timeout = this.type.timeout;
            if (this.id && !this.is_anonymous)
                Object.defineProperty(globalThis, this.toString(), { get: () => this.value, set: (value) => this.value = value, configurable: true });
            setTimeout(() => { for (let l of Pointer.pointer_add_listeners)
                l(this); }, 0);
            Object.freeze(this);
        }
        updateGarbageCollection() {
            if (this.is_persistant || this.subscribers.size != 0) {
                this.#garbage_collectable = false;
                if (super.value instanceof WeakRef)
                    super.value = super.value.deref();
            }
            else {
                if (!this.#garbage_collectable) {
                    this.#garbage_collectable = true;
                    setTimeout(() => {
                        const value = this.value;
                        if (value)
                            Pointer.garbage_registry.register(value, this.id);
                    }, Runtime.OPTIONS.DEFAULT_REQUEST_TIMEOUT);
                }
                if (!(super.value instanceof WeakRef))
                    super.value = new WeakRef(super.value);
            }
        }
        get value() {
            return super.value instanceof WeakRef ? super.value.deref() : super.value;
        }
        get original_value() {
            return this.#original_value?.deref();
        }
        get shadow_object() {
            return this.#shadow_object?.deref();
        }
        get type() {
            return this.#type;
        }
        extended_pointers = new Set();
        extend(otherPointer, update_back = true) {
            if (!(otherPointer instanceof Pointer))
                throw "not a pointer";
            logger.info(this + " is extending pointer " + otherPointer);
            for (let property of otherPointer.getKeys()) {
                this.extendProperty(otherPointer, property, update_back);
            }
        }
        extendProperty(otherPointer, key, update_back = true) {
            console.log("extend poperty", key);
            if (!(otherPointer instanceof Pointer))
                throw "not a pointer";
            this.extended_pointers.add(otherPointer);
            this.value[key] = otherPointer.value[key];
            let changing1 = false;
            let changing2 = false;
            otherPointer.observe(value => {
                if (changing2)
                    return;
                changing1 = true;
                console.warn("other pointer cahnged", key, value);
                this.handleSet(key, value, false);
                changing1 = false;
            }, undefined, key);
            if (update_back) {
                this.observe(value => {
                    if (changing1)
                        return;
                    changing2 = true;
                    console.warn("own pointer cahnged", key, value);
                    otherPointer.handleSet(key, value);
                    changing2 = false;
                }, undefined, key);
            }
        }
        datex_timeout;
        visible_children;
        sealed_properties;
        anonymous_properties;
        canReadProperty(property_name) {
            return (!this.visible_children && !DEFAULT_HIDDEN_OBJECT_PROPERTIES.has(property_name)) || this.visible_children.has(property_name);
        }
        canUpdateProperty(property_name) {
            return this.canReadProperty(property_name) && (!this.sealed_properties || !this.sealed_properties.has(property_name));
        }
        subscribers = new Set();
        subscribers_filter = new Datex.Addresses.Filter(this.subscribers);
        subscribers_filter_pointer = [];
        addSubscriber(subscriber) {
            if (this.subscribers.has(subscriber)) {
                logger.warn(subscriber.toString() + " re-subscribed to " + this);
            }
            this.subscribers.add(subscriber);
            if (this.subscribers.size == 1)
                this.updateGarbageCollection();
            if (this.streaming.length)
                setTimeout(() => this.startStreamOutForEndpoint(subscriber), 1000);
        }
        removeSubscriber(subscriber) {
            this.subscribers.delete(subscriber);
            if (this.subscribers.size == 0)
                this.updateGarbageCollection();
        }
        async getSubscribersFilter() {
            if (this.subscribers_filter_pointer.length)
                return this.subscribers_filter_pointer[0];
            if (this.is_origin) {
                this.subscribers_filter_pointer[0] = Pointer.create(null, this.subscribers_filter).value;
            }
            else {
                this.subscribers_filter_pointer[0] = await Runtime.datexOut(['subscribers ?', [this]], this.origin);
            }
            return this.subscribers_filter_pointer[0];
        }
        #update_filter = this.subscribers_filter;
        #exclude_origin_from_updates;
        excludeEndpointFromUpdates(endpoint) {
            if (this.origin.equals(endpoint))
                this.#exclude_origin_from_updates = true;
            this.#update_filter = Datex.Addresses.Filter.createMergedFilter(this.subscribers_filter, Datex.Addresses.Not.get(endpoint));
        }
        enableUpdatesForAll() {
            this.#exclude_origin_from_updates = false;
            this.#update_filter = this.subscribers_filter;
        }
        get update_filter() {
            return this.#update_filter;
        }
        static property_type_assigner;
        static setPropertyTypeAssigner(assigner) {
            this.property_type_assigner = assigner;
        }
        getSerializedValue() {
            return SerializedValue.get(this.value);
        }
        getKeys(array_indices_as_numbers = false) {
            if (this.visible_children)
                return this.visible_children;
            let keys = JSInterface.handleKeys(this.value, this.type);
            if (keys == Datex.INVALID)
                throw new ValueError("Value has no iterable content");
            if (keys == Datex.NOT_EXISTING) {
                if (this.value instanceof Array) {
                    if (array_indices_as_numbers)
                        return [...this.value.keys()];
                    else
                        return [...this.value.keys()].map(BigInt);
                }
                else
                    keys = Object.keys(this.value);
            }
            return keys;
        }
        proxifyChild(name, value) {
            let child = value === Datex.NOT_EXISTING ? this.value[name] : value;
            if (typeof child == "function" && !(child instanceof Function))
                child = Pointer.convertNativeFunctionToDatexFunction(child, this, name);
            return Pointer.proxifyValue(child, false, this.allowed_access, this.anonymous_properties?.has(name));
        }
        objProxifyChildren() {
            const value = this.value;
            for (let name of this.visible_children ?? Object.keys(value)) {
                const type = Type.getValueDatexType(value[name]);
                if (!type.is_primitive && !(value[name] instanceof Date)) {
                    if (value[name] instanceof Function && this.type?.children_timeouts?.has(name)) {
                        value[name].datex_timeout = this.type.children_timeouts.get(name);
                    }
                    this.shadow_object[name] = this.proxifyChild(name, Datex.NOT_EXISTING);
                }
            }
            return;
        }
        addObjProxy(obj) {
            if (Object(obj) !== obj)
                return;
            let res = JSInterface.createProxy(obj, this, this.type);
            if (res != Datex.INVALID && res != Datex.NOT_EXISTING)
                return res;
            if (obj instanceof Stream || obj instanceof Function) {
                return obj;
            }
            let prototype1 = Object.getPrototypeOf(obj);
            let prototype2 = prototype1 && Object.getPrototypeOf(prototype1);
            if (prototype1 == Object.prototype)
                prototype1 = undefined;
            if (prototype2 == Object.prototype)
                prototype2 = undefined;
            if (obj[SHADOW_OBJECT] && Object.isSealed(obj)) {
                obj[SET_PROXY] = (k, v) => this.handleSet(k, v);
                this.#shadow_object = new WeakRef(obj[SHADOW_OBJECT]);
                return obj;
            }
            else if (!Object.isSealed(obj) && this.visible_children) {
                const shadow_object = { [Datex.DX_PTR]: this };
                this.#shadow_object = new WeakRef(shadow_object);
                for (let name of this.visible_children) {
                    const property_descriptor = Object.getOwnPropertyDescriptor(obj, name)
                        ?? (prototype1 && Object.getOwnPropertyDescriptor(prototype1, name))
                        ?? (prototype2 && Object.getOwnPropertyDescriptor(prototype2, name));
                    if (property_descriptor?.set || property_descriptor?.get) {
                        const descriptor = {};
                        if (property_descriptor.set)
                            descriptor.set = val => property_descriptor.set?.call(obj, val);
                        if (property_descriptor.get)
                            descriptor.get = () => property_descriptor.get?.call(obj);
                        Object.defineProperty(shadow_object, name, descriptor);
                    }
                    else
                        shadow_object[name] = obj[name];
                    Object.defineProperty(obj, name, {
                        set: val => {
                            this.handleSet(name, val);
                        },
                        get: () => {
                            return shadow_object[name];
                        }
                    });
                }
                return obj;
            }
            if (((obj instanceof Function) || typeof obj == "object") && obj != null) {
                const is_array = Array.isArray(obj);
                if (is_array) {
                    Object.defineProperty(obj, "splice", {
                        value: Pointer.arraySplice,
                        enumerable: false,
                        writable: false
                    });
                }
                let proxy = new Proxy(obj, {
                    set: (target, val_name, val) => {
                        if (is_array && val_name == "length") {
                            if (val > obj.length) {
                                throw new ValueError("<Array> property 'length' cannot be increased");
                            }
                            else if (val < obj.length) {
                                for (let i = obj.length - 1; i >= val; i--) {
                                    if (i in obj)
                                        this.handleDelete(BigInt(i));
                                }
                                obj.length = val;
                            }
                            return true;
                        }
                        if (is_array && !(typeof val_name == "number" || typeof val_name == "bigint" || /^[0-9]+$/.test(globalThis.String(val_name)))) {
                            target[val_name] = val;
                            return true;
                        }
                        this.handleSet(is_array ? BigInt(Number(val_name)) : val_name, val);
                        if (is_array && val === Datex.VOID && Number(val_name) + 1 == obj.length)
                            Runtime.runtime_actions.trimArray(obj);
                        return true;
                    },
                    deleteProperty: (target, prop) => {
                        this.handleDelete(is_array ? BigInt(Number(prop)) : prop);
                        if (is_array && Number(prop) + 1 == obj.length)
                            Runtime.runtime_actions.trimArray(obj);
                        return true;
                    }
                });
                for (let name of [...Object.getOwnPropertyNames(obj), ...Object.getOwnPropertyNames(prototype1 ?? {}), ...Object.getOwnPropertyNames(prototype2 ?? {})]) {
                    const property_descriptor = Object.getOwnPropertyDescriptor(obj, name)
                        ?? Object.getOwnPropertyDescriptor(prototype1, name)
                        ?? (prototype2 && Object.getOwnPropertyDescriptor(prototype2, name));
                    if (property_descriptor?.set || property_descriptor?.get) {
                        Object.defineProperty(obj, name, {
                            set: val => { property_descriptor.set?.call(proxy, val); },
                            get: () => property_descriptor.get?.call(proxy)
                        });
                    }
                }
                return proxy;
            }
            else {
                return obj;
            }
        }
        getProperty(key) {
            let property_value = JSInterface.handleGetProperty(this.shadow_object, key, this.type);
            if (property_value == Datex.INVALID || property_value == Datex.NOT_EXISTING)
                property_value = this.shadow_object[key];
            return property_value;
        }
        handleSet(key, value, ignore_if_unchanged = true) {
            if (!this.value)
                return;
            value = this.proxifyChild(key, value);
            key = Pointer.proxifyValue(key);
            let obj = this.value;
            let existed_before = false;
            if (!this.type.isPropertyAllowed(key)) {
                throw new ValueError("Property '" + key + '" does not exist');
            }
            if (typeof value == "number" && this.type.getAllowedPropertyType(key).root_type == Type.std.Int)
                value = BigInt(value);
            if (!this.type.isPropertyValueAllowed(key, value)) {
                throw new ValueError("Property '" + key + "' must be of type " + this.type.getAllowedPropertyType(key));
            }
            const current_value = this.getProperty(key);
            if (current_value === value && ignore_if_unchanged) {
                return;
            }
            if (current_value !== undefined)
                existed_before = true;
            let res = JSInterface.handleSetPropertySilently(obj, key, value, this, this.type);
            if (res == Datex.INVALID || res == Datex.NOT_EXISTING)
                this.shadow_object[key] = value;
            if ((res == Datex.INVALID || res == Datex.NOT_EXISTING) && this.shadow_object instanceof Array)
                key = BigInt(key);
            if (this.origin && !this.is_origin) {
                if (!this.#exclude_origin_from_updates)
                    this.handleDatexUpdate(key, Runtime.PRECOMPILED_DXB.SET_PROPERTY, [this, key, value], this.origin);
            }
            else if (this.is_origin && this.subscribers.size) {
                this.handleDatexUpdate(key, Runtime.PRECOMPILED_DXB.SET_PROPERTY, [this, key, value], this.#update_filter);
            }
            if (this.value instanceof Array)
                key = Number(key);
            this.callObservers(value, key, Value.UPDATE_TYPE.SET);
            if (existed_before && Pointer.pointer_property_change_listeners.size) {
                setTimeout(() => {
                    for (let l of Pointer.pointer_property_change_listeners)
                        l(this, key, value);
                }, 0);
            }
            else if (!existed_before && Pointer.pointer_property_add_listeners.size) {
                setTimeout(() => {
                    for (let l of Pointer.pointer_property_add_listeners)
                        l(this, key, value);
                }, 0);
            }
        }
        handleAdd(value) {
            if (!this.value)
                return;
            value = this.proxifyChild(undefined, value);
            let obj = this.value;
            let index;
            let res = JSInterface.handlePropertyActionSilently(BinaryCode.ADD, obj, value, this, this.type);
            if (res == Datex.INVALID || res == Datex.NOT_EXISTING) {
                if (this.shadow_object instanceof Array)
                    index = this.shadow_object.push(value);
                else
                    throw new ValueError("Cannot add values to this value");
            }
            if (this.origin && !this.is_origin) {
                if (!this.#exclude_origin_from_updates)
                    this.handleDatexUpdate(null, '? += ?', [this, value], this.origin);
            }
            else if (this.is_origin && this.subscribers.size) {
                this.handleDatexUpdate(null, '? += ?', [this, value], this.#update_filter);
            }
            this.callObservers(value, Datex.VOID, Value.UPDATE_TYPE.ADD);
            if (Pointer.pointer_property_add_listeners.size) {
                setTimeout(() => {
                    index = index ?? Runtime.serializeValue(this.value)?.indexOf(value);
                    for (let l of Pointer.pointer_property_add_listeners)
                        l(this, index, value);
                }, 0);
            }
        }
        streaming = [];
        startStreamOut() {
            let obj = this.value;
            if (!obj || !(obj instanceof Stream))
                return;
            this.streaming.push(true);
            if (this.origin && !this.is_origin) {
                logger.info("streaming to parent " + this.origin);
                if (!this.#exclude_origin_from_updates)
                    this.handleDatexUpdate(null, '? << ?', [this, obj], this.origin);
            }
            else if (this.is_origin && this.subscribers.size) {
                logger.info("streaming to subscribers " + this.subscribers_filter);
                this.handleDatexUpdate(null, '? << ?', [this, obj], this.#update_filter);
            }
        }
        startStreamOutForEndpoint(endpoint) {
            logger.info("streaming to new subscriber " + endpoint);
            this.handleDatexUpdate(null, '? << ?', [this, this.value], endpoint);
        }
        handleClear() {
            if (!this.value)
                return;
            let obj = this.value;
            const keys = this.getKeys(true);
            let res = JSInterface.handleClearSilently(obj, this, this.type);
            if (res == Datex.INVALID || res == Datex.NOT_EXISTING) {
                if (this.shadow_object instanceof Array)
                    Array.prototype.splice.call(this.shadow_object, 0, this.shadow_object.length);
                else
                    throw new ValueError("Cannot perform clear operation on this value");
            }
            if (this.origin && !this.is_origin) {
                if (!this.#exclude_origin_from_updates)
                    this.handleDatexUpdate(null, Runtime.PRECOMPILED_DXB.CLEAR_WILDCARD, [this], this.origin);
            }
            else if (this.is_origin && this.subscribers.size) {
                this.handleDatexUpdate(null, Runtime.PRECOMPILED_DXB.CLEAR_WILDCARD, [this], this.#update_filter);
            }
            for (let key of keys) {
                this.callObservers(Datex.VOID, key, Value.UPDATE_TYPE.CLEAR);
            }
            if (Pointer.pointer_property_delete_listeners.size) {
                setTimeout(() => {
                    for (let l of Pointer.pointer_property_delete_listeners)
                        l(this, undefined);
                }, 0);
            }
        }
        handleSplice(start_index, deleteCount, replace) {
            if (!this.value)
                return;
            if (deleteCount == 0 && !replace.length)
                return;
            let obj = this.value;
            const start = BigInt(start_index);
            const end = BigInt(start_index + deleteCount);
            let size = BigInt(deleteCount);
            const replace_length = BigInt(replace.length);
            if (obj instanceof Array && start + size > obj.length)
                size = BigInt(obj.length) - start;
            let ret;
            if (obj instanceof Array) {
                ret = Array.prototype.splice.call(this.shadow_object, start_index, deleteCount, ...replace);
            }
            if (this.origin && !this.is_origin) {
                if (!this.#exclude_origin_from_updates) {
                    if (!replace?.length)
                        this.handleDatexUpdate(null, '#0 = ?0; #1 = count #0;#0.(?1..?2) = void;#0.(?1..#1) = #0.(?3..#1);', [this, start, end, start + size], this.origin);
                    else
                        this.handleDatexUpdate(null, '#0=?0;#0.(?4..?1) = void; #0.(?2..((count #0) + ?3)) = #0.(?4..(count #0));#0.(?4..?5) = ?6;', [this, end, start - size + replace_length, replace_length, start, start + replace_length, replace], this.origin);
                }
            }
            else if (this.is_origin && this.subscribers.size) {
                if (!replace?.length)
                    this.handleDatexUpdate(null, '#0 = ?0; #1 = count #0;#0.(?1..?2) = void;#0.(?1..#1) = #0.(?3..#1);', [this, start, end, start + size], this.#update_filter);
                else
                    this.handleDatexUpdate(null, '#0=?0;#0.(?4..?1) = void; #0.(?2..((count #0) + ?3)) = #0.(?4..(count #0));#0.(?4..?5) = ?6;', [this, end, start - size + replace_length, replace_length, start, start + replace_length, replace], this.#update_filter);
            }
            if (Pointer.pointer_property_delete_listeners.size) {
                setTimeout(() => {
                    for (let l of Pointer.pointer_property_delete_listeners)
                        l(this, undefined);
                }, 0);
            }
            return ret;
        }
        handleDelete(key) {
            if (!this.value)
                return;
            let obj = this.value;
            if (!this.type.isPropertyAllowed(key)) {
                throw new ValueError("Property '" + key + '" does not exist');
            }
            let res = JSInterface.handleDeletePropertySilently(obj, key, this, this.type);
            if (res == Datex.INVALID || res == Datex.NOT_EXISTING)
                delete this.shadow_object[key];
            if ((res == Datex.INVALID || res == Datex.NOT_EXISTING) && this.shadow_object instanceof Array)
                key = BigInt(key);
            if (this.origin && !this.is_origin) {
                if (!this.#exclude_origin_from_updates)
                    this.handleDatexUpdate(null, '?.? = void', [this, key], this.origin);
            }
            else if (this.is_origin && this.subscribers.size) {
                this.handleDatexUpdate(null, '?.? = void', [this, key], this.#update_filter);
            }
            this.callObservers(Datex.VOID, key, Value.UPDATE_TYPE.DELETE);
            if (Pointer.pointer_property_delete_listeners.size) {
                setTimeout(() => {
                    for (let l of Pointer.pointer_property_delete_listeners)
                        l(this, key);
                }, 0);
            }
        }
        handleRemove(value) {
            if (!this.value)
                return;
            let obj = this.value;
            let res = JSInterface.handlePropertyActionSilently(BinaryCode.SUBTRACT, obj, value, this, this.type);
            if (res == Datex.INVALID || res == Datex.NOT_EXISTING) {
                throw new ValueError("Cannot subtract values from this value");
            }
            if (this.origin && !this.is_origin) {
                if (!this.#exclude_origin_from_updates)
                    this.handleDatexUpdate(null, '? -= ?', [this, value], this.origin);
            }
            else if (this.is_origin && this.subscribers.size) {
                logger.info("forwarding delete to subscribers " + this.#update_filter);
                this.handleDatexUpdate(null, '? -= ?', [this, value], this.#update_filter);
            }
            this.callObservers(value, Datex.VOID, Value.UPDATE_TYPE.REMOVE);
            if (Pointer.pointer_property_delete_listeners.size) {
                setTimeout(() => {
                    for (let l of Pointer.pointer_property_delete_listeners)
                        l(this, value);
                }, 0);
            }
        }
        async handleDatexUpdate(identifier, datex, data, receiver) {
            if (this.#scheduleder) {
                this.#scheduleder.addUpdate(this, identifier, datex, data, receiver);
            }
            else {
                try {
                    await Runtime.datexOut([datex, data], receiver, undefined, true, undefined, undefined, false, undefined, this.datex_timeout);
                }
                catch (e) {
                    throw e;
                }
            }
        }
        change_observers = new Map();
        bound_change_observers = new Map();
        general_change_observers = new Set();
        bound_general_change_observers = new Map();
        observe(handler, bound_object, key) {
            if (!handler)
                throw new ValueError("Missing observer handler");
            if (key == undefined) {
                super.observe(handler, bound_object);
                if (bound_object) {
                    if (!this.bound_general_change_observers.has(bound_object))
                        this.bound_general_change_observers.set(bound_object, new Set());
                    this.bound_general_change_observers.get(bound_object).add(handler);
                }
                else
                    this.general_change_observers.add(handler);
            }
            else {
                if (this.value instanceof Array)
                    key = Number(key);
                if (bound_object) {
                    if (!this.bound_change_observers.has(bound_object))
                        this.bound_change_observers.set(bound_object, new Map());
                    let bound_object_map = this.bound_change_observers.get(bound_object);
                    if (!bound_object_map.has(key))
                        bound_object_map.set(key, new Set());
                    bound_object_map.get(key).add(handler);
                }
                else {
                    if (!this.change_observers.has(key))
                        this.change_observers.set(key, new Set());
                    this.change_observers.get(key).add(handler);
                }
            }
        }
        unobserve(handler, bound_object, key) {
            if (key == undefined) {
                super.unobserve(handler, bound_object);
                if (bound_object) {
                    this.bound_general_change_observers.get(bound_object)?.delete(handler);
                    if (this.bound_general_change_observers.get(bound_object).size == 0)
                        this.bound_general_change_observers.delete(bound_object);
                }
                else
                    this.general_change_observers.delete(handler);
            }
            else {
                if (bound_object) {
                    this.bound_change_observers.get(bound_object)?.get(key)?.delete(handler);
                    if (this.bound_change_observers.get(bound_object)?.size == 0)
                        this.bound_change_observers.delete(bound_object);
                    else if (this.bound_change_observers.get(bound_object)?.get(key)?.size == 0)
                        this.bound_change_observers.get(bound_object).delete(key);
                }
                else
                    this.change_observers.get(key)?.delete(handler);
            }
        }
        callObservers(value, key, type) {
            if (key != undefined) {
                for (let o of this.change_observers.get(key) || [])
                    o(value, key, type);
                for (let [object, entries] of this.bound_change_observers.entries()) {
                    for (let [k, handlers] of entries) {
                        if (k === key) {
                            for (let handler of handlers) {
                                if (handler.call(object, value, key, type) === false)
                                    this.unobserve(handler, object, key);
                            }
                        }
                    }
                }
            }
            for (let o of this.general_change_observers || [])
                o(value, key, type);
            for (let [object, handlers] of this.bound_general_change_observers || []) {
                for (let handler of handlers) {
                    if (handler.call(object, value, key, type) === false)
                        this.unobserve(handler, object, key);
                }
            }
        }
        toString() {
            return `$${this.id}`;
        }
    }
    Datex.Pointer = Pointer;
    (function (Value) {
        let UPDATE_TYPE;
        (function (UPDATE_TYPE) {
            UPDATE_TYPE[UPDATE_TYPE["INIT"] = 0] = "INIT";
            UPDATE_TYPE[UPDATE_TYPE["SET"] = 1] = "SET";
            UPDATE_TYPE[UPDATE_TYPE["DELETE"] = 2] = "DELETE";
            UPDATE_TYPE[UPDATE_TYPE["CLEAR"] = 3] = "CLEAR";
            UPDATE_TYPE[UPDATE_TYPE["ADD"] = 4] = "ADD";
            UPDATE_TYPE[UPDATE_TYPE["REMOVE"] = 5] = "REMOVE";
        })(UPDATE_TYPE = Value.UPDATE_TYPE || (Value.UPDATE_TYPE = {}));
    })(Value = Datex.Value || (Datex.Value = {}));
    globalThis["p"] = Pointer.pointers;
    globalThis["DatexPointer"] = Pointer;
    Pointer.registerPointerSource(new DatexStoragePointerSource());
    class PrimitivePointer extends Pointer {
        get is_persistant() { return true; }
        set is_persistant(persistant) { }
        updateGarbageCollection() { }
        get original_value() { return this.value; }
        get value() { return super.value; }
        set value(_v) {
            const v = Value.collapseValue(_v, true, true);
            if (!this._getValueUpdated()) {
                this._setValue(v);
                this._setType(Type.getValueDatexType(v));
                this.afterFirstValueSet();
            }
            else {
                const newType = Type.getValueDatexType(v);
                if (newType !== this.type)
                    throw new ValueError("Invalid value type for pointer: " + newType + " - must be " + this.type);
                this._setValue(v);
            }
        }
        getSerializedValue() {
            return SerializedValue.get(this);
        }
    }
    Datex.PrimitivePointer = PrimitivePointer;
    class String extends PrimitivePointer {
    }
    Datex.String = String;
    class Int extends PrimitivePointer {
    }
    Datex.Int = Int;
    class Float extends PrimitivePointer {
    }
    Datex.Float = Float;
    class Boolean extends PrimitivePointer {
    }
    Datex.Boolean = Boolean;
    class Buffer extends PrimitivePointer {
    }
    Datex.Buffer = Buffer;
    function getProxyFunction(method_name, params) {
        return function (...args) {
            let dynamic_filter = params.dynamic_filter ? params.dynamic_filter.clone() : null;
            let filter = dynamic_filter ? (params.filter ? Datex.Addresses.Filter.createMergedFilter(dynamic_filter, params.filter) : dynamic_filter) : params.filter || new Datex.Addresses.Filter();
            let compile_info = [`#static.${params.scope_name}.${method_name} ?`, [new Tuple(args)], { to: filter, sign: params.sign }];
            return Runtime.datexOut(compile_info, filter, undefined, true, undefined, undefined, false, undefined, params.timeout);
        };
    }
    Datex.getProxyFunction = getProxyFunction;
    function getProxyStaticValue(name, params) {
        return function () {
            let dynamic_filter = params.dynamic_filter ? params.dynamic_filter.clone() : null;
            let filter = dynamic_filter ? (params.filter ? Datex.Addresses.Filter.createMergedFilter(dynamic_filter, params.filter) : dynamic_filter) : params.filter || new Datex.Addresses.Filter();
            let compile_info = [`#static.${params.scope_name}.${name}`, [], { to: filter, sign: params.sign }];
            return Runtime.datexOut(compile_info, filter, undefined, true, undefined, undefined, false, undefined, params.timeout);
        };
    }
    Datex.getProxyStaticValue = getProxyStaticValue;
    class Task {
        datex;
        #executed = false;
        promise;
        get is_local() { return !!this.datex; }
        result;
        state = 0n;
        constructor(datex) {
            this.datex = datex;
        }
        replicate() {
            this.#remotePromise();
        }
        #remotePromise() {
            this.promise = new Promise((resolve, reject) => {
                if (this.state > 0n) {
                    if (this.state == 2n)
                        reject(this.result);
                    else
                        resolve(this.result);
                }
                Datex.Pointer.observe(this, () => {
                    console.log("finished task:", this);
                    if (this.state > 0n) {
                        if (this.state == 2n)
                            reject(this.result);
                        else
                            resolve(this.result);
                        return false;
                    }
                }, this, 'state');
            });
        }
        run(SCOPE) {
            if (!this.#executed) {
                this.#executed = true;
                this.promise = new Promise(async (resolve, reject) => {
                    try {
                        const res = await this.datex.execute([], SCOPE.sender, SCOPE.context);
                        this.result = res;
                        this.state = 1n;
                        resolve(res);
                    }
                    catch (e) {
                        this.result = e;
                        this.state = 2n;
                        reject(e);
                    }
                });
            }
        }
    }
    Datex.Task = Task;
    class LazyValue extends Task {
    }
    Datex.LazyValue = LazyValue;
    class ExtensibleFunction {
        constructor(f) {
            return Object.setPrototypeOf(f, new.target.prototype);
        }
    }
    class Function extends ExtensibleFunction {
        context;
        body;
        ntarget;
        location;
        fn;
        allowed_callers;
        serialize_result;
        anonymize_result;
        params;
        params_keys;
        meta_index;
        datex_timeout;
        about;
        proxy_fn;
        constructor(body, ntarget, location = Runtime.endpoint, params, allowed_callers, meta_index = undefined, context, anonymize_result = false) {
            super((...args) => this.handleApply(new Tuple(args)));
            this.meta_index = meta_index;
            this.params = params ?? new Datex.Tuple();
            this.params_keys = [...this.params.named.keys()];
            this.body = body;
            this.ntarget = ntarget;
            this.location = location;
            if (body instanceof Scope) {
                this.meta_index = 0;
                let ctx = context instanceof Pointer ? context.value : context;
                this.fn = (meta, ...args) => body.execute(this.mapArgs(args), meta.sender, ctx);
            }
            else if (typeof ntarget == "function") {
                this.fn = ntarget;
            }
            if (allowed_callers instanceof Datex.Addresses.Target)
                allowed_callers = new Datex.Addresses.Filter(allowed_callers);
            this.allowed_callers = allowed_callers;
            this.anonymize_result = anonymize_result;
            Object.defineProperty(this, 'context', {
                enumerable: false,
                value: context
            });
            if (this.location == Datex.Addresses.LOCAL_ENDPOINT) {
                Datex.Runtime.onEndpointChanged((endpoint) => {
                    logger.info("update local function location for " + Datex.Runtime.valueToDatexString(this));
                    this.location = endpoint;
                });
            }
        }
        mapArgs(args) {
            const variables = {};
            let i = 0;
            for (let name of this.params_keys) {
                variables[name] = args[i++];
            }
            return variables;
        }
        setRemoteEndpoint(endpoint) {
            let filter = new Datex.Addresses.Filter(endpoint);
            let sid = DatexCompiler.generateSID();
            Runtime.datexOut(['_=?;', [this], { to: filter, end_of_scope: false, sid, return_index: DatexCompiler.getNextReturnIndexForSID(sid) }], filter, sid, false);
            this.proxy_fn = async (value) => {
                let compile_info = [this.serialize_result ? 'value (_ ?);return;' : '_ ?;return;', [value], { to: filter, end_of_scope: false, sid, return_index: DatexCompiler.getNextReturnIndexForSID(sid) }];
                try {
                    let res = await Runtime.datexOut(compile_info, filter, undefined, true, undefined, undefined, false, undefined, this.datex_timeout);
                    return res;
                }
                catch (e) {
                    console.log(e);
                    logger.debug("Error ocurred, resetting DATEX scope for proxy function");
                    this.setRemoteEndpoint(endpoint);
                    throw e;
                }
            };
        }
        __call__(...params) {
            logger.error("HERE NOT");
        }
        write(data, scope) {
            return this.handleApply(data, scope);
        }
        async pipe(in_stream) {
            const reader = in_stream.getReader();
            let next;
            while (true) {
                next = await reader.read();
                if (next.done)
                    break;
                this.write(next.value);
            }
        }
        handleApply(value, SCOPE) {
            if (!Runtime.endpoint.equals(this.location) && this.location != Datex.Addresses.LOCAL_ENDPOINT)
                this.setRemoteEndpoint(this.location);
            let meta;
            if (SCOPE) {
                if (!SCOPE.execution_permission || (this.allowed_callers && !this.allowed_callers.test(SCOPE.sender))) {
                    throw new PermissionError("No execution permission", SCOPE);
                }
                if (this.proxy_fn) {
                    if (SCOPE.impersonation_permission)
                        return this.proxy_fn(value);
                    else
                        throw new PermissionError("No permission to execute functions on external endpoints", SCOPE);
                }
                meta = SCOPE.meta;
            }
            else {
                if (this.proxy_fn)
                    return this.proxy_fn(value);
                meta = {
                    sender: Runtime.endpoint,
                    current: Runtime.endpoint,
                    timestamp: new Date(),
                    signed: true,
                    type: DatexProtocolDataType.LOCAL_REQ,
                    local: true
                };
            }
            if (!this.fn)
                throw new Datex.RuntimeError("Cannot apply values to a <Function> with no executable DATEX or valid native target");
            let context = this.context instanceof Value ? this.context.value : this.context;
            let params;
            if (value instanceof Tuple) {
                params = [];
                for (let [key, val] of value.entries()) {
                    if (!isNaN(Number(key.toString()))) {
                        if (Number(key.toString()) < 0)
                            throw new RuntimeError("Invalid function arguments: '" + key + "'");
                        if (Number(key.toString()) >= this.params_keys.length)
                            throw new RuntimeError("Maximum number of function arguments is " + (this.params_keys.length), SCOPE);
                        params[Number(key.toString())] = val;
                    }
                    else {
                        const index = this.params_keys.indexOf(key.toString());
                        if (index == -1)
                            throw new RuntimeError("Invalid function argument: '" + key + "'", SCOPE);
                        params[index] = val;
                    }
                }
            }
            else if (value == Datex.VOID)
                params = [];
            else {
                params = [value];
            }
            if (this.params) {
                let i = 0;
                for (let [name, required_type] of this.params.entries()) {
                    let actual_type = Type.getValueDatexType(params[i]);
                    if (required_type
                        && required_type != Type.std.Object
                        && actual_type != Type.std.Null
                        && actual_type != Type.std.Void
                        && !required_type.matchesType(actual_type)) {
                        throw new TypeError(`Invalid argument '${name}': type should be ${required_type.toString()}`, SCOPE);
                    }
                    i++;
                }
            }
            let required_param_nr = this.params.size;
            if (this.meta_index == undefined) {
                if (required_param_nr == undefined || params.length <= required_param_nr)
                    return this.fn.call(context, ...params);
                else if (params.length > required_param_nr)
                    return this.fn.call(context, ...params.slice(0, required_param_nr));
            }
            else if (this.meta_index == -1) {
                if (required_param_nr == undefined || params.length == required_param_nr)
                    return this.fn.call(context, ...params, meta);
                else if (params.length > required_param_nr)
                    return this.fn.call(context, ...params.slice(0, required_param_nr), meta);
                else if (params.length < required_param_nr)
                    return this.fn.call(context, ...params, ...Array(required_param_nr - params.length), meta);
            }
            else if (this.meta_index == 0)
                return this.fn.call(context, meta, ...params);
            else if (this.meta_index > 0) {
                let p1 = params.slice(0, this.meta_index);
                let p2 = params.slice(this.meta_index);
                if (p1.length == this.meta_index)
                    return this.fn.call(context, ...p1, meta, ...p2);
                else
                    return this.fn.call(context, ...p1, ...Array(this.meta_index - p1.length), meta);
            }
            else {
                throw new RuntimeError("Invalid index for the meta parameter", SCOPE);
            }
        }
        bodyToString(formatted = false, parentheses = true, spaces = '  ') {
            if (this.body)
                return this.body.bodyToString(formatted, parentheses, spaces);
            else
                return '(### native code ###)';
        }
        toString(formatted = false, spaces = '  ') {
            return `function ${this.params_keys.length == 0 ? '()' : Runtime.valueToDatexString(this.params)}${(formatted ? " " : "")}${this.bodyToString(formatted, true, spaces)}`;
        }
    }
    Datex.Function = Function;
    class IterationFunction extends Function {
        handleApply(value, SCOPE) {
            this.handleApply(value, SCOPE);
        }
    }
    Datex.IterationFunction = IterationFunction;
    class Unit extends Number {
        toString() {
            return Runtime.floatToString(Number(this)) + "u";
        }
    }
    Datex.Unit = Unit;
    class Tuple {
        #indexed = [];
        #named = new Map();
        constructor(initial_value) {
            if (initial_value instanceof Array || initial_value instanceof Set) {
                this.#indexed.push(...initial_value);
            }
            else if (initial_value instanceof Map) {
                for (const [k, v] of initial_value)
                    this.#named.set(k, v);
            }
            else if (typeof initial_value === "object") {
                for (let [name, value] of Object.entries(initial_value))
                    this.#named.set(name, value);
            }
            else if (initial_value != null)
                throw new Datex.ValueError("Invalid initial value for <Tuple>");
        }
        seal() {
            DatexObject.seal(this);
            return this;
        }
        get indexed() {
            return this.#indexed;
        }
        get named() {
            return this.#named;
        }
        get size() {
            return this.#named.size + this.#indexed.length;
        }
        set(index, value) {
            if (typeof index === "number" || typeof index === "bigint")
                this.#indexed[Number(index)] = value;
            else if (typeof index === "string")
                this.#named.set(index, value);
            else
                throw new Datex.ValueError("<Tuple> key must be <String> or <Int>");
        }
        get(index) {
            if (typeof index === "number" || typeof index === "bigint")
                return this.#indexed[Number(index)];
            else if (typeof index === "string")
                return this.#named.get(index);
            else
                throw new Datex.ValueError("<Tuple> key must be <String> or <Int>");
        }
        toArray() {
            if (this.#named.size == 0)
                return [...this.#indexed];
            else
                throw new Datex.ValueError("<Tuple> has non-integer indices");
        }
        toObject() {
            if (this.#indexed.length == 0)
                return Object.fromEntries(this.#named);
            else
                throw new Datex.ValueError("<Tuple> has integer indices");
        }
        entries() {
            return this[Symbol.iterator]();
        }
        clone() {
            const cloned = new Tuple(this.named);
            cloned.indexed.push(...this.indexed);
            return cloned;
        }
        push(...values) {
            this.#indexed.push(...values);
        }
        spread(other) {
            this.#indexed.push(...other.indexed);
            for (let [name, value] of other.named.entries())
                this.#named.set(name, value);
        }
        *[Symbol.iterator]() {
            for (const entry of this.#indexed.entries())
                yield entry;
            for (const entry of this.#named.entries())
                yield entry;
        }
        static generateRange(start, end) {
            if (typeof start == "number")
                start = BigInt(start);
            if (typeof end == "number")
                end = BigInt(end);
            if (typeof start != "bigint" || typeof end != "bigint")
                throw new ValueError("Range only accepts <Int> as boundaries");
            if (end < start)
                throw new ValueError("Second range boundary must be greater than or equal to the first boundary");
            const N = Number(end - start), range = new Tuple();
            let i = 0n;
            while (i < N)
                range[Number(i)] = start + i++;
            return range.seal();
        }
    }
    Datex.Tuple = Tuple;
    Datex.EXTENDED_OBJECTS = Symbol("EXTENDED_OBJECTS");
    Datex.INHERITED_PROPERTIES = Symbol("INHERITED_PROPERTIES");
    const SET_PROXY = Symbol("SET_PROXY");
    const SHADOW_OBJECT = Symbol("SHADOW_OBJECT");
    class DatexObject {
        constructor(object) {
            if (object)
                Object.assign(this, object);
        }
        *[Symbol.iterator]() { for (const entry of Object.entries(this))
            yield entry; }
        [Datex.EXTENDED_OBJECTS];
        [Datex.INHERITED_PROPERTIES];
        [SET_PROXY];
        [SHADOW_OBJECT];
        static extends(object, extends_object) {
            const extended_objects = object[Datex.EXTENDED_OBJECTS];
            if (!extended_objects)
                return false;
            if (extended_objects.has(extends_object))
                return true;
            else {
                for (let ext_object of extended_objects) {
                    if (ext_object[Datex.EXTENDED_OBJECTS] && DatexObject.extends(ext_object, extends_object)) {
                        return true;
                    }
                }
                return false;
            }
        }
        static extend(object, extend_object, update_back = true) {
            if (typeof extend_object != "object")
                throw new ValueError("Cannot extend an object with a primitive value");
            if (typeof object != "object" || object == null)
                throw new ValueError("Not an object or null");
            if (!object[Datex.EXTENDED_OBJECTS])
                object[Datex.EXTENDED_OBJECTS] = new Set();
            if (!object[Datex.INHERITED_PROPERTIES])
                object[Datex.INHERITED_PROPERTIES] = new Set();
            if (DatexObject.extends(object, extend_object))
                return;
            if (DatexObject.extends(extend_object, object))
                throw new ValueError("Cross-referenced extensions are not allowed");
            if (Object.isFrozen(extend_object) || !update_back) {
                for (const key of Object.keys(extend_object)) {
                    object[Datex.INHERITED_PROPERTIES].add(key);
                    object[key] = extend_object[key];
                }
            }
            else {
                for (const key of Object.keys(extend_object)) {
                    const descriptor = Object.getOwnPropertyDescriptor(object, key);
                    if (!descriptor || descriptor.configurable) {
                        Object.defineProperty(object, key, {
                            set(v) {
                                extend_object[key] = v;
                            },
                            get() {
                                return extend_object[key];
                            },
                            enumerable: true,
                            configurable: true
                        });
                    }
                    else {
                        logger.warn("Cannot create new getter/setter for extendable object key: " + key);
                        object[key] = extend_object[key];
                    }
                    object[Datex.INHERITED_PROPERTIES].add(key);
                }
            }
            object[Datex.EXTENDED_OBJECTS].add(extend_object);
            return object;
        }
        static seal(object) {
            if (Object.isSealed(object))
                return;
            object[SET_PROXY] = undefined;
            const shadow_object = object[SHADOW_OBJECT] = {};
            for (const key of Object.keys(object)) {
                if (!object[Datex.INHERITED_PROPERTIES]?.has(key)) {
                    const property_descriptor = Object.getOwnPropertyDescriptor(object, key);
                    if (property_descriptor?.set || property_descriptor?.get) {
                        const descriptor = {};
                        if (property_descriptor.set)
                            descriptor.set = val => property_descriptor.set?.call(object, val);
                        if (property_descriptor.get)
                            descriptor.get = () => property_descriptor.get?.call(object);
                        Object.defineProperty(shadow_object, key, descriptor);
                    }
                    else
                        shadow_object[key] = object[key];
                    Object.defineProperty(object, key, {
                        set(v) {
                            if (object[SET_PROXY])
                                object[SET_PROXY](key, v);
                            else
                                shadow_object[key] = v;
                        },
                        get() {
                            return shadow_object[key];
                        },
                        enumerable: true,
                        configurable: false
                    });
                }
            }
            Object.seal(shadow_object);
            Object.seal(object);
            return object;
        }
        static freeze(object) {
            Object.freeze(object);
            return object;
        }
    }
    Datex.DatexObject = DatexObject;
    class StaticScope {
        static STD;
        static scopes = {};
        static NAME = Symbol("name");
        static DOCS = Symbol("docs");
        static get(name) {
            return this.scopes[name] || new StaticScope(name);
        }
        constructor(name) {
            const proxy = Pointer.proxifyValue(this, false, undefined, false);
            if (name)
                proxy.name = name;
            return proxy;
        }
        getVariable(name) {
            return this[name];
        }
        setVariable(name, value) {
            return this[name] = value;
        }
        hasVariable(name) {
            return this.hasOwnProperty(name);
        }
        set name(name) {
            if (this[StaticScope.NAME])
                delete StaticScope.scopes[this[StaticScope.NAME]];
            this[StaticScope.NAME] = name;
            StaticScope.scopes[this[StaticScope.NAME]] = this;
            if (this[StaticScope.NAME] == "std")
                StaticScope.STD = this;
        }
        get name() {
            return this[StaticScope.NAME];
        }
        set docs(docs) {
            this[StaticScope.DOCS] = docs;
        }
        get docs() {
            return this[StaticScope.DOCS];
        }
    }
    Datex.StaticScope = StaticScope;
    class TypedValue extends DatexObject {
        [Datex.DX_TYPE];
        constructor(type, value) {
            super(value);
            this[Datex.DX_TYPE] = type;
        }
    }
    Datex.TypedValue = TypedValue;
    class UnresolvedValue {
        [Datex.DX_TYPE];
        [Datex.DX_VALUE];
        constructor(type, value) {
            this[Datex.DX_VALUE] = value;
            this[Datex.DX_TYPE] = type;
        }
    }
    Datex.UnresolvedValue = UnresolvedValue;
    class SerializedValue extends UnresolvedValue {
        constructor(value, type) {
            super(type ?? Type.getValueDatexType(value), value);
        }
        static get(value) {
            if (value instanceof SerializedValue)
                return value;
            else if (value instanceof UnresolvedValue)
                return new SerializedValue(value[Datex.DX_VALUE], value[Datex.DX_TYPE]);
            else
                return new SerializedValue(value);
        }
        getSerialized() {
            let value;
            if (this[Datex.DX_TYPE]?.is_complex) {
                value = Runtime.serializeValue(this[Datex.DX_VALUE]);
            }
            else if (this[Datex.DX_TYPE]?.serializable_not_complex) {
                value = Runtime.serializeValue(this[Datex.DX_VALUE]);
            }
            else
                value = this[Datex.DX_VALUE];
            if (value instanceof Pointer)
                value = value.value;
            return [this[Datex.DX_TYPE], value];
        }
    }
    Datex.SerializedValue = SerializedValue;
    class Type {
        static fundamental_types = ["String", "Float", "Int", "Boolean", "Target", "Endpoint", "Filter", "Null", "Void", "Array", "Object", "Tuple", "Type", "Buffer", "Datex", "Unit", "Url"];
        static primitive_types = ["String", "Float", "Int", "Boolean", "Null", "Void", "Unit", "Target", "Endpoint", "Buffer", "Type", "Url"];
        static compact_rep_types = ["Datex", "Filter"];
        static serializable_not_complex_types = ["Buffer"];
        static types = new Map();
        static type_templates = new Map();
        static template_types = new WeakMap();
        namespace = 'std';
        name = '';
        variation = '';
        parameters;
        root_type;
        base_type;
        is_complex = true;
        is_primitive = false;
        has_compact_rep = false;
        serializable_not_complex = false;
        timeout;
        #proxify_children;
        children_timeouts;
        get proxify_children() { return this.interface_config?.proxify_children ?? this.#proxify_children; }
        set proxify_children(proxify) { if (this.interface_config) {
            this.interface_config.proxify_children = proxify;
        } ; this.#proxify_children = proxify; }
        #visible_children;
        get visible_children() { return this.#visible_children ?? this.interface_config?.visible_children; }
        #about;
        #about_md;
        get about() {
            if (!this.#about_md) {
                this.#about_md = new Markdown(`## ${this.toString().replace("<", "\\<").replace(">", "\\>")}\n${this.#about}`);
            }
            return this.#about_md;
        }
        #template;
        #constructor_fn;
        #replicator_fn;
        #destructor_fn;
        get interface_config() {
            return this.#interface_config ?? (this.root_type != this ? this.root_type?.interface_config : undefined);
        }
        #interface_config;
        #implemented_types = new Set();
        get implemented_types() {
            return this.#implemented_types;
        }
        addImplementedType(type) {
            this.#implemented_types.add(type);
        }
        setConstructor(constructor_fn) {
            this.#constructor_fn = constructor_fn;
        }
        setReplicator(replicator_fn) {
            this.#replicator_fn = replicator_fn;
        }
        setDestructor(destructor_fn) {
            this.#destructor_fn = destructor_fn;
        }
        setTemplate(template) {
            DatexObject.freeze(template);
            this.#template = template;
            this.#visible_children = new Set(Object.keys(this.#template));
            for (let t of this.#template[Datex.EXTENDED_OBJECTS] ?? []) {
                this.#implemented_types.add(Type.template_types.get(t));
            }
            Type.type_templates.set(this, template);
            Type.template_types.set(template, this);
            return this;
        }
        get template() {
            return this.#template;
        }
        createFromTemplate(value = {}, assign_to_object = new TypedValue(this)) {
            if (!this.#template)
                throw new RuntimeError("Type has no template");
            if (!(typeof value == "object"))
                throw new RuntimeError("Cannot create template value from non-object value");
            for (let key of Object.keys(this.#template)) {
                const required_type = this.#template[key];
                if (!required_type) {
                    assign_to_object[key] = value[key];
                }
                else if (key in value && required_type.matches(value[key])) {
                    assign_to_object[key] = value[key];
                }
                else if (key in value && required_type.root_type == Type.std.Int && typeof value[key] == "number" && Number.isInteger(value[key])) {
                    assign_to_object[key] = BigInt(value[key]);
                }
                else if (value[key] == Datex.VOID && required_type.template) {
                    assign_to_object[key] = required_type.createFromTemplate();
                }
                else if (value[key] == Datex.VOID)
                    assign_to_object[key] = Datex.VOID;
                else
                    throw new ValueError("Property '" + key + "' must be of type " + required_type);
            }
            if (this.#template[Datex.DX_PERMISSIONS]) {
                const permissions = assign_to_object[Datex.DX_PERMISSIONS] = {};
                for (let [key, val] of Object.entries(this.#template[Datex.DX_PERMISSIONS])) {
                    permissions[key] = val;
                }
            }
            assign_to_object[Datex.DX_TEMPLATE] = this.#template;
            return (assign_to_object instanceof DatexObject ? DatexObject.seal(assign_to_object) : assign_to_object);
        }
        createDefaultValue(context, origin = Runtime.endpoint) {
            return Datex.Runtime.castValue(this, Datex.VOID, context, origin);
        }
        static #current_constructor;
        static isConstructing(value) {
            return value.constructor == this.#current_constructor;
        }
        cast(value, context, origin = Runtime.endpoint, make_pointer = false) {
            if (!this.interface_config && !this.template)
                return Datex.UNKNOWN_TYPE;
            if (this.interface_config) {
                if (value === Datex.VOID && this.interface_config.empty_generator instanceof globalThis.Function)
                    return this.interface_config.empty_generator();
                else if (this.interface_config.cast) {
                    return this.interface_config.cast(value, this, context, origin);
                }
                else if (typeof value == "object" && this.interface_config.prototype) {
                    const object = Object.create(this.interface_config.prototype);
                    Object.assign(object, value);
                    return object;
                }
            }
            let args;
            let is_constructor = true;
            if (value instanceof Tuple)
                args = value.toArray();
            else if (typeof value != "object" || value === null)
                args = [value];
            else {
                args = [];
                is_constructor = false;
            }
            Type.#current_constructor = this.interface_config?.class;
            let instance = this.interface_config?.class ? Reflect.construct(Type.#current_constructor, is_constructor ? [...args] : []) : new TypedValue(this);
            Type.#current_constructor = null;
            if (!is_constructor) {
                if (this.#template)
                    this.createFromTemplate(value, instance);
                else {
                    Object.assign(instance, value);
                }
            }
            return this.construct(instance, args, is_constructor, make_pointer);
        }
        construct(instance, args, is_constructor = true, make_pointer = false) {
            instance[Datex.DX_TEMPLATE] = this.#template;
            if (make_pointer) {
                instance = Pointer.create(null, instance, false, undefined, false, false).value;
            }
            if (is_constructor && this.#constructor_fn)
                this.#constructor_fn.apply(instance, args);
            else if (!is_constructor && this.#replicator_fn)
                this.#replicator_fn.apply(instance, args);
            return instance;
        }
        setJSInterface(configuration) {
            this.#interface_config = configuration;
            JSInterface.handleConfigUpdate(this, configuration);
            return this;
        }
        setAbout(about) {
            if (about instanceof Markdown)
                this.#about_md = about;
            else if (typeof about == "string")
                this.#about = about;
            else
                throw new ValueError("Invalid about, must be <String>");
        }
        constructor(namespace, name, variation, parameters) {
            if (name)
                this.name = name;
            if (namespace)
                this.namespace = namespace;
            if (variation)
                this.variation = variation;
            this.parameters = parameters;
            this.base_type = parameters ? Type.get(namespace, name, variation) : this;
            this.root_type = (variation || parameters) ? Type.get(namespace, name) : this;
            this.is_primitive = namespace == "std" && Type.primitive_types.includes(this.name);
            this.is_complex = namespace != "std" || !Type.fundamental_types.includes(this.name);
            this.has_compact_rep = namespace == "std" && (this.is_primitive || Type.compact_rep_types.includes(this.name));
            this.serializable_not_complex = Type.serializable_not_complex_types.includes(this.name);
            if (!parameters)
                Type.types.set((this.namespace || "std") + ":" + this.name + "/" + (this.variation ?? ""), this);
        }
        getParametrized(parameters) {
            return Type.get(this.namespace, this.name, this.variation, parameters);
        }
        getVariation(variation) {
            return Type.get(this.namespace, this.name, variation, this.parameters);
        }
        matchesType(type) {
            return Type.matchesType(type, this);
        }
        matches(value) {
            return Type.matches(value, this);
        }
        setChildTimeout(child, timeout) {
            if (!this.children_timeouts)
                this.children_timeouts = new Map();
            this.children_timeouts.set(child, timeout);
        }
        addVisibleChild(child) {
            if (!this.#visible_children)
                this.#visible_children = new Set();
            this.#visible_children.add(child);
        }
        isPropertyAllowed(property) {
            return !this.visible_children || this.visible_children.has(property);
        }
        isPropertyValueAllowed(property, value) {
            if (!this.#template)
                return true;
            else if (typeof property !== "string")
                return true;
            else
                return (!this.#template[property] || this.#template[property].matches?.(value));
        }
        getAllowedPropertyType(property) {
            if (!this.#template)
                return Type.std.Any;
            else if (typeof property !== "string")
                return Type.std.Void;
            else
                return this.#template[property];
        }
        #string;
        toString() {
            if (!this.#string) {
                this.#string = `<${(this.namespace && this.namespace != 'std') ? this.namespace + ":" : ""}${this.name}${this.variation ? '/' + this.variation : ''}${this.parameters ? (this.parameters.length == 1 ? '(' + Runtime.valueToDatexString(this.parameters[0]) + ')' :
                    '(' + this.parameters.map(p => Runtime.valueToDatexString(p)).join(",") + ')') : ''}>`;
            }
            return this.#string;
        }
        toJSON() {
            return "dx::" + this.toString();
        }
        static or(...types) {
            if (types.length == 1)
                return types[0];
            return Datex.Type.std.Or.getParametrized(types);
        }
        static matchesType(type, matches_type) {
            return matches_type == Type.std.Any || Type._matchesType(type, matches_type) || Type._matchesType(type.root_type, matches_type);
        }
        static _matchesType(type, matches_type) {
            if (matches_type.base_type == Type.std.Or) {
                if (!matches_type.parameters)
                    return false;
                for (let [_, t] of matches_type.parameters) {
                    if (Type._matchesType(type, t))
                        return true;
                }
                return false;
            }
            if (type.base_type == Type.std.Or) {
                if (!type.parameters)
                    return false;
                for (let [_, t] of type.parameters) {
                    if (Type._matchesType(t, matches_type))
                        return true;
                }
                return false;
            }
            if (matches_type.base_type == Type.std.And) {
                if (!matches_type.parameters)
                    return false;
                for (let [_, t] of matches_type.parameters) {
                    if (!Type._matchesType(type, t))
                        return false;
                }
                return true;
            }
            return (matches_type == Type.std.Any || (matches_type === type || (type.implemented_types.has(matches_type)))) ?? false;
        }
        static matchesTemplate(template, parent_template) {
            if (template == parent_template)
                return true;
            else {
                for (let object of template[Datex.EXTENDED_OBJECTS] || []) {
                    if (typeof object == "object" && this.matchesTemplate(object, parent_template))
                        return true;
                }
                return false;
            }
        }
        static matches(value, type) {
            if (type.template && value[Datex.DX_TEMPLATE] && this.matchesTemplate(value[Datex.DX_TEMPLATE], type.template))
                return true;
            return Type.matchesType(Type.getValueDatexType(value), type);
        }
        static extends(type, extends_type) {
            console.log("extemds", type, extends_type);
            return type != extends_type && Type.matchesType(type, extends_type);
        }
        static get(namespace, name_or_parameters, variation, parameters) {
            let name;
            if (name_or_parameters instanceof Array)
                parameters = name_or_parameters;
            else if (typeof name_or_parameters == "string")
                name = name_or_parameters;
            else if (name_or_parameters != undefined)
                throw new TypeError("Invalid type name or parameters");
            if (namespace?.includes(":"))
                [namespace, name] = namespace.split(":");
            if (name === undefined) {
                name = namespace;
                namespace = "std";
            }
            if (!namespace)
                namespace = "std";
            if (!name)
                throw new Error("Invalid type");
            if (name?.includes("/"))
                [name, variation] = name.split("/");
            if (parameters)
                return new Type(namespace, name, variation, parameters);
            else
                return this.types.get(namespace + ":" + name + "/" + (variation ?? "")) || new Type(namespace, name, variation, parameters);
        }
        static has(namespace, name, variation) {
            if (namespace.includes(":"))
                [namespace, name] = namespace.split(":");
            if (name.includes("/"))
                [name, variation] = name.split("/");
            return this.types.has((namespace || "std") + ":" + name + "/" + (variation ?? ""));
        }
        static getValueDatexType(value) {
            value = Value.collapseValue(value, false, true);
            if (value instanceof PrimitivePointer) {
                return value.type;
            }
            else if (value instanceof Pointer) {
                console.warn("Tried to get the type of a pointer reference");
                throw new RuntimeError("Tried to get the type of a pointer reference");
            }
            if (value?.[Datex.DX_TYPE])
                return value[Datex.DX_TYPE];
            let type;
            if (type = Pointer.getByValue(value)?.type)
                return type;
            let custom_type = JSInterface.getValueDatexType(value);
            if (!custom_type) {
                if (value === Datex.VOID)
                    return Type.std.Void;
                if (value === null)
                    return Type.std.Null;
                if (value?.[Datex.DX_TYPE])
                    return value[Datex.DX_TYPE];
                if (value instanceof Unit)
                    return Type.std.Unit;
                if (typeof value == "string")
                    return Type.std.String;
                if (typeof value == "bigint")
                    return Type.std.Int;
                if (typeof value == "number")
                    return Type.std.Float;
                if (typeof value == "boolean")
                    return Type.std.Boolean;
                if (typeof value == "symbol")
                    return Type.std.Void;
                if (value instanceof ArrayBuffer || value instanceof NodeBuffer || value instanceof TypedArray)
                    return Type.std.Buffer;
                if (value instanceof Tuple)
                    return Type.std.Tuple;
                if (value instanceof Array)
                    return Type.std.Array;
                if (value instanceof SyntaxError)
                    return Type.std.SyntaxError;
                if (value instanceof CompilerError)
                    return Type.std.CompilerError;
                if (value instanceof PointerError)
                    return Type.std.PointerError;
                if (value instanceof ValueError)
                    return Type.std.ValueError;
                if (value instanceof PermissionError)
                    return Type.std.PermissionError;
                if (value instanceof TypeError)
                    return Type.std.TypeError;
                if (value instanceof NetworkError)
                    return Type.std.NetworkError;
                if (value instanceof RuntimeError)
                    return Type.std.RuntimeError;
                if (value instanceof SecurityError)
                    return Type.std.SecurityError;
                if (value instanceof AssertionError)
                    return Type.std.AssertionError;
                if (value instanceof Error)
                    return Type.std.Error;
                if (value instanceof Markdown)
                    return Type.std.Markdown;
                if (value instanceof Date)
                    return Type.std.Time;
                if (value instanceof URL)
                    return Type.std.Url;
                if (value instanceof Function)
                    return Type.std.Function;
                if (value instanceof Stream)
                    return Type.std.Stream;
                if (value instanceof Type)
                    return Type.std.Type;
                if (value instanceof Datex.Addresses.Endpoint)
                    return Type.std.Endpoint;
                if (value instanceof Datex.Addresses.Target)
                    return Type.std.Target;
                if (value instanceof Datex.Addresses.Filter)
                    return Type.std.Filter;
                if (value instanceof Datex.Addresses.Not)
                    return Type.std.Not;
                if (value instanceof Scope)
                    return Type.std.Scope;
                if (typeof value == "object")
                    return Type.std.Object;
                else
                    return Type.std.Object;
            }
            return custom_type;
        }
        static getClassDatexType(class_constructor) {
            if (class_constructor[Datex.DX_TYPE])
                return class_constructor[Datex.DX_TYPE];
            let custom_type = JSInterface.getClassDatexType(class_constructor);
            let type;
            if (!custom_type) {
                if (class_constructor == Unit || Unit.isPrototypeOf(class_constructor))
                    return Type.std.Unit;
                if (class_constructor == globalThis.String || globalThis.String.isPrototypeOf(class_constructor))
                    return Type.std.String;
                if (class_constructor == BigInt || BigInt.isPrototypeOf(class_constructor))
                    return Type.std.Int;
                if (class_constructor == Number || Number.isPrototypeOf(class_constructor))
                    return Type.std.Float;
                if (class_constructor == globalThis.Boolean || globalThis.Boolean.isPrototypeOf(class_constructor))
                    return Type.std.Boolean;
                if (class_constructor == ArrayBuffer || class_constructor == NodeBuffer || TypedArray.isPrototypeOf(class_constructor))
                    return Type.std.Buffer;
                if (class_constructor == Tuple || Tuple.isPrototypeOf(class_constructor))
                    return Type.std.Tuple;
                if (class_constructor == Array || Array.isPrototypeOf(class_constructor))
                    return Type.std.Array;
                if (class_constructor == SyntaxError || SyntaxError.isPrototypeOf(class_constructor))
                    return Type.std.SyntaxError;
                if (class_constructor == CompilerError || CompilerError.isPrototypeOf(class_constructor))
                    return Type.std.CompilerError;
                if (class_constructor == PointerError || PointerError.isPrototypeOf(class_constructor))
                    return Type.std.PointerError;
                if (class_constructor == ValueError || ValueError.isPrototypeOf(class_constructor))
                    return Type.std.ValueError;
                if (class_constructor == PermissionError || PermissionError.isPrototypeOf(class_constructor))
                    return Type.std.PermissionError;
                if (class_constructor == TypeError || TypeError.isPrototypeOf(class_constructor))
                    return Type.std.TypeError;
                if (class_constructor == NetworkError || NetworkError.isPrototypeOf(class_constructor))
                    return Type.std.NetworkError;
                if (class_constructor == RuntimeError || RuntimeError.isPrototypeOf(class_constructor))
                    return Type.std.RuntimeError;
                if (class_constructor == SecurityError || SecurityError.isPrototypeOf(class_constructor))
                    return Type.std.SecurityError;
                if (class_constructor == AssertionError || AssertionError.isPrototypeOf(class_constructor))
                    return Type.std.AssertionError;
                if (class_constructor == Error || Error.isPrototypeOf(class_constructor))
                    return Type.std.Error;
                if (class_constructor == Markdown || Markdown.isPrototypeOf(class_constructor))
                    return Type.std.Markdown;
                if (class_constructor == Date || Date.isPrototypeOf(class_constructor))
                    return Type.std.Time;
                if (class_constructor == URL || URL.isPrototypeOf(class_constructor))
                    return Type.std.Url;
                if (class_constructor == Function || Function.isPrototypeOf(class_constructor))
                    return Type.std.Function;
                if (class_constructor == Stream || Stream.isPrototypeOf(class_constructor))
                    return Type.std.Stream;
                if (class_constructor == Type || Type.isPrototypeOf(class_constructor))
                    return Type.std.Type;
                if (class_constructor == Datex.Addresses.Endpoint || Datex.Addresses.Endpoint.isPrototypeOf(class_constructor))
                    return Type.std.Endpoint;
                if (class_constructor == Datex.Addresses.Target || Datex.Addresses.Target.isPrototypeOf(class_constructor))
                    return Type.std.Target;
                if (class_constructor == Datex.Addresses.Filter || Datex.Addresses.Filter.isPrototypeOf(class_constructor))
                    return Type.std.Filter;
                if (class_constructor == Datex.Addresses.Not || Datex.Addresses.Not.isPrototypeOf(class_constructor))
                    return Type.std.Not;
                if (class_constructor == Scope || Scope.isPrototypeOf(class_constructor))
                    return Type.std.Scope;
                if (class_constructor == Object)
                    return Type.std.Object;
                else
                    return Type.std.Object;
            }
            return custom_type;
        }
        static doesValueHaveProperties(value) {
            return value && typeof value == "object" && !(value instanceof Datex.Addresses.Filter ||
                value instanceof globalThis.Function ||
                value instanceof Unit ||
                value instanceof Date ||
                value instanceof ArrayBuffer);
        }
        static isValueObjectEditable(value) {
            return !(value instanceof Set || value instanceof Function);
        }
        static std = {
            Int: Type.get("std:Int"),
            Int_8: Type.get("std:Int").getVariation("8"),
            Int_16: Type.get("std:Int").getVariation("16"),
            Int_32: Type.get("std:Int").getVariation("32"),
            Int_64: Type.get("std:Int").getVariation("64"),
            Int_u8: Type.get("std:Int").getVariation("u8"),
            Int_u16: Type.get("std:Int").getVariation("u16"),
            Int_u32: Type.get("std:Int").getVariation("u32"),
            Int_u64: Type.get("std:Int").getVariation("u64"),
            String: Type.get("std:String"),
            Float: Type.get("std:Float"),
            Unit: Type.get("std:Unit"),
            Boolean: Type.get("std:Boolean"),
            Null: Type.get("std:Null"),
            Void: Type.get("std:Void"),
            Buffer: Type.get("std:Buffer"),
            Set: Type.get("std:Set"),
            Map: Type.get("std:Map"),
            Transaction: Type.get("std:Transaction"),
            Object: Type.get("std:Object"),
            Array: Type.get("std:Array"),
            Tuple: Type.get("std:Tuple"),
            ExtObject: Type.get("std:ExtObject"),
            Type: Type.get("std:Type"),
            Function: Type.get("std:Function"),
            Stream: Type.get("std:Stream"),
            Markdown: Type.get("std:Markdown"),
            Filter: Type.get("std:Filter"),
            Target: Type.get("std:Target"),
            Endpoint: Type.get("std:Endpoint"),
            Time: Type.get("std:Time"),
            Not: Type.get("std:Not"),
            Url: Type.get("std:Url"),
            Task: Type.get("std:Task"),
            Assertion: Type.get("std:Assertion"),
            Iterator: Type.get("std:Iterator"),
            Iteration: Type.get("std:Iteration"),
            Error: Type.get("std:Error"),
            SyntaxError: Type.get("std:SyntaxError"),
            CompilerError: Type.get("std:CompilerError"),
            PointerError: Type.get("std:PointerError"),
            ValueError: Type.get("std:ValueError"),
            PermissionError: Type.get("std:PermissionError"),
            TypeError: Type.get("std:TypeError"),
            NetworkError: Type.get("std:NetworkError"),
            RuntimeError: Type.get("std:RuntimeError"),
            SecurityError: Type.get("std:DatexSecurityError"),
            AssertionError: Type.get("std:AssertionError"),
            Scope: Type.get("std:Scope"),
            And: Type.get("std:And"),
            Or: Type.get("std:Or"),
            Any: Type.get("std:Any"),
            SyncConsumer: Type.get("std:SyncConsumer"),
            ValueConsumer: Type.get("std:ValueConsumer"),
            StreamConsumer: Type.get("std:StreamConsumer"),
        };
        static short_types = {
            [BinaryCode.STD_TYPE_STRING]: Type.std.String,
            [BinaryCode.STD_TYPE_INT]: Type.std.Int,
            [BinaryCode.STD_TYPE_FLOAT]: Type.std.Float,
            [BinaryCode.STD_TYPE_BOOLEAN]: Type.std.Boolean,
            [BinaryCode.STD_TYPE_NULL]: Type.std.Null,
            [BinaryCode.STD_TYPE_VOID]: Type.std.Void,
            [BinaryCode.STD_TYPE_BUFFER]: Type.std.Buffer,
            [BinaryCode.STD_TYPE_CODE_BLOCK]: Type.std.Scope,
            [BinaryCode.STD_TYPE_UNIT]: Type.std.Unit,
            [BinaryCode.STD_TYPE_FILTER]: Type.std.Filter,
            [BinaryCode.STD_TYPE_ARRAY]: Type.std.Array,
            [BinaryCode.STD_TYPE_OBJECT]: Type.std.Object,
            [BinaryCode.STD_TYPE_SET]: Type.std.Set,
            [BinaryCode.STD_TYPE_MAP]: Type.std.Map,
            [BinaryCode.STD_TYPE_TUPLE]: Type.std.Tuple,
            [BinaryCode.STD_TYPE_FUNCTION]: Type.std.Function,
            [BinaryCode.STD_TYPE_STREAM]: Type.std.Stream,
            [BinaryCode.STD_TYPE_ASSERTION]: Type.std.Assertion,
            [BinaryCode.STD_TYPE_TASK]: Type.std.Task,
            [BinaryCode.STD_TYPE_ITERATOR]: Type.std.Iterator,
            [BinaryCode.STD_TYPE_ANY]: Type.std.Any
        };
    }
    Datex.Type = Type;
    Type.std.Function.addImplementedType(Type.std.ValueConsumer);
    Type.std.Endpoint.addImplementedType(Type.std.ValueConsumer);
    Type.std.Filter.addImplementedType(Type.std.ValueConsumer);
    Type.std.Assertion.addImplementedType(Type.std.StreamConsumer);
    Type.std.Function.addImplementedType(Type.std.StreamConsumer);
    Type.std.Stream.addImplementedType(Type.std.StreamConsumer);
    let total_size = 30;
    let current_binary_index = 0;
    let current_filters = [];
    function enableFilterLogicOperations(target_class) {
        target_class.prototype[Symbol.toPrimitive] = function (hint) {
            if (hint === 'number')
                return _customLogicOperators(this);
            return this.toString();
        };
    }
    function _customLogicOperators(object) {
        let binary;
        if (current_binary_index == 0) {
            binary = ("0".repeat(current_binary_index) + "1").padEnd(total_size / 2, "0");
        }
        else {
            binary = ("0".repeat(current_binary_index - 1) + "11").padEnd(total_size / 2, "0");
        }
        binary += ("0".repeat(current_binary_index) + "1").padEnd(total_size / 2, "0");
        console.debug(":: ", binary.match(/.{1,15}/g).join(" "));
        current_binary_index++;
        current_filters.push(object);
        return parseInt(binary, 2);
    }
    class Iterator {
        val;
        done = false;
        internal_iterator;
        constructor(iterator) {
            this.internal_iterator = iterator ?? this.generator();
        }
        async next() {
            if (this.done)
                return false;
            let res = await this.internal_iterator.next();
            this.val = res.value;
            this.done = res.done;
            return !this.done;
        }
        async *[Symbol.iterator]() {
            while (await this.next())
                yield this.val;
        }
        async collapse() {
            let result = new Tuple();
            while (await this.next())
                result.push(this.val);
            return result;
        }
        static get(iterator_or_iterable) {
            if (iterator_or_iterable instanceof Iterator)
                return iterator_or_iterable;
            else if (iterator_or_iterable instanceof Datex.IterationFunction) {
                console.log("iterator for iteration function", iterator_or_iterable);
            }
            else if (iterator_or_iterable instanceof Datex.Tuple && iterator_or_iterable.named.size == 0)
                return new Iterator(Iterator.getJSIterator(iterator_or_iterable.toArray()));
            else
                return new Iterator(Iterator.getJSIterator(iterator_or_iterable));
        }
        static getJSIterator(iterator_or_iterable) {
            if (iterator_or_iterable instanceof Datex.Iterator)
                return iterator_or_iterable.internal_iterator;
            else if (typeof iterator_or_iterable == "function")
                return iterator_or_iterable;
            else
                return (typeof iterator_or_iterable != "string" && iterator_or_iterable?.[Symbol.iterator]) ?
                    iterator_or_iterable?.[Symbol.iterator]() :
                    [iterator_or_iterable][Symbol.iterator]();
        }
        static map(iterator_or_iterable, map) {
            return new MappingIterator(iterator_or_iterable, map);
        }
        *generator() { }
    }
    Datex.Iterator = Iterator;
    class MappingIterator extends Iterator {
        #iterator;
        #map;
        constructor(iterator_or_iterable, map) {
            super();
            this.#iterator = Iterator.getJSIterator(iterator_or_iterable);
            this.#map = map;
        }
        *generator() {
            let result = this.#iterator?.next();
            while (!result?.done) {
                console.log("map", result.value);
                yield this.#map(result.value);
                result = this.#iterator.next();
            }
        }
    }
    class RangeIterator extends Iterator {
        #min;
        #max;
        constructor(min, max) {
            super();
            this.#min = typeof min == "number" ? BigInt(Math.floor(min)) : min;
            this.#max = typeof max == "number" ? BigInt(Math.floor(max)) : max;
        }
        *generator() {
            while (this.#min < this.#max) {
                yield this.#min;
                this.#min++;
            }
        }
    }
    Datex.RangeIterator = RangeIterator;
    class Assertion {
        datex;
        constructor(datex) {
            this.datex = datex;
        }
        async assert(value, SCOPE) {
            const valid = await this.datex.execute([], SCOPE?.sender, SCOPE?.context, value);
            if (valid !== true && valid !== Datex.VOID)
                throw new Datex.AssertionError(valid === false ? 'Invalid' : Datex.Runtime.valueToDatexString(valid));
        }
        handleApply(value, SCOPE) {
            return this.assert(value, SCOPE);
        }
    }
    Datex.Assertion = Assertion;
    class Composition {
    }
    Datex.Composition = Composition;
    let Addresses;
    (function (Addresses) {
        class AndSet extends Set {
        }
        Addresses.AndSet = AndSet;
        class Filter {
            filter = new Datex.Addresses.AndSet();
            normal_filter;
            set(...ors) {
                for (let o = 0; o < ors.length; o++) {
                    const or = ors[o];
                    if (typeof or == "string")
                        ors[o] = Filter.fromString(or);
                }
                this.filter = new Datex.Addresses.AndSet(ors);
                this.calculateNormalForm();
            }
            constructor(...ors) {
                this.set(...ors);
            }
            appendFilter(filter) {
                if (typeof filter == "string")
                    filter = Filter.fromString(filter);
                this.filter.add(filter);
                this.calculateNormalForm();
            }
            static createMergedFilter(f1, f2) {
                return new Filter(f1, f2);
            }
            static concatAndCNFs(cnf1, cnf2) {
                or2: for (let or2 of cnf2 || []) {
                    for (let literal2 of (or2 instanceof Set ? or2 : [or2])) {
                        for (const or1 of cnf1 || []) {
                            let or1_it = (or1 instanceof Set ? or1 : [or1]);
                            let all_1_endpoints = true;
                            for (let literal1 of or1_it) {
                                if (!(literal1 instanceof Datex.Addresses.Endpoint)) {
                                    all_1_endpoints = false;
                                    break;
                                }
                            }
                            if (all_1_endpoints) {
                                for (let literal1 of or1_it) {
                                    if (literal1 == Datex.Addresses.Not.get(literal2)) {
                                        if (or1 instanceof Set)
                                            or1.delete(literal1);
                                        else
                                            cnf1.delete(literal1);
                                        if (or2 instanceof Set)
                                            or2.delete(literal2);
                                        else
                                            continue or2;
                                    }
                                    if (literal2 instanceof Datex.Addresses.Endpoint && literal1 == literal2.main) {
                                        if (or1 instanceof Set)
                                            or1.delete(literal1);
                                        else
                                            cnf1.delete(literal1);
                                    }
                                    if (literal1 instanceof Datex.Addresses.Endpoint && literal2 == literal1.main) {
                                        if (or2 instanceof Set)
                                            or2.delete(literal2);
                                        else
                                            continue or2;
                                    }
                                    if (literal1 instanceof Datex.Addresses.Not && literal2 instanceof Datex.Addresses.Endpoint && literal1.value == literal2.main)
                                        return false;
                                    if (literal2 instanceof Datex.Addresses.Not && literal1 instanceof Datex.Addresses.Endpoint && literal2.value == literal1.main)
                                        return false;
                                    if (literal1 instanceof Datex.Addresses.Endpoint && literal2 instanceof Datex.Addresses.Endpoint) {
                                        if (literal1.main == literal2.main && literal1.instance != undefined && literal2.instance == undefined) {
                                            if (or2 instanceof Set)
                                                or2.delete(literal2);
                                            else
                                                continue or2;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (or2 instanceof Set && or2.size == 0)
                        continue;
                    if (or2 instanceof Set && or2.size == 1)
                        or2 = [...or2][0];
                    cnf1.add(or2);
                }
                return true;
            }
            static *cartesian(...tail) {
                let head = tail.shift();
                let remainder = tail.length ? Filter.cartesian(...tail) : [[]];
                for (const r of remainder || [])
                    for (const h of head || []) {
                        let ors = new Set([...(h instanceof Set ? h : [h]), ...r]);
                        for (const o of ors) {
                            let not_o = Datex.Addresses.Not.get(o);
                            if (ors.has(not_o)) {
                                ors.delete(not_o);
                                ors.delete(o);
                            }
                            if (o instanceof Datex.Addresses.Endpoint && ors.has(o.main)) {
                                ors.delete(o);
                            }
                        }
                        yield ors;
                    }
            }
            static OR(...ors) {
                let ors_set = new Set();
                for (let or of ors) {
                    if (typeof or == "string")
                        ors_set.add(Filter.fromString(or));
                    else
                        ors_set.add(or);
                }
                return new Filter(ors_set);
            }
            static AND(...ands) {
                let and_set = new Set();
                for (let and of ands) {
                    if (typeof and == "string")
                        and_set.add(Filter.fromString(and));
                    else
                        and_set.add(and);
                }
                return new Filter(...and_set);
            }
            static fromString(target_string) {
                if (target_string.match(Regex.LABELED_POINTER)) {
                    let filter = Pointer.getByLabel(target_string.slice(1)).value;
                    if (!(filter instanceof Filter || filter instanceof Datex.Addresses.Target || filter instanceof Array || filter instanceof Set)) {
                        throw new ValueError("Invalid type: <Filter>, <Target>, <Tuple>, <Set> or <Array> expected");
                    }
                    return filter;
                }
                return Datex.Addresses.Target.get(target_string);
            }
            static async fromFilterString(filter_string) {
                const filter = await Runtime.executeDatexLocally(filter_string, { type: DatexProtocolDataType.DATA });
                if (!(filter instanceof Filter || filter instanceof Datex.Addresses.Target || filter instanceof Array || filter instanceof Set)) {
                    console.warn(filter);
                    throw new ValueError("Invalid type: <Filter>, <Target>, <Tuple>, <Set>, or <Array> expected");
                }
                else
                    return filter;
            }
            toString(formatted = false) {
                let string = '';
                let cnf = this.calculateNormalForm();
                let i = cnf.size;
                for (let and of cnf) {
                    string += "(";
                    let j = (and instanceof Set ? and.size : 1);
                    for (let or of (and instanceof Set ? and : [and])) {
                        if (or instanceof Datex.Addresses.Not)
                            string += "~" + or.value.toString();
                        else
                            string += or.toString();
                        j--;
                        if (j > 0)
                            string += " | ";
                    }
                    string += ")";
                    i--;
                    if (i > 0)
                        string += " & ";
                }
                if (cnf.size == 0)
                    string = "()";
                return string;
            }
            getPositiveEndpoints() {
                let cnf = this.calculateNormalForm();
                let endpoints = new Set();
                for (let and of cnf) {
                    for (let or of (and instanceof Set ? and : [and])) {
                        if (or instanceof Datex.Addresses.Endpoint)
                            endpoints.add(or);
                    }
                }
                return endpoints;
            }
            calculateNormalForm(resolve_pointers = true) {
                const cnf = Filter.toNormalForm(this, resolve_pointers);
                if (resolve_pointers)
                    this.normal_filter = cnf;
                return cnf;
            }
            test(...properties) {
                let props = new Set(properties);
                let main_parts = new Set();
                for (let prop of props) {
                    if (prop instanceof Datex.Addresses.Endpoint && prop.main)
                        main_parts.add(prop.main);
                }
                let cnf = this.calculateNormalForm();
                for (let and of cnf) {
                    let valid = false;
                    for (let or of (and instanceof Set ? and : [and])) {
                        if (or instanceof Datex.Addresses.Not && !props.has(or.value) && !main_parts.has(or.value)) {
                            valid = true;
                            break;
                        }
                        if (or instanceof Datex.Addresses.Target && props.has(or)) {
                            valid = true;
                            break;
                        }
                        ;
                        if (or instanceof Datex.Addresses.Target && main_parts.has(or)) {
                            valid = true;
                            break;
                        }
                        ;
                    }
                    if (!valid)
                        return false;
                }
                return true;
            }
            equals(target) {
                if (this.filter.size == 1) {
                    let first = [...this.filter][0];
                    if (first instanceof Set && first.size == 1)
                        first = [...first][0];
                    if (first instanceof Datex.Addresses.Endpoint && target.equals(first))
                        return true;
                }
                return false;
            }
            static toNormalForm(filter, resolve_pointers = true) {
                return this._toNormalForm(filter, resolve_pointers) || new Datex.Addresses.AndSet();
            }
            static _toNormalForm(filter, resolve_pointers = true) {
                if (!resolve_pointers) {
                    const pointer = Pointer.getByValue(filter);
                    if (pointer)
                        return pointer;
                }
                if (filter instanceof Filter)
                    filter = filter.filter;
                let cnf;
                if (filter instanceof Datex.Addresses.Target) {
                    cnf = new Datex.Addresses.AndSet();
                    cnf.add(filter);
                    return cnf;
                }
                if (filter instanceof Datex.Addresses.AndSet) {
                    let first = true;
                    for (let f of filter) {
                        if (first) {
                            let _cnf = Filter._toNormalForm(f);
                            if (_cnf == false)
                                return false;
                            else
                                cnf = _cnf;
                            first = false;
                            continue;
                        }
                        let cnf2 = Filter._toNormalForm(f);
                        if (cnf2 == false)
                            return false;
                        if (!Filter.concatAndCNFs(cnf, cnf2))
                            return false;
                    }
                    return cnf ?? new Datex.Addresses.AndSet();
                }
                if (filter instanceof Set) {
                    cnf = new Datex.Addresses.AndSet();
                    let literals = [];
                    for (let f of filter) {
                        let lit = Filter._toNormalForm(f);
                        if (lit !== false)
                            literals.push(lit);
                    }
                    for (let c of Filter.cartesian(...literals)) {
                        cnf.add(c.size == 1 ? [...c][0] : c);
                    }
                    return cnf;
                }
                if (filter instanceof Datex.Addresses.Not) {
                    cnf = new Datex.Addresses.AndSet();
                    let not_value = filter.value;
                    if (not_value instanceof Filter)
                        not_value = not_value.filter;
                    if (not_value instanceof Datex.Addresses.Target) {
                        cnf.add(filter);
                        return cnf;
                    }
                    if (not_value instanceof Datex.Addresses.Not)
                        return Filter._toNormalForm(not_value.value);
                    if (not_value instanceof Datex.Addresses.AndSet) {
                        let ors = new Set();
                        for (let f of not_value)
                            ors.add(Datex.Addresses.Not.get(f));
                        return Filter._toNormalForm(new Datex.Addresses.AndSet([ors]));
                    }
                    if (not_value instanceof Set) {
                        let ors = new Datex.Addresses.AndSet();
                        for (let f of not_value)
                            ors.add(Datex.Addresses.Not.get(f));
                        return Filter._toNormalForm(ors);
                    }
                }
            }
            serialize() {
                return Runtime.serializeValue(Filter.toNormalForm(this));
            }
            clone() {
                this.calculateNormalForm();
                return new Filter(this.normal_filter);
            }
            evaluate() {
                this.calculateNormalForm();
                let all = new Set();
                for (let ands of this.normal_filter) {
                    if (ands instanceof Datex.Addresses.Target)
                        all.add(ands);
                    else if (ands instanceof Set) {
                        for (let and of ands) {
                            if (and instanceof Datex.Addresses.Target)
                                all.add(and);
                        }
                    }
                }
                return all;
            }
        }
        Addresses.Filter = Filter;
        class Not {
            static negation_map = new WeakMap();
            value;
            static get(value) {
                if (value instanceof Not)
                    return value.value;
                if (this.negation_map.has(value))
                    return this.negation_map.get(value);
                else
                    return new Not(value);
            }
            constructor(value) {
                this.value = value;
                Not.negation_map.set(value, this);
            }
        }
        Addresses.Not = Not;
        let ElType;
        (function (ElType) {
            ElType[ElType["PERSON"] = 0] = "PERSON";
            ElType[ElType["LABEL"] = 1] = "LABEL";
            ElType[ElType["INSTITUTION"] = 2] = "INSTITUTION";
            ElType[ElType["BOT"] = 3] = "BOT";
            ElType[ElType["FLAG"] = 4] = "FLAG";
        })(ElType = Addresses.ElType || (Addresses.ElType = {}));
        class Target {
            static targets = new Map();
            static prefix = "@";
            static type;
            handleApply(value, SCOPE) {
            }
            static getClassFromBinaryCode(binary_code) {
                switch (binary_code) {
                    case BinaryCode.PERSON_ALIAS: return Datex.Addresses.Person;
                    case BinaryCode.INSTITUTION_ALIAS: return Datex.Addresses.Institution;
                    case BinaryCode.BOT: return Datex.Addresses.Bot;
                    case BinaryCode.ENDPOINT: return Datex.Addresses.IdEndpoint;
                    case BinaryCode.PERSON_ALIAS_WILDCARD: return Datex.Addresses.Person;
                    case BinaryCode.INSTITUTION_ALIAS_WILDCARD: return Datex.Addresses.Institution;
                    case BinaryCode.BOT_WILDCARD: return Datex.Addresses.Bot;
                    case BinaryCode.ENDPOINT_WILDCARD: return Datex.Addresses.IdEndpoint;
                }
            }
            static isWildcardBinaryCode(binary_code) {
                switch (binary_code) {
                    case BinaryCode.PERSON_ALIAS_WILDCARD:
                    case BinaryCode.INSTITUTION_ALIAS_WILDCARD:
                    case BinaryCode.BOT_WILDCARD:
                    case BinaryCode.ENDPOINT_WILDCARD:
                        return true;
                    default:
                        return false;
                }
            }
            static get(name, subspaces, instance, appspace, filter_class_or_type) {
                let classType = this.getClassFromBinaryCode(filter_class_or_type) ?? filter_class_or_type;
                if (typeof name == "string") {
                    if (name.startsWith("@+")) {
                        name = name.substring(2);
                        classType = Datex.Addresses.Institution;
                    }
                    else if (name.startsWith("@@")) {
                        name = name.substring(2);
                        classType = Datex.Addresses.IdEndpoint;
                    }
                    else if (name.startsWith("@")) {
                        name = name.substring(1);
                        classType = Datex.Addresses.Person;
                    }
                    else if (name.startsWith("*")) {
                        name = name.substring(1);
                        classType = Datex.Addresses.Bot;
                    }
                    let split = name.split("/");
                    name = split[0];
                    if (split[1])
                        instance = split[1];
                    split = name.split(":");
                    name = split[0];
                    if (split[1])
                        subspaces = split.slice(1).filter(s => s);
                }
                if (typeof classType != "function")
                    throw new SyntaxError("Invalid Target: " + name);
                const target = new classType(name, subspaces, instance, appspace);
                if (typeof filter_class_or_type == "number" && this.isWildcardBinaryCode(filter_class_or_type))
                    return WildcardTarget.getWildcardTarget(target);
                else
                    return target;
            }
        }
        Addresses.Target = Target;
        class Endpoint extends Datex.Addresses.Target {
            #name;
            #subspaces = [];
            #appspace;
            #binary;
            #instance;
            #instance_binary;
            #prefix;
            #type;
            #base;
            #main;
            #n;
            n;
            get name() { return this.#name; }
            get instance() { return this.#instance; }
            get instance_binary() { return this.#instance_binary; }
            get prefix() { return this.#prefix; }
            get type() { return this.#type; }
            get main() { return this.#main; }
            get base() { return this.#base; }
            get binary() { return this.#binary; }
            get subspaces() { return this.#subspaces; }
            get appspace() { return this.#appspace; }
            static DEFAULT_INSTANCE = new Uint8Array(8);
            get id_endpoint() {
                return this.__id_endpoint;
            }
            constructor(name, subspaces, instance, appspace) {
                super();
                if (name instanceof Uint8Array) {
                    this.#binary = name;
                    name = Pointer.buffer2hex(name);
                }
                else if (typeof name != "string")
                    throw new ValueError("<Target> name must be a <String> or a <Buffer>");
                if (!name)
                    throw new ValueError("Cannot create an empty filter target");
                if (instance instanceof Uint8Array) {
                    this.#instance_binary = instance;
                    instance = new TextDecoder().decode(instance).replaceAll("\u0000", "");
                }
                else if (typeof instance == "number") {
                    this.#instance_binary = new Uint8Array(new BigUint64Array([BigInt(instance)]));
                    instance = Pointer.buffer2hex(this.#instance_binary);
                }
                else if (instance == undefined) {
                    this.#instance_binary = Datex.Addresses.Endpoint.DEFAULT_INSTANCE;
                }
                else if (typeof instance == "string") {
                    this.#instance_binary = new TextEncoder().encode(instance);
                }
                else {
                    console.log("inst", instance);
                    throw new ValueError("<Target> instance must be a <String>, <Integer> or a <Buffer>");
                }
                if (typeof name == "string" && !this.#binary && this.constructor.prefix == "@@") {
                    try {
                        this.#binary = Pointer.hex2buffer(name);
                    }
                    catch (e) {
                        throw new ValueError("Invalid binary id for <Target>");
                    }
                }
                if ((this.#binary?.byteLength ?? 0 + this.#instance_binary?.byteLength ?? 0) > 20)
                    throw new ValueError("ID Endpoint size must be <=20 bytes");
                if (subspaces?.length) {
                    this.#subspaces = subspaces;
                    this.#base = Datex.Addresses.Target.get(name, null, null, null, this.constructor);
                }
                if (instance) {
                    this.#instance = instance;
                    this.#main = Datex.Addresses.Target.get(name, subspaces, null, appspace, this.constructor);
                }
                this.#prefix = this.constructor.prefix;
                this.#type = this.constructor.type;
                this.#name = name;
                this.#appspace = appspace;
                this.#n = this.toString();
                this.n = this.#n;
                if (Datex.Addresses.Target.targets.has(this.#n)) {
                    return Datex.Addresses.Target.targets.get(this.#n);
                }
                else
                    Datex.Addresses.Target.targets.set(this.#n, this);
            }
            toString(with_instance = true) {
                return this._toString(with_instance);
            }
            toJSON() {
                return 'dx::' + this.toString();
            }
            _toString(with_instance = true) {
                return `${this.prefix}${this.name}${this.subspaces.length ? "." + this.subspaces.join(".") : ""}${with_instance && this.instance ? "/" + this.instance : ""}${this.appspace ? this.appspace.toString() : ""}`;
            }
            getInstance(instance) {
                return Datex.Addresses.Target.get(this.name, this.subspaces, instance, this.appspace, this.constructor);
            }
            getSubspace(subspace) {
                return Datex.Addresses.Target.get(this.name, [...this.subspaces, subspace], this.instance, this.appspace, this.constructor);
            }
            equals(other) {
                return other == this || (other?.instance == this.instance && (other?.id_endpoint == this || this.id_endpoint == other || this.id_endpoint == other?.id_endpoint));
            }
            setIdEndpoint(id_endpoint) {
                if (this.__id_endpoint != undefined)
                    throw new SecurityError("Id Endpoint for this Target is already set");
                else
                    this.__id_endpoint = id_endpoint;
            }
            setInterfaceChannels(info) {
                this.interface_channel_info = info;
            }
            getInterfaceChannelInfo(channel) {
                return this.interface_channel_info[channel];
            }
            static fromString(string) {
                try {
                    return Datex.Addresses.Target.get(string);
                }
                catch {
                    return Datex.Addresses.Target.get("@TODO_IPV6");
                }
            }
            static createNewID() {
                const id = new DataView(new ArrayBuffer(12));
                const timestamp = Math.round((new Date().getTime() - DatexCompiler.BIG_BANG_TIME) / 1000);
                id.setUint32(0, timestamp);
                id.setBigUint64(4, BigInt(Math.floor(Math.random() * (2 ** 64))));
                return `@@${Datex.Pointer.buffer2hex(new Uint8Array(id.buffer))}`;
            }
            static getNewEndpoint() {
                return IdEndpoint.get(Addresses.Endpoint.createNewID());
            }
        }
        Addresses.Endpoint = Endpoint;
        class WildcardTarget extends Datex.Addresses.Target {
            target;
            static wildcard_targets = new WeakMap();
            static getWildcardTarget(target) {
                if (this.wildcard_targets.has(target))
                    return this.wildcard_targets.get(target);
                else {
                    const wildcard_target = new WildcardTarget(target);
                    this.wildcard_targets.get(target);
                    return wildcard_target;
                }
            }
            toString() {
                return this.target?.toString() ?? "### invalid wildcard target ###";
            }
            constructor(target) {
                super();
                this.target = target;
            }
        }
        Addresses.WildcardTarget = WildcardTarget;
        class Person extends Datex.Addresses.Endpoint {
            static prefix = "@";
            static type = BinaryCode.PERSON_ALIAS;
            static get(name, subspaces, instance, appspace) { return super.get(name, subspaces, instance, appspace, Datex.Addresses.Person); }
        }
        Addresses.Person = Person;
        class Bot extends Datex.Addresses.Endpoint {
            static prefix = "*";
            static type = BinaryCode.BOT;
            static get(name, subspaces, instance, appspace) { return super.get(name, subspaces, instance, appspace, Datex.Addresses.Bot); }
        }
        Addresses.Bot = Bot;
        class Institution extends Datex.Addresses.Endpoint {
            static prefix = "@+";
            static type = BinaryCode.INSTITUTION_ALIAS;
            static get(name, subspaces, instance, appspace) { return super.get(name, subspaces, instance, appspace, Datex.Addresses.Institution); }
        }
        Addresses.Institution = Institution;
        class IdEndpoint extends Datex.Addresses.Endpoint {
            static prefix = "@@";
            static type = BinaryCode.ENDPOINT;
            static get(name, subspaces, instance, appspace) { return super.get(name, subspaces, instance, appspace, Datex.Addresses.IdEndpoint); }
            constructor(name, subspaces, instance, appspace) {
                super(name, subspaces, instance, appspace);
                if (this.id_endpoint == undefined)
                    this.setIdEndpoint(this);
            }
            getPointerPrefix() {
                return new Uint8Array([
                    this.binary.byteLength == 16 ? Pointer.POINTER_TYPE.IPV6_ID : Pointer.POINTER_TYPE.DEFAULT,
                    ...this.binary,
                    ...this.instance_binary
                ]);
            }
            getStaticPointerPrefix() {
                return new Uint8Array([
                    Pointer.POINTER_TYPE.STATIC,
                    ...this.binary
                ]);
            }
        }
        Addresses.IdEndpoint = IdEndpoint;
        Addresses.LOCAL_ENDPOINT = Datex.Addresses.IdEndpoint.get("@@000000000000000000000000");
        Addresses.BROADCAST = Datex.Addresses.IdEndpoint.get("@@FFFFFFFFFFFFFFFFFFFFFFFF");
    })(Addresses = Datex.Addresses || (Datex.Addresses = {}));
    const DATEX_ERROR = {
        NO_VALUE: 0x00,
        NO_EXTERNAL_CONNECTION: 0x10,
        NO_OUTPUT: 0x11,
        NO_RECEIVERS: 0x12,
        TOO_MANY_REDIRECTS: 0x13,
    };
    const DATEX_ERROR_MESSAGE = {
        [DATEX_ERROR.NO_VALUE]: "No value provided",
        [DATEX_ERROR.NO_EXTERNAL_CONNECTION]: "No external connections, can only execute DATEX locally",
        [DATEX_ERROR.NO_OUTPUT]: "No DATEX output available",
        [DATEX_ERROR.NO_RECEIVERS]: "DATEX has no receivers and is not flooding, cannot send",
        [DATEX_ERROR.TOO_MANY_REDIRECTS]: "Too many redirects",
    };
    class Error extends globalThis.Error {
        message;
        datex_stack;
        type = "";
        code;
        constructor(message = '', stack = [[Runtime.endpoint]]) {
            super();
            this.name = this.constructor.name.replace("Datex", "");
            if (typeof stack == "object" && stack != null && !(stack instanceof Array)) {
                this.addScopeToStack(stack);
            }
            else if (Runtime.OPTIONS.ERROR_STACK_TRACES && stack instanceof Array)
                this.datex_stack = stack;
            else
                this.datex_stack = [];
            if (typeof message == "string")
                this.message = message;
            else if (typeof message == "number" || typeof message == "bigint") {
                this.code = BigInt(message);
                this.message = DATEX_ERROR_MESSAGE[Number(this.code)];
            }
            else
                this.message = null;
            this.updateStackMessage();
        }
        addScopeToStack(scope) {
            if (Runtime.OPTIONS.ERROR_STACK_TRACES) {
                if (!this.datex_stack)
                    this.datex_stack = [];
                this.datex_stack.push([Runtime.endpoint, scope.sender + " " + scope.header.sid?.toString(16) + ":" + scope.current_index?.toString(16)]);
                this.updateStackMessage();
            }
        }
        updateStackMessage() {
            this.stack = this.name + ": " + (this.message ?? "Unknown") + '\n';
            for (let d of this.datex_stack.reverse()) {
                this.stack += `    on ${d[0]} (${d[1] ?? "Unknown"})\n`;
            }
        }
        toString() {
            return this.message;
        }
    }
    Datex.Error = Error;
    class SyntaxError extends Error {
    }
    Datex.SyntaxError = SyntaxError;
    class CompilerError extends Error {
    }
    Datex.CompilerError = CompilerError;
    class PointerError extends Error {
    }
    Datex.PointerError = PointerError;
    class ValueError extends Error {
    }
    Datex.ValueError = ValueError;
    class PermissionError extends Error {
    }
    Datex.PermissionError = PermissionError;
    class TypeError extends Error {
    }
    Datex.TypeError = TypeError;
    class NetworkError extends Error {
    }
    Datex.NetworkError = NetworkError;
    class RuntimeError extends Error {
    }
    Datex.RuntimeError = RuntimeError;
    class SecurityError extends Error {
    }
    Datex.SecurityError = SecurityError;
    class AssertionError extends Error {
    }
    Datex.AssertionError = AssertionError;
    async function getFileContent(url, file_path) {
        if (file_path && fs) {
            return new TextDecoder().decode(fs.readFileSync(new URL(file_path, import.meta.url)));
        }
        let res;
        try {
            res = await (await fetch(url, { credentials: 'include', mode: 'cors' })).text();
            await Datex.Storage.setItem(url, res);
        }
        catch (e) {
            res = await Datex.Storage.getItem(url);
        }
        return res;
    }
    Datex.getFileContent = getFileContent;
    class Runtime {
        static OPTIONS = {
            DEFAULT_REQUEST_TIMEOUT: 5000,
            USE_BIGINTS: true,
            ERROR_STACK_TRACES: true
        };
        static PRECOMPILED_DXB;
        static VERSION = "0.1.0";
        static HOST_ENV = '';
        static #blockchain_interface;
        static get blockchain_interface() {
            return this.#blockchain_interface;
        }
        static set blockchain_interface(blockchain_interface) {
            this.#blockchain_interface = blockchain_interface;
        }
        static #endpoint;
        static get endpoint() {
            return this.#endpoint;
        }
        static set endpoint(endpoint) {
            if (!endpoint.id_endpoint) {
                throw new RuntimeError("Endpoint has no associated Endpoint Id, cannot set local runtime endpoint");
            }
            logger.success("Changing local endpoint to " + endpoint);
            this.#endpoint = endpoint;
            Pointer.pointer_prefix = this.endpoint.id_endpoint.getPointerPrefix();
            if (endpoint != Datex.Addresses.LOCAL_ENDPOINT)
                Pointer.is_local = false;
            else
                Pointer.is_local = true;
            Observers.call(this, "endpoint", this.#endpoint);
        }
        static onEndpointChanged(listener) {
            Observers.add(this, "endpoint", listener);
        }
        static main_node;
        static utf8_decoder = new TextDecoder("utf-8");
        static utf8_encoder = new TextEncoder();
        static initialized = false;
        static END_BIN_CODES = [
            undefined,
            BinaryCode.CLOSE_AND_STORE,
            BinaryCode.IMPLEMENTS,
            BinaryCode.EXTENDS,
            BinaryCode.MATCHES,
            BinaryCode.ARRAY_END,
            BinaryCode.SUBSCOPE_END,
            BinaryCode.OBJECT_END,
            BinaryCode.TUPLE_END,
            BinaryCode.ELEMENT,
            BinaryCode.ELEMENT_WITH_KEY,
            BinaryCode.ELEMENT_WITH_INT_KEY,
            BinaryCode.ELEMENT_WITH_DYNAMIC_KEY,
            BinaryCode.KEY_PERMISSION,
            BinaryCode.EQUAL_VALUE,
            BinaryCode.EQUAL,
            BinaryCode.NOT_EQUAL_VALUE,
            BinaryCode.NOT_EQUAL,
            BinaryCode.GREATER,
            BinaryCode.GREATER_EQUAL,
            BinaryCode.LESS,
            BinaryCode.LESS_EQUAL,
            BinaryCode.ADD,
            BinaryCode.SUBTRACT,
            BinaryCode.MULTIPLY,
            BinaryCode.DIVIDE,
            BinaryCode.OR,
            BinaryCode.AND,
        ];
        static readonly_internal_vars = new Set([
            'current',
            'sender',
            'timestamp',
            'signed',
            'encrypted',
            'meta',
            'this',
            'static'
        ]);
        static callbacks_by_sid = new Map();
        static detailed_result_callbacks_by_sid = new Map();
        static detailed_result_callbacks_by_sid_multi = new Map();
        static setMainNode(main_node) {
            this.main_node = main_node;
        }
        static STD_STATIC_SCOPE;
        static STD_TYPES_ABOUT;
        static default_static_scope = new Tuple();
        static addRootExtension(scope) {
            DatexObject.extend(this.default_static_scope, scope);
        }
        static addRootVariable(name, value) {
            this.default_static_scope[name] = value;
        }
        static #datex_out_handler_initialized_resolve;
        static #datex_out_init_promise = new Promise(resolve => this.#datex_out_handler_initialized_resolve = resolve);
        static local_input_handler = Runtime.getDatexInputHandler();
        static datex_out = async (dxb, to, flood) => {
            if (!(to instanceof Datex.Addresses.Endpoint && Runtime.endpoint.equals(to))) {
                throw new NetworkError(DATEX_ERROR.NO_EXTERNAL_CONNECTION);
            }
            else
                this.local_input_handler(dxb);
        };
        static setDatexOut(handler) {
            this.datex_out = handler;
            if (this.#datex_out_handler_initialized_resolve) {
                this.#datex_out_handler_initialized_resolve();
                this.#datex_out_handler_initialized_resolve = undefined;
                this.#datex_out_init_promise = undefined;
            }
        }
        static scope_symmetric_keys = new Map();
        static async getOwnSymmetricKey(scope_id) {
            if (!this.scope_symmetric_keys.has(this.endpoint))
                this.scope_symmetric_keys.set(this.endpoint, new Map());
            let sender_map = this.scope_symmetric_keys.get(this.endpoint);
            if (!sender_map.has(scope_id))
                sender_map.set(scope_id, await Crypto.generateSymmetricKey());
            return sender_map.get(scope_id);
        }
        static async getScopeSymmetricKeyForSender(scope_id, sender) {
            if (!this.scope_symmetric_keys.has(sender))
                this.scope_symmetric_keys.set(sender, new Map());
            let sender_map = this.scope_symmetric_keys.get(sender);
            if (!sender_map.has(scope_id)) {
                throw new SecurityError("Found no encryption key for this scope");
            }
            return sender_map.get(scope_id);
        }
        static async setScopeSymmetricKeyForSender(scope_id, sender, key) {
            if (!this.scope_symmetric_keys.has(sender))
                this.scope_symmetric_keys.set(sender, new Map());
            this.scope_symmetric_keys.get(sender).set(scope_id, key);
        }
        static async removeScopeSymmetricKeyForSender(scope_id, sender) {
            this.scope_symmetric_keys.get(sender)?.delete(scope_id);
        }
        static async resolveUrl(url_string) {
            const url = url_string instanceof URL ? url_string : new URL(url_string);
            if (url.protocol == "https:" || url.protocol == "http:") {
                let response = await fetch(url_string, { headers: {
                        Cookie: 'secret=njh23zjod%C3%96%C3%84A%3D)JNCBnvoaidjsako1mncvdfsnuafhlaidosfjmDASDFAJFEDNnbcuai28z9ueaof9jnncbgaabdADAF'
                    } });
                let type = response.headers.get('content-type');
                if (type == "application/datex" || type == "text/dxb") {
                    return this.executeDXBLocally(await response.arrayBuffer());
                }
                else if (type?.startsWith("text/datex")) {
                    return this.executeDatexLocally(await response.text());
                }
                else if (type?.startsWith("application/json")) {
                    return response.json();
                }
                else if (type?.startsWith("image/")) {
                    return Datex.Type.get('std:image').cast(await response.arrayBuffer());
                }
                else
                    return response.text();
            }
        }
        static async parseDatexData(dx, data) {
            return Runtime.executeDXBLocally(await DatexCompiler.compile(dx, data, { sign: false, encrypt: false, type: DatexProtocolDataType.DATA }));
        }
        static getValueFromBase64DXB(dxb_base64) {
            return Runtime.executeDXBLocally(base64ToArrayBuffer(dxb_base64));
        }
        static async decodeValueBase64(dxb_base64) {
            const scope = Runtime.createNewInitialScope();
            Runtime.updateScope(scope, base64ToArrayBuffer(dxb_base64), { end_of_scope: true, sender: Runtime.endpoint });
            return Runtime.simpleScopeExecution(scope);
        }
        static async decodeValue(dxb) {
            const scope = Runtime.createNewInitialScope();
            Runtime.updateScope(scope, dxb, { end_of_scope: true, sender: Runtime.endpoint });
            return Runtime.simpleScopeExecution(scope);
        }
        static async cloneValue(value) {
            const pointer = Pointer.pointerifyValue(value);
            return await Runtime.decodeValue(DatexCompiler.encodeValue(value, undefined, true, false, true));
        }
        static async deepCloneValue(value) {
            return await Runtime.decodeValue(DatexCompiler.encodeValue(value, undefined, true, true));
        }
        static async executeDatexLocally(datex, options) {
            return Runtime.executeDXBLocally(await DatexCompiler.compile(datex, [], { sign: false, encrypt: false, ...options }));
        }
        static async executeDXBLocally(dxb) {
            let header;
            let dxb_body;
            const res = await this.parseHeader(dxb);
            if (res instanceof Array) {
                header = res[0];
                dxb_body = res[1].buffer;
            }
            else {
                throw new Error("Cannot execute dxb locally, the receiver defined in the header is external");
            }
            const scope = Runtime.createNewInitialScope(header);
            Runtime.updateScope(scope, dxb_body, header);
            return Runtime.simpleScopeExecution(scope);
        }
        static async compileAdvanced(data) {
            let header_options = data[2];
            if (header_options.sid == null)
                header_options.sid = DatexCompiler.generateSID();
            if (header_options.encrypt && !header_options.sym_encrypt_key) {
                header_options.sym_encrypt_key = await this.getOwnSymmetricKey(header_options.sid);
                header_options.send_sym_encrypt_key = true;
            }
            return DatexCompiler.compile(...data);
        }
        static async datexOut(data, to = Runtime.endpoint, sid, wait_for_result = true, encrypt = false, detailed_result_callback, flood = false, flood_exclude, timeout) {
            if (!(to instanceof Datex.Addresses.Endpoint && Runtime.endpoint.equals(to)) && this.#datex_out_init_promise) {
                await this.#datex_out_init_promise;
            }
            let dxb;
            if (data instanceof Array) {
                if (!data[2])
                    data[2] = {};
                if (!data[2].to && to != null)
                    data[2].to = to;
                if (!data[2].sid && sid != null)
                    data[2].sid = sid;
                if (data[2].flood == null && flood != null)
                    data[2].flood = flood;
                if (data[2].encrypt == null && encrypt != null)
                    data[2].encrypt = encrypt;
                dxb = await this.compileAdvanced(data);
                sid = data[2].sid ?? sid;
                flood = data[2].flood ?? flood;
                encrypt = data[2].encrypt ?? encrypt;
            }
            else
                dxb = data;
            if (!sid)
                throw new RuntimeError("Could not get an SID for sending data");
            if (!this.datex_out)
                throw new NetworkError(DATEX_ERROR.NO_OUTPUT);
            if (!flood && !to)
                throw new NetworkError(DATEX_ERROR.NO_RECEIVERS);
            const unique_sid = sid + "-" + (data[2]?.return_index ?? 0);
            const evaluated_receivers = to ? this.evaluateFilter(to) : null;
            if (dxb instanceof ArrayBuffer) {
                return this.datexOutSingleBlock(dxb, evaluated_receivers, sid, unique_sid, data, wait_for_result, encrypt, detailed_result_callback, flood, flood_exclude, timeout);
            }
            else {
                const reader = dxb.getReader();
                let next;
                let end_of_scope = false;
                while (true) {
                    next = await reader.read();
                    if (next.done)
                        break;
                    if (next.value.byteLength == 0)
                        end_of_scope = true;
                    else if (end_of_scope)
                        return this.datexOutSingleBlock(next.value, evaluated_receivers, sid, unique_sid, data, wait_for_result, encrypt, detailed_result_callback, flood, flood_exclude, timeout);
                    else
                        this.datexOutSingleBlock(next.value, evaluated_receivers, sid, unique_sid, data, false, encrypt, null, flood, flood_exclude, timeout);
                }
            }
        }
        static datexOutSingleBlock(dxb, to, sid, unique_sid, data, wait_for_result = true, encrypt = false, detailed_result_callback, flood = false, flood_exclude, timeout) {
            if (to?.size == 0)
                return;
            return new Promise((resolve, reject) => {
                IOHandler.handleDatexSent(dxb, to);
                if (flood) {
                    this.datex_out(dxb, flood_exclude, true)?.catch(e => reject(e));
                }
                else if (to) {
                    for (let to_endpoint of to) {
                        this.datex_out(dxb, to_endpoint)?.catch(e => reject(e));
                    }
                }
                if (detailed_result_callback) {
                    if (to.size == 1)
                        this.detailed_result_callbacks_by_sid.set(unique_sid, detailed_result_callback);
                    else
                        this.detailed_result_callbacks_by_sid_multi.set(unique_sid, detailed_result_callback);
                }
                if (wait_for_result) {
                    this.callbacks_by_sid.set(unique_sid, [resolve, reject]);
                    if (timeout == undefined)
                        timeout = this.OPTIONS.DEFAULT_REQUEST_TIMEOUT;
                    setTimeout(() => {
                        reject(new NetworkError("DATEX request timeout after " + timeout + "ms: " + unique_sid));
                    }, timeout);
                }
                else
                    resolve(true);
            });
        }
        static evaluateFilter(filter) {
            if (filter instanceof Datex.Addresses.Target)
                return new Set([filter]);
            else if (filter instanceof Datex.Addresses.Filter)
                return filter.evaluate();
            else
                logger.error("cannot evaluate non-filter", filter);
        }
        static async redirectDatex(datex, header, wait_for_result = true) {
            if (header.routing.ttl == 0)
                throw new NetworkError(DATEX_ERROR.TOO_MANY_REDIRECTS);
            datex = DatexCompiler.setHeaderTTL(datex, header.routing.ttl - 1);
            logger.debug("redirect :: ", header.sid + " > " + header.routing.receivers?.toString());
            let res = await this.datexOut(datex, header.routing.receivers, header.sid, wait_for_result);
            return res;
        }
        static floodDatex(datex, exclude, ttl) {
            datex = DatexCompiler.setHeaderTTL(datex, ttl);
            let [dxb_header] = this.parseHeaderSynchronousPart(datex);
            this.datexOut(datex, null, dxb_header.sid, false, false, null, true, exclude);
        }
        static async init(endpoint) {
            if (endpoint)
                Runtime.endpoint = endpoint;
            if (this.initialized)
                return;
            this.initialized = true;
            this.PRECOMPILED_DXB = {
                SET_PROPERTY: await PrecompiledDXB.create('?.? = ?'),
                SET_WILDCARD: await PrecompiledDXB.create('?.* = ?'),
                CLEAR_WILDCARD: await PrecompiledDXB.create('?.* = void'),
                STREAM: await PrecompiledDXB.create('? << ?'),
            };
            Pointer.createLabel({
                REQUEST: DatexProtocolDataType.REQUEST,
                RESPONSE: DatexProtocolDataType.RESPONSE,
                DATA: DatexProtocolDataType.DATA,
                HELLO: DatexProtocolDataType.HELLO,
                LOCAL_REQ: DatexProtocolDataType.LOCAL_REQ,
                BC_TRNSCT: DatexProtocolDataType.BC_TRNSCT
            }, "TYPE");
            this.STD_STATIC_SCOPE = StaticScope.get("std");
            this.STD_STATIC_SCOPE.setVariable('print', Pointer.create(null, new Function(null, (meta, ...params) => {
                IOHandler.stdOut(params, meta.sender);
            }, Datex.Runtime.endpoint, new Tuple({ value: Type.std.Object }), null, 0), true, undefined, false).value);
            this.STD_STATIC_SCOPE.setVariable('printf', Pointer.create(null, new Function(null, async (meta, ...params) => {
                await IOHandler.stdOutF(params, meta.sender);
            }, Datex.Runtime.endpoint, new Tuple({ value: Type.std.Object }), null, 0), true, undefined, false).value);
            this.STD_STATIC_SCOPE.setVariable('printn', Pointer.create(null, new Function(null, (meta, ...params) => {
                logger.success("std.printn >", ...params);
            }, Datex.Runtime.endpoint, new Tuple({ value: Type.std.Object }), null, 0), true, undefined, false).value);
            this.STD_STATIC_SCOPE.setVariable('read', Pointer.create(null, new Function(null, (meta, msg_start = "", msg_end = "") => {
                return IOHandler.stdIn(msg_start, msg_end, meta.sender);
            }, Datex.Runtime.endpoint, new Tuple({ msg_start: Type.std.String, msg_end: Type.std.String }), null, 0), true, undefined, false).value);
            this.STD_STATIC_SCOPE.setVariable('sleep', Pointer.create(null, new Function(null, async (meta, time_ms) => {
                return new Promise(resolve => setTimeout(() => resolve(), Number(time_ms)));
            }, Datex.Runtime.endpoint, new Tuple({ time_ms: Type.std.Int }), null, 0), true, undefined, false).value);
            this.STD_TYPES_ABOUT = await this.parseDatexData(await getFileContent("/unyt_core/dx_data/type_info.dx", './dx_data/type_info.dx'));
            DatexObject.seal(this.STD_STATIC_SCOPE);
            Runtime.addRootExtension(Runtime.STD_STATIC_SCOPE);
            logger.success("Initialized <std:> library");
        }
        static decompileBase64(dxb_base64, formatted = false, has_header = true) {
            return Runtime.decompile(base64ToArrayBuffer(dxb_base64), false, formatted, false, has_header);
        }
        static formatVariableName(name, prefix) {
            return prefix + (typeof name == "number" ? name.toString(16) : name);
        }
        static decompile(dxb, comments = true, formatted = true, formatted_strings = true, has_header = true) {
            let uint8 = new Uint8Array(dxb);
            if (!dxb) {
                logger.error("DATEX missing");
                return "### INVALID DATEX ###";
            }
            if (has_header) {
                try {
                    let res = this.parseHeaderSynchronousPart(dxb);
                    if (!(res instanceof Array))
                        return "### ERROR: Invalid DATEX Header ###";
                    uint8 = res[1];
                }
                catch (e) {
                    return "### ERROR: Invalid DATEX Header ###";
                }
            }
            let buffer = uint8.buffer;
            let data_view = new DataView(buffer);
            let append_comments = "";
            let current_index = 0;
            let TOKEN_TYPE;
            (function (TOKEN_TYPE) {
                TOKEN_TYPE[TOKEN_TYPE["VALUE"] = 0] = "VALUE";
                TOKEN_TYPE[TOKEN_TYPE["SUBSCOPE"] = 1] = "SUBSCOPE";
            })(TOKEN_TYPE || (TOKEN_TYPE = {}));
            let tokens = [{ type: TOKEN_TYPE.SUBSCOPE, value: [] }];
            let current_scope = tokens[0].value;
            let parent_scopes = [];
            const extractVariableName = () => {
                let length = uint8[current_index++];
                let name;
                if (length == 0) {
                    name = data_view.getUint16(current_index, true);
                    current_index += Uint16Array.BYTES_PER_ELEMENT;
                }
                else {
                    name = Runtime.utf8_decoder.decode(uint8.subarray(current_index, current_index + length));
                    current_index += length;
                }
                return name;
            };
            const extractType = (is_extended = false) => {
                let ns_length = uint8[current_index++];
                let name_length = uint8[current_index++];
                let variation_length = 0;
                let has_parameters;
                if (is_extended) {
                    variation_length = uint8[current_index++];
                    has_parameters = uint8[current_index++] ? true : false;
                }
                let ns = Runtime.utf8_decoder.decode(uint8.subarray(current_index, current_index += ns_length));
                let type = Runtime.utf8_decoder.decode(uint8.subarray(current_index, current_index += name_length));
                let varation = is_extended ? Runtime.utf8_decoder.decode(uint8.subarray(current_index, current_index += variation_length)) : undefined;
                return [Type.get(ns, type, varation), has_parameters];
            };
            const actionToString = (action) => {
                let action_string;
                switch (action) {
                    case BinaryCode.ADD:
                        action_string = "+";
                        break;
                    case BinaryCode.SUBTRACT:
                        action_string = "-";
                        break;
                    case BinaryCode.MULTIPLY:
                        action_string = "*";
                        break;
                    case BinaryCode.DIVIDE:
                        action_string = "/";
                        break;
                    case BinaryCode.AND:
                        action_string = "&";
                        break;
                    case BinaryCode.OR:
                        action_string = "|";
                        break;
                    case BinaryCode.CREATE_POINTER:
                        action_string = ":";
                        break;
                }
                return action_string;
            };
            const enterSubScope = (type) => {
                parent_scopes.push(current_scope);
                current_scope.push({ type: TOKEN_TYPE.SUBSCOPE, bin: type, value: [] });
                current_scope = current_scope[current_scope.length - 1].value;
            };
            const exitSubScope = () => {
                if (!parent_scopes.length) {
                    logger.error("No parent scope to go to");
                    append_comments += "### ERROR: No parent scope to go to ###";
                    throw "No parent scope to go to";
                }
                current_scope = parent_scopes.pop();
            };
            const constructFilterElement = (type, target_list) => {
                const name_is_binary = type == BinaryCode.ENDPOINT || type == BinaryCode.ENDPOINT_WILDCARD;
                let instance;
                let name_length = uint8[current_index++];
                let subspace_number = uint8[current_index++];
                let instance_length = uint8[current_index++];
                if (instance_length == 0)
                    instance = "*";
                else if (instance_length == 255)
                    instance_length = 0;
                let name_binary = uint8.subarray(current_index, current_index += name_length);
                let name = name_is_binary ? name_binary : Runtime.utf8_decoder.decode(name_binary);
                let subspaces = [];
                for (let n = 0; n < subspace_number; n++) {
                    let length = uint8[current_index++];
                    if (length == 0) {
                        subspaces.push("*");
                    }
                    else {
                        let subspace_name = Runtime.utf8_decoder.decode(uint8.subarray(current_index, current_index += length));
                        subspaces.push(subspace_name);
                    }
                }
                if (!instance)
                    instance = Runtime.utf8_decoder.decode(uint8.subarray(current_index, current_index += instance_length));
                let app_index;
                if (target_list)
                    app_index = uint8[current_index++];
                return Datex.Addresses.Target.get(name, subspaces, instance, app_index ? target_list[app_index - 1] : null, type);
            };
            loop: while (true) {
                if (current_index >= uint8.byteLength) {
                    break;
                }
                let token = uint8[current_index++];
                if (token == undefined)
                    break;
                switch (token) {
                    case BinaryCode.END: {
                        current_scope.push({ string: "end" });
                        break;
                    }
                    case BinaryCode.SHORT_STRING:
                    case BinaryCode.STRING: {
                        let length;
                        if (token == BinaryCode.SHORT_STRING) {
                            length = uint8[current_index++];
                        }
                        else {
                            length = data_view.getUint32(current_index, true);
                            current_index += Uint32Array.BYTES_PER_ELEMENT;
                        }
                        let string = Runtime.utf8_decoder.decode(uint8.subarray(current_index, current_index + length));
                        current_index += length;
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: Runtime.valueToDatexString(string, formatted_strings) });
                        break;
                    }
                    case BinaryCode.BUFFER: {
                        let buffer_length = data_view.getUint32(current_index, true);
                        current_index += Uint32Array.BYTES_PER_ELEMENT;
                        let _buffer = buffer.slice(current_index, current_index + buffer_length);
                        current_index += buffer_length;
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: Runtime.valueToDatexString(_buffer) });
                        break;
                    }
                    case BinaryCode.CHILD_SET: {
                        current_scope.push({ bin: BinaryCode.CHILD_SET, string: "." });
                        break;
                    }
                    case BinaryCode.CHILD_ACTION: {
                        let action_string = actionToString(uint8[current_index++]);
                        current_scope.push({ bin: BinaryCode.CHILD_ACTION, string: ".", meta_string: action_string });
                        break;
                    }
                    case BinaryCode.RANGE: {
                        current_scope.push({ bin: BinaryCode.RANGE });
                        break;
                    }
                    case BinaryCode.EXTEND: {
                        current_scope.push({ string: "..." });
                        break;
                    }
                    case BinaryCode.THROW_ERROR: {
                        current_scope.push({ string: "!" });
                        break;
                    }
                    case BinaryCode.EQUAL_VALUE: {
                        current_scope.push({ string: "==" });
                        break;
                    }
                    case BinaryCode.EQUAL: {
                        current_scope.push({ string: "===" });
                        break;
                    }
                    case BinaryCode.NOT_EQUAL_VALUE: {
                        current_scope.push({ string: "~=" });
                        break;
                    }
                    case BinaryCode.NOT_EQUAL: {
                        current_scope.push({ string: "~==" });
                        break;
                    }
                    case BinaryCode.GREATER: {
                        current_scope.push({ string: ">" });
                        break;
                    }
                    case BinaryCode.GREATER_EQUAL: {
                        current_scope.push({ string: ">=" });
                        break;
                    }
                    case BinaryCode.LESS: {
                        current_scope.push({ string: "<" });
                        break;
                    }
                    case BinaryCode.LESS_EQUAL: {
                        current_scope.push({ string: "<=" });
                        break;
                    }
                    case BinaryCode.CHILD_GET: {
                        current_scope.push({ bin: BinaryCode.CHILD_GET, string: "." });
                        break;
                    }
                    case BinaryCode.CHILD_GET_REF: {
                        current_scope.push({ bin: BinaryCode.CHILD_GET_REF, string: "->" });
                        break;
                    }
                    case BinaryCode.CACHE_POINT: {
                        current_scope.push({ bin: BinaryCode.CACHE_POINT });
                        break;
                    }
                    case BinaryCode.CACHE_RESET: {
                        current_scope.push({ bin: BinaryCode.CACHE_RESET });
                        break;
                    }
                    case BinaryCode.REMOTE: {
                        current_scope.push({ string: "::" });
                        break;
                    }
                    case BinaryCode.JMP: {
                        let index = data_view.getUint32(current_index, true);
                        current_index += Uint32Array.BYTES_PER_ELEMENT;
                        current_scope.push({ string: "jmp " + index.toString(16) });
                        break;
                    }
                    case BinaryCode.JTR: {
                        let index = data_view.getUint32(current_index, true);
                        current_index += Uint32Array.BYTES_PER_ELEMENT;
                        current_scope.push({ string: "jtr " + index.toString(16) + " " });
                        break;
                    }
                    case BinaryCode.JFA: {
                        let index = data_view.getUint32(current_index, true);
                        current_index += Uint32Array.BYTES_PER_ELEMENT;
                        current_scope.push({ string: "jfa " + index.toString(16) + " " });
                        break;
                    }
                    case BinaryCode.SET_LABEL: {
                        let name = extractVariableName();
                        current_scope.push({ string: Runtime.formatVariableName(name, '$') + " = " });
                        break;
                    }
                    case BinaryCode.LABEL: {
                        let name = extractVariableName();
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: Runtime.formatVariableName(name, '$') });
                        break;
                    }
                    case BinaryCode.LABEL_ACTION: {
                        let action_string = actionToString(uint8[current_index++]);
                        let name = extractVariableName();
                        current_scope.push({ string: Runtime.formatVariableName(name, '$') + ` ${action_string}= ` });
                        break;
                    }
                    case BinaryCode.SET_INTERNAL_VAR: {
                        let name = extractVariableName();
                        current_scope.push({ string: Runtime.formatVariableName(name, '#') + " = " });
                        break;
                    }
                    case BinaryCode.INTERNAL_VAR: {
                        let name = extractVariableName();
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: Runtime.formatVariableName(name, '#') });
                        break;
                    }
                    case BinaryCode.INTERNAL_VAR_ACTION: {
                        let action_string = actionToString(uint8[current_index++]);
                        let name = extractVariableName();
                        current_scope.push({ string: Runtime.formatVariableName(name, '#') + ` ${action_string}= ` });
                        break;
                    }
                    case BinaryCode.VAR_RESULT: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: "#result" });
                        break;
                    }
                    case BinaryCode.VAR_SUB_RESULT: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: "#sub_result" });
                        break;
                    }
                    case BinaryCode.VAR_ENCRYPTED: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: "#encrypted" });
                        break;
                    }
                    case BinaryCode.VAR_SIGNED: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: "#signed" });
                        break;
                    }
                    case BinaryCode.VAR_SENDER: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: "#sender" });
                        break;
                    }
                    case BinaryCode.VAR_CURRENT: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: "#current" });
                        break;
                    }
                    case BinaryCode.VAR_TIMESTAMP: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: "#timestamp" });
                        break;
                    }
                    case BinaryCode.VAR_META: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: "#meta" });
                        break;
                    }
                    case BinaryCode.VAR_REMOTE: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: "#remote" });
                        break;
                    }
                    case BinaryCode.VAR_STATIC: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: "#static" });
                        break;
                    }
                    case BinaryCode.VAR_ROOT: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: "#root" });
                        break;
                    }
                    case BinaryCode.VAR_THIS: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: "#this" });
                        break;
                    }
                    case BinaryCode.VAR_IT: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: "#it" });
                        break;
                    }
                    case BinaryCode.SET_VAR_RESULT: {
                        current_scope.push({ string: "#result = " });
                        break;
                    }
                    case BinaryCode.SET_VAR_SUB_RESULT: {
                        current_scope.push({ string: "#sub_result = " });
                        break;
                    }
                    case BinaryCode.SET_VAR_ROOT: {
                        current_scope.push({ string: "#root = " });
                        break;
                    }
                    case BinaryCode.VAR_ROOT_ACTION: {
                        let action_string = actionToString(uint8[current_index++]);
                        current_scope.push({ string: "#root" + ` ${action_string}= ` });
                        break;
                    }
                    case BinaryCode.VAR_SUB_RESULT_ACTION: {
                        let action_string = actionToString(uint8[current_index++]);
                        current_scope.push({ string: "#sub_result" + ` ${action_string}= ` });
                        break;
                    }
                    case BinaryCode.VAR_RESULT_ACTION: {
                        let action_string = actionToString(uint8[current_index++]);
                        current_scope.push({ string: "#result" + ` ${action_string}= ` });
                        break;
                    }
                    case BinaryCode.VAR_REMOTE_ACTION: {
                        let action_string = actionToString(uint8[current_index++]);
                        current_scope.push({ string: "#remote" + ` ${action_string}= ` });
                        break;
                    }
                    case BinaryCode.VAR: {
                        let name = extractVariableName();
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: (typeof name == "number" ? "_" + name.toString(16) : name) });
                        break;
                    }
                    case BinaryCode.SET_VAR: {
                        let name = extractVariableName();
                        current_scope.push({ string: (typeof name == "number" ? "_" + name.toString(16) : name) + " = " });
                        break;
                    }
                    case BinaryCode.VAR_ACTION: {
                        let action_string = actionToString(uint8[current_index++]);
                        let name = extractVariableName();
                        current_scope.push({ string: (typeof name == "number" ? "_" + name.toString(16) : name) + ` ${action_string}= ` });
                        break;
                    }
                    case BinaryCode.CLOSE_AND_STORE: {
                        current_scope.push({ string: ";\n" });
                        break;
                    }
                    case BinaryCode.SCOPE_BLOCK: {
                        let size = data_view.getUint32(current_index, true);
                        current_index += Uint32Array.BYTES_PER_ELEMENT;
                        const buffer = uint8.subarray(current_index, current_index + size);
                        const decompiled = Runtime.decompile(buffer, comments, formatted, formatted_strings, false);
                        current_index += size;
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: '(' + decompiled + ')' });
                        break;
                    }
                    case BinaryCode.NULL: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: "null" });
                        break;
                    }
                    case BinaryCode.VOID: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: "void" });
                        break;
                    }
                    case BinaryCode.WILDCARD: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: "*" });
                        break;
                    }
                    case BinaryCode.RETURN: {
                        current_scope.push({ string: "return" });
                        break;
                    }
                    case BinaryCode.ABOUT: {
                        current_scope.push({ string: "about " });
                        break;
                    }
                    case BinaryCode.COUNT: {
                        current_scope.push({ string: "count " });
                        break;
                    }
                    case BinaryCode.FREEZE: {
                        current_scope.push({ string: "freeze " });
                        break;
                    }
                    case BinaryCode.SEAL: {
                        current_scope.push({ string: "seal " });
                        break;
                    }
                    case BinaryCode.HAS: {
                        current_scope.push({ string: " has " });
                        break;
                    }
                    case BinaryCode.KEYS: {
                        current_scope.push({ string: "keys " });
                        break;
                    }
                    case BinaryCode.TEMPLATE: {
                        current_scope.push({ string: "template " });
                        break;
                    }
                    case BinaryCode.EXTENDS: {
                        current_scope.push({ string: " extends " });
                        break;
                    }
                    case BinaryCode.PLAIN_SCOPE: {
                        current_scope.push({ string: "scope " });
                        break;
                    }
                    case BinaryCode.TRANSFORM: {
                        current_scope.push({ string: "transform " });
                        break;
                    }
                    case BinaryCode.DO: {
                        current_scope.push({ string: "do " });
                        break;
                    }
                    case BinaryCode.ITERATOR: {
                        current_scope.push({ string: "iterator " });
                        break;
                    }
                    case BinaryCode.ITERATION: {
                        current_scope.push({ string: "iteration " });
                        break;
                    }
                    case BinaryCode.ASSERT: {
                        current_scope.push({ string: "assert " });
                        break;
                    }
                    case BinaryCode.AWAIT: {
                        current_scope.push({ string: "await " });
                        break;
                    }
                    case BinaryCode.FUNCTION: {
                        current_scope.push({ string: "function " });
                        break;
                    }
                    case BinaryCode.HOLD: {
                        current_scope.push({ string: "hold " });
                        break;
                    }
                    case BinaryCode.OBSERVE: {
                        current_scope.push({ string: "observe " });
                        break;
                    }
                    case BinaryCode.IMPLEMENTS: {
                        current_scope.push({ string: " implements " });
                        break;
                    }
                    case BinaryCode.MATCHES: {
                        current_scope.push({ string: " matches " });
                        break;
                    }
                    case BinaryCode.DEBUG: {
                        current_scope.push({ string: "debug " });
                        break;
                    }
                    case BinaryCode.REQUEST: {
                        current_scope.push({ string: "request " });
                        break;
                    }
                    case BinaryCode.URL: {
                        let length = data_view.getUint32(current_index, true);
                        current_index += Uint32Array.BYTES_PER_ELEMENT;
                        let url = new URL(Runtime.utf8_decoder.decode(uint8.subarray(current_index, current_index + length)));
                        current_index += length;
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: Runtime.valueToDatexString(url, formatted_strings) });
                        break;
                    }
                    case BinaryCode.ARRAY_START: {
                        enterSubScope(BinaryCode.ARRAY_START);
                        break;
                    }
                    case BinaryCode.TUPLE_START: {
                        enterSubScope(BinaryCode.TUPLE_START);
                        break;
                    }
                    case BinaryCode.OBJECT_START: {
                        enterSubScope(BinaryCode.OBJECT_START);
                        break;
                    }
                    case BinaryCode.ELEMENT_WITH_KEY: {
                        let length = uint8[current_index++];
                        let key = Runtime.utf8_decoder.decode(uint8.subarray(current_index, current_index + length));
                        current_index += length;
                        current_scope.push({ bin: BinaryCode.ELEMENT_WITH_KEY, string: `"${key.replace(/\'/g, "\\'")}": ` });
                        break;
                    }
                    case BinaryCode.ELEMENT_WITH_INT_KEY: {
                        let key = data_view.getUint32(current_index);
                        current_index += Uint32Array.BYTES_PER_ELEMENT;
                        current_scope.push({ bin: BinaryCode.ELEMENT_WITH_KEY, string: `${key}: ` });
                        break;
                    }
                    case BinaryCode.ELEMENT_WITH_DYNAMIC_KEY: {
                        current_scope.push({ bin: BinaryCode.ELEMENT_WITH_KEY, string: `: ` });
                        break;
                    }
                    case BinaryCode.KEY_PERMISSION: {
                        current_scope.push({ string: `!!` });
                        break;
                    }
                    case BinaryCode.ELEMENT: {
                        current_scope.push({ bin: BinaryCode.ELEMENT });
                        break;
                    }
                    case BinaryCode.ARRAY_END:
                    case BinaryCode.OBJECT_END:
                    case BinaryCode.TUPLE_END: {
                        try {
                            exitSubScope();
                        }
                        catch (e) {
                            break loop;
                        }
                        break;
                    }
                    case BinaryCode.STD_TYPE_STRING:
                    case BinaryCode.STD_TYPE_INT:
                    case BinaryCode.STD_TYPE_FLOAT:
                    case BinaryCode.STD_TYPE_BOOLEAN:
                    case BinaryCode.STD_TYPE_NULL:
                    case BinaryCode.STD_TYPE_VOID:
                    case BinaryCode.STD_TYPE_BUFFER:
                    case BinaryCode.STD_TYPE_CODE_BLOCK:
                    case BinaryCode.STD_TYPE_UNIT:
                    case BinaryCode.STD_TYPE_FILTER:
                    case BinaryCode.STD_TYPE_ARRAY:
                    case BinaryCode.STD_TYPE_OBJECT:
                    case BinaryCode.STD_TYPE_SET:
                    case BinaryCode.STD_TYPE_MAP:
                    case BinaryCode.STD_TYPE_TUPLE:
                    case BinaryCode.STD_TYPE_STREAM:
                    case BinaryCode.STD_TYPE_ANY:
                    case BinaryCode.STD_TYPE_ASSERTION:
                    case BinaryCode.STD_TYPE_TASK:
                    case BinaryCode.STD_TYPE_FUNCTION: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: Type.short_types[token].toString() });
                        break;
                    }
                    case BinaryCode.ADD: {
                        current_scope.push({ string: " + " });
                        break;
                    }
                    case BinaryCode.SUBTRACT: {
                        current_scope.push({ string: " - " });
                        break;
                    }
                    case BinaryCode.MULTIPLY: {
                        current_scope.push({ string: " * " });
                        break;
                    }
                    case BinaryCode.DIVIDE: {
                        current_scope.push({ string: " / " });
                        break;
                    }
                    case BinaryCode.SYNC: {
                        current_scope.push({ string: " <<< " });
                        break;
                    }
                    case BinaryCode.STOP_SYNC: {
                        current_scope.push({ string: " <</ " });
                        break;
                    }
                    case BinaryCode.AND: {
                        current_scope.push({ string: " & " });
                        break;
                    }
                    case BinaryCode.OR: {
                        current_scope.push({ string: " | " });
                        break;
                    }
                    case BinaryCode.NOT: {
                        current_scope.push({ string: "~" });
                        break;
                    }
                    case BinaryCode.SUBSCOPE_START: {
                        enterSubScope(BinaryCode.SUBSCOPE_START);
                        break;
                    }
                    case BinaryCode.SUBSCOPE_END: {
                        try {
                            exitSubScope();
                        }
                        catch (e) {
                            break loop;
                        }
                        break;
                    }
                    case BinaryCode.TRUE: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: "true" });
                        break;
                    }
                    case BinaryCode.FALSE: {
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: "false" });
                        break;
                    }
                    case BinaryCode.UNIT: {
                        let unit = new Unit(data_view.getFloat64(current_index, true));
                        current_index += Float64Array.BYTES_PER_ELEMENT;
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: unit.toString() });
                        break;
                    }
                    case BinaryCode.INT_8: {
                        let integer = data_view.getInt8(current_index);
                        current_index += Int8Array.BYTES_PER_ELEMENT;
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: integer.toString() });
                        break;
                    }
                    case BinaryCode.INT_16: {
                        let integer = data_view.getInt16(current_index, true);
                        current_index += Int16Array.BYTES_PER_ELEMENT;
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: integer.toString() });
                        break;
                    }
                    case BinaryCode.INT_32: {
                        let integer = data_view.getInt32(current_index, true);
                        current_index += Int32Array.BYTES_PER_ELEMENT;
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: integer.toString() });
                        break;
                    }
                    case BinaryCode.INT_64: {
                        let integer = data_view.getBigInt64(current_index, true);
                        current_index += BigInt64Array.BYTES_PER_ELEMENT;
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: integer.toString() });
                        break;
                    }
                    case BinaryCode.FLOAT_64: {
                        let float = data_view.getFloat64(current_index, true);
                        current_index += Float64Array.BYTES_PER_ELEMENT;
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: Runtime.valueToDatexString(float) });
                        break;
                    }
                    case BinaryCode.FLOAT_AS_INT: {
                        let float = data_view.getInt32(current_index, true);
                        current_index += Int32Array.BYTES_PER_ELEMENT;
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: Runtime.valueToDatexString(float) });
                        break;
                    }
                    case BinaryCode.TYPE: {
                        const [type] = extractType();
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: type.toString() });
                        break;
                    }
                    case BinaryCode.EXTENDED_TYPE: {
                        const [type, has_parameters] = extractType(true);
                        if (has_parameters)
                            current_scope.push({ type: TOKEN_TYPE.VALUE, bin: BinaryCode.EXTENDED_TYPE, string: type.toString().slice(0, -1) });
                        else
                            current_scope.push({ type: TOKEN_TYPE.VALUE, string: type.toString() });
                        break;
                    }
                    case BinaryCode.FILTER: {
                        let targets_size = uint8[current_index++];
                        let target_list = [];
                        for (let n = 0; n < targets_size; n++) {
                            let type = uint8[current_index++];
                            const target = constructFilterElement(type, target_list);
                            target_list.push(target);
                        }
                        let cnf = new Datex.Addresses.AndSet();
                        let ands_nr = uint8[current_index++];
                        for (let n = 0; n < ands_nr; n++) {
                            let ors_nr = uint8[current_index++];
                            let ors = new Set();
                            for (let m = 0; m < ors_nr; m++) {
                                let index = data_view.getInt8(current_index++);
                                ors.add(index < 0 ? Datex.Addresses.Not.get(target_list[-index - 1]) : target_list[index - 1]);
                            }
                            cnf.add(ors);
                        }
                        current_scope.push({ type: TOKEN_TYPE.VALUE, string: new Datex.Addresses.Filter(...cnf).toString() });
                        break;
                    }
                    case BinaryCode.PERSON_ALIAS:
                    case BinaryCode.PERSON_ALIAS_WILDCARD:
                    case BinaryCode.INSTITUTION_ALIAS:
                    case BinaryCode.INSTITUTION_ALIAS_WILDCARD:
                    case BinaryCode.BOT:
                    case BinaryCode.BOT_WILDCARD:
                    case BinaryCode.ENDPOINT:
                    case BinaryCode.ENDPOINT_WILDCARD:
                        {
                            const f = constructFilterElement(token);
                            current_scope.push({ type: TOKEN_TYPE.VALUE, string: f.toString() });
                            break;
                        }
                    case BinaryCode.SET_POINTER: {
                        let id = uint8.slice(current_index, current_index += Pointer.MAX_POINTER_ID_SIZE);
                        current_scope.push({ string: `$${id}=` });
                        break;
                    }
                    case BinaryCode.DELETE_POINTER: {
                        current_scope.push({ string: `delete ` });
                        break;
                    }
                    case BinaryCode.SUBSCRIBE: {
                        current_scope.push({ string: `subscribe ` });
                        break;
                    }
                    case BinaryCode.UNSUBSCRIBE: {
                        current_scope.push({ string: `unsubscribe ` });
                        break;
                    }
                    case BinaryCode.PLAIN_SCOPE: {
                        current_scope.push({ string: `scope ` });
                        break;
                    }
                    case BinaryCode.VALUE: {
                        current_scope.push({ string: `value ` });
                        break;
                    }
                    case BinaryCode.GET_TYPE: {
                        current_scope.push({ string: `type ` });
                        break;
                    }
                    case BinaryCode.ORIGIN: {
                        current_scope.push({ string: `origin ` });
                        break;
                    }
                    case BinaryCode.SUBSCRIBERS: {
                        current_scope.push({ string: `subscribers ` });
                        break;
                    }
                    case BinaryCode.POINTER: {
                        let id = uint8.slice(current_index, current_index += Pointer.MAX_POINTER_ID_SIZE);
                        current_scope.push({ string: `$${Pointer.normalizePointerId(id)}` });
                        break;
                    }
                    case BinaryCode.POINTER_ACTION: {
                        let action_string = actionToString(uint8[current_index++]);
                        let id = uint8.slice(current_index, current_index += Pointer.MAX_POINTER_ID_SIZE);
                        current_scope.push({ string: `$${Pointer.normalizePointerId(id)} ${action_string}= ` });
                        break;
                    }
                    case BinaryCode.CREATE_POINTER: {
                        current_scope.push({ string: `$$` });
                        break;
                    }
                    case BinaryCode.STREAM: {
                        current_scope.push({ string: ` << ` });
                        break;
                    }
                    case BinaryCode.STOP_STREAM: {
                        current_scope.push({ string: ` </ ` });
                        break;
                    }
                    default: {
                        current_scope.push({ string: `###${token?.toString(16) ?? '?'}###` });
                    }
                }
            }
            const parse_tokens = (tokens, indentation = 0) => {
                let datex_tmp = "";
                let append;
                for (let t = 0; t < tokens.length; t++) {
                    let current_token = tokens[t];
                    if (current_token.type == TOKEN_TYPE.SUBSCOPE) {
                        let indentation = 0;
                        if (current_token.bin == BinaryCode.SUBSCOPE_START) {
                            datex_tmp += "(";
                        }
                        else if (current_token.bin == BinaryCode.TUPLE_START)
                            datex_tmp += "(";
                        else if (current_token.bin == BinaryCode.ARRAY_START)
                            datex_tmp += "[";
                        else if (current_token.bin == BinaryCode.OBJECT_START)
                            datex_tmp += "{";
                        datex_tmp += parse_tokens(current_token.value, indentation);
                        if (current_token.bin == BinaryCode.SUBSCOPE_START)
                            datex_tmp += ")";
                        else if (current_token.bin == BinaryCode.TUPLE_START)
                            datex_tmp += ")";
                        else if (current_token.bin == BinaryCode.ARRAY_START)
                            datex_tmp += "]";
                        else if (current_token.bin == BinaryCode.OBJECT_START)
                            datex_tmp += "}";
                    }
                    else {
                        if (current_token.string)
                            datex_tmp += current_token.string;
                    }
                    if (tokens[t + 1]?.bin == BinaryCode.ELEMENT_WITH_KEY || tokens[t + 1]?.bin == BinaryCode.ELEMENT)
                        datex_tmp += ",";
                    if (append) {
                        datex_tmp += append;
                        append = null;
                    }
                    if (current_token.bin == BinaryCode.CHILD_SET)
                        append = " = ";
                    else if (current_token.bin == BinaryCode.RANGE)
                        append = "..";
                    else if (current_token.bin == BinaryCode.EXTENDED_TYPE)
                        append = ">";
                    else if (current_token.bin == BinaryCode.CHILD_ACTION)
                        append = ` ${current_token.meta_string}= `;
                }
                return (indentation ? " ".repeat(indentation) : "") + datex_tmp.replace(/\n/g, "\n" + (" ".repeat(indentation)));
            };
            let datex_string = (parse_tokens(tokens) + append_comments).replace(/\n$/, '');
            return datex_string;
        }
        static getAbout(type) {
            if (type instanceof Type)
                return type.about;
            else
                return Datex.VOID;
        }
        static convertByteToNumbers(bit_distribution, byte) {
            let byte_str = byte.toString(2).padStart(8, '0');
            let nrs = [];
            let pos = 0;
            for (let size of bit_distribution) {
                nrs.push(parseInt(byte_str.slice(pos, pos + size), 2));
                pos += size;
            }
            return nrs;
        }
        static parseHeaderSynchronousPart(dxb) {
            let header_data_view = new DataView(dxb);
            let header_uint8 = new Uint8Array(dxb);
            if (header_uint8[0] !== 0x01 || header_uint8[1] !== 0x64) {
                throw new SecurityError("DXB Format not recognized");
            }
            if (dxb.byteLength < 4)
                throw new SecurityError("DXB Block must be at least 4 bytes");
            let header = {};
            let routing_info = {};
            header.version = header_uint8[2];
            let i = 3;
            const block_size = header_data_view.getInt16(i, true);
            i += Int16Array.BYTES_PER_ELEMENT;
            routing_info.ttl = header_uint8[i++];
            routing_info.prio = header_uint8[i++];
            const signed_encrypted = header_uint8[i++];
            header.signed = signed_encrypted == 1 || signed_encrypted == 2;
            header.encrypted = signed_encrypted == 2 || signed_encrypted == 3;
            header.routing = routing_info;
            const last_index = [0];
            routing_info.sender = header.sender = DatexCompiler.extractHeaderSender(header_uint8, last_index);
            i = last_index[0];
            let receiver_size = header_data_view.getUint16(i, true);
            i += Uint16Array.BYTES_PER_ELEMENT;
            let encrypted_key;
            if (receiver_size == Datex.MAX_UINT_16) {
                routing_info.flood = true;
            }
            else if (receiver_size != 0) {
                let targets_nr = header_uint8[i++];
                let target_list = [];
                for (let n = 0; n < targets_nr; n++) {
                    let type = header_uint8[i++];
                    if (type == BinaryCode.POINTER) {
                        const id_buffer = header_uint8.subarray(i, i += Pointer.MAX_POINTER_ID_SIZE);
                        const target = Pointer.get(id_buffer)?.value;
                        if (!target)
                            throw new ValueError("Receiver filter pointer not found (TODO request)");
                        if (!(target instanceof Datex.Addresses.Target || target instanceof Datex.Addresses.Filter || target instanceof Array || target instanceof Set || target instanceof Datex.Addresses.Not))
                            throw new ValueError("Receiver filter pointer is not a filter");
                        else
                            target_list.push(target);
                        console.log("TARGET", target);
                    }
                    else {
                        let name_length = header_uint8[i++];
                        let subspace_number = header_uint8[i++];
                        let instance_length = header_uint8[i++];
                        let name_binary = header_uint8.subarray(i, i += name_length);
                        let name = type == BinaryCode.ENDPOINT ? name_binary : Runtime.utf8_decoder.decode(name_binary);
                        let subspaces = [];
                        for (let n = 0; n < subspace_number; n++) {
                            let length = header_uint8[i++];
                            let subspace_name = Runtime.utf8_decoder.decode(header_uint8.subarray(i, i += length));
                            subspaces.push(subspace_name);
                        }
                        let instance = Runtime.utf8_decoder.decode(header_uint8.subarray(i, i += instance_length));
                        let app_index = header_uint8[i++];
                        const target = Datex.Addresses.Target.get(name, subspaces, instance, app_index ? target_list[app_index - 1] : null, type);
                        target_list.push(target);
                        let has_key = header_uint8[i++];
                        if (has_key) {
                            if (this.endpoint.equals(target))
                                encrypted_key = header_uint8.slice(i, i + 512);
                            i += 512;
                        }
                    }
                }
                let cnf = new Datex.Addresses.AndSet();
                let ands_nr = header_uint8[i++];
                for (let n = 0; n < ands_nr; n++) {
                    let ors_nr = header_uint8[i++];
                    let ors = new Set();
                    for (let m = 0; m < ors_nr; m++) {
                        let index = header_data_view.getInt8(i++);
                        ors.add(index < 0 ? Datex.Addresses.Not.get(target_list[-index - 1]) : target_list[index - 1]);
                    }
                    cnf.add(ors.size == 1 ? [...ors][0] : ors);
                }
                if (cnf.size == 1 && [...cnf][0] instanceof Datex.Addresses.Filter)
                    routing_info.receivers = [...cnf][0];
                else
                    routing_info.receivers = new Datex.Addresses.Filter(...cnf);
            }
            let signature_start = i;
            if (header.signed)
                i += DatexCompiler.signature_size;
            header.sid = header_data_view.getUint32(i, true);
            i += Uint32Array.BYTES_PER_ELEMENT;
            header.return_index = header_data_view.getUint16(i, true);
            i += Uint16Array.BYTES_PER_ELEMENT;
            header.inc = header_data_view.getUint16(i, true);
            i += Uint16Array.BYTES_PER_ELEMENT;
            if (routing_info.receivers && !routing_info.receivers.equals(Runtime.endpoint)) {
                header.redirect = true;
            }
            header.type = header_uint8[i++];
            let [_, executable, end_of_scope, device_type] = this.convertByteToNumbers([1, 1, 1, 5], header_uint8[i++]);
            header.executable = executable ? true : false;
            header.end_of_scope = end_of_scope ? true : false;
            header.timestamp = new Date(Number(header_data_view.getBigUint64(i, true)) + DatexCompiler.BIG_BANG_TIME);
            i += BigUint64Array.BYTES_PER_ELEMENT;
            let iv;
            if (header.encrypted) {
                iv = header_uint8.slice(i, i + 16);
                i += 16;
            }
            let header_buffer = header_uint8.slice(0, i);
            let data_buffer = header_uint8.slice(i);
            return [header, data_buffer, header_buffer, signature_start, iv, encrypted_key];
        }
        static async parseHeader(dxb, force_sym_enc_key, force_only_header_info = false) {
            let res = this.parseHeaderSynchronousPart(dxb);
            let header, data_buffer, header_buffer, signature_start, iv, encrypted_key;
            if (!res[0].redirect && !force_only_header_info) {
                [header, data_buffer, header_buffer, signature_start, iv, encrypted_key] = res;
                if (encrypted_key) {
                    let sym_enc_key = await Crypto.extractEncryptedKey(encrypted_key);
                    await this.setScopeSymmetricKeyForSender(header.sid, header.sender, sym_enc_key);
                }
                if (header.signed) {
                    if (!header.sender)
                        throw [header, new SecurityError("Signed DATEX without a sender")];
                    let j = signature_start;
                    let signature = header_buffer.subarray(j, j + DatexCompiler.signature_size);
                    let content = new Uint8Array(dxb).subarray(j + DatexCompiler.signature_size);
                    j += DatexCompiler.signature_size;
                    let valid = await Crypto.verify(content, signature, header.sender);
                    if (!valid) {
                        logger.error("Invalid signature from " + header.sender);
                        throw [header, new SecurityError("Invalid signature from " + header.sender)];
                    }
                }
                if (header.encrypted) {
                    if (!iv)
                        throw [header, new SecurityError("DATEX not correctly encrypted")];
                    try {
                        data_buffer = new Uint8Array(await Crypto.decryptSymmetric(data_buffer.buffer, force_sym_enc_key ?? await this.getScopeSymmetricKeyForSender(header.sid, header.sender), iv));
                    }
                    catch (e) {
                        console.warn(header, e);
                        throw [header, e];
                    }
                }
                return [header, data_buffer, header_buffer, res[1]];
            }
            else
                return res[0];
        }
        static active_datex_scopes = new Map();
        static getDatexInputHandler(full_scope_callback) {
            let handler = (dxb, last_endpoint) => {
                if (dxb instanceof ArrayBuffer)
                    return this.handleDatexIn(dxb, last_endpoint, full_scope_callback);
                else if (dxb instanceof ReadableStreamDefaultReader)
                    return this.handleContinuousBlockStream(dxb, full_scope_callback, undefined, undefined, last_endpoint);
                else {
                    if (dxb.dxb instanceof ArrayBuffer)
                        return this.handleDatexIn(dxb.dxb, last_endpoint, full_scope_callback, dxb.variables, dxb.header_callback);
                    else if (dxb.dxb instanceof ReadableStreamDefaultReader)
                        return this.handleContinuousBlockStream(dxb.dxb, full_scope_callback, dxb.variables, dxb.header_callback, last_endpoint);
                }
            };
            return handler;
        }
        static async handleContinuousBlockStream(dxb_stream_reader, full_scope_callback, variables, header_callback, last_endpoint) {
            let current_block;
            let current_block_size;
            let new_block = new Uint8Array(4);
            let overflow_block;
            let index = 0;
            let timeout;
            const newValue = (value) => {
                if (overflow_block) {
                    const _overflow_block = overflow_block;
                    overflow_block = null;
                    newValue(_overflow_block);
                }
                if (current_block) {
                    if (index + value.byteLength > current_block_size) {
                        current_block.set(value.subarray(0, current_block_size - index), index);
                        overflow_block = value.subarray(current_block_size - index);
                    }
                    else
                        current_block.set(value, index);
                }
                else {
                    if (index + value.byteLength > 4) {
                        new_block.set(value.subarray(0, 4 - index), index);
                        overflow_block = value.subarray(4 - index);
                    }
                    else
                        new_block.set(value, index);
                }
                index += value.byteLength;
                if (!current_block && index >= 4) {
                    if (!(new_block[0] == 0x01 && new_block[1] == 0x64)) {
                        logger.error("DXB Format not recognized in block stream");
                        overflow_block = null;
                        index = 0;
                    }
                    else {
                        current_block_size = new_block[2] * 256 + new_block[3];
                        current_block = new Uint8Array(current_block_size);
                        current_block.set(new_block);
                        index = 4;
                    }
                }
                if (current_block && index >= current_block_size) {
                    console.log("received new block from stream");
                    this.handleDatexIn(current_block.buffer, last_endpoint, full_scope_callback, variables, header_callback);
                    current_block = null;
                    index = 0;
                }
            };
            try {
                while (true) {
                    const { value, done } = await dxb_stream_reader.read();
                    if (done) {
                        logger.error("reader has been cancelled");
                        break;
                    }
                    newValue(value);
                }
            }
            catch (error) {
                logger.error("disconnected: " + error);
            }
            finally {
                dxb_stream_reader.releaseLock();
            }
        }
        static async simpleScopeExecution(scope) {
            await this.run(scope);
            return scope.result;
        }
        static async handleDatexIn(dxb, last_endpoint, full_scope_callback, variables, header_callback) {
            let header, data_uint8;
            let res;
            try {
                res = await this.parseHeader(dxb);
            }
            catch (e) {
                console.error(e);
                this.handleScopeError(e[0], e[1]);
                return;
            }
            if (res instanceof Array) {
                [header, data_uint8] = res;
                if (header.routing.flood) {
                    this.floodDatex(dxb, last_endpoint ?? header.sender, header.routing.ttl - 1);
                }
                if (header_callback instanceof globalThis.Function)
                    header_callback(header);
            }
            else {
                this.redirectDatex(dxb, res, false);
                if (header_callback instanceof globalThis.Function)
                    header_callback(res);
                return;
            }
            let data = data_uint8.buffer;
            if (!this.active_datex_scopes.has(header.sender)) {
                if (header.end_of_scope) { }
                else
                    this.active_datex_scopes.set(header.sender, new Map());
            }
            const sid = Runtime.endpoint.equals(header.sender) && header.type == DatexProtocolDataType.RESPONSE ? -header.sid : header.sid;
            let sender_map = this.active_datex_scopes.get(header.sender);
            if (sender_map && !sender_map.has(sid)) {
                sender_map.set(sid, { next: 0, active: new Map() });
            }
            let scope_map = sender_map?.get(sid);
            if (!scope_map || (scope_map.next == header.inc)) {
                let scope = scope_map?.scope ?? this.createNewInitialScope(header, variables);
                let _header = header;
                let _data = data;
                let _dxb = dxb;
                do {
                    let has_error = false;
                    try {
                        this.updateScope(scope, _data, _header);
                        IOHandler.handleDatexReceived(scope, _dxb);
                        await this.run(scope);
                    }
                    catch (e) {
                        if (full_scope_callback && typeof full_scope_callback == "function") {
                            full_scope_callback(sid, e, true);
                        }
                        this.handleScopeError(_header, e, scope);
                        has_error = true;
                    }
                    if (_header.end_of_scope || scope.closed) {
                        sender_map?.delete(sid);
                        this.removeScopeSymmetricKeyForSender(sid, _header.sender);
                        if (!has_error) {
                            if (full_scope_callback && typeof full_scope_callback == "function") {
                                full_scope_callback(sid, scope);
                            }
                            await this.handleScopeResult(_header, scope, scope.result);
                        }
                        break;
                    }
                    else {
                        scope_map.next++;
                        if (scope_map.next > DatexCompiler.MAX_BLOCK)
                            scope_map.next = 0;
                        if (!scope_map.scope)
                            scope_map.scope = scope;
                        if (scope_map.active.has(scope_map.next)) {
                            [_header, _data, _dxb] = scope_map.active.get(scope_map.next);
                        }
                        else
                            break;
                    }
                } while (true);
            }
            else {
                if (scope_map.next > header.inc) {
                    logger.error("invalid scope inc, lower than next required number");
                }
                else {
                    scope_map.active.set(header.inc, [header, data, dxb]);
                }
            }
            return header;
        }
        static handleScopeError(header, e, scope) {
            if (header?.type == undefined) {
                console.log("Scope error occured, cannot get the original error here!");
                return;
            }
            if (header.type == DatexProtocolDataType.REQUEST) {
                if (e instanceof globalThis.Error && !(e instanceof Error)) {
                    e = new Error(e.message, [[Runtime.endpoint, "[native] " + e.name]]);
                    if (scope)
                        e.addScopeToStack(scope);
                }
                this.datexOut(["!?", [e], { type: DatexProtocolDataType.RESPONSE, to: header.sender, return_index: header.return_index, sign: header.signed }], header.sender, header.sid, false);
            }
            else if (header.type == DatexProtocolDataType.RESPONSE ||
                header.type == DatexProtocolDataType.DATA ||
                header.type == DatexProtocolDataType.LOCAL_REQ) {
                let unique_sid = header.sid + "-" + header.return_index;
                if (this.callbacks_by_sid.has(unique_sid)) {
                    this.callbacks_by_sid.get(unique_sid)[1](e, true);
                    this.callbacks_by_sid.delete(unique_sid);
                }
                if (this.detailed_result_callbacks_by_sid.has(unique_sid)) {
                    this.detailed_result_callbacks_by_sid.get(unique_sid)(scope, header, e);
                    this.detailed_result_callbacks_by_sid.delete(unique_sid);
                }
                else if (this.detailed_result_callbacks_by_sid_multi.has(unique_sid)) {
                    this.detailed_result_callbacks_by_sid_multi.get(unique_sid)(scope, header, e);
                }
            }
            else {
                logger.error("Invalid proctocol data type: " + header.type);
            }
        }
        static async handleScopeResult(header, scope, return_value) {
            let unique_sid = header.sid + "-" + header.return_index;
            if (header.type == DatexProtocolDataType.REQUEST) {
                this.datexOut(["?", [return_value], { type: DatexProtocolDataType.RESPONSE, to: header.sender, return_index: header.return_index, encrypt: header.encrypted, sign: header.signed }], header.sender, header.sid, false);
            }
            else if (header.type == DatexProtocolDataType.RESPONSE ||
                header.type == DatexProtocolDataType.DATA ||
                header.type == DatexProtocolDataType.LOCAL_REQ) {
                if (this.callbacks_by_sid.has(unique_sid)) {
                    this.callbacks_by_sid.get(unique_sid)[0](return_value);
                    this.callbacks_by_sid.delete(unique_sid);
                }
                if (this.detailed_result_callbacks_by_sid.has(unique_sid)) {
                    this.detailed_result_callbacks_by_sid.get(unique_sid)(scope, header);
                    this.detailed_result_callbacks_by_sid.delete(unique_sid);
                }
                else if (this.detailed_result_callbacks_by_sid_multi.has(unique_sid)) {
                    this.detailed_result_callbacks_by_sid_multi.get(unique_sid)(scope, header);
                }
            }
            else if (header.type == DatexProtocolDataType.BC_TRNSCT) {
                console.log("bc transaction");
            }
            else if (header.type == DatexProtocolDataType.HELLO) {
                if (return_value) {
                    try {
                        let keys_updated = await Crypto.bindKeys(header.sender, ...return_value);
                        console.log("HELLO from " + header.sender + ", keys " + (keys_updated ? "" : "not ") + "updated");
                    }
                    catch (e) {
                        logger.error("Invalid HELLO keys");
                    }
                }
                else
                    console.log("HELLO from " + header.sender + ", no keys");
            }
            else {
                logger.error("Invalid proctocol data type: " + header.type);
            }
            IOHandler.handleScopeFinished(header.sid, scope);
        }
        static async castValue(type, value, context, origin = Runtime.endpoint, no_fetch) {
            let old_type = Type.getValueDatexType(value);
            let old_value = value instanceof UnresolvedValue ? value[Datex.DX_VALUE] : value;
            if (old_type == type)
                return old_value;
            let new_value = Datex.UNKNOWN_TYPE;
            if (type.namespace == "std") {
                if (old_value instanceof Pointer)
                    old_value = old_value.value;
                switch (type) {
                    case Type.std.Type: {
                        new_value = old_type;
                        break;
                    }
                    case Type.std.Void: {
                        new_value = Datex.VOID;
                        break;
                    }
                    case Type.std.Null: {
                        new_value = null;
                        break;
                    }
                    case Type.std.String: {
                        if (old_value === Datex.VOID)
                            new_value = globalThis.String();
                        else if (old_value instanceof Markdown)
                            new_value = old_value.toString();
                        else if (old_value instanceof ArrayBuffer)
                            new_value = Runtime.utf8_decoder.decode(old_value);
                        else
                            new_value = this.valueToDatexString(value, false, true);
                        break;
                    }
                    case Type.std.Float: {
                        if (old_value === Datex.VOID)
                            new_value = Number();
                        else if (old_value == null)
                            new_value = 0;
                        else if (typeof old_value == "string" || typeof old_value == "boolean" || typeof old_value == "bigint") {
                            new_value = Number(old_value);
                            if (isNaN(new_value))
                                throw new ValueError("Failed to convert " + old_type + " to " + type);
                        }
                        break;
                    }
                    case Type.std.Int: {
                        if (old_value === Datex.VOID)
                            new_value = this.OPTIONS.USE_BIGINTS ? 0n : 0;
                        else if (typeof old_value == "number")
                            new_value = Runtime.OPTIONS.USE_BIGINTS ? BigInt(Math.floor(old_value)) : Math.floor(old_value);
                        else if (old_value == null)
                            new_value = this.OPTIONS.USE_BIGINTS ? 0n : 0;
                        else if (typeof old_value == "string" || typeof old_value == "boolean" || typeof old_value == "bigint") {
                            new_value = Math.floor(Number(old_value));
                            if (isNaN(new_value))
                                throw new ValueError("Failed to convert " + old_type + " to " + type);
                            if (Runtime.OPTIONS.USE_BIGINTS)
                                new_value = BigInt(new_value);
                        }
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.Unit: {
                        if (old_value === Datex.VOID)
                            new_value = new Unit();
                        else if (typeof old_value == "number" || typeof old_value == "bigint")
                            new_value = new Unit(Number(old_value));
                        else if (old_value == null)
                            new_value = new Unit(0);
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.Boolean: {
                        if (old_value === Datex.VOID)
                            new_value = globalThis.Boolean();
                        new_value = !!old_value;
                        break;
                    }
                    case Type.std.Endpoint: {
                        if (typeof old_value == "string")
                            new_value = Datex.Addresses.Endpoint.fromString(old_value);
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.Target: {
                        if (typeof old_value == "string")
                            new_value = Datex.Addresses.Target.get(old_value);
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.Object: {
                        if (old_value === Datex.VOID)
                            new_value = Object();
                        else if (old_value && typeof old_value == "object")
                            new_value = { ...Runtime.serializeValue(old_value) ?? {} };
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.Tuple: {
                        if (old_value === Datex.VOID)
                            new_value = new Tuple().seal();
                        else if (old_value instanceof Array) {
                            new_value = new Tuple(old_value).seal();
                        }
                        else if (old_value instanceof Set) {
                            new_value = new Tuple(old_value).seal();
                        }
                        else if (old_value instanceof Map) {
                            new_value = new Tuple(old_value.entries()).seal();
                        }
                        else if (old_value instanceof Iterator) {
                            new_value = await old_value.collapse();
                        }
                        else
                            new_value = new Tuple(old_value).seal();
                        break;
                    }
                    case Type.std.Array: {
                        if (old_value === Datex.VOID)
                            new_value = Array();
                        else if (old_value instanceof Tuple)
                            new_value = old_value.toArray();
                        else if (old_value instanceof Set)
                            new_value = [...old_value];
                        else if (old_value instanceof Map)
                            new_value = [...old_value.entries()];
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.Buffer: {
                        if (old_value === Datex.VOID)
                            new_value = new ArrayBuffer(0);
                        else if (typeof old_value == "string")
                            new_value = this.utf8_encoder.encode(old_value).buffer;
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.Filter: {
                        if (old_value === Datex.VOID)
                            new_value = new Datex.Addresses.Filter();
                        else if (old_value instanceof Datex.Addresses.Target)
                            new_value = new Datex.Addresses.Filter(old_value);
                        else if (old_value instanceof Array)
                            new_value = new Datex.Addresses.Filter(...old_value);
                        else if (typeof old_value == "string")
                            new_value = Datex.Addresses.Filter.fromString(old_value);
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.Error: {
                        if (old_value === Datex.VOID)
                            new_value = new Error(null, null);
                        else if (typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint")
                            new_value = new Error(old_value, null);
                        else if (old_value instanceof Array)
                            new_value = new Error(old_value[0], old_value[1]);
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.SyntaxError: {
                        if (old_value === Datex.VOID)
                            new_value = new SyntaxError(null, null);
                        else if (typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint")
                            new_value = new SyntaxError(old_value, null);
                        else if (old_value instanceof Array)
                            new_value = new SyntaxError(old_value[0], old_value[1]);
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.CompilerError: {
                        if (old_value === Datex.VOID)
                            new_value = new CompilerError(null, null);
                        else if (typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint")
                            new_value = new CompilerError(old_value, null);
                        else if (old_value instanceof Array)
                            new_value = new CompilerError(old_value[0], old_value[1]);
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.PointerError: {
                        if (old_value === Datex.VOID)
                            new_value = new PointerError(null, null);
                        else if (typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint")
                            new_value = new PointerError(old_value, null);
                        else if (old_value instanceof Array)
                            new_value = new PointerError(old_value[0], old_value[1]);
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.ValueError: {
                        if (old_value === Datex.VOID)
                            new_value = new ValueError(null, null);
                        else if (typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint")
                            new_value = new ValueError(old_value, null);
                        else if (old_value instanceof Array)
                            new_value = new ValueError(old_value[0], old_value[1]);
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.PermissionError: {
                        if (old_value === Datex.VOID)
                            new_value = new PermissionError(null, null);
                        else if (typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint")
                            new_value = new PermissionError(old_value, null);
                        else if (old_value instanceof Array)
                            new_value = new PermissionError(old_value[0], old_value[1]);
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.TypeError: {
                        if (old_value === Datex.VOID)
                            new_value = new TypeError(null, null);
                        else if (typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint")
                            new_value = new TypeError(old_value, null);
                        else if (old_value instanceof Array)
                            new_value = new TypeError(old_value[0], old_value[1]);
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.NetworkError: {
                        if (old_value === Datex.VOID)
                            new_value = new NetworkError(null, null);
                        else if (typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint")
                            new_value = new NetworkError(old_value, null);
                        else if (old_value instanceof Array)
                            new_value = new NetworkError(old_value[0], old_value[1]);
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.SecurityError: {
                        if (old_value === Datex.VOID)
                            new_value = new SecurityError(null, null);
                        else if (typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint")
                            new_value = new SecurityError(old_value, null);
                        else if (old_value instanceof Array)
                            new_value = new SecurityError(old_value[0], old_value[1]);
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.RuntimeError: {
                        if (old_value === Datex.VOID)
                            new_value = new RuntimeError(null, null);
                        else if (typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint")
                            new_value = new RuntimeError(old_value, null);
                        else if (old_value instanceof Array)
                            new_value = new RuntimeError(old_value[0], old_value[1]);
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.AssertionError: {
                        if (old_value === Datex.VOID)
                            new_value = new AssertionError(null, null);
                        else if (typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint")
                            new_value = new AssertionError(old_value, null);
                        else if (old_value instanceof Array)
                            new_value = new AssertionError(old_value[0], old_value[1]);
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.Markdown: {
                        if (old_value === Datex.VOID)
                            new_value = new Markdown();
                        else if (typeof old_value == "string")
                            new_value = new Markdown(old_value);
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.Time: {
                        if (old_value === Datex.VOID)
                            new_value = new Date();
                        else if (typeof old_value == "number" || typeof old_value == "bigint")
                            new_value = new Date(Number(old_value));
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.Url: {
                        if (typeof old_value == "string")
                            new_value = new URL(old_value);
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.Function: {
                        if (old_value instanceof Tuple) {
                            new_value = new Function(old_value.get('body'), null, old_value.get('location'), null, undefined, undefined, old_value.get('context'));
                        }
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.Stream: {
                        if (old_value === Datex.VOID)
                            new_value = new Stream();
                        else if (typeof old_value == "object")
                            new_value = new Stream();
                        else
                            new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.Scope: {
                        new_value = Datex.INVALID;
                        break;
                    }
                    case Type.std.Not: {
                        new_value = Datex.Addresses.Not.get(old_value);
                        break;
                    }
                }
            }
            if (new_value === Datex.UNKNOWN_TYPE) {
                new_value = type.cast(old_value, context, origin);
            }
            if (new_value === Datex.UNKNOWN_TYPE) {
                if (!no_fetch) {
                    try {
                        await JSInterface.loadTypeConfiguration(type);
                        return Runtime.castValue(type, value, context, origin, true);
                    }
                    catch (e) {
                        logger.error(e);
                    }
                }
                else {
                    logger.warn("Unknown type '" + type.toString() + "'");
                    new_value = new UnresolvedValue(type, old_value);
                }
            }
            if (new_value === Datex.INVALID) {
                throw new TypeError("Cannot cast " + old_type + " to " + type);
            }
            return new_value;
        }
        static serializeValue(value) {
            let type;
            if (value instanceof PointerProperty)
                return value;
            if (typeof value == "string" || typeof value == "boolean" || typeof value == "number" || typeof value == "bigint")
                return value;
            if (value === Datex.VOID || value === null || value instanceof Datex.Addresses.Endpoint || value instanceof Unit || value instanceof Type)
                return value;
            if (value instanceof Datex.Scope)
                return value;
            if (value instanceof URL)
                return value;
            if (value instanceof Function)
                return new Datex.Tuple({ body: value.body, location: value.location });
            if (value instanceof Datex.Addresses.WildcardTarget)
                return value.target;
            if (value instanceof ArrayBuffer)
                return value;
            if (value instanceof Stream)
                return Datex.VOID;
            if (value instanceof NodeBuffer)
                return new Uint8Array(value.buffer, value.byteOffset, value.byteLength / Uint8Array.BYTES_PER_ELEMENT);
            if (value instanceof TypedArray)
                return value.buffer;
            let serialized = JSInterface.serializeValue(value);
            if (value instanceof NodeBuffer)
                serialized = new Uint8Array(serialized.buffer, serialized.byteOffset, serialized.byteLength / Uint8Array.BYTES_PER_ELEMENT);
            else if (serialized instanceof TypedArray)
                serialized = serialized.buffer;
            if (serialized !== Datex.INVALID && serialized !== Datex.NOT_EXISTING) { }
            else if (value instanceof Error)
                serialized = [value.code ?? value.message, value.datex_stack];
            else if (value instanceof Error)
                serialized = value.toString();
            else if (value instanceof Markdown)
                serialized = value.toString();
            else if (value instanceof Date)
                serialized = BigInt(value.getTime());
            else if (value instanceof Datex.Addresses.Not)
                serialized = value.value;
            else if (value instanceof UnresolvedValue)
                serialized = Runtime.serializeValue(value[Datex.DX_VALUE]);
            else if (value instanceof Array) {
                serialized = [];
                for (let i = 0; i < value.length; i++) {
                    serialized[i] = value[i];
                }
            }
            else if (value instanceof Tuple)
                serialized = value.clone();
            else if ((type = Type.getValueDatexType(value)) && type.visible_children) {
                serialized = {};
                const type = Type.getValueDatexType(value);
                for (let key of type.visible_children) {
                    serialized[key] = value[key];
                }
            }
            else if (typeof value == "object") {
                serialized = {};
                for (let [key, val] of Object.entries(value)) {
                    serialized[key] = val;
                }
            }
            if (serialized == Datex.INVALID || serialized == Datex.NOT_EXISTING)
                return Datex.VOID;
            return serialized;
        }
        static async equalValues(a, b) {
            a = Value.collapseValue(a, true, true);
            b = Value.collapseValue(b, true, true);
            if (a === Datex.VOID && b instanceof Tuple && Object.keys(b).length == 0)
                return true;
            if (b === Datex.VOID && a instanceof Tuple && Object.keys(a).length == 0)
                return true;
            if ((typeof a == "number" || typeof a == "bigint") && (typeof b == "number" || typeof b == "bigint"))
                return a == b;
            if (typeof a != typeof b)
                return false;
            if (a !== Object(a) && b !== Object(a !== Object(a))) {
                return a === b;
            }
            const [hashA, hashB] = await Promise.all([DatexCompiler.getValueHashString(a), DatexCompiler.getValueHashString(b)]);
            return (hashA === hashB);
        }
        static FORMAT_INDENT = 3;
        static TEXT_KEY = /^\w+$/;
        static escapeString(string, formatted = false) {
            string = string
                .replace(/\\/g, '\\\\')
                .replace(/\"/g, '\\"');
            if (!formatted)
                string = string.replace(/\n/g, "\\n");
            return '"' + string + '"';
        }
        static floatToString(float) {
            let float_string = float.toString();
            let sign = "";
            (float_string += "").charAt(0) == "-" && (float_string = float_string.substring(1), sign = "-");
            let arr = float_string.split(/[e]/ig);
            if (arr.length < 2)
                return sign + float_string;
            let dot = (.1).toLocaleString().substr(1, 1), n = arr[0], exp = +arr[1], w = (n = n.replace(/^0+/, '')).replace(dot, ''), pos = n.split(dot)[1] ? n.indexOf(dot) + exp : w.length + exp, L = pos - w.length, s = "" + BigInt(w);
            w = exp >= 0 ? (L >= 0 ? s + "0".repeat(L) : r()) : (pos <= 0 ? "0" + dot + "0".repeat(Math.abs(pos)) + s : r());
            L = w.split(dot);
            if (L[0] == "0" && L[1] == "0" || (+w == 0 && +s == 0))
                w = "0";
            return sign + w;
            function r() { return w.replace(new RegExp(`^(.{${pos}})(.)`), `$1${dot}$2`); }
        }
        static valueToDatexStringExperimental(value, deep_clone = false, collapse_value = false, formatted = false) {
            return Datex.Runtime.decompile(DatexCompiler.encodeValue(value, undefined, false, deep_clone, collapse_value), true, formatted, formatted, false);
        }
        static valueToDatexString(value, formatted = false, collapse_pointers = false, deep_collapse = false, pointer_anchors) {
            return this._valueToDatexString(value, formatted, 0, collapse_pointers, deep_collapse, pointer_anchors);
        }
        static _valueToDatexString(value, formatted = false, depth = 0, collapse_pointers = false, deep_collapse = false, pointer_anchors, _serialized = false, parents = new Set()) {
            let string;
            if (!collapse_pointers && !deep_collapse)
                value = Pointer.pointerifyValue(value);
            if (collapse_pointers && value instanceof Value)
                value = value.value;
            if (value instanceof Pointer && value.is_anonymous)
                value = value.original_value;
            if (parents.has(value))
                return value instanceof Tuple ? "(...)" : (value instanceof Array ? "[...]" : "{...}");
            let type = value instanceof Pointer ? Type.std.Object : Type.getValueDatexType(value);
            if (typeof value == "string") {
                string = Runtime.escapeString(value, formatted);
            }
            else if (value === null) {
                string = "null";
            }
            else if (value === Datex.VOID) {
                string = "void";
            }
            else if (value instanceof Unit) {
                string = value.toString();
            }
            else if (typeof value == "number") {
                if (isNaN(value))
                    string = 'nan';
                else if (value === -Infinity)
                    string = '-infinity';
                else if (value === Infinity)
                    string = 'infinity';
                else if (Object.is(value, -0))
                    string = '-0.0';
                else if (Number.isInteger(value)) {
                    string = value.toString();
                    if (!string.includes("e"))
                        string += '.0';
                }
                else
                    string = value.toString();
            }
            else if (typeof value == "bigint" || typeof value == "boolean") {
                string = value.toString();
            }
            else if (value instanceof ArrayBuffer || value instanceof NodeBuffer || value instanceof TypedArray) {
                string = "`" + Pointer.buffer2hex(value instanceof Uint8Array ? value : new Uint8Array(value instanceof TypedArray ? value.buffer : value), null, null) + "`";
            }
            else if (value instanceof Scope) {
                let spaces = Array(this.FORMAT_INDENT * (depth + 1)).join(' ');
                string = value.toString(formatted, spaces);
            }
            else if (value instanceof Datex.Addresses.Target) {
                string = value.toString();
            }
            else if (value instanceof URL) {
                string = value.toString();
            }
            else if (value instanceof Datex.Addresses.Filter) {
                string = value.toString(formatted);
            }
            else if (value instanceof Pointer) {
                if (pointer_anchors)
                    string = pointer_anchors[0] + value.toString() + pointer_anchors[1];
                else
                    string = value.toString();
            }
            else if (value instanceof PointerProperty) {
                const string_value = value.pointer.toString() + "->" + (typeof value.key == "string" && value.key.match(Runtime.TEXT_KEY) ? value.key : Runtime.valueToDatexString(value.key, false));
                if (pointer_anchors)
                    string = pointer_anchors[0] + string_value + pointer_anchors[1];
                else
                    string = string_value;
            }
            else if (value instanceof Type) {
                string = value.toString();
            }
            else if (value instanceof Tuple && _serialized) {
                parents.add(value);
                let brackets = ['(', ')'];
                if (value instanceof Tuple && value.indexed.length == 1 && value.named.size == 0)
                    string = Type.std.Tuple.toString();
                else
                    string = "";
                string += brackets[0] + (formatted ? "\n" : "");
                let first = true;
                let spaces = Array(this.FORMAT_INDENT * (depth + 1)).join(' ');
                for (let [k, v] of value) {
                    if (!first)
                        string += ", " + (formatted ? "\n" : "");
                    if (typeof k == 'string')
                        string += (formatted ? spaces : "") + `${k.match(Runtime.TEXT_KEY) ? k : Runtime.escapeString(k, false)}: ` + this._valueToDatexString(v, formatted, depth + 1, false, deep_collapse, pointer_anchors, false, new Set(parents));
                    else
                        string += (formatted ? spaces : "") + this._valueToDatexString(v, formatted, depth + 1, false, deep_collapse, pointer_anchors, false, new Set(parents));
                    first = false;
                }
                string += (formatted ? "\n" + Array(this.FORMAT_INDENT * depth).join(' ') : "") + brackets[1];
            }
            else if (value instanceof Array && _serialized) {
                parents.add(value);
                let brackets = ['[', ']'];
                string = ((value instanceof Tuple && value.length == 0) ? Type.std.Tuple.toString() : "") + brackets[0] + (formatted ? "\n" : "");
                if (value instanceof Tuple && value.length == 1)
                    string += "...";
                let first = true;
                let spaces = Array(this.FORMAT_INDENT * (depth + 1)).join(' ');
                for (let v of value) {
                    if (!first)
                        string += ", " + (formatted ? "\n" : "");
                    string += (formatted ? spaces : "") + this._valueToDatexString(v, formatted, depth + 1, false, deep_collapse, pointer_anchors, false, new Set(parents));
                    first = false;
                }
                string += (formatted ? "\n" + Array(this.FORMAT_INDENT * depth).join(' ') : "") + brackets[1];
            }
            else if ((typeof value == "object" || value instanceof Function) && _serialized) {
                parents.add(value);
                let brackets = ['{', '}'];
                let entries = Object.entries(value);
                string = brackets[0] + (formatted ? "\n" : "");
                let first = true;
                let spaces = Array(this.FORMAT_INDENT * (depth + 1)).join(' ');
                for (let [key, v] of entries) {
                    if (!first)
                        string += ", " + (formatted ? "\n" : "");
                    string += (formatted ? spaces : "") + `${key.match(Runtime.TEXT_KEY) ? key : Runtime.escapeString(key, false)}: ` + this._valueToDatexString(v, formatted, depth + 1, false, deep_collapse, pointer_anchors, false, new Set(parents));
                    first = false;
                }
                string += (formatted ? "\n" + Array(this.FORMAT_INDENT * depth).join(' ') : "") + brackets[1];
            }
            else if (typeof value == "object" || value instanceof Function) {
                parents.add(value);
                let serialized = value != null ? this.serializeValue(value) : value;
                serialized = Pointer.pointerifyValue(serialized);
                if (serialized == Datex.VOID)
                    string = "()";
                else if (type?.is_primitive)
                    string = this._valueToDatexString(serialized, formatted, depth, true, deep_collapse, pointer_anchors, false, new Set(parents));
                else
                    string = this._valueToDatexString(serialized, formatted, depth, true, deep_collapse, pointer_anchors, true, new Set(parents));
            }
            else {
                string = "void";
            }
            if (type && !type.is_primitive && type.is_complex && type != Datex.Type.std.Scope)
                string = type.toString() + (formatted ? " " : "") + string;
            return string;
        }
        static runtime_actions = {
            waitForBuffer(SCOPE, jump_to_index, shift_current_index) {
                if (typeof jump_to_index == "number")
                    SCOPE.current_index = jump_to_index;
                else if (typeof shift_current_index == "number")
                    SCOPE.current_index -= shift_current_index;
                else
                    SCOPE.current_index = SCOPE.start_index;
                SCOPE.cache_previous = true;
            },
            constructFilterElement(SCOPE, type, target_list) {
                if (SCOPE.current_index + 2 > SCOPE.buffer_views.uint8.byteLength)
                    return false;
                const name_is_binary = type == BinaryCode.ENDPOINT || type == BinaryCode.ENDPOINT_WILDCARD;
                let instance;
                let name_length = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                let subspace_number = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                let instance_length = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                if (instance_length == 0)
                    instance = "*";
                else if (instance_length == 255)
                    instance_length = 0;
                if (SCOPE.current_index + name_length + instance_length + 1 > SCOPE.buffer_views.uint8.byteLength)
                    return false;
                let name_binary = SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index += name_length);
                let name = name_is_binary ? name_binary : Runtime.utf8_decoder.decode(name_binary);
                let subspaces = [];
                for (let n = 0; n < subspace_number; n++) {
                    let length = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                    if (length == 0) {
                        subspaces.push("*");
                    }
                    else {
                        let subspace_name = Runtime.utf8_decoder.decode(SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index += length));
                        subspaces.push(subspace_name);
                    }
                }
                if (!instance)
                    instance = Runtime.utf8_decoder.decode(SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index += instance_length));
                let app_index;
                if (target_list)
                    app_index = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                return Datex.Addresses.Target.get(name, subspaces, instance, app_index ? target_list[app_index - 1] : null, type);
            },
            trimArray(array) {
                let new_length = array.length;
                for (let i = array.length - 1; i >= 0; i--) {
                    if (array[i] === Datex.VOID)
                        new_length--;
                    else
                        break;
                }
                array.length = new_length;
                return array;
            },
            getTrimmedArrayLength(array) {
                let new_length = array.length;
                for (let i = array.length - 1; i >= 0; i--) {
                    if (array[i] === Datex.VOID)
                        new_length--;
                    else
                        break;
                }
                return new_length;
            },
            async returnValue(SCOPE, value) {
                await Runtime.handleScopeResult(SCOPE.header, SCOPE, value);
            },
            enterSubScope(SCOPE) {
                SCOPE.inner_scope = { root: SCOPE.inner_scope.root, ctx_intern: SCOPE.inner_scope.active_object ?? SCOPE.inner_scope.ctx_intern };
                SCOPE.sub_scopes.push(SCOPE.inner_scope);
            },
            async exitSubScope(SCOPE) {
                await Runtime.runtime_actions.closeSubScopeAssignments(SCOPE);
                let result = SCOPE.inner_scope.result;
                let inner_spread = SCOPE.inner_scope.inner_spread;
                if (SCOPE.sub_scopes.length == 1) {
                    logger.error("Cannot exit out of root scope");
                    console.warn(Pointer.buffer2hex(SCOPE.buffer_views.uint8, " "), SCOPE.buffer_views.buffer);
                    return;
                }
                SCOPE.sub_scopes.pop();
                SCOPE.inner_scope = SCOPE.sub_scopes[SCOPE.sub_scopes.length - 1];
                if (inner_spread)
                    SCOPE.inner_scope.waiting_collapse = true;
                return result;
            },
            async newSubScope(SCOPE) {
                const is_outer_scope = SCOPE.inner_scope.is_outer_scope;
                await Runtime.runtime_actions.closeSubScopeAssignments(SCOPE);
                let result = SCOPE.inner_scope.result;
                SCOPE.sub_scopes.pop();
                Runtime.runtime_actions.enterSubScope(SCOPE);
                if (is_outer_scope && result !== Datex.VOID) {
                    SCOPE.result = result;
                }
                if (result !== Datex.VOID)
                    SCOPE.inner_scope.result = result;
                SCOPE.inner_scope.is_outer_scope = is_outer_scope;
            },
            async closeSubScopeAssignments(SCOPE) {
                const INNER_SCOPE = SCOPE.inner_scope;
                if (INNER_SCOPE.type_casts?.length) {
                    let el = INNER_SCOPE.type_casts.pop();
                    let type;
                    while (type = INNER_SCOPE.type_casts.pop())
                        el = await Runtime.castValue(type, el, INNER_SCOPE.ctx_intern ?? INNER_SCOPE.root, SCOPE.origin);
                    INNER_SCOPE.active_value = el;
                }
                let el = INNER_SCOPE.active_value;
                let did_assignment = false;
                if (INNER_SCOPE.waiting_ptrs?.size) {
                    for (let p of INNER_SCOPE.waiting_ptrs) {
                        if (p[1] == undefined)
                            p[0].setValue(el);
                        else
                            await Runtime.runtime_actions.handleAssignAction(SCOPE, p[1], null, null, el, p[0]);
                    }
                    did_assignment = true;
                }
                if (INNER_SCOPE.waiting_labels?.size) {
                    for (let label of INNER_SCOPE.waiting_labels) {
                        let pointer = Pointer.getByValue(el);
                        if (pointer)
                            pointer.addLabel(label);
                        else {
                            pointer = Pointer.create(null, el);
                            pointer.addLabel(label);
                        }
                    }
                    did_assignment = true;
                }
                if (INNER_SCOPE.waiting_vars?.size) {
                    for (let v of INNER_SCOPE.waiting_vars) {
                        if (v[1] == undefined) {
                            SCOPE.inner_scope.root[v[0]] = el;
                        }
                        else
                            await Runtime.runtime_actions.handleAssignAction(SCOPE, v[1], SCOPE.inner_scope.root, v[0], el);
                    }
                    did_assignment = true;
                }
                if (INNER_SCOPE.waiting_for_action?.length) {
                    let action;
                    while (action = INNER_SCOPE.waiting_for_action.pop()) {
                        await Runtime.runtime_actions.handleAssignAction(SCOPE, action[0], action[1], action[2], el);
                    }
                    did_assignment = true;
                }
                if (INNER_SCOPE.waiting_internal_vars?.size) {
                    did_assignment = true;
                    for (let v of INNER_SCOPE.waiting_internal_vars) {
                        if (v[1] == undefined) {
                            if (v[0] == 'result') {
                                SCOPE.result = INNER_SCOPE.result = el;
                            }
                            else if (v[0] == 'sub_result')
                                INNER_SCOPE.result = el;
                            else if (v[0] == 'it')
                                SCOPE.it = el;
                            else if (v[0] == 'root') {
                                SCOPE.inner_scope.root = el;
                            }
                            else if (v[0] == 'remote') {
                                if (typeof el == "object")
                                    SCOPE.remote = el;
                                else
                                    throw new ValueError("Invalid type for #remote");
                            }
                            else {
                                if (el === Datex.VOID)
                                    delete SCOPE.internal_vars[v[0]];
                                else
                                    SCOPE.internal_vars[v[0]] = el;
                            }
                        }
                        else {
                            let parent = SCOPE.internal_vars;
                            let key = v[0];
                            if (v[0] == 'result')
                                parent = SCOPE;
                            else if (v[0] == 'sub_result') {
                                parent = INNER_SCOPE;
                                key = 'sub_result';
                            }
                            else if (v[0] == 'root')
                                parent = SCOPE.inner_scope;
                            else if (v[0] == 'remote')
                                parent = SCOPE;
                            else if (v[0] == 'it')
                                parent = SCOPE;
                            await Runtime.runtime_actions.handleAssignAction(SCOPE, v[1], parent, key, el);
                        }
                    }
                }
                if (INNER_SCOPE.return) {
                    Runtime.runtime_actions.returnValue(SCOPE, el === Datex.VOID ? INNER_SCOPE.result : el);
                }
                else if (!did_assignment && el !== Datex.VOID)
                    INNER_SCOPE.result = el;
            },
            async handleAssignAction(SCOPE, action_type, parent, key, value, current_val) {
                if (key instanceof Iterator)
                    key = await key.collapse();
                if (action_type == -1) {
                    Runtime.runtime_actions.setProperty(SCOPE, parent, key, value);
                }
                else {
                    Runtime.runtime_actions.assignAction(SCOPE, action_type, parent, key, value, current_val);
                }
            },
            checkPointerReadPermission(parent, key) {
                parent = Pointer.pointerifyValue(parent);
                if (parent instanceof Pointer && !parent.canReadProperty(key))
                    throw new ValueError("Property '" + key.toString() + "' does not exist");
            },
            checkPointerUpdatePermission(parent, key) {
                parent = Pointer.pointerifyValue(parent);
                if (parent instanceof Pointer && !parent.canUpdateProperty(key))
                    throw new PermissionError("Cannot update the property " + Runtime.valueToDatexString(key) + "");
            },
            countValue(value) {
                if (value === Datex.VOID)
                    return 0n;
                let count = JSInterface.handleCount(value);
                if (count == Datex.NOT_EXISTING) {
                    if (value instanceof Array)
                        count = value.length;
                    else if (value.constructor == Object)
                        count = Object.keys(value).length;
                    else
                        count = 1n;
                }
                else if (count == Datex.INVALID)
                    throw new ValueError("Value uncountable");
                return BigInt(count);
            },
            hasProperty(SCOPE, parent, key) {
                let has = JSInterface.handleHasProperty(parent, key);
                if (has == Datex.NOT_EXISTING) {
                    if (parent instanceof Array) {
                        if (typeof key != "bigint")
                            throw new ValueError("Invalid key for <Array> - must be of type <Int>", SCOPE);
                        else
                            return key > 0 && key < parent.length;
                    }
                    else if (typeof parent == "object") {
                        if (typeof key != "string")
                            throw new ValueError("Invalid key for <Object> - must be of type <String>", SCOPE);
                        else if (DEFAULT_HIDDEN_OBJECT_PROPERTIES.has(key) || (parent && !(key in parent)))
                            return false;
                        else
                            return true;
                    }
                    else
                        has = Datex.INVALID;
                }
                if (has == Datex.INVALID)
                    throw new ValueError("Cannot check for properties on this value");
                else
                    return has;
            },
            getReferencedProperty(parent, key) {
                const pointer = Pointer.createOrGet(parent);
                if (pointer) {
                    return PointerProperty.get(pointer, key);
                }
                else
                    throw new RuntimeError("Could not get a child reference");
            },
            getProperty(SCOPE, parent, key) {
                if (parent instanceof UnresolvedValue)
                    parent = parent[Datex.DX_VALUE];
                key = Value.collapseValue(key, true, true);
                Runtime.runtime_actions.checkPointerReadPermission(parent, key);
                if (!Type.doesValueHaveProperties(parent))
                    throw new ValueError("Value of type " + Type.getValueDatexType(parent) + " has no properties", SCOPE);
                if (key === Datex.WILDCARD) {
                    parent = Value.collapseValue(parent, true, true);
                    let values = JSInterface.handleGetAllValues(parent);
                    if (values == Datex.NOT_EXISTING) {
                        let keys;
                        if (parent instanceof Array) {
                            keys = [];
                            const N = parent.length;
                            let i = 0n;
                            while (i < N)
                                keys[Number(i)] = i++;
                        }
                        else
                            keys = Object.keys(parent);
                        if (!(Symbol.iterator in keys))
                            throw new RuntimeError("Value keys are not iterable", SCOPE);
                        return Runtime.runtime_actions.getProperty(SCOPE, Pointer.pointerifyValue(parent), new Tuple(keys));
                    }
                    else if (values == Datex.INVALID)
                        throw new ValueError("Value has no iterable content", SCOPE);
                    if (!(Symbol.iterator in values))
                        throw new RuntimeError("Value keys are not iterable", SCOPE);
                    return values instanceof Tuple ? values : new Tuple(values);
                }
                else if (key instanceof Tuple) {
                    return Iterator.map(key.toArray(), (k) => Runtime.runtime_actions.getProperty(SCOPE, parent, k));
                }
                else if (key instanceof Iterator) {
                    return Iterator.map(key, (k) => Runtime.runtime_actions.getProperty(SCOPE, parent, k));
                }
                parent = Value.collapseValue(parent, true, true);
                let new_obj = JSInterface.handleGetProperty(parent, key);
                if (new_obj == Datex.INVALID)
                    throw new ValueError("Property '" + key.toString() + "' does not exist", SCOPE);
                else if (new_obj == Datex.NOT_EXISTING) {
                    if (parent instanceof Addresses.Endpoint)
                        return parent.getSubspace(key?.toString());
                    if (parent instanceof Array && typeof key != "bigint")
                        throw new ValueError("Invalid key for <Array> - must be of type <Int>", SCOPE);
                    else if (parent instanceof Tuple && !(key in parent))
                        throw new ValueError("Property '" + key.toString() + "' does not exist in <Tuple>", SCOPE);
                    else if ((Object.isSealed(parent) || Object.isFrozen(parent)) && !parent.hasOwnProperty(key))
                        throw new ValueError("Property '" + key.toString() + "' does not exist", SCOPE);
                    else if (typeof key != "string" && !(parent instanceof Array))
                        throw new ValueError("Invalid key for <Object> - must be of type <String>", SCOPE);
                    else if (DEFAULT_HIDDEN_OBJECT_PROPERTIES.has(key) || (parent && !(key in parent)))
                        return Datex.VOID;
                    else {
                        if (parent instanceof Array && typeof key == "bigint" && key < 0n)
                            key = parent.length + Number(key);
                        else
                            return parent[key];
                    }
                }
                else
                    return new_obj;
            },
            setProperty(SCOPE, parent, key, value) {
                if (parent instanceof UnresolvedValue)
                    parent = parent[Datex.DX_VALUE];
                let o_parent = Pointer.pointerifyValue(parent);
                if (!(o_parent instanceof Pointer))
                    o_parent = null;
                key = Value.collapseValue(key, true, true);
                Runtime.runtime_actions.checkPointerUpdatePermission(parent, key);
                if (!Type.doesValueHaveProperties(parent)) {
                    throw new PermissionError("Cannot set a property for value of type " + Type.getValueDatexType(parent) + "", SCOPE);
                }
                if (key === Datex.WILDCARD) {
                    parent = Value.collapseValue(parent, true, true);
                    if (JSInterface.hasPseudoClass(parent)) {
                        if (value === Datex.VOID) {
                            let res = JSInterface.handleClear(parent);
                            if (res == Datex.INVALID || res == Datex.NOT_EXISTING)
                                throw new ValueError("Cannot clear value", SCOPE);
                        }
                        else {
                            let keys = JSInterface.handleKeys(parent);
                            if (keys == Datex.INVALID || keys == Datex.NOT_EXISTING)
                                throw new ValueError("Value has no iterable content", SCOPE);
                            Runtime.runtime_actions.setProperty(SCOPE, Pointer.pointerifyValue(parent), new Tuple(keys), value);
                        }
                    }
                    else if (value instanceof Tuple && (typeof parent == "object")) {
                        DatexObject.extend(parent, value);
                    }
                    else {
                        let keys;
                        if (parent instanceof Array) {
                            keys = [];
                            const N = parent.length;
                            let i = 0n;
                            while (i < N)
                                keys[Number(i)] = i++;
                        }
                        else
                            keys = Object.keys(parent);
                        if (!(Symbol.iterator in keys))
                            throw new RuntimeError("Value keys are not iterable", SCOPE);
                        Runtime.runtime_actions.setProperty(SCOPE, Pointer.pointerifyValue(parent), new Tuple(keys), value);
                    }
                    return;
                }
                else if (key instanceof Tuple) {
                    if (value instanceof Tuple) {
                        for (let [k, v] of Object.entries(value)) {
                            Runtime.runtime_actions.setProperty(SCOPE, parent, k, v);
                        }
                    }
                    else {
                        for (let k of key.toArray())
                            Runtime.runtime_actions.setProperty(SCOPE, parent, k, value);
                    }
                    return;
                }
                parent = Value.collapseValue(parent, true, true);
                value = Value.collapseValue(value, true);
                if (parent[Datex.DX_PERMISSIONS]?.[key] && !parent[Datex.DX_PERMISSIONS][key].test(SCOPE.sender)) {
                    throw new PermissionError("Cannot update this value");
                }
                let current_value = JSInterface.handleGetProperty(parent, key);
                if (current_value === value) {
                    return;
                }
                o_parent?.excludeEndpointFromUpdates(SCOPE.sender);
                let assigned;
                if (value === Datex.VOID)
                    assigned = JSInterface.handleDeleteProperty(parent, key);
                else
                    assigned = JSInterface.handleSetProperty(parent, key, value);
                if (assigned === Datex.INVALID) {
                    o_parent?.enableUpdatesForAll();
                    throw new ValueError("Property '" + key.toString() + "' can not be " + (value === Datex.VOID ? "deleted" : "set"), SCOPE);
                }
                else if (assigned == Datex.NOT_EXISTING) {
                    if (parent instanceof Array && (typeof key != "bigint")) {
                        o_parent?.enableUpdatesForAll();
                        throw new ValueError("Invalid key for <Array> - must be of type <Int>", SCOPE);
                    }
                    else if (typeof key != "string" && !(parent instanceof Array)) {
                        o_parent?.enableUpdatesForAll();
                        throw new ValueError("Invalid key for <Object> - must be of type <String>", SCOPE);
                    }
                    else if (DEFAULT_HIDDEN_OBJECT_PROPERTIES.has(key)) {
                        o_parent?.enableUpdatesForAll();
                        throw new ValueError("Property '" + key.toString() + "' can not be " + (value === Datex.VOID ? "deleted" : "set"), SCOPE);
                    }
                    else {
                        if (parent instanceof Array && typeof key == "bigint" && key < 0n)
                            key = parent.length + Number(key);
                        const type = Type.getValueDatexType(parent);
                        if (type.template && !type.isPropertyAllowed(key))
                            throw new ValueError("Property '" + key + '" does not exist');
                        if (type.template && !type.isPropertyValueAllowed(key, value))
                            throw new ValueError("Property '" + key + "' must be of type " + type.getAllowedPropertyType(key));
                        if (parent instanceof Tuple && !(key in parent))
                            throw new ValueError("Property '" + key.toString() + "' does not exist in <Tuple>", SCOPE);
                        try {
                            if (value === Datex.VOID) {
                                delete parent[key];
                                if (parent instanceof Array && Number(key) + 1 == parent.length)
                                    Runtime.runtime_actions.trimArray(parent);
                            }
                            else
                                parent[key] = value;
                        }
                        catch (e) {
                            o_parent?.enableUpdatesForAll();
                            console.warn(e);
                            throw new RuntimeError("Property '" + key.toString() + "' is readonly or does not exist", SCOPE);
                        }
                    }
                }
                o_parent?.enableUpdatesForAll();
            },
            assignAction(SCOPE, action_type, parent, key, value, current_val = Runtime.runtime_actions.getProperty(SCOPE, parent, key)) {
                if (parent instanceof UnresolvedValue)
                    parent = parent[Datex.DX_VALUE];
                let o_parent = Pointer.pointerifyValue(current_val);
                if (!(o_parent instanceof Pointer))
                    o_parent = null;
                key = Value.collapseValue(key, true, true);
                Runtime.runtime_actions.checkPointerUpdatePermission(parent, key);
                if (key === Datex.WILDCARD) {
                    parent = Value.collapseValue(parent);
                    let keys;
                    if (JSInterface.hasPseudoClass(parent)) {
                        let _keys = JSInterface.handleKeys(parent);
                        if (_keys == Datex.INVALID || _keys == Datex.NOT_EXISTING)
                            throw new ValueError("Value has no iterable content", SCOPE);
                        keys = _keys;
                    }
                    else {
                        if (parent instanceof Array) {
                            keys = [];
                            const N = parent.length;
                            let i = 0n;
                            while (i < N)
                                keys[Number(i)] = i++;
                        }
                        else
                            keys = Object.keys(parent);
                        if (!(Symbol.iterator in keys))
                            throw new RuntimeError("Value keys are not iterable", SCOPE);
                    }
                    Runtime.runtime_actions.assignAction(SCOPE, action_type, Pointer.pointerifyValue(parent), new Tuple(keys), value);
                    return;
                }
                else if (key instanceof Tuple) {
                    const array = key.toArray();
                    if (value instanceof Tuple) {
                        for (let i = 0; i < array.length; i++) {
                            Runtime.runtime_actions.assignAction(SCOPE, action_type, parent, array[i], value[i]);
                        }
                    }
                    else {
                        for (let k of array)
                            Runtime.runtime_actions.assignAction(SCOPE, action_type, parent, k, value);
                    }
                    return;
                }
                else if (action_type == BinaryCode.ADD) {
                    if (value instanceof Tuple) {
                        if (current_val instanceof Array) {
                            for (let v of value.indexed) {
                                Runtime.runtime_actions.assignAction(SCOPE, action_type, null, null, v, current_val);
                            }
                        }
                        else
                            DatexObject.extend(current_val, value);
                        return;
                    }
                }
                current_val = Value.collapseValue(current_val);
                parent = Value.collapseValue(parent);
                value = Value.collapseValue(value);
                o_parent?.excludeEndpointFromUpdates(SCOPE.sender);
                let assigned = JSInterface.handlePropertyAction(action_type, current_val, value);
                if (assigned === Datex.INVALID) {
                    o_parent?.enableUpdatesForAll();
                    throw new ValueError("Could not perform property operation", SCOPE);
                }
                else if (assigned == Datex.NOT_EXISTING) {
                    const current_val_prim = Value.collapseValue(current_val, true, true);
                    const value_prim = Value.collapseValue(value, true, true);
                    try {
                        switch (action_type) {
                            case BinaryCode.ADD:
                                if (current_val instanceof Array && !(current_val instanceof Tuple))
                                    current_val.push(value);
                                else if (current_val instanceof String && typeof value_prim == "string")
                                    current_val.value += value;
                                else if (current_val instanceof Float && typeof value_prim == "number")
                                    current_val.value += value_prim;
                                else if (current_val instanceof Int && typeof value_prim == "bigint")
                                    current_val.value += value_prim;
                                else if (current_val instanceof Float && typeof value_prim == "bigint")
                                    current_val.value += Number(value_prim);
                                else if (current_val instanceof Int && typeof value_prim == "number")
                                    throw new ValueError("Cannot apply a <Float> value to an <Int> pointer", SCOPE);
                                else if (typeof current_val == "object" && typeof value == "object")
                                    DatexObject.extend(current_val, value);
                                else if (current_val_prim instanceof Unit && value_prim instanceof Unit)
                                    Runtime.runtime_actions.setProperty(SCOPE, parent, key, new Unit(current_val_prim + value_prim));
                                else if (typeof current_val_prim == "number" && typeof value_prim == "number")
                                    Runtime.runtime_actions.setProperty(SCOPE, parent, key, current_val_prim + value_prim);
                                else if ((typeof current_val_prim == "number" && typeof value_prim == "bigint") || (typeof current_val_prim == "bigint" && typeof value_prim == "number"))
                                    Runtime.runtime_actions.setProperty(SCOPE, parent, key, Number(current_val_prim) + Number(value_prim));
                                else if (typeof current_val_prim == "bigint" && typeof value_prim == "bigint")
                                    Runtime.runtime_actions.setProperty(SCOPE, parent, key, current_val_prim + value_prim);
                                else if (typeof current_val_prim == "string" && typeof value_prim == "string")
                                    Runtime.runtime_actions.setProperty(SCOPE, parent, key, current_val_prim + value_prim);
                                else
                                    throw new ValueError("Failed to perform an add operation on this value", SCOPE);
                                break;
                            case BinaryCode.SUBTRACT:
                                if (current_val instanceof Array)
                                    Runtime.runtime_actions._removeItemFromArray(current_val, value);
                                else if (current_val instanceof Float && typeof value_prim == "number")
                                    current_val.value -= value_prim;
                                else if (current_val instanceof Int && typeof value_prim == "bigint")
                                    current_val.value -= value_prim;
                                else if (current_val instanceof Float && typeof value_prim == "bigint")
                                    current_val.value -= Number(value_prim);
                                else if (current_val instanceof Int && typeof value_prim == "number")
                                    throw new ValueError("Cannot apply a <Float> value to an <Int> pointer", SCOPE);
                                else if (current_val instanceof Unit && value instanceof Unit)
                                    Runtime.runtime_actions.setProperty(SCOPE, parent, key, new Unit(current_val - value));
                                else if (typeof current_val_prim == "number" && typeof value_prim == "number")
                                    Runtime.runtime_actions.setProperty(SCOPE, parent, key, current_val_prim - value_prim);
                                else if ((typeof current_val_prim == "number" && typeof value_prim == "bigint") || (typeof current_val_prim == "bigint" && typeof value_prim == "number"))
                                    Runtime.runtime_actions.setProperty(SCOPE, parent, key, Number(current_val_prim) - Number(value_prim));
                                else if (typeof current_val_prim == "bigint" && typeof value_prim == "bigint")
                                    Runtime.runtime_actions.setProperty(SCOPE, parent, key, current_val_prim - value_prim);
                                else
                                    throw new ValueError("Failed to perform a subtract operation on this value", SCOPE);
                                break;
                            case BinaryCode.MULTIPLY:
                                if (current_val instanceof Float && typeof value_prim == "number")
                                    current_val.value *= value_prim;
                                else if (current_val instanceof Int && typeof value_prim == "bigint")
                                    current_val.value *= value_prim;
                                else if (current_val instanceof Float && typeof value_prim == "bigint")
                                    current_val.value *= Number(value_prim);
                                else if (current_val instanceof Int && typeof value_prim == "number")
                                    throw new ValueError("Cannot apply a <Float> value to an <Int> pointer", SCOPE);
                                else if (current_val instanceof Unit && value instanceof Unit)
                                    Runtime.runtime_actions.setProperty(SCOPE, parent, key, new Unit(current_val * value));
                                else if (typeof current_val_prim == "number" && typeof value_prim == "number")
                                    Runtime.runtime_actions.setProperty(SCOPE, parent, key, current_val_prim * value_prim);
                                else if ((typeof current_val_prim == "number" && typeof value_prim == "bigint") || (typeof current_val_prim == "bigint" && typeof value_prim == "number"))
                                    Runtime.runtime_actions.setProperty(SCOPE, parent, key, Number(current_val_prim) * Number(value_prim));
                                else if (typeof current_val_prim == "bigint" && typeof value_prim == "bigint")
                                    Runtime.runtime_actions.setProperty(SCOPE, parent, key, current_val_prim * value_prim);
                                else
                                    throw new ValueError("Failed to perform a subtract operation on this value", SCOPE);
                                break;
                            case BinaryCode.DIVIDE:
                                if (current_val instanceof Float && typeof value_prim == "number")
                                    current_val.value /= value_prim;
                                else if (current_val instanceof Int && typeof value_prim == "bigint")
                                    current_val.value /= value_prim;
                                else if (current_val instanceof Float && typeof value_prim == "bigint")
                                    current_val.value /= Number(value_prim);
                                else if (current_val instanceof Int && typeof value_prim == "number")
                                    throw new ValueError("Cannot apply a <Float> value to an <Int> pointer", SCOPE);
                                else if (current_val instanceof Unit && value instanceof Unit)
                                    Runtime.runtime_actions.setProperty(SCOPE, parent, key, new Unit(current_val / value));
                                else if (typeof current_val_prim == "number" && typeof value_prim == "number")
                                    Runtime.runtime_actions.setProperty(SCOPE, parent, key, current_val_prim / value_prim);
                                else if ((typeof current_val_prim == "number" && typeof value_prim == "bigint") || (typeof current_val_prim == "bigint" && typeof value_prim == "number"))
                                    Runtime.runtime_actions.setProperty(SCOPE, parent, key, Number(current_val_prim) / Number(value_prim));
                                else if (typeof current_val_prim == "bigint" && typeof value_prim == "bigint")
                                    Runtime.runtime_actions.setProperty(SCOPE, parent, key, current_val_prim / value_prim);
                                else
                                    throw new ValueError("Failed to perform a subtract operation on this value", SCOPE);
                                break;
                            case BinaryCode.CREATE_POINTER:
                                if (current_val instanceof Pointer)
                                    current_val.value = value_prim;
                                else
                                    throw new ValueError("Pointer value assignment not possible on this value", SCOPE);
                                break;
                            default:
                                throw new RuntimeError("Unsupported assignment operation", SCOPE);
                        }
                    }
                    catch (e) {
                        o_parent?.enableUpdatesForAll();
                        if (e instanceof Error)
                            throw e;
                        console.log(e);
                        throw new PermissionError("Cannot change a readonly value", SCOPE);
                    }
                }
                o_parent?.enableUpdatesForAll();
            },
            _removeItemFromArray(arr, value) {
                let i = 0;
                while (i < arr.length) {
                    if (arr[i] === value)
                        arr.splice(i, 1);
                    else
                        ++i;
                }
            },
            extractScopeBlock(SCOPE) {
                if (SCOPE.current_index + Uint32Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength)
                    return false;
                let buffer_length = SCOPE.buffer_views.data_view.getUint32(SCOPE.current_index, true);
                SCOPE.current_index += Uint32Array.BYTES_PER_ELEMENT;
                if (buffer_length == 0)
                    return undefined;
                if (SCOPE.current_index + buffer_length > SCOPE.buffer_views.uint8.byteLength)
                    return false;
                let _buffer = SCOPE.buffer_views.buffer.slice(SCOPE.current_index, SCOPE.current_index + buffer_length);
                SCOPE.current_index += buffer_length;
                return _buffer;
            },
            extractVariableName(SCOPE) {
                if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                    return false;
                let length = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                let name;
                if (length == 0) {
                    if (SCOPE.current_index + Uint16Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength)
                        return false;
                    name = SCOPE.buffer_views.data_view.getUint16(SCOPE.current_index, true);
                    SCOPE.current_index += Uint16Array.BYTES_PER_ELEMENT;
                }
                else {
                    if (SCOPE.current_index + length > SCOPE.buffer_views.uint8.byteLength)
                        return false;
                    name = Runtime.utf8_decoder.decode(SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index + length));
                    SCOPE.current_index += length;
                }
                return name;
            },
            extractType(SCOPE, is_extended_type = false) {
                if (SCOPE.current_index + 2 + (is_extended_type ? 2 : 0) > SCOPE.buffer_views.uint8.byteLength)
                    return false;
                let ns_length = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                let name_length = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                let variation_length = 0;
                let has_parameters;
                if (is_extended_type) {
                    variation_length = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                    has_parameters = SCOPE.buffer_views.uint8[SCOPE.current_index++] ? true : false;
                }
                if (SCOPE.current_index + ns_length + name_length + variation_length > SCOPE.buffer_views.uint8.byteLength)
                    return false;
                let ns = Runtime.utf8_decoder.decode(SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index += ns_length));
                let type = Runtime.utf8_decoder.decode(SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index += name_length));
                let varation;
                if (is_extended_type) {
                    varation = Runtime.utf8_decoder.decode(SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index += variation_length));
                }
                return is_extended_type ? [Type.get(ns, type, varation), has_parameters] : Type.get(ns, type, varation);
            },
            forkScope(SCOPE) {
                let structuredClone = globalThis.structuredClone;
                const forked_scope = {
                    sid: SCOPE.sid,
                    header: SCOPE.header,
                    sender: SCOPE.sender,
                    origin: SCOPE.origin,
                    current_index: SCOPE.current_index,
                    start_index: SCOPE.start_index,
                    index_offset: SCOPE.index_offset,
                    cache_previous: SCOPE.cache_previous,
                    cache_after_index: SCOPE.cache_after_index,
                    context: SCOPE.context,
                    sync: SCOPE.sync,
                    unsubscribe: SCOPE.unsubscribe,
                    result: SCOPE.result,
                    closed: SCOPE.closed,
                    root: { ...SCOPE.root },
                    internal_vars: { ...SCOPE.internal_vars },
                    execution_permission: SCOPE.execution_permission,
                    impersonation_permission: SCOPE.impersonation_permission,
                    sub_scopes: [],
                    meta: { ...SCOPE.meta },
                    remote: { ...SCOPE.remote },
                    buffer_views: { ...SCOPE.buffer_views },
                    inner_scope: undefined
                };
                for (let s of SCOPE.sub_scopes) {
                    forked_scope.sub_scopes.push({
                        result: s.result,
                        is_outer_scope: s.is_outer_scope,
                        type_casts: s.type_casts,
                        root: s.root,
                        ctx_intern: s.ctx_intern,
                        last_insert_value: s.last_insert_value,
                        active_object: s.active_object,
                        auto_obj_index: s.auto_obj_index,
                        active_object_new: s.active_object_new,
                        waiting_key: s.waiting_key,
                        waiting_vars: s.waiting_vars,
                        waiting_ptrs: s.waiting_ptrs,
                        waiting_internal_vars: s.waiting_internal_vars,
                        waiting_ext_type: s.waiting_ext_type,
                        waiting_labels: s.waiting_labels,
                        waiting_for_child: s.waiting_for_child,
                        waiting_for_child_action: s.waiting_for_child_action,
                        return: s.return,
                        waiting_range: s.waiting_range,
                        waiting_collapse: s.waiting_collapse,
                        compare_type: s.compare_type,
                        about: s.about,
                        count: s.count,
                        request: s.request,
                        waiting_for_action: s.waiting_for_action,
                        create_pointer: s.create_pointer,
                        delete_pointer: s.delete_pointer,
                        sync: s.sync,
                        unsubscribe: s.unsubscribe,
                        get_value: s.get_value,
                        get_type: s.get_type,
                        get_origin: s.get_origin,
                        get_subscribers: s.get_subscribers,
                        active_value: s.active_value,
                        auto_exit: s.auto_exit,
                        stream_consumer: s.stream_consumer,
                        jmp: s.jmp,
                        jmp_true: s.jmp_true,
                        operator: s.operator,
                        negate_operator: s.negate_operator
                    });
                }
                forked_scope.inner_scope = forked_scope.sub_scopes[forked_scope.sub_scopes.length - 1];
                return forked_scope;
            },
            async insertToScope(SCOPE, el, literal_value = false) {
                const INNER_SCOPE = SCOPE.inner_scope;
                el = Value.collapseValue(el);
                if (INNER_SCOPE.template) {
                    if (INNER_SCOPE.template === true) {
                        if (el instanceof Type) {
                            INNER_SCOPE.template = el;
                            return;
                        }
                        else
                            throw new RuntimeError("Invalid template definition");
                    }
                    else if (INNER_SCOPE.template instanceof Type) {
                        if (typeof el == "object") {
                            INNER_SCOPE.template.setTemplate(el);
                            delete INNER_SCOPE.template;
                        }
                        else
                            throw new RuntimeError("Invalid template definition");
                        return;
                    }
                    else
                        throw new RuntimeError("Invalid template definition");
                }
                if (INNER_SCOPE.scope_block_for && SCOPE.buffer_views.uint8[SCOPE.current_index] != BinaryCode.CHILD_GET_REF) {
                    INNER_SCOPE.scope_block_vars.push(Pointer.pointerifyValue(el));
                    return;
                }
                if (INNER_SCOPE.wait_dynamic_key) {
                    let key = el;
                    console.log("DYN>", key);
                    INNER_SCOPE.waiting_key = key;
                    INNER_SCOPE.wait_dynamic_key = false;
                    Datex.Runtime.runtime_actions.enterSubScope(SCOPE);
                    return;
                }
                if (INNER_SCOPE.wait_iterator) {
                    INNER_SCOPE.active_value = $$(Datex.Iterator.get(el));
                    delete INNER_SCOPE.wait_iterator;
                    return;
                }
                if (INNER_SCOPE.wait_await) {
                    if (el instanceof Datex.Task) {
                        delete INNER_SCOPE.wait_await;
                        const task = el;
                        INNER_SCOPE.active_value = await task.promise;
                        return;
                    }
                    else if (el instanceof Datex.Tuple) {
                        delete INNER_SCOPE.wait_await;
                        INNER_SCOPE.active_value = await Promise.all(el.indexed.map(v => v.promise));
                        return;
                    }
                }
                if (INNER_SCOPE.wait_hold) {
                    if (el instanceof Scope) {
                        const lazy_value = new Datex.LazyValue(el);
                        INNER_SCOPE.active_value = lazy_value;
                    }
                    else
                        throw new RuntimeError("Invalid hold");
                    delete INNER_SCOPE.wait_hold;
                    return;
                }
                if (INNER_SCOPE.waiting_ext_type) {
                    if (!(el instanceof Tuple))
                        el = new Tuple([el]);
                    if (el.size)
                        el = INNER_SCOPE.waiting_ext_type.getParametrized(el.toArray());
                    else
                        el = INNER_SCOPE.waiting_ext_type;
                    INNER_SCOPE.waiting_ext_type = null;
                }
                if (!literal_value && el instanceof Type && !(Runtime.END_BIN_CODES.includes(SCOPE.buffer_views.uint8[SCOPE.current_index]) || SCOPE.buffer_views.uint8[SCOPE.current_index] == BinaryCode.CHILD_GET || SCOPE.buffer_views.uint8[SCOPE.current_index] == BinaryCode.CHILD_GET_REF)) {
                    if (!INNER_SCOPE.type_casts)
                        INNER_SCOPE.type_casts = [];
                    INNER_SCOPE.type_casts.push(el);
                    return;
                }
                if (INNER_SCOPE.type_casts) {
                    let type;
                    while (type = INNER_SCOPE.type_casts.pop())
                        el = await Runtime.castValue(type, el, INNER_SCOPE.ctx_intern ?? INNER_SCOPE.root, SCOPE.origin);
                }
                if (INNER_SCOPE.negate_operator) {
                    if (el instanceof Datex.Addresses.Target || el instanceof Datex.Addresses.Filter || el instanceof Set || el instanceof Array) {
                        el = Datex.Addresses.Not.get(el);
                    }
                    else if (el instanceof Datex.Addresses.Not) {
                        el = el.value;
                    }
                    else if (typeof el == "boolean") {
                        el = !el;
                    }
                    else
                        throw (new ValueError("Cannot negate this value (" + Runtime.valueToDatexString(el) + ")", SCOPE));
                    delete INNER_SCOPE.negate_operator;
                }
                if (INNER_SCOPE.waiting_for_child == 1) {
                    el = Runtime.runtime_actions.getProperty(SCOPE, INNER_SCOPE.active_value, el);
                    delete INNER_SCOPE.active_value;
                    INNER_SCOPE.waiting_for_child = 0;
                }
                else if (INNER_SCOPE.waiting_for_child == 2) {
                    el = Runtime.runtime_actions.getReferencedProperty(INNER_SCOPE.active_value, el);
                    delete INNER_SCOPE.active_value;
                    INNER_SCOPE.waiting_for_child = 0;
                }
                else if (INNER_SCOPE.waiting_for_child_action) {
                    if (!INNER_SCOPE.waiting_for_action)
                        INNER_SCOPE.waiting_for_action = [];
                    INNER_SCOPE.waiting_for_action.push([INNER_SCOPE.waiting_for_child_action, INNER_SCOPE.active_value, el]);
                    delete INNER_SCOPE.active_value;
                    delete INNER_SCOPE.waiting_for_child_action;
                    return;
                }
                if (!INNER_SCOPE.auto_exit && (SCOPE.buffer_views.uint8[SCOPE.current_index] == BinaryCode.CHILD_GET || SCOPE.buffer_views.uint8[SCOPE.current_index] == BinaryCode.CHILD_GET_REF)) {
                    Runtime.runtime_actions.enterSubScope(SCOPE);
                    SCOPE.inner_scope.active_value = el;
                    SCOPE.inner_scope.auto_exit = 1;
                    return;
                }
                if (INNER_SCOPE.waiting_for_key_perm) {
                    INNER_SCOPE.waiting_for_key_perm = false;
                    if (el instanceof Datex.Addresses.Target)
                        INNER_SCOPE.key_perm = new Datex.Addresses.Filter(el);
                    else if (el instanceof Datex.Addresses.Filter)
                        INNER_SCOPE.key_perm = el;
                    else
                        throw new ValueError("Invalid permission prefix must be <Filter> or <Target>");
                    return;
                }
                if (INNER_SCOPE.waiting_range) {
                    if (INNER_SCOPE.waiting_range.length < 2)
                        INNER_SCOPE.waiting_range.push(el);
                    if (INNER_SCOPE.waiting_range.length == 2) {
                        INNER_SCOPE.active_value = $$(new RangeIterator(INNER_SCOPE.waiting_range[0], INNER_SCOPE.waiting_range[1]));
                        INNER_SCOPE.waiting_range = null;
                    }
                }
                else if (INNER_SCOPE.active_object && (INNER_SCOPE.active_object instanceof Array)) {
                    if (INNER_SCOPE.waiting_collapse) {
                        INNER_SCOPE.waiting_collapse = false;
                        if (el instanceof Iterator)
                            INNER_SCOPE.active_object.push(...(await el.collapse()).toArray());
                        else if (el instanceof Tuple)
                            INNER_SCOPE.active_object.push(...el.toArray());
                        else if (el instanceof Array)
                            INNER_SCOPE.active_object.push(...el);
                        else
                            throw new ValueError("Cannot collapse value");
                    }
                    else if ('waiting_key' in INNER_SCOPE) {
                        if (typeof INNER_SCOPE.waiting_key == "bigint")
                            INNER_SCOPE.active_object[Number(INNER_SCOPE.waiting_key)] = el;
                        else
                            throw new Datex.ValueError("<Array> key must be <Int>");
                        if (INNER_SCOPE.key_perm) {
                            console.log("array key permission", INNER_SCOPE.waiting_key, INNER_SCOPE.key_perm, el);
                            if (!INNER_SCOPE.active_object[Datex.DX_PERMISSIONS])
                                INNER_SCOPE.active_object[Datex.DX_PERMISSIONS] = {};
                            INNER_SCOPE.active_object[Datex.DX_PERMISSIONS][INNER_SCOPE.waiting_key] = INNER_SCOPE.key_perm;
                            delete INNER_SCOPE.key_perm;
                        }
                        delete INNER_SCOPE.waiting_key;
                    }
                    else
                        INNER_SCOPE.active_object.push(el);
                }
                else if (INNER_SCOPE.active_object && (INNER_SCOPE.active_object instanceof Tuple)) {
                    if (INNER_SCOPE.waiting_collapse) {
                        INNER_SCOPE.waiting_collapse = false;
                        if (el instanceof Iterator)
                            INNER_SCOPE.active_object.push(...(await el.collapse()).toArray());
                        else if (el instanceof Tuple)
                            INNER_SCOPE.active_object.spread(el);
                        else if (el instanceof Array)
                            INNER_SCOPE.active_object.push(...el);
                        else
                            throw new ValueError("Cannot collapse value");
                    }
                    else if ('waiting_key' in INNER_SCOPE) {
                        INNER_SCOPE.active_object.set(INNER_SCOPE.waiting_key, el);
                        if (INNER_SCOPE.key_perm) {
                            console.log("tuple key permission", INNER_SCOPE.waiting_key, INNER_SCOPE.key_perm, el);
                            if (!INNER_SCOPE.active_object[Datex.DX_PERMISSIONS])
                                INNER_SCOPE.active_object[Datex.DX_PERMISSIONS] = {};
                            INNER_SCOPE.active_object[Datex.DX_PERMISSIONS][INNER_SCOPE.waiting_key] = INNER_SCOPE.key_perm;
                            delete INNER_SCOPE.key_perm;
                        }
                        delete INNER_SCOPE.waiting_key;
                    }
                    else {
                        INNER_SCOPE.active_object.push(el);
                    }
                }
                else if (INNER_SCOPE.active_object) {
                    if (INNER_SCOPE.waiting_collapse) {
                        INNER_SCOPE.waiting_collapse = false;
                        if (el instanceof Tuple)
                            Object.assign(INNER_SCOPE.active_object, el.toObject());
                        else if (Datex.Type.getValueDatexType(el) == Datex.Type.std.Object)
                            Object.assign(INNER_SCOPE.active_object, el);
                        else
                            throw new ValueError("Cannot collapse value");
                    }
                    else if ('waiting_key' in INNER_SCOPE) {
                        if (typeof INNER_SCOPE.waiting_key == "string")
                            INNER_SCOPE.active_object[INNER_SCOPE.waiting_key] = el;
                        else
                            throw new Datex.ValueError("<Object> key must be <String>");
                        if (INNER_SCOPE.key_perm) {
                            console.log("object key permission", INNER_SCOPE.waiting_key, INNER_SCOPE.key_perm, el);
                            if (!INNER_SCOPE.active_object[Datex.DX_PERMISSIONS])
                                INNER_SCOPE.active_object[Datex.DX_PERMISSIONS] = {};
                            INNER_SCOPE.active_object[Datex.DX_PERMISSIONS][INNER_SCOPE.waiting_key] = INNER_SCOPE.key_perm;
                            delete INNER_SCOPE.key_perm;
                        }
                        delete INNER_SCOPE.waiting_key;
                    }
                    else
                        throw new Datex.ValueError("<Object> key cannot be void");
                }
                else if (INNER_SCOPE.jmp) {
                    let is_true = (el !== Datex.VOID && el !== false && el !== 0 && el !== 0n && el !== null);
                    if ((INNER_SCOPE.jmp_true && is_true) || (!INNER_SCOPE.jmp_true && !is_true)) {
                        SCOPE.current_index = INNER_SCOPE.jmp;
                    }
                    await Runtime.runtime_actions.newSubScope(SCOPE);
                }
                else if (INNER_SCOPE.create_pointer || INNER_SCOPE.delete_pointer) {
                    if (INNER_SCOPE.create_pointer) {
                        INNER_SCOPE.create_pointer = false;
                        if (!SCOPE.impersonation_permission)
                            throw new PermissionError("No permission to create pointers on this endpoint", SCOPE);
                        INNER_SCOPE.active_value = Value.collapseValue(Pointer.createOrGet(el));
                    }
                    if (INNER_SCOPE.delete_pointer) {
                        delete INNER_SCOPE.active_value;
                        INNER_SCOPE.delete_pointer = false;
                        if (!SCOPE.impersonation_permission)
                            throw new PermissionError("No permission to delete pointers on this endpoint", SCOPE);
                        el = Pointer.pointerifyValue(el);
                        if (el instanceof Pointer)
                            el.delete();
                        else
                            throw new PermissionError("Cannot delete non-pointer", SCOPE);
                        return;
                    }
                }
                else if (INNER_SCOPE.sync) {
                    INNER_SCOPE.sync = false;
                    SCOPE.sync = false;
                    let pointer = Pointer.pointerifyValue(el);
                    if (!(pointer instanceof Pointer) || pointer.is_anonymous)
                        throw new ValueError("sync expects a pointer value", SCOPE);
                    if (Runtime.endpoint.equals(SCOPE.sender)) {
                        throw new PointerError("Cannot subscribe to pointer with origin self", SCOPE);
                    }
                    logger.success(SCOPE.sender + " subscribed to " + pointer);
                    if (pointer.is_origin) {
                        if (!pointer.value || (pointer.allowed_access && !pointer.allowed_access.test(SCOPE.sender)))
                            throw new PointerError("Pointer does not exist", SCOPE);
                        else {
                            pointer.addSubscriber(SCOPE.sender);
                            INNER_SCOPE.active_value = SerializedValue.get(pointer.value);
                        }
                    }
                    else {
                        throw new PermissionError("Cannot subscribe to pointer with remote origin " + pointer.origin, SCOPE);
                    }
                }
                else if (INNER_SCOPE.unsubscribe) {
                    INNER_SCOPE.unsubscribe = false;
                    SCOPE.unsubscribe = false;
                    let pointer = Pointer.pointerifyValue(el);
                    logger.success(SCOPE.sender + " unsubscribed from " + pointer);
                    if (pointer instanceof Pointer && !pointer.is_anonymous) {
                        if (pointer.is_origin) {
                            pointer.removeSubscriber(SCOPE.sender);
                            return;
                        }
                        else {
                            throw new PermissionError("Cannot unsubscribe from pointer with remote origin", SCOPE);
                        }
                    }
                    else
                        throw new ValueError("Cannot unsubscribe from a non-pointer", SCOPE);
                }
                else if (INNER_SCOPE.get_value) {
                    try {
                        INNER_SCOPE.active_value = await Datex.Runtime.cloneValue(el);
                    }
                    catch (e) {
                        console.warn(e);
                        if (e instanceof Error)
                            e.addScopeToStack(SCOPE);
                        throw e;
                    }
                    INNER_SCOPE.get_value = false;
                }
                else if (INNER_SCOPE.get_type) {
                    INNER_SCOPE.active_value = Type.getValueDatexType(el);
                    INNER_SCOPE.get_type = false;
                }
                else if (INNER_SCOPE.get_origin) {
                    INNER_SCOPE.get_origin = false;
                    let pointer = Pointer.pointerifyValue(el);
                    if (pointer instanceof Pointer && !pointer.is_anonymous) {
                        INNER_SCOPE.active_value = pointer.origin;
                    }
                    else
                        throw new ValueError("Cannot get origin of a non-pointer", SCOPE);
                }
                else if (INNER_SCOPE.get_subscribers) {
                    INNER_SCOPE.get_subscribers = false;
                    let pointer = Pointer.pointerifyValue(el);
                    if (pointer instanceof Pointer && !pointer.is_anonymous) {
                        INNER_SCOPE.active_value = await pointer.getSubscribersFilter();
                    }
                    else
                        throw new ValueError("Cannot get subscribers of a non-pointer", SCOPE);
                }
                else if (INNER_SCOPE.wait_extends) {
                    INNER_SCOPE.wait_extends = false;
                    if (INNER_SCOPE.active_value instanceof Type && el instanceof Type) {
                        INNER_SCOPE.active_value = el.template && DatexObject.extends(INNER_SCOPE.active_value.template, el.template);
                    }
                    else if (typeof INNER_SCOPE.active_value == "object") {
                        INNER_SCOPE.active_value = DatexObject.extends(INNER_SCOPE.active_value, el);
                    }
                    else if ("active_value" in INNER_SCOPE && (Type.getValueDatexType(INNER_SCOPE.active_value).is_primitive || INNER_SCOPE.active_value instanceof PrimitivePointer))
                        throw new RuntimeError("A primitive value cannot extend a value", SCOPE);
                    else if ("active_value" in INNER_SCOPE)
                        INNER_SCOPE.active_value = false;
                    else
                        throw new RuntimeError("Invalid 'extends' command", SCOPE);
                }
                else if (INNER_SCOPE.wait_matches) {
                    INNER_SCOPE.wait_matches = false;
                    if (el instanceof Type) {
                        INNER_SCOPE.active_value = el.matches(INNER_SCOPE.active_value);
                    }
                    else if (INNER_SCOPE.active_value instanceof Addresses.Endpoint && el instanceof Addresses.Filter) {
                        INNER_SCOPE.active_value = el.test(INNER_SCOPE.active_value);
                    }
                    else if (INNER_SCOPE.active_value instanceof Addresses.Endpoint && el instanceof Addresses.Endpoint) {
                        INNER_SCOPE.active_value = el.equals(INNER_SCOPE.active_value);
                    }
                    else if (!("active_value" in INNER_SCOPE))
                        throw new RuntimeError("Invalid 'matches' command", SCOPE);
                    else
                        throw new RuntimeError("Invalid values for 'matches' command", SCOPE);
                }
                else if (INNER_SCOPE.wait_implements) {
                    INNER_SCOPE.wait_implements = false;
                    if (INNER_SCOPE.active_value instanceof Type && el instanceof Type) {
                        INNER_SCOPE.active_value = el.matchesType(INNER_SCOPE.active_value);
                    }
                    else
                        throw new RuntimeError("'implements' must check a <Type> against a <Type>", SCOPE);
                }
                else if (INNER_SCOPE.has_prop) {
                    INNER_SCOPE.active_value = Runtime.runtime_actions.hasProperty(SCOPE, INNER_SCOPE.active_value, el);
                    delete INNER_SCOPE.has_prop;
                }
                else if (INNER_SCOPE.wait_freeze) {
                    INNER_SCOPE.wait_freeze = false;
                    if (Type.getValueDatexType(el).is_primitive || el instanceof PrimitivePointer)
                        throw new RuntimeError("Cannot freeze a primitive value", SCOPE);
                    else
                        INNER_SCOPE.active_value = DatexObject.freeze(el);
                }
                else if (INNER_SCOPE.wait_seal) {
                    INNER_SCOPE.wait_seal = false;
                    if (Type.getValueDatexType(el).is_primitive || el instanceof PrimitivePointer)
                        throw new RuntimeError("Cannot seal a primitive value", SCOPE);
                    else
                        INNER_SCOPE.active_value = DatexObject.seal(el);
                }
                else if (SCOPE.inner_scope.stream_consumer) {
                    el = Value.collapseValue(el, true, true);
                    if (el instanceof Stream) {
                        SCOPE.inner_scope.stream_consumer.pipe(el, SCOPE);
                        INNER_SCOPE.stream_consumer = el;
                        console.log("pipe << ", el);
                    }
                    else {
                        SCOPE.inner_scope.stream_consumer.write(el, SCOPE);
                    }
                }
                else if ("compare_type" in INNER_SCOPE) {
                    let is_true = false;
                    let a = Value.collapseValue(INNER_SCOPE.active_value, true);
                    let b = Value.collapseValue(el, true);
                    let compared;
                    if (a instanceof Datex.Addresses.Endpoint && b instanceof Datex.Addresses.Endpoint && (INNER_SCOPE.compare_type == BinaryCode.EQUAL || INNER_SCOPE.compare_type == BinaryCode.NOT_EQUAL)) {
                        switch (INNER_SCOPE.compare_type) {
                            case BinaryCode.EQUAL:
                                is_true = a.equals(b);
                                compared = true;
                                break;
                            case BinaryCode.NOT_EQUAL:
                                is_true = !a.equals(b);
                                compared = true;
                                break;
                        }
                    }
                    if (!compared) {
                        switch (INNER_SCOPE.compare_type) {
                            case BinaryCode.EQUAL:
                                is_true = a === b;
                                break;
                            case BinaryCode.NOT_EQUAL:
                                is_true = a !== b;
                                break;
                            case BinaryCode.EQUAL_VALUE:
                                is_true = await Runtime.equalValues(a, b);
                                break;
                            case BinaryCode.NOT_EQUAL_VALUE:
                                is_true = !(await Runtime.equalValues(a, b));
                                break;
                            case BinaryCode.GREATER:
                                is_true = a > b;
                                break;
                            case BinaryCode.GREATER_EQUAL:
                                is_true = a >= b;
                                break;
                            case BinaryCode.LESS:
                                is_true = a < b;
                                break;
                            case BinaryCode.LESS_EQUAL:
                                is_true = a <= b;
                                break;
                        }
                    }
                    delete INNER_SCOPE.compare_type;
                    INNER_SCOPE.active_value = is_true;
                }
                else if (INNER_SCOPE.operator === BinaryCode.ADD || INNER_SCOPE.operator === BinaryCode.SUBTRACT) {
                    el = Value.collapseValue(el, true, true);
                    let val = Value.collapseValue(INNER_SCOPE.active_value, true, true);
                    if (INNER_SCOPE.operator === BinaryCode.SUBTRACT && (typeof el == "number" || typeof el == "bigint"))
                        el = -el;
                    else if (INNER_SCOPE.operator === BinaryCode.SUBTRACT && (el instanceof Unit))
                        el = new Unit(-el);
                    if ((val === 0 || val instanceof Unit) && el instanceof Unit) {
                        INNER_SCOPE.active_value = new Unit((val ?? 0) + el);
                    }
                    else if (typeof val == "bigint" && typeof el == "bigint") {
                        INNER_SCOPE.active_value += el;
                    }
                    else if ((typeof val == "number" || typeof val == "bigint") && (typeof el == "number" || typeof el == "bigint")) {
                        INNER_SCOPE.active_value = Number(val);
                        INNER_SCOPE.active_value += Number(el);
                    }
                    else if (INNER_SCOPE.operator === BinaryCode.ADD && typeof val == "string" && typeof el == "string") {
                        INNER_SCOPE.active_value += el;
                    }
                    else {
                        console.log(val, el);
                        throw new ValueError("Cannot perform " + (INNER_SCOPE.operator === BinaryCode.ADD ? "an add" : "a subtract") + " operation on this value", SCOPE);
                    }
                    delete INNER_SCOPE.operator;
                }
                else if (INNER_SCOPE.operator === BinaryCode.AND) {
                    let val = Value.collapseValue(INNER_SCOPE.active_value, true, true);
                    el = Value.collapseValue(el, true, true);
                    if (val instanceof Datex.Addresses.Target || val instanceof Datex.Addresses.Filter || val instanceof Datex.Addresses.Not) {
                        if (el instanceof Datex.Addresses.Target || el instanceof Datex.Addresses.Filter || el instanceof Datex.Addresses.Not || el instanceof Set || el instanceof Array) {
                            INNER_SCOPE.active_value = new Datex.Addresses.Filter(val, el);
                        }
                        else
                            throw new ValueError("Cannot perform a logic AND operation on this value", SCOPE);
                    }
                    else if (el instanceof Datex.Addresses.Target || el instanceof Datex.Addresses.Filter || el instanceof Datex.Addresses.Not) {
                        if (val instanceof Datex.Addresses.Target || val instanceof Datex.Addresses.Filter || val instanceof Datex.Addresses.Not || val instanceof Set || val instanceof Array) {
                            INNER_SCOPE.active_value = new Datex.Addresses.Filter(val, el);
                        }
                        else
                            throw new ValueError("Cannot perform a logic AND operation on this value", SCOPE);
                    }
                    else if (el instanceof Type && val instanceof Type) {
                    }
                    else if (typeof val == "boolean" && typeof el == "boolean") {
                        INNER_SCOPE.active_value = val && el;
                    }
                    else {
                        const base_type = Datex.Type.getValueDatexType(val);
                        const base = await base_type.createDefaultValue();
                        DatexObject.extend(base, val);
                        DatexObject.extend(base, el);
                        INNER_SCOPE.active_value = base;
                    }
                    delete INNER_SCOPE.operator;
                    delete INNER_SCOPE.negate_operator;
                }
                else if (INNER_SCOPE.operator === BinaryCode.OR) {
                    let val = Value.collapseValue(INNER_SCOPE.active_value, true, true);
                    el = Value.collapseValue(el, true, true);
                    if (val instanceof Datex.Addresses.Target || val instanceof Datex.Addresses.Filter || val instanceof Datex.Addresses.Not) {
                        if (el instanceof Datex.Addresses.Target || el instanceof Datex.Addresses.Filter || el instanceof Datex.Addresses.Not || el instanceof Set || el instanceof Array) {
                            INNER_SCOPE.active_value = new Datex.Addresses.Filter(new Set([val, el]));
                        }
                        else
                            throw new ValueError("Cannot perform a logic AND operation on this value", SCOPE);
                    }
                    else if (el instanceof Datex.Addresses.Target || el instanceof Datex.Addresses.Filter || el instanceof Datex.Addresses.Not) {
                        if (val instanceof Datex.Addresses.Target || val instanceof Datex.Addresses.Filter || val instanceof Datex.Addresses.Not || val instanceof Set || val instanceof Array) {
                            INNER_SCOPE.active_value = new Datex.Addresses.Filter(new Set([val, el]));
                        }
                        else
                            throw new ValueError("Cannot perform a logic AND operation on this value", SCOPE);
                    }
                    else if (el instanceof Type && val instanceof Type) {
                    }
                    else if (typeof val == "boolean" && typeof el == "boolean") {
                        INNER_SCOPE.active_value = val || el;
                    }
                    else {
                        throw (new ValueError("Cannot perform a logic OR operation on this value", SCOPE));
                    }
                    delete INNER_SCOPE.operator;
                    delete INNER_SCOPE.negate_operator;
                }
                else if (INNER_SCOPE.operator === BinaryCode.MULTIPLY) {
                    let val = Value.collapseValue(INNER_SCOPE.active_value, true, true);
                    el = Value.collapseValue(el, true, true);
                    if ((val instanceof Unit && (typeof el == "number" || typeof el == "bigint")) || (el instanceof Unit && (typeof val == "number" || typeof val == "bigint"))) {
                        INNER_SCOPE.active_value = new Unit(Number(val) * Number(el));
                    }
                    else if (typeof val == "bigint" && typeof el == "bigint") {
                        INNER_SCOPE.active_value *= el;
                    }
                    else if ((typeof val == "number" || typeof val == "bigint") && (typeof el == "number" || typeof el == "bigint")) {
                        INNER_SCOPE.active_value = Number(INNER_SCOPE.active_value);
                        INNER_SCOPE.active_value *= Number(el);
                    }
                    else if (typeof val == "string" && typeof el == "bigint") {
                        INNER_SCOPE.active_value = val.repeat(Number(el));
                    }
                    else if (typeof val == "bigint" && typeof el == "string") {
                        INNER_SCOPE.active_value = el.repeat(Number(val));
                    }
                    else if (val instanceof Tuple && typeof el == "bigint") {
                        if (el < 0)
                            throw new ValueError("Cannot multiply <Tuple> with negative <Int>", SCOPE);
                        INNER_SCOPE.active_value = new Tuple(new Array(Number(el)).fill(val).flat()).seal();
                    }
                    else if (typeof val == "bigint" && el instanceof Tuple) {
                        if (val < 0)
                            throw new ValueError("Cannot multiply <Tuple> with negative <Int>", SCOPE);
                        INNER_SCOPE.active_value = new Tuple(new Array(Number(val)).fill(el).flat()).seal();
                    }
                    else if (val === Datex.VOID && typeof el == "bigint") {
                        if (el < 0)
                            throw new ValueError("Cannot multiply <Tuple> with negative <Int>", SCOPE);
                        INNER_SCOPE.active_value = new Tuple(new Array(Number(el)).fill(Datex.VOID)).seal();
                    }
                    else if (typeof val == "bigint" && el === Datex.VOID) {
                        console.log("multiple", val, el);
                        if (val < 0)
                            throw new ValueError("Cannot multiply <Tuple> with negative <Int>", SCOPE);
                        INNER_SCOPE.active_value = new Tuple(new Array(Number(val)).fill(Datex.VOID)).seal();
                    }
                    else {
                        throw new ValueError("Cannot perform a multiply operation on this value", SCOPE);
                    }
                    delete INNER_SCOPE.operator;
                }
                else if (INNER_SCOPE.operator === BinaryCode.DIVIDE) {
                    let val = Value.collapseValue(INNER_SCOPE.active_value, true, true);
                    el = Value.collapseValue(el, true, true);
                    if ((val instanceof Unit && (typeof el == "number" || typeof el == "bigint"))) {
                        INNER_SCOPE.active_value = new Unit(Number(val) / Number(el));
                    }
                    else if (val instanceof Unit && el instanceof Unit) {
                        INNER_SCOPE.active_value = Number(val) / Number(el);
                    }
                    else if (typeof val == "bigint" && typeof el == "bigint") {
                        if (el === 0n)
                            throw new ValueError("Division by zero", SCOPE);
                        INNER_SCOPE.active_value /= el;
                    }
                    else if ((typeof val == "number" || typeof val == "bigint") && (typeof el == "number" || typeof el == "bigint")) {
                        INNER_SCOPE.active_value = Number(INNER_SCOPE.active_value);
                        INNER_SCOPE.active_value /= Number(el);
                    }
                    else {
                        throw new ValueError("Cannot perform a divide operation on this value", SCOPE);
                    }
                    delete INNER_SCOPE.operator;
                }
                else if (INNER_SCOPE.operator === BinaryCode.THROW_ERROR) {
                    if (el instanceof Error)
                        el.addScopeToStack(SCOPE);
                    throw el;
                }
                else if (INNER_SCOPE.about) {
                    INNER_SCOPE.active_value = Runtime.getAbout(el);
                    delete INNER_SCOPE.about;
                }
                else if (INNER_SCOPE.count) {
                    INNER_SCOPE.active_value = Runtime.runtime_actions.countValue(el);
                    delete INNER_SCOPE.count;
                }
                else if (INNER_SCOPE.request) {
                    if (el instanceof Addresses.Target || el instanceof Addresses.Filter) {
                        if (!SCOPE.impersonation_permission && (!(el instanceof Datex.Addresses.Endpoint) || !SCOPE.sender.equals(el) || !SCOPE.header.signed)) {
                            throw new PermissionError("No permission to execute scopes on external endpoints", SCOPE);
                        }
                        INNER_SCOPE.active_value = await datex("#default", [], el);
                    }
                    else if (el instanceof URL) {
                        INNER_SCOPE.active_value = await Runtime.resolveUrl(el);
                    }
                    else
                        INNER_SCOPE.active_value = el;
                    delete INNER_SCOPE.request;
                }
                else if ("active_value" in INNER_SCOPE) {
                    let val = INNER_SCOPE.active_value;
                    if (val instanceof Function || val instanceof Datex.Addresses.Target || val instanceof Datex.Assertion) {
                        if (val.handleApply)
                            INNER_SCOPE.active_value = await val.handleApply(Value.collapseValue(el), SCOPE);
                        else
                            throw new ValueError("Cannot apply values to this value", SCOPE);
                    }
                    else {
                        throw (new ValueError(`Cannot apply ${Runtime.valueToDatexString(el)} to ${Runtime.valueToDatexString(val)}`, SCOPE));
                    }
                }
                else {
                    INNER_SCOPE.active_value = el;
                }
            },
        };
        static createNewInitialScope(header, variables, internal_vars, context, it) {
            const scope = {
                sid: header?.sid,
                header: header,
                sender: header?.sender,
                origin: header?.sender,
                current_index: 0,
                start_index: 0,
                index_offset: 0,
                root: this.default_static_scope ? DatexObject.extend(variables ?? {}, this.default_static_scope) : Object.assign({}, variables),
                internal_vars: internal_vars ?? {},
                execution_permission: header?.executable,
                impersonation_permission: Runtime.endpoint.equals(header?.sender),
                inner_scope: null,
                sub_scopes: [],
                result: Datex.VOID,
                context: context,
                it: it,
                meta: {},
                remote: {},
                buffer_views: {}
            };
            Object.defineProperty(scope.meta, 'encrypted', { value: header?.encrypted, writable: false, enumerable: true });
            Object.defineProperty(scope.meta, 'signed', { value: header?.signed, writable: false, enumerable: true });
            Object.defineProperty(scope.meta, 'sender', { value: header?.sender, writable: false, enumerable: true });
            Object.defineProperty(scope.meta, 'timestamp', { value: header?.timestamp, writable: false, enumerable: true });
            Object.defineProperty(scope.meta, 'type', { value: header?.type, writable: false, enumerable: true });
            return scope;
        }
        static updateScope(scope, datex_body_buffer, header) {
            if (scope.cache_previous || (typeof scope.cache_after_index == "number" && scope.current_index + scope.index_offset >= scope.cache_after_index)) {
                const new_uint8 = new Uint8Array(scope.buffer_views.buffer.byteLength + datex_body_buffer.byteLength);
                new_uint8.set(new Uint8Array(scope.buffer_views.buffer), 0);
                new_uint8.set(new Uint8Array(datex_body_buffer), scope.buffer_views.buffer.byteLength);
                scope.buffer_views.buffer = new_uint8.buffer;
            }
            else {
                scope.buffer_views.buffer = datex_body_buffer;
                scope.index_offset += scope.current_index;
                scope.current_index = 0;
            }
            scope.buffer_views.uint8 = new Uint8Array(scope.buffer_views.buffer);
            scope.buffer_views.data_view = new DataView(scope.buffer_views.buffer);
            scope.header = header;
            scope.execution_permission = header?.executable;
            scope.impersonation_permission = Runtime.endpoint.equals(header?.sender);
            if (scope.sub_scopes.length == 0) {
                scope.inner_scope = { root: scope.root };
                scope.sub_scopes.push(scope.inner_scope);
                scope.inner_scope.is_outer_scope = true;
            }
            scope.cache_previous = false;
        }
        static async run(SCOPE) {
            while (true) {
                if (SCOPE.current_index >= SCOPE.buffer_views.uint8.byteLength) {
                    return;
                }
                if (SCOPE.inner_scope.auto_exit == 2) {
                    await this.runtime_actions.insertToScope(SCOPE, await this.runtime_actions.exitSubScope(SCOPE), true);
                }
                else if (SCOPE.inner_scope.auto_exit == 1 && !(SCOPE.buffer_views.uint8[SCOPE.current_index] == BinaryCode.CHILD_GET || SCOPE.buffer_views.uint8[SCOPE.current_index] == BinaryCode.CHILD_GET_REF)) {
                    SCOPE.inner_scope.auto_exit = 2;
                }
                SCOPE.start_index = SCOPE.current_index;
                let token = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                switch (token) {
                    case BinaryCode.END: {
                        SCOPE.closed = true;
                        return;
                    }
                    case BinaryCode.SHORT_STRING:
                    case BinaryCode.STRING: {
                        let length;
                        if (token == BinaryCode.SHORT_STRING) {
                            if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                                return Runtime.runtime_actions.waitForBuffer(SCOPE);
                            length = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                        }
                        else {
                            if (SCOPE.current_index + Uint32Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength)
                                return Runtime.runtime_actions.waitForBuffer(SCOPE);
                            length = SCOPE.buffer_views.data_view.getUint32(SCOPE.current_index, true);
                            SCOPE.current_index += Uint32Array.BYTES_PER_ELEMENT;
                        }
                        if (SCOPE.current_index + length > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let string = this.utf8_decoder.decode(SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index + length));
                        SCOPE.current_index += length;
                        await this.runtime_actions.insertToScope(SCOPE, string);
                        break;
                    }
                    case BinaryCode.BUFFER: {
                        if (SCOPE.current_index + Uint32Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let buffer_length = SCOPE.buffer_views.data_view.getUint32(SCOPE.current_index, true);
                        SCOPE.current_index += Uint32Array.BYTES_PER_ELEMENT;
                        if (SCOPE.current_index + buffer_length > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let buffer = SCOPE.buffer_views.buffer.slice(SCOPE.current_index, SCOPE.current_index + buffer_length);
                        SCOPE.current_index += buffer_length;
                        await this.runtime_actions.insertToScope(SCOPE, buffer);
                        break;
                    }
                    case BinaryCode.CHILD_GET: {
                        SCOPE.inner_scope.waiting_for_child = 1;
                        break;
                    }
                    case BinaryCode.CHILD_GET_REF: {
                        SCOPE.inner_scope.waiting_for_child = 2;
                        break;
                    }
                    case BinaryCode.CHILD_SET: {
                        SCOPE.inner_scope.waiting_for_child_action = -1;
                        break;
                    }
                    case BinaryCode.CHILD_ACTION: {
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        SCOPE.inner_scope.waiting_for_child_action = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                        break;
                    }
                    case BinaryCode.RANGE: {
                        SCOPE.inner_scope.waiting_range = [];
                        break;
                    }
                    case BinaryCode.EXTEND: {
                        SCOPE.inner_scope.inner_spread = true;
                        break;
                    }
                    case BinaryCode.THROW_ERROR: {
                        SCOPE.inner_scope.operator = BinaryCode.THROW_ERROR;
                        break;
                    }
                    case BinaryCode.EQUAL_VALUE:
                    case BinaryCode.EQUAL:
                    case BinaryCode.NOT_EQUAL_VALUE:
                    case BinaryCode.GREATER:
                    case BinaryCode.GREATER_EQUAL:
                    case BinaryCode.LESS:
                    case BinaryCode.LESS_EQUAL: {
                        SCOPE.inner_scope.compare_type = token;
                        break;
                    }
                    case BinaryCode.CACHE_POINT: {
                        SCOPE.cache_after_index = SCOPE.current_index + SCOPE.index_offset;
                        break;
                    }
                    case BinaryCode.CACHE_RESET: {
                        delete SCOPE.cache_after_index;
                        break;
                    }
                    case BinaryCode.JMP: {
                        if (SCOPE.current_index + Uint32Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let index = SCOPE.buffer_views.data_view.getUint32(SCOPE.current_index, true);
                        await Runtime.runtime_actions.newSubScope(SCOPE);
                        SCOPE.current_index = index;
                        break;
                    }
                    case BinaryCode.JTR: {
                        if (SCOPE.current_index + Uint32Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let index = SCOPE.buffer_views.data_view.getUint32(SCOPE.current_index, true);
                        SCOPE.current_index += Uint32Array.BYTES_PER_ELEMENT;
                        SCOPE.inner_scope.jmp = index;
                        SCOPE.inner_scope.jmp_true = true;
                        break;
                    }
                    case BinaryCode.JFA: {
                        if (SCOPE.current_index + Uint32Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let index = SCOPE.buffer_views.data_view.getUint32(SCOPE.current_index, true);
                        SCOPE.current_index += Uint32Array.BYTES_PER_ELEMENT;
                        SCOPE.inner_scope.jmp = index;
                        SCOPE.inner_scope.jmp_true = false;
                        break;
                    }
                    case BinaryCode.INTERNAL_VAR: {
                        let name = Runtime.runtime_actions.extractVariableName(SCOPE);
                        if (name === false)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        else {
                            let val;
                            if (name == "result")
                                val = SCOPE.result;
                            else if (name == "sub_result")
                                val = SCOPE.inner_scope.result;
                            else if (name == "sender")
                                val = SCOPE.header.sender;
                            else if (name == "current")
                                val = Runtime.endpoint;
                            else if (name == "timestamp")
                                val = SCOPE.header.timestamp;
                            else if (name == "encrypted")
                                val = SCOPE.header.encrypted;
                            else if (name == "signed")
                                val = SCOPE.header.signed;
                            else if (name == "static")
                                val = StaticScope.scopes;
                            else if (name == "meta")
                                val = SCOPE.meta;
                            else if (name == "remote")
                                val = SCOPE.remote;
                            else if (name == "this")
                                val = SCOPE.context;
                            else if (name == "it")
                                val = SCOPE.it;
                            else if (name in SCOPE.internal_vars)
                                val = SCOPE.internal_vars[name];
                            else {
                                throw new RuntimeError("Internal variable #" + name + " does not exist", SCOPE);
                            }
                            await this.runtime_actions.insertToScope(SCOPE, val);
                        }
                        break;
                    }
                    case BinaryCode.SET_INTERNAL_VAR: {
                        let name = Runtime.runtime_actions.extractVariableName(SCOPE);
                        if (name === false)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        if (!Runtime.readonly_internal_vars.has(name)) {
                            if (!SCOPE.inner_scope.waiting_internal_vars)
                                SCOPE.inner_scope.waiting_internal_vars = new Set();
                            SCOPE.inner_scope.waiting_internal_vars.add([name]);
                        }
                        else {
                            throw new RuntimeError("Internal variable #" + name + " is readonly", SCOPE);
                        }
                        break;
                    }
                    case BinaryCode.INTERNAL_VAR_ACTION: {
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let action = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                        let name = Runtime.runtime_actions.extractVariableName(SCOPE);
                        if (name === false)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        if (!Runtime.readonly_internal_vars.has(name)) {
                            if (!SCOPE.inner_scope.waiting_internal_vars)
                                SCOPE.inner_scope.waiting_internal_vars = new Set();
                            SCOPE.inner_scope.waiting_internal_vars.add([name, action]);
                        }
                        else {
                            throw new RuntimeError("Internal variable '" + name + "' is readonly", SCOPE);
                        }
                        break;
                    }
                    case BinaryCode.VAR_RESULT: {
                        await this.runtime_actions.insertToScope(SCOPE, SCOPE.result);
                        break;
                    }
                    case BinaryCode.VAR_SUB_RESULT: {
                        await this.runtime_actions.insertToScope(SCOPE, SCOPE.inner_scope.result);
                        break;
                    }
                    case BinaryCode.VAR_ENCRYPTED: {
                        await this.runtime_actions.insertToScope(SCOPE, SCOPE.meta.encrypted);
                        break;
                    }
                    case BinaryCode.VAR_SIGNED: {
                        await this.runtime_actions.insertToScope(SCOPE, SCOPE.meta.signed);
                        break;
                    }
                    case BinaryCode.VAR_SENDER: {
                        await this.runtime_actions.insertToScope(SCOPE, SCOPE.meta.sender);
                        break;
                    }
                    case BinaryCode.VAR_CURRENT: {
                        await this.runtime_actions.insertToScope(SCOPE, Runtime.endpoint);
                        break;
                    }
                    case BinaryCode.VAR_TIMESTAMP: {
                        await this.runtime_actions.insertToScope(SCOPE, SCOPE.meta.timestamp);
                        break;
                    }
                    case BinaryCode.VAR_META: {
                        await this.runtime_actions.insertToScope(SCOPE, SCOPE.meta);
                        break;
                    }
                    case BinaryCode.VAR_REMOTE: {
                        await this.runtime_actions.insertToScope(SCOPE, SCOPE.remote);
                        break;
                    }
                    case BinaryCode.VAR_STATIC: {
                        await this.runtime_actions.insertToScope(SCOPE, StaticScope.scopes);
                        break;
                    }
                    case BinaryCode.VAR_ROOT: {
                        await this.runtime_actions.insertToScope(SCOPE, SCOPE.inner_scope.root);
                        break;
                    }
                    case BinaryCode.VAR_THIS: {
                        await this.runtime_actions.insertToScope(SCOPE, SCOPE.context ?? SCOPE.inner_scope.root);
                        break;
                    }
                    case BinaryCode.VAR_IT: {
                        await this.runtime_actions.insertToScope(SCOPE, SCOPE.it);
                        break;
                    }
                    case BinaryCode.SET_VAR_IT: {
                        if (!SCOPE.inner_scope.waiting_internal_vars)
                            SCOPE.inner_scope.waiting_internal_vars = new Set();
                        SCOPE.inner_scope.waiting_internal_vars.add(['it']);
                        break;
                    }
                    case BinaryCode.SET_VAR_RESULT: {
                        if (!SCOPE.inner_scope.waiting_internal_vars)
                            SCOPE.inner_scope.waiting_internal_vars = new Set();
                        SCOPE.inner_scope.waiting_internal_vars.add(['result']);
                        break;
                    }
                    case BinaryCode.SET_VAR_SUB_RESULT: {
                        if (!SCOPE.inner_scope.waiting_internal_vars)
                            SCOPE.inner_scope.waiting_internal_vars = new Set();
                        SCOPE.inner_scope.waiting_internal_vars.add(['sub_result']);
                        break;
                    }
                    case BinaryCode.SET_VAR_ROOT: {
                        if (!SCOPE.inner_scope.waiting_internal_vars)
                            SCOPE.inner_scope.waiting_internal_vars = new Set();
                        SCOPE.inner_scope.waiting_internal_vars.add(['root']);
                        break;
                    }
                    case BinaryCode.VAR_RESULT_ACTION: {
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let action = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                        if (!SCOPE.inner_scope.waiting_internal_vars)
                            SCOPE.inner_scope.waiting_internal_vars = new Set();
                        SCOPE.inner_scope.waiting_internal_vars.add(['result', action]);
                        break;
                    }
                    case BinaryCode.VAR_SUB_RESULT_ACTION: {
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let action = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                        if (!SCOPE.inner_scope.waiting_internal_vars)
                            SCOPE.inner_scope.waiting_internal_vars = new Set();
                        SCOPE.inner_scope.waiting_internal_vars.add(['sub_result', action]);
                        break;
                    }
                    case BinaryCode.VAR_ROOT_ACTION: {
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let action = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                        if (!SCOPE.inner_scope.waiting_internal_vars)
                            SCOPE.inner_scope.waiting_internal_vars = new Set();
                        SCOPE.inner_scope.waiting_internal_vars.add(['root', action]);
                        break;
                    }
                    case BinaryCode.VAR_REMOTE_ACTION: {
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let action = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                        if (!SCOPE.inner_scope.waiting_internal_vars)
                            SCOPE.inner_scope.waiting_internal_vars = new Set();
                        SCOPE.inner_scope.waiting_internal_vars.add(['remote', action]);
                        break;
                    }
                    case BinaryCode.VAR_IT_ACTION: {
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let action = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                        if (!SCOPE.inner_scope.waiting_internal_vars)
                            SCOPE.inner_scope.waiting_internal_vars = new Set();
                        SCOPE.inner_scope.waiting_internal_vars.add(['it', action]);
                        break;
                    }
                    case BinaryCode.VAR: {
                        let name = Runtime.runtime_actions.extractVariableName(SCOPE);
                        if (name === false)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        if (!SCOPE.inner_scope.root)
                            throw new RuntimeError("Invalid #root");
                        if (name in SCOPE.inner_scope.root) {
                            await this.runtime_actions.insertToScope(SCOPE, SCOPE.inner_scope.root[name]);
                        }
                        else
                            throw new RuntimeError("Variable '" + name + "' does not exist", SCOPE);
                        break;
                    }
                    case BinaryCode.SET_VAR: {
                        let name = Runtime.runtime_actions.extractVariableName(SCOPE);
                        if (name === false)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        if (!SCOPE.inner_scope.waiting_vars)
                            SCOPE.inner_scope.waiting_vars = new Set();
                        SCOPE.inner_scope.waiting_vars.add([name]);
                        break;
                    }
                    case BinaryCode.VAR_ACTION: {
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let action = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                        let name = Runtime.runtime_actions.extractVariableName(SCOPE);
                        if (name === false)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        if (!SCOPE.inner_scope.waiting_vars)
                            SCOPE.inner_scope.waiting_vars = new Set();
                        SCOPE.inner_scope.waiting_vars.add([name, action]);
                        break;
                    }
                    case BinaryCode.LABEL: {
                        let name = Runtime.runtime_actions.extractVariableName(SCOPE);
                        if (name === false)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        const pointer = Pointer.getByLabel(name);
                        await this.runtime_actions.insertToScope(SCOPE, pointer);
                        break;
                    }
                    case BinaryCode.LABEL_ACTION: {
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let action = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                        let name = Runtime.runtime_actions.extractVariableName(SCOPE);
                        if (name === false)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        const pointer = Pointer.getByLabel(name);
                        if (!SCOPE.inner_scope.waiting_ptrs)
                            SCOPE.inner_scope.waiting_ptrs = new Set();
                        SCOPE.inner_scope.waiting_ptrs.add([pointer, action]);
                        break;
                    }
                    case BinaryCode.SET_LABEL: {
                        let name = Runtime.runtime_actions.extractVariableName(SCOPE);
                        if (name === false)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        if (!SCOPE.impersonation_permission) {
                            throw new PermissionError("No permission to create labels on this endpoint", SCOPE);
                        }
                        if (!SCOPE.inner_scope.waiting_labels)
                            SCOPE.inner_scope.waiting_labels = new Set();
                        SCOPE.inner_scope.waiting_labels.add(name);
                        break;
                    }
                    case BinaryCode.CLOSE_AND_STORE: {
                        await this.runtime_actions.newSubScope(SCOPE);
                        break;
                    }
                    case BinaryCode.SCOPE_BLOCK: {
                        const INNER_SCOPE = SCOPE.inner_scope;
                        let buffer = this.runtime_actions.extractScopeBlock(SCOPE);
                        if (buffer === false)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        const code_block = buffer ? new Scope(INNER_SCOPE.scope_block_vars, buffer, true) : null;
                        if (INNER_SCOPE.scope_block_for == BinaryCode.TRANSFORM) {
                            console.log("transform", INNER_SCOPE.scope_block_vars);
                            INNER_SCOPE.scope_block_for = null;
                            await this.runtime_actions.insertToScope(SCOPE, Value.collapseValue(await Pointer.transformMultipleAsync(INNER_SCOPE.scope_block_vars, () => code_block.execute([], SCOPE.sender))));
                        }
                        else if (INNER_SCOPE.scope_block_for == BinaryCode.ASSERT) {
                            INNER_SCOPE.scope_block_for = null;
                            const assertion = $$(new Datex.Assertion(code_block));
                            await this.runtime_actions.insertToScope(SCOPE, assertion);
                        }
                        else if (INNER_SCOPE.scope_block_for == BinaryCode.DO) {
                            INNER_SCOPE.scope_block_for = null;
                            const task = $$(new Datex.Task(code_block));
                            task.run(SCOPE);
                            await this.runtime_actions.insertToScope(SCOPE, task);
                        }
                        else if (INNER_SCOPE.scope_block_for == BinaryCode.PLAIN_SCOPE) {
                            INNER_SCOPE.scope_block_for = null;
                            await this.runtime_actions.insertToScope(SCOPE, code_block);
                        }
                        else if (INNER_SCOPE.scope_block_for == BinaryCode.ITERATION) {
                            await this.runtime_actions.insertToScope(SCOPE, new IterationFunction(code_block, undefined, undefined, undefined, SCOPE.context));
                        }
                        else if (INNER_SCOPE.scope_block_for == BinaryCode.FUNCTION) {
                            INNER_SCOPE.scope_block_for = null;
                            if (!(SCOPE.inner_scope.active_value instanceof Datex.Tuple || SCOPE.inner_scope.active_value === Datex.VOID)) {
                                console.log(SCOPE.inner_scope.active_value);
                                throw new RuntimeError("Invalid function declaration: parameters must be empty or of type <Tuple>");
                            }
                            const args = INNER_SCOPE.active_value ?? new Datex.Tuple();
                            delete INNER_SCOPE.active_value;
                            await this.runtime_actions.insertToScope(SCOPE, new Function(code_block, null, undefined, args, undefined, undefined, SCOPE.context));
                        }
                        else if (INNER_SCOPE.scope_block_for == BinaryCode.REMOTE) {
                            INNER_SCOPE.scope_block_for = null;
                            if (!(INNER_SCOPE.active_value instanceof Datex.Addresses.Filter || INNER_SCOPE.active_value instanceof Datex.Addresses.Target)) {
                                throw new RuntimeError("Invalid remote execution declaration: target must be of type <Target> or <Filter>");
                            }
                            const remote = INNER_SCOPE.active_value;
                            delete INNER_SCOPE.active_value;
                            if (!SCOPE.impersonation_permission && (!(remote instanceof Datex.Addresses.Endpoint) || !SCOPE.sender.equals(remote) || !SCOPE.header.signed)) {
                                throw new PermissionError("No permission to execute scopes on external endpoints", SCOPE);
                            }
                            if (INNER_SCOPE.scope_block_vars.length) {
                                const variables_insert_code = Object.keys(INNER_SCOPE.scope_block_vars).map((_, i) => `#${i}=?;`).join("");
                                let var_dxb = await DatexCompiler.compile(variables_insert_code, INNER_SCOPE.scope_block_vars, undefined, false, false, 0, undefined, Infinity);
                                var tmp = new Uint8Array(var_dxb.byteLength + buffer.byteLength);
                                tmp.set(new Uint8Array(var_dxb), 0);
                                tmp.set(new Uint8Array(buffer), var_dxb.byteLength);
                                buffer = tmp.buffer;
                            }
                            let filter = remote instanceof Datex.Addresses.Filter ? remote : new Datex.Addresses.Filter(remote);
                            let sid = DatexCompiler.generateSID();
                            let full_dxb = await DatexCompiler.appendHeader(buffer, true, Runtime.endpoint, filter, false, SCOPE.remote.type ?? undefined, SCOPE.remote.sign ?? true, SCOPE.remote.encrypt ?? false, undefined, undefined, true, sid);
                            let res = await Runtime.datexOut(full_dxb, filter, sid, true, undefined, (scope, header, error) => {
                            });
                            await this.runtime_actions.insertToScope(SCOPE, res);
                        }
                        SCOPE.inner_scope.scope_block_vars = null;
                        break;
                    }
                    case BinaryCode.NULL: {
                        await this.runtime_actions.insertToScope(SCOPE, null);
                        break;
                    }
                    case BinaryCode.VOID: {
                        await this.runtime_actions.insertToScope(SCOPE, Datex.VOID);
                        break;
                    }
                    case BinaryCode.WILDCARD: {
                        await this.runtime_actions.insertToScope(SCOPE, Datex.WILDCARD);
                        break;
                    }
                    case BinaryCode.RETURN: {
                        SCOPE.inner_scope.return = true;
                        break;
                    }
                    case BinaryCode.ABOUT: {
                        SCOPE.inner_scope.about = true;
                        break;
                    }
                    case BinaryCode.COUNT: {
                        SCOPE.inner_scope.count = true;
                        break;
                    }
                    case BinaryCode.TEMPLATE: {
                        SCOPE.inner_scope.template = true;
                        break;
                    }
                    case BinaryCode.OBSERVE: {
                        SCOPE.inner_scope.observe = true;
                        break;
                    }
                    case BinaryCode.TRANSFORM: {
                        SCOPE.inner_scope.scope_block_for = BinaryCode.TRANSFORM;
                        SCOPE.inner_scope.scope_block_vars = [];
                        break;
                    }
                    case BinaryCode.PLAIN_SCOPE: {
                        SCOPE.inner_scope.scope_block_for = BinaryCode.PLAIN_SCOPE;
                        SCOPE.inner_scope.scope_block_vars = [];
                        break;
                    }
                    case BinaryCode.DO: {
                        SCOPE.inner_scope.scope_block_for = BinaryCode.DO;
                        SCOPE.inner_scope.scope_block_vars = [];
                        break;
                    }
                    case BinaryCode.ITERATION: {
                        SCOPE.inner_scope.scope_block_for = BinaryCode.ITERATION;
                        SCOPE.inner_scope.scope_block_vars = [];
                        break;
                    }
                    case BinaryCode.ITERATOR: {
                        SCOPE.inner_scope.wait_iterator = true;
                        break;
                    }
                    case BinaryCode.ASSERT: {
                        SCOPE.inner_scope.scope_block_for = BinaryCode.ASSERT;
                        SCOPE.inner_scope.scope_block_vars = [];
                        break;
                    }
                    case BinaryCode.FUNCTION: {
                        SCOPE.inner_scope.scope_block_for = BinaryCode.FUNCTION;
                        SCOPE.inner_scope.scope_block_vars = [];
                        break;
                    }
                    case BinaryCode.REMOTE: {
                        SCOPE.inner_scope.scope_block_for = BinaryCode.REMOTE;
                        SCOPE.inner_scope.scope_block_vars = [];
                        break;
                    }
                    case BinaryCode.AWAIT: {
                        SCOPE.inner_scope.wait_await = true;
                        break;
                    }
                    case BinaryCode.HOLD: {
                        SCOPE.inner_scope.wait_hold = true;
                        break;
                    }
                    case BinaryCode.HAS: {
                        SCOPE.inner_scope.has_prop = true;
                        break;
                    }
                    case BinaryCode.SEAL: {
                        SCOPE.inner_scope.wait_seal = true;
                        break;
                    }
                    case BinaryCode.FREEZE: {
                        SCOPE.inner_scope.wait_freeze = true;
                        break;
                    }
                    case BinaryCode.EXTENDS: {
                        SCOPE.inner_scope.wait_extends = true;
                        break;
                    }
                    case BinaryCode.IMPLEMENTS: {
                        SCOPE.inner_scope.wait_implements = true;
                        break;
                    }
                    case BinaryCode.MATCHES: {
                        SCOPE.inner_scope.wait_matches = true;
                        break;
                    }
                    case BinaryCode.DEBUG: {
                        SCOPE.result = SCOPE;
                        SCOPE.closed = true;
                        return;
                    }
                    case BinaryCode.REQUEST: {
                        SCOPE.inner_scope.request = true;
                        break;
                    }
                    case BinaryCode.URL: {
                        if (SCOPE.current_index + Uint32Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let length = SCOPE.buffer_views.data_view.getUint32(SCOPE.current_index, true);
                        SCOPE.current_index += Uint32Array.BYTES_PER_ELEMENT;
                        if (SCOPE.current_index + length > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let url = new URL(this.utf8_decoder.decode(SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index + length)));
                        SCOPE.current_index += length;
                        await this.runtime_actions.insertToScope(SCOPE, url);
                        break;
                    }
                    case BinaryCode.ARRAY_START: {
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        if (SCOPE.buffer_views.uint8[SCOPE.current_index] === BinaryCode.ARRAY_END) {
                            SCOPE.current_index++;
                            await this.runtime_actions.insertToScope(SCOPE, []);
                        }
                        else {
                            this.runtime_actions.enterSubScope(SCOPE);
                            SCOPE.inner_scope.active_object = [];
                            SCOPE.inner_scope.active_object_new = true;
                        }
                        break;
                    }
                    case BinaryCode.TUPLE_START: {
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        if (SCOPE.buffer_views.uint8[SCOPE.current_index] === BinaryCode.TUPLE_END) {
                            SCOPE.current_index++;
                            await this.runtime_actions.insertToScope(SCOPE, new Tuple().seal());
                        }
                        else {
                            this.runtime_actions.enterSubScope(SCOPE);
                            SCOPE.inner_scope.active_object = new Tuple();
                            SCOPE.inner_scope.active_object_new = true;
                        }
                        break;
                    }
                    case BinaryCode.OBJECT_START: {
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        if (SCOPE.buffer_views.uint8[SCOPE.current_index] === BinaryCode.OBJECT_END) {
                            SCOPE.current_index++;
                            await this.runtime_actions.insertToScope(SCOPE, {});
                        }
                        else {
                            this.runtime_actions.enterSubScope(SCOPE);
                            SCOPE.inner_scope.active_object = {};
                            SCOPE.inner_scope.active_object_new = true;
                        }
                        break;
                    }
                    case BinaryCode.ELEMENT_WITH_KEY: {
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let length = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                        let key = Runtime.utf8_decoder.decode(SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index + length));
                        SCOPE.current_index += length;
                        const key_perm = SCOPE.inner_scope.key_perm;
                        if (!SCOPE.inner_scope.active_object_new)
                            await this.runtime_actions.insertToScope(SCOPE, await this.runtime_actions.exitSubScope(SCOPE), true);
                        SCOPE.inner_scope.active_object_new = false;
                        SCOPE.inner_scope.waiting_key = key;
                        if (key_perm)
                            SCOPE.inner_scope.key_perm = key_perm;
                        this.runtime_actions.enterSubScope(SCOPE);
                        break;
                    }
                    case BinaryCode.ELEMENT_WITH_INT_KEY: {
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let key = BigInt(SCOPE.buffer_views.data_view.getUint32(SCOPE.current_index));
                        SCOPE.current_index += Uint32Array.BYTES_PER_ELEMENT;
                        const key_perm = SCOPE.inner_scope.key_perm;
                        if (!SCOPE.inner_scope.active_object_new)
                            await this.runtime_actions.insertToScope(SCOPE, await this.runtime_actions.exitSubScope(SCOPE), true);
                        SCOPE.inner_scope.active_object_new = false;
                        SCOPE.inner_scope.waiting_key = key;
                        if (key_perm)
                            SCOPE.inner_scope.key_perm = key_perm;
                        this.runtime_actions.enterSubScope(SCOPE);
                        break;
                    }
                    case BinaryCode.ELEMENT_WITH_DYNAMIC_KEY: {
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        if (!SCOPE.inner_scope.active_object_new)
                            await this.runtime_actions.insertToScope(SCOPE, await this.runtime_actions.exitSubScope(SCOPE), true);
                        SCOPE.inner_scope.active_object_new = false;
                        SCOPE.inner_scope.wait_dynamic_key = true;
                        break;
                    }
                    case BinaryCode.KEY_PERMISSION: {
                        SCOPE.inner_scope.waiting_for_key_perm = true;
                        break;
                    }
                    case BinaryCode.ELEMENT: {
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        if (!SCOPE.inner_scope.active_object_new)
                            await this.runtime_actions.insertToScope(SCOPE, await this.runtime_actions.exitSubScope(SCOPE), true);
                        SCOPE.inner_scope.active_object_new = false;
                        this.runtime_actions.enterSubScope(SCOPE);
                        break;
                    }
                    case BinaryCode.ARRAY_END:
                    case BinaryCode.OBJECT_END:
                    case BinaryCode.TUPLE_END: {
                        let result = await this.runtime_actions.exitSubScope(SCOPE);
                        SCOPE.current_index--;
                        await this.runtime_actions.insertToScope(SCOPE, result, true);
                        SCOPE.current_index++;
                        let new_object = SCOPE.inner_scope.active_object;
                        await this.runtime_actions.exitSubScope(SCOPE);
                        if (new_object instanceof Array)
                            Runtime.runtime_actions.trimArray(new_object);
                        if (new_object instanceof Tuple)
                            DatexObject.seal(new_object);
                        await this.runtime_actions.insertToScope(SCOPE, new_object);
                        break;
                    }
                    case BinaryCode.STD_TYPE_STRING:
                    case BinaryCode.STD_TYPE_INT:
                    case BinaryCode.STD_TYPE_FLOAT:
                    case BinaryCode.STD_TYPE_BOOLEAN:
                    case BinaryCode.STD_TYPE_NULL:
                    case BinaryCode.STD_TYPE_VOID:
                    case BinaryCode.STD_TYPE_BUFFER:
                    case BinaryCode.STD_TYPE_CODE_BLOCK:
                    case BinaryCode.STD_TYPE_UNIT:
                    case BinaryCode.STD_TYPE_FILTER:
                    case BinaryCode.STD_TYPE_ARRAY:
                    case BinaryCode.STD_TYPE_OBJECT:
                    case BinaryCode.STD_TYPE_SET:
                    case BinaryCode.STD_TYPE_MAP:
                    case BinaryCode.STD_TYPE_TUPLE:
                    case BinaryCode.STD_TYPE_STREAM:
                    case BinaryCode.STD_TYPE_ANY:
                    case BinaryCode.STD_TYPE_ASSERTION:
                    case BinaryCode.STD_TYPE_TASK:
                    case BinaryCode.STD_TYPE_FUNCTION: {
                        await this.runtime_actions.insertToScope(SCOPE, Type.short_types[token]);
                        break;
                    }
                    case BinaryCode.ADD: {
                        SCOPE.inner_scope.operator = BinaryCode.ADD;
                        break;
                    }
                    case BinaryCode.SUBTRACT: {
                        SCOPE.inner_scope.operator = BinaryCode.SUBTRACT;
                        break;
                    }
                    case BinaryCode.MULTIPLY: {
                        SCOPE.inner_scope.operator = BinaryCode.MULTIPLY;
                        break;
                    }
                    case BinaryCode.DIVIDE: {
                        SCOPE.inner_scope.operator = BinaryCode.DIVIDE;
                        break;
                    }
                    case BinaryCode.AND: {
                        SCOPE.inner_scope.operator = BinaryCode.AND;
                        break;
                    }
                    case BinaryCode.OR: {
                        SCOPE.inner_scope.operator = BinaryCode.OR;
                        break;
                    }
                    case BinaryCode.NOT: {
                        SCOPE.inner_scope.negate_operator = true;
                        break;
                    }
                    case BinaryCode.SUBSCOPE_START: {
                        this.runtime_actions.enterSubScope(SCOPE);
                        break;
                    }
                    case BinaryCode.SUBSCOPE_END: {
                        const res = await this.runtime_actions.exitSubScope(SCOPE);
                        await this.runtime_actions.insertToScope(SCOPE, res);
                        break;
                    }
                    case BinaryCode.TRUE: {
                        await this.runtime_actions.insertToScope(SCOPE, true);
                        break;
                    }
                    case BinaryCode.FALSE: {
                        await this.runtime_actions.insertToScope(SCOPE, false);
                        break;
                    }
                    case BinaryCode.UNIT: {
                        let unit = new Unit(SCOPE.buffer_views.data_view.getFloat64(SCOPE.current_index, true));
                        SCOPE.current_index += Float64Array.BYTES_PER_ELEMENT;
                        await this.runtime_actions.insertToScope(SCOPE, unit);
                        break;
                    }
                    case BinaryCode.INT_8: {
                        if (SCOPE.current_index + Int8Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let integer = SCOPE.buffer_views.data_view.getInt8(SCOPE.current_index);
                        if (Runtime.OPTIONS.USE_BIGINTS)
                            integer = BigInt(integer);
                        SCOPE.current_index += Int8Array.BYTES_PER_ELEMENT;
                        await this.runtime_actions.insertToScope(SCOPE, integer);
                        break;
                    }
                    case BinaryCode.INT_16: {
                        if (SCOPE.current_index + Int16Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let integer = SCOPE.buffer_views.data_view.getInt16(SCOPE.current_index, true);
                        if (Runtime.OPTIONS.USE_BIGINTS)
                            integer = BigInt(integer);
                        SCOPE.current_index += Int16Array.BYTES_PER_ELEMENT;
                        await this.runtime_actions.insertToScope(SCOPE, integer);
                        break;
                    }
                    case BinaryCode.INT_32: {
                        if (SCOPE.current_index + Int32Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let integer = SCOPE.buffer_views.data_view.getInt32(SCOPE.current_index, true);
                        if (Runtime.OPTIONS.USE_BIGINTS)
                            integer = BigInt(integer);
                        SCOPE.current_index += Int32Array.BYTES_PER_ELEMENT;
                        await this.runtime_actions.insertToScope(SCOPE, integer);
                        break;
                    }
                    case BinaryCode.INT_64: {
                        if (SCOPE.current_index + BigInt64Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let integer = SCOPE.buffer_views.data_view.getBigInt64(SCOPE.current_index, true);
                        if (!Runtime.OPTIONS.USE_BIGINTS)
                            integer = Number(integer);
                        SCOPE.current_index += BigInt64Array.BYTES_PER_ELEMENT;
                        await this.runtime_actions.insertToScope(SCOPE, integer);
                        break;
                    }
                    case BinaryCode.FLOAT_64: {
                        if (SCOPE.current_index + Float64Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let float = SCOPE.buffer_views.data_view.getFloat64(SCOPE.current_index, true);
                        SCOPE.current_index += Float64Array.BYTES_PER_ELEMENT;
                        await this.runtime_actions.insertToScope(SCOPE, float);
                        break;
                    }
                    case BinaryCode.FLOAT_AS_INT: {
                        if (SCOPE.current_index + Int32Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let float = SCOPE.buffer_views.data_view.getInt32(SCOPE.current_index, true);
                        SCOPE.current_index += Int32Array.BYTES_PER_ELEMENT;
                        await this.runtime_actions.insertToScope(SCOPE, float);
                        break;
                    }
                    case BinaryCode.TYPE: {
                        const type = this.runtime_actions.extractType(SCOPE);
                        if (type === false)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        await this.runtime_actions.insertToScope(SCOPE, type);
                        break;
                    }
                    case BinaryCode.EXTENDED_TYPE: {
                        const type_info = this.runtime_actions.extractType(SCOPE, true);
                        if (type_info === false)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        if (type_info[1])
                            SCOPE.inner_scope.waiting_ext_type = type_info[0];
                        else
                            await this.runtime_actions.insertToScope(SCOPE, type_info[0]);
                        break;
                    }
                    case BinaryCode.FILTER: {
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let targets_nr = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                        let target_list = [];
                        for (let n = 0; n < targets_nr; n++) {
                            let type = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                            const target = Runtime.runtime_actions.constructFilterElement(SCOPE, type, target_list);
                            if (target)
                                target_list.push(target);
                            else
                                return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        }
                        let cnf = new Datex.Addresses.AndSet();
                        if (SCOPE.current_index + 1 > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let ands_nr = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                        for (let n = 0; n < ands_nr; n++) {
                            let ors_nr = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                            if (SCOPE.current_index + (ors_nr * Int8Array.BYTES_PER_ELEMENT) > SCOPE.buffer_views.uint8.byteLength)
                                return Runtime.runtime_actions.waitForBuffer(SCOPE);
                            let ors = new Set();
                            for (let m = 0; m < ors_nr; m++) {
                                let index = SCOPE.buffer_views.data_view.getInt8(SCOPE.current_index++);
                                ors.add(index < 0 ? Datex.Addresses.Not.get(target_list[-index - 1]) : target_list[index - 1]);
                            }
                            cnf.add(ors);
                        }
                        await this.runtime_actions.insertToScope(SCOPE, new Datex.Addresses.Filter(...cnf));
                        break;
                    }
                    case BinaryCode.PERSON_ALIAS:
                    case BinaryCode.PERSON_ALIAS_WILDCARD:
                    case BinaryCode.INSTITUTION_ALIAS:
                    case BinaryCode.INSTITUTION_ALIAS_WILDCARD:
                    case BinaryCode.BOT:
                    case BinaryCode.BOT_WILDCARD:
                    case BinaryCode.ENDPOINT:
                    case BinaryCode.ENDPOINT_WILDCARD:
                        {
                            const f = this.runtime_actions.constructFilterElement(SCOPE, token);
                            if (f === false)
                                return Runtime.runtime_actions.waitForBuffer(SCOPE);
                            await this.runtime_actions.insertToScope(SCOPE, f);
                            break;
                        }
                    case BinaryCode.POINTER: {
                        if (SCOPE.current_index + Pointer.MAX_POINTER_ID_SIZE > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let id = SCOPE.buffer_views.uint8.slice(SCOPE.current_index, SCOPE.current_index += Pointer.MAX_POINTER_ID_SIZE);
                        await this.runtime_actions.insertToScope(SCOPE, await Pointer.load(id, SCOPE));
                        break;
                    }
                    case BinaryCode.SET_POINTER: {
                        if (SCOPE.current_index + Pointer.MAX_POINTER_ID_SIZE > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        const id = SCOPE.buffer_views.uint8.slice(SCOPE.current_index, SCOPE.current_index += Pointer.MAX_POINTER_ID_SIZE);
                        const pointer = await Pointer.load(id, SCOPE);
                        if (!SCOPE.inner_scope.waiting_ptrs)
                            SCOPE.inner_scope.waiting_ptrs = new Set();
                        SCOPE.inner_scope.waiting_ptrs.add([pointer]);
                        break;
                    }
                    case BinaryCode.SYNC: {
                        SCOPE.inner_scope.sync = true;
                        SCOPE.sync = true;
                        break;
                    }
                    case BinaryCode.STOP_SYNC: {
                        SCOPE.inner_scope.stop_sync = true;
                        break;
                    }
                    case BinaryCode.SUBSCRIBE: {
                        SCOPE.inner_scope.sync = true;
                        SCOPE.sync = true;
                        break;
                    }
                    case BinaryCode.UNSUBSCRIBE: {
                        SCOPE.inner_scope.unsubscribe = true;
                        SCOPE.unsubscribe = true;
                        break;
                    }
                    case BinaryCode.VALUE: {
                        SCOPE.inner_scope.get_value = true;
                        break;
                    }
                    case BinaryCode.GET_TYPE: {
                        SCOPE.inner_scope.get_type = true;
                        break;
                    }
                    case BinaryCode.ORIGIN: {
                        SCOPE.inner_scope.get_origin = true;
                        break;
                    }
                    case BinaryCode.SUBSCRIBERS: {
                        SCOPE.inner_scope.get_subscribers = true;
                        break;
                    }
                    case BinaryCode.POINTER_ACTION: {
                        if (SCOPE.current_index + 1 + Pointer.MAX_POINTER_ID_SIZE > SCOPE.buffer_views.uint8.byteLength)
                            return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        let action = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                        let id = SCOPE.buffer_views.uint8.slice(SCOPE.current_index, SCOPE.current_index += Pointer.MAX_POINTER_ID_SIZE);
                        let pointer = Pointer.get(id);
                        if (!pointer)
                            throw new PointerError("Pointer does not exist", SCOPE);
                        if (!SCOPE.inner_scope.waiting_ptrs)
                            SCOPE.inner_scope.waiting_ptrs = new Set();
                        SCOPE.inner_scope.waiting_ptrs.add([pointer, action]);
                        break;
                    }
                    case BinaryCode.CREATE_POINTER: {
                        SCOPE.inner_scope.create_pointer = true;
                        break;
                    }
                    case BinaryCode.STREAM: {
                        if (!SCOPE.inner_scope.stream_consumer) {
                            if (!SCOPE.inner_scope.active_value)
                                throw new RuntimeError("Missing stream consumer", SCOPE);
                            if (!Type.std.StreamConsumer.matches(SCOPE.inner_scope.active_value))
                                throw new TypeError("<StreamConsumer> expected");
                            SCOPE.inner_scope.stream_consumer = SCOPE.inner_scope.active_value;
                            delete SCOPE.inner_scope.active_value;
                        }
                        break;
                    }
                    default: {
                        throw new Error("Invalid Binary Token: " + token.toString(16), SCOPE);
                    }
                }
            }
        }
    }
    Datex.Runtime = Runtime;
    Logger.setDatex(Datex);
    Observers.register(Runtime, "endpoint");
    Runtime.endpoint = Datex.Addresses.LOCAL_ENDPOINT;
    if (globalThis.navigator?.userAgentData?.brands) {
        for (let brand of globalThis.navigator.userAgentData.brands) {
            if (!brand.brand.includes("Not;") && !brand.brand.includes("Not A;")) {
                Runtime.HOST_ENV = (brand.brand ?? "") + " " + (brand.version ?? "");
                break;
            }
        }
    }
    Runtime.HOST_ENV += globalThis.navigator?.userAgentData ? (' / ' + globalThis.navigator.userAgentData.platform) : '';
    if (!Runtime.HOST_ENV)
        Runtime.HOST_ENV = globalThis.navigator?.platform;
    globalThis.parseDatexData = Runtime.parseDatexData;
    globalThis.decompile = Runtime.decompile;
    globalThis.decompileBase64 = Runtime.decompileBase64;
    globalThis.DatexRuntime = Runtime;
    DatexRuntimePerformance.marker("main runtime loading time", "main_runtime_loaded", "modules_loaded");
    DatexRuntimePerformance.createMeasureGroup("compile time", [
        "header",
        "body"
    ]);
    globalThis.serializeImg = (img) => {
        return new Promise(async (resolve) => {
            var blob = await fetch(img.src).then(r => r.blob());
            var fileReader = new FileReader();
            fileReader.onloadend = (e) => {
                let arr = (new Uint8Array(e.target.result)).subarray(0, 4);
                let header = '';
                for (let i = 0; i < arr.length; i++) {
                    header += arr[i].toString(16);
                }
                let type;
                switch (header) {
                    case '89504e47':
                        type = 'image/png';
                        break;
                    case '47494638':
                        type = 'image/gif';
                        break;
                    case 'ffd8ffdb':
                    case 'ffd8ffe0':
                    case 'ffd8ffe1':
                    case 'ffd8ffe2':
                        type = 'image/jpeg';
                        break;
                    case '25504446':
                        type = 'application/pdf';
                        break;
                    case '504B0304':
                        type = 'application/zip';
                        break;
                }
                if (!type) {
                    resolve(false);
                    return;
                }
                img._type = Type.get("std", type);
                img._buffer = fileReader.result;
                resolve(type);
            };
            fileReader.onerror = () => resolve(false);
            fileReader.readAsArrayBuffer(blob);
        });
    };
    Type.std.Map.setJSInterface({
        class: Map,
        serialize: value => [...value.entries()],
        empty_generator: () => new Map(),
        cast: value => {
            if (value instanceof Array) {
                try {
                    return new Map(value);
                }
                catch (e) {
                    throw new ValueError("Failed to convert " + Type.getValueDatexType(value) + " to " + Type.std.Map);
                }
            }
            else if (typeof value == "object")
                return new Map(Object.entries(value));
            return Datex.INVALID;
        },
        create_proxy: (value, pointer) => {
            Object.defineProperty(value, "set", { value: (key, value) => {
                    return pointer.handleSet(key, value);
                }, writable: false, enumerable: false });
            Object.defineProperty(value, "clear", { value: () => {
                    return pointer.handleClear();
                }, writable: false, enumerable: false });
            Object.defineProperty(value, "delete", { value: (el) => {
                    return pointer.handleDelete(el);
                }, writable: false, enumerable: false });
            return value;
        },
        set_property_silently: (parent, key, value, pointer) => Map.prototype.set.call(parent, key, value),
        delete_property_silently: (parent, key, pointer) => Map.prototype.delete.call(parent, key),
        clear_silently: (parent, pointer) => Map.prototype.clear.call(parent),
        set_property: (parent, key, value) => parent.set(key, value),
        get_property: (parent, key) => parent.get(key),
        delete_property: (parent, key) => parent.delete(key),
        has_property: (parent, key) => parent.has(key),
        clear: (parent) => parent.clear(),
        count: (parent) => parent.size,
        keys: (parent) => [...parent.keys()],
        values: (parent) => [...parent.values()],
    });
    Type.std.Set.setJSInterface({
        class: Set,
        serialize: value => [...value].sort(),
        empty_generator: () => new Set(),
        cast: value => {
            if (value instanceof Array)
                return new Set(value);
            return Datex.INVALID;
        },
        create_proxy: (value, pointer) => {
            Object.defineProperty(value, "add", { value: el => {
                    return pointer.handleAdd(el);
                }, writable: false, enumerable: false });
            Object.defineProperty(value, "clear", { value: () => {
                    return pointer.handleClear();
                }, writable: false, enumerable: false });
            Object.defineProperty(value, "delete", { value: el => {
                    return pointer.handleRemove(el);
                }, writable: false, enumerable: false });
            return value;
        },
        property_action_silently: (type, parent, value, pointer) => {
            switch (type) {
                case BinaryCode.SUBTRACT:
                    Set.prototype.delete.call(parent, value);
                    break;
                case BinaryCode.ADD:
                    Set.prototype.add.call(parent, value);
                    break;
            }
        },
        clear_silently: (parent, pointer) => Set.prototype.clear.call(parent),
        property_action: (type, parent, value) => {
            switch (type) {
                case BinaryCode.SUBTRACT:
                    parent.delete(value);
                    break;
                case BinaryCode.ADD:
                    parent.add(value);
                    break;
            }
        },
        get_property: (parent, key) => Datex.NOT_EXISTING,
        has_property: (parent, key) => parent.has(key),
        clear: (parent) => parent.clear(),
        count: (parent) => parent.size,
        keys: (parent) => [...parent],
        values: (parent) => [...parent],
    });
    if (globalThis.HTMLImageElement)
        Type.get("std:image").setJSInterface({
            class: HTMLImageElement,
            serialize: value => value._buffer,
            empty_generator: () => new Image(),
            cast: (value, type) => {
                console.log("cast image " + type);
                if (value instanceof ArrayBuffer) {
                    let blob = new Blob([value], { type: "image/" + type.variation });
                    let imageUrl = (globalThis.URL || globalThis.webkitURL).createObjectURL(blob);
                    let img = new Image();
                    img._buffer = value;
                    img._type = type;
                    img.src = imageUrl;
                    return img;
                }
                return Datex.INVALID;
            },
            get_type: value => {
                return value._type ?? Type.get("std:image");
            },
            visible_children: new Set(["src"]),
        });
    Type.get("std:Task").setJSInterface({
        class: Datex.Task,
        is_normal_object: true,
        proxify_children: true,
        visible_children: new Set(["state", "result"]),
    }).setReplicator(Datex.Task.prototype.replicate);
    Type.get("std:Assertion").setJSInterface({
        class: Datex.Assertion,
        is_normal_object: true,
        proxify_children: true,
        visible_children: new Set(),
    });
    Type.get("std:Iterator").setJSInterface({
        class: Datex.Iterator,
        is_normal_object: true,
        proxify_children: true,
        visible_children: new Set(['val', 'next']),
    });
    Type.get("std:LazyValue").setJSInterface({
        class: Datex.LazyValue,
        is_normal_object: true,
        proxify_children: true,
        visible_children: new Set(["datex"]),
    });
})(Datex || (Datex = {}));
export function datex(dx, data = [], to = Datex.Runtime.endpoint, sign = to != Datex.Runtime.endpoint, encrypt = false) {
    if (dx instanceof Array && !(dx instanceof PrecompiledDXB)) {
        dx = dx.raw.join("?");
        let data = Array.from(arguments);
        data.splice(0, 1);
        return Datex.Runtime.datexOut([dx, data, { sign: false }], Datex.Runtime.endpoint);
    }
    else
        return Datex.Runtime.datexOut([dx, data, { sign, encrypt }], typeof to == "string" ? f(to) : to);
}
globalThis.datex = datex;
globalThis.〱 = datex;
export const 〱 = datex;
export function pointer(value) {
    const pointer = Datex.Pointer.createOrGet(value);
    if (pointer instanceof Datex.PrimitivePointer)
        return pointer;
    else
        return pointer.value;
}
export const $$ = pointer;
export function float(value = 0) {
    if (value instanceof Datex.Value)
        value = value.value;
    return Datex.Pointer.create(undefined, Number(value));
}
export function int(value = 0n) {
    if (value instanceof Datex.Value)
        value = value.value;
    return Datex.Pointer.create(undefined, BigInt(Math.floor(Number(value))));
}
export function string(value = "", ...vars) {
    if (value instanceof Datex.Value)
        value = value.value;
    if (value instanceof Array)
        return datex(`transform '${value.raw.map(s => s.replace(/\(/g, '\\(')).join("(?)")}'`, vars);
    else
        return Datex.Pointer.create(undefined, String(value));
}
export function boolean(value = false) {
    if (value instanceof Datex.Value)
        value = value.value;
    return Datex.Pointer.create(undefined, Boolean(value));
}
export function buffer(value = new ArrayBuffer(0)) {
    if (value instanceof Datex.Value)
        value = value.value;
    if (typeof value == "string")
        value = new TextEncoder().encode(value);
    else if (value instanceof NodeBuffer)
        value = new Uint8Array(value.buffer, value.byteOffset, value.byteLength / Uint8Array.BYTES_PER_ELEMENT).buffer;
    if (value instanceof TypedArray)
        value = value.buffer;
    return Datex.Pointer.create(undefined, value);
}
globalThis.float = float;
globalThis.int = int;
globalThis.string = string;
globalThis.boolean = boolean;
globalThis.buffer = buffer;
export function static_pointer(value, endpoint, unique_id, label) {
    const static_id = Datex.Pointer.getStaticPointerId(endpoint, unique_id);
    const pointer = Datex.Pointer.create(static_id, value);
    if (label)
        pointer.addLabel(typeof label == "string" ? label.replace(/^\$/, '') : label);
    return pointer.value;
}
export function label(label, value) {
    const pointer = Datex.Pointer.createOrGet(value);
    pointer.addLabel(typeof label == "string" ? label.replace(/^\$/, '') : label);
    return pointer.value;
}
globalThis.label = label;
globalThis.pointer = pointer;
globalThis.$$ = $$;
globalThis.static_pointer = static_pointer;
let PERSISTENT_INDEX = 0;
export function eternal(id_or_create_or_class, _create_or_class) {
    const create_or_class = (id_or_create_or_class instanceof Function || id_or_create_or_class instanceof Datex.Type) ? id_or_create_or_class : _create_or_class;
    const unique = () => {
        const type = create_or_class instanceof Datex.Type ? create_or_class : (create_or_class.prototype !== undefined ? Datex.Type.getClassDatexType(create_or_class) : null);
        const stackInfo = new Error().stack.toString().split(/\r\n|\n/)[3]?.replace(/ *at/, '').trim();
        return (stackInfo ?? '*') + ':' + (type ? type.toString() : '*') + ':' + (PERSISTENT_INDEX++);
    };
    const id = (typeof id_or_create_or_class == "string" || typeof id_or_create_or_class == "number") ? id_or_create_or_class : unique();
    let creator;
    if (typeof create_or_class === "function" && create_or_class.prototype !== undefined) {
        if (create_or_class == String || create_or_class == Number || create_or_class == Boolean)
            creator = () => create_or_class();
        else if (create_or_class == BigInt)
            creator = () => create_or_class(0);
        else
            creator = () => new create_or_class();
    }
    else if (typeof create_or_class === "function") {
        creator = create_or_class;
    }
    else if (create_or_class instanceof Datex.Type) {
        creator = () => create_or_class.createDefaultValue();
    }
    if (creator == null)
        throw new Datex.Error("Undefined creator for eternal creation");
    return Datex.Storage.loadOrCreate(id, creator);
}
globalThis.eternal = eternal;
export function not(value) {
    let target;
    if (typeof value == "string")
        target = f(value);
    else if (value instanceof Array && typeof value[0] == "string")
        target = f(value[0]);
    return new Datex.Addresses.Filter(Datex.Addresses.Not.get(target));
}
export function person(name) {
    return Datex.Addresses.Person.get(typeof name == "string" ? name : name[0]);
}
export function institution(name) {
    return Datex.Addresses.Institution.get(typeof name == "string" ? name : name[0]);
}
export function bot(name) {
    return Datex.Addresses.Bot.get(typeof name == "string" ? name : name[0]);
}
export function f(name) {
    return Datex.Addresses.Target.get((typeof name == "string" ? name : name[0]));
}
export function ef(filter) {
    if (filter instanceof Datex.Addresses.Target)
        return filter.toString();
    return new Datex.Addresses.Filter(filter).toString();
}
globalThis.not = not;
globalThis.person = person;
globalThis.f = f;
globalThis.ef = ef;
export function syncedValue(parent, key) {
    return Datex.PointerProperty.get(parent, key);
}
export function props(parent, strong_parent_bounding = true) {
    let pointer;
    parent = Datex.Pointer.pointerifyValue(parent);
    if (parent instanceof Datex.PointerProperty)
        parent = parent.value;
    if (parent instanceof Datex.Pointer)
        pointer = parent;
    else
        pointer = Datex.Pointer.createOrGet(parent, undefined, undefined, undefined, true);
    return new Proxy({}, {
        get: (_, key) => {
            if (!strong_parent_bounding) {
                const property = pointer.getProperty(key);
                if (property instanceof Datex.Value)
                    return property;
            }
            return Datex.PointerProperty.get(pointer, key);
        },
        set: (_, key, value) => {
            Datex.PointerProperty.get(pointer, key).value = value;
            return true;
        }
    });
}
globalThis.props = props;
globalThis.Datex = Datex;
class BlockchainTransaction {
    transaction;
    constructor(transaction = { data: undefined, type: 0 }) {
        this.transaction = transaction;
    }
}
Datex.Type.std.Transaction.setJSInterface({
    class: BlockchainTransaction,
    serialize: (value) => value.transaction,
    empty_generator: () => new BlockchainTransaction(),
    cast: value => {
        if (value instanceof Object)
            return new BlockchainTransaction(value);
        return Datex.INVALID;
    }
});
Datex.Pointer.onPointerAdded(async (pointer) => {
    if (await Datex.Storage.hasPointer(pointer)) {
        Datex.Storage.syncPointer(pointer);
    }
});
DatexRuntimePerformance.marker("pseudoclass loading time", "pseudo_classes_loaded", "main_runtime_loaded");
DatexRuntimePerformance.marker("runtime initialization time", "initialized", "main_runtime_loaded");
DatexRuntimePerformance.marker("startup time", "runtime_ready", "runtime_start");
