
/**
╔══════════════════════════════════════════════════════════════════════════════════════╗
║  DATEX Runtime                                                                       ║
╠══════════════════════════════════════════════════════════════════════════════════════╣
║  Complete DATEX runtime for the web and node.js                                      ║
║  * Parses & executes DATEX requests, handles pointers, garbage collection and more   ║
║  * Supports the DATEX binary format (dxb) and DATEX script code                      ║
║  Visit https://docs.unyt.org/datex for more information                              ║
╠═════════════════════════════════════════╦════════════════════════════════════════════╣
║  © 2022 unyt.org                        ║                                            ║
╚═════════════════════════════════════════╩════════════════════════════════════════════╝
*/


import Logger from "./logger.js";
const logger = new Logger("DATEX Runtime");
logger.info("initializing ...");


// used for Runtime/Compiler performance measuring
// average measured durations are available as DatexObjects
export class DatexRuntimePerformance {

    static enabled = false;

    /** adds a new marker and measures + logs the time from a given start marker to the new marker*/

    static marker(description:string, new_marker:string, start_marker:string){
        if (!globalThis.performance?.getEntriesByName) return;
        if (!globalThis.performance.getEntriesByName("runtime_start").length) globalThis.performance.mark("runtime_start");
    
        const meas_name = start_marker+"-"+new_marker;
        globalThis.performance.mark(new_marker);
        globalThis.performance.measure(meas_name, start_marker);
        
        logger.info(`${description}: ${ Math.round(globalThis.performance.getEntriesByName(meas_name, 'measure')[0]?.duration)}ms`)
    }

    static #marker_count = new Map<string,number>();

    static #measurements_groups = new Map<string,object>(); // group name, measurement

    static MEAS_COUNT = Symbol("MEAS_COUNT")

    /** define/create a new measurement group object to save the average measured times */
    static createMeasureGroup(name:string, measurement_names:string[]=[]){
        const obj = Object.fromEntries(measurement_names.map(n=>[n,0]));
        const group = Datex.DatexObject.seal({[this.MEAS_COUNT]:obj, ...obj})
        this.#measurements_groups.set(name, group)
        return group;
    }

    // get a measure group object (DatexObject) for a previously defined measure group
    static getMeasureGroup(name:string){
        return this.#measurements_groups.get(name)
    }

    static startMeasure(group:string, name:string):PerformanceMark{
        if (!globalThis.performance?.getEntriesByName || !DatexRuntimePerformance.enabled) return;
        if (!this.#measurements_groups.has(group)) throw new Error("Measurement group '"+group+"' is not defined");

        const count = (this.#marker_count.get(name)??0);
        this.#marker_count.set(name, count+1)

        const marker = globalThis.performance.mark(group+'_'+name+'_'+count, {detail:{group, name}})

        return marker;
    }

    static endMeasure(mark:string|PerformanceMark){
        if (!globalThis.performance?.getEntriesByName || !DatexRuntimePerformance.enabled) return;
        const performance_mark = mark instanceof PerformanceMark ? mark : <PerformanceMark> globalThis.performance.getEntriesByName(mark, 'mark')[0];
        const mark_name = performance_mark.name;
        const name = performance_mark.detail.name;
        if (!performance_mark.detail.group) throw new Error("Performance mark has no assigned measurment group");

        const duration = globalThis.performance.measure(mark_name, mark_name).duration;
        const group = this.#measurements_groups.get(performance_mark.detail.group)
        const count = ++group[this.MEAS_COUNT][name];

        // calculate new average value
        group[name] = group[name] + (duration - group[name]) / count;

        return group
    }
}

globalThis.performance?.mark("runtime_start");
globalThis.DatexRuntimePerformance = DatexRuntimePerformance;

// for debugging: converting bigints to JSON
// @ts-ignore
BigInt.prototype.toJSON = function(){return globalThis.String(this)+"n"}
// @ts-ignore
Symbol.prototype.toJSON = function(){return globalThis.String(this)}

/***** imports */
import { DatexCompiler, DatexProtocolDataType, compiler_options, Regex, BinaryCode, PrecompiledDXB} from "./datex_compiler.js"; // Compiler functions
import "./lib/marked.js"; // required for Markdown highlighting
import { BlockchainAdapter } from "./blockchain_adapter.js";
declare const marked:Function;

const client_type = globalThis.process?.release?.name ? 'node' : 'browser'


// STORAGE
type localForage = Storage & {setItem:(key:string,value:any)=>void, getItem:(key:string)=>ArrayBuffer|string|null};

// storage for saving DATEX data (keys, endpoints), files in the .datex directory or IndexDB in the browser
let datex_storage: Storage;

// db based storage for DATEX value caching (IndexDB in the browser)
let datex_item_storage: localForage;
let datex_pointer_storage: localForage;

// fallback if no DB storage available localStorage or node-localstorage
let localStorage = globalThis.localStorage;

/***** imports and definitions with top-level await - node.js / browser interoperability *******************************/
const site_suffix = globalThis.location?.pathname ?? '';

if (client_type=="node") {
    // @ts-ignore
    const node_localstorage = (await import("node-localstorage")).default.LocalStorage;
    datex_storage = new node_localstorage('.datex');
    localStorage = new node_localstorage('./.datex-cache');
}
else {
    const localforage = (await import("./lib/localforage/localforage.js")).default;
    datex_storage = localforage.createInstance({name: "dx::"+site_suffix});
    datex_item_storage = localforage.createInstance({name: "dxitem::"+site_suffix});
    datex_pointer_storage = localforage.createInstance({name: "dxptr::"+site_suffix});
}

globalThis.storage = datex_storage;
globalThis.datex_storage = datex_item_storage;
globalThis.datex_pointer_storage = datex_pointer_storage;

// crypto
if (client_type == 'browser' && !globalThis.crypto) throw new Error("The Web Crypto API is required for the DATEX Runtime");
// @ts-ignore
const crypto = globalThis.crypto ?? <Crypto>(<any>(await import("crypto")).webcrypto) //<- EXPERIMENTAL, deprecated ->  <Crypto>(<any>new((await import("node-webcrypto-ossl")).default.Crypto)()) 
if (!crypto) throw new Error("Newer version of node crypto library required");

// fetch
// @ts-ignore
const fetch = client_type == "browser" ? globalThis.fetch : (await import("node-fetch")).default;
// fs
// @ts-ignore
const fs = client_type == "node" ? (await import("fs")).default : null;

// TODO replace with ReadableStream Web API Implementation for Nodejs (also WebCrypto API)
// @ts-ignore
export const ReadableStream = <typeof globalThis.ReadableStream>(globalThis.ReadableStream ?? (await import("node-web-streams")).ReadableStream);

/*********************************************************************************************************************/

DatexRuntimePerformance.marker("module loading time", "modules_loaded", "runtime_start");

// TODO reader for node.js
const ReadableStreamDefaultReader = globalThis.ReadableStreamDefaultReader ?? class {};

// node.js Buffers
// @ts-ignore
const NodeBuffer = globalThis.Buffer || class {};
// binary - base64 conversion
export const btoa:(s:string)=>string = typeof globalThis.btoa !== 'undefined' ? globalThis.btoa : (b) => NodeBuffer.from(b).toString('base64');
export const atob:(base64:string)=>string = typeof globalThis.atob !== 'undefined' ? globalThis.atob : (base64) => NodeBuffer.from(base64, 'base64').toString('binary');


/** ArrayBuffer <-> Base64 String */
export function arrayBufferToBase64(buffer:ArrayBuffer):string {
	let binary = '';
	let bytes = new Uint8Array( buffer );
	let len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += globalThis.String.fromCharCode( bytes[ i ] );
	}
	return btoa( binary );
}

export function base64ToArrayBuffer(base64:string):ArrayBuffer {
    let binary_string = atob(base64);
    let len = binary_string.length;
    let bytes = new Uint8Array( len );
    for (let i = 0; i < len; i++)        {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

export const TypedArray = Object.getPrototypeOf(Uint8Array);


// Util class to link observers methods
export class Observers {

    static #observers = new WeakMap<object, (Map<string|Symbol,Set<Function>>)>();

    // register a new observer group for a parent and key
    public static register(parent:object, key:string|Symbol) {
        if (!this.#observers.has(parent)) this.#observers.set(parent, new Map());
        const observers = this.#observers.get(parent);
        if (!observers.has(key)) observers.set(key, new Set());
    }


    // add a observer method
    public static add(parent:object, key:string|Symbol, observer:Function) {
        if (!this.#observers.has(parent)) this.#observers.set(parent, new Map());
        const observers = this.#observers.get(parent);
        if (!observers.has(key)) observers.set(key, new Set());
        observers.get(key).add(observer);
    }

    // call all observer methods for a parent and key with args
    public static call(parent:object, key?:string|Symbol, ...args:any[]) {
        if (!this.#observers.has(parent)) throw Error("Observers for this object do not exist")
        const observers = this.#observers.get(parent);
        if (!observers.has(key)) throw Error("Observers for this key do not exist")
        for (let o of observers.get(key)) o(...args);
    }

    // call all observer methods for a parent and key with args (async)
    public static callAsync(parent:object, key?:string|Symbol, ...args:any[]) {
        if (!this.#observers.has(parent)) throw Error("Observers for this object do not exist")
        const observers = this.#observers.get(parent);
        if (!observers.has(key)) throw Error("Observers for this key do not exist")
        const promises = [];
        for (let o of observers.get(key)) promises.push(o(...args));
        return Promise.all(promises);
    }

    public static clear(parent:object, key?:string|Symbol, observer?:Function) {
        if (!this.#observers.has(parent)) throw Error("Observers for this object do not exist")
        // delete all observers for parent object
        if (key === undefined) this.#observers.delete(parent);
        else {
            const observers = this.#observers.get(parent);
            if (!observers.has(key)) throw Error("Observers for this key do not exist")
            // delete method
            if (observer) {
                observers.get(key).delete(observer);
            }
            // delete all observer methods for key
            else {
                observers.delete(key);
            }
        }

    }
}


declare global {
    interface Map<K, V> {
        clear(): void;
        delete(key: K): boolean;
        forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void;
        get(key: K): V | undefined;
        has(key: K): boolean;
        set(key: K, value: V): this;
        readonly size: number;

        setAutoDefault(default_class_or_creator_function_or_value:V|any_class<V>|(()=>V)):Map<K, V>;
        getAuto(key: K): V;
    }
  }

type any_class<V> = (new (...args: any[]) => V)|((...args: any[]) => V)|StringConstructor|NumberConstructor|BigIntConstructor|BooleanConstructor;

// extends Map class to automatically create new empty entries when the getAuto() method is called and the entry does not exist

const DEFAULT_CLASS = Symbol('DEFAULT_CLASS')
const DEFAULT_IS_CLASS = Symbol('DEFAULT_IS_CLASS')
const DEFAULT_CLASS_PRIMITIVE = Symbol('DEFAULT_CLASS_PRIMITIVE')
const DEFAULT_CREATOR_FUNCTION = Symbol('DEFAULT_CREATOR_FUNCTION')
const DEFAULT_VALUE = Symbol('DEFAULT_VALUE')

Map.prototype.setAutoDefault = function<V>(default_class_or_creator_function_or_value:V|any_class<V>|(()=>V)) {
    // is class
    if (typeof default_class_or_creator_function_or_value === "function" && default_class_or_creator_function_or_value.prototype !== undefined) {
        this[DEFAULT_CLASS] = <any_class<V>>default_class_or_creator_function_or_value;
        this[DEFAULT_IS_CLASS] = true;
        this[DEFAULT_CLASS_PRIMITIVE] = this[DEFAULT_CLASS] == String || this[DEFAULT_CLASS] == Number  || this[DEFAULT_CLASS] == BigInt || this[DEFAULT_CLASS] == Boolean;
    }
    // is function
    else if (typeof default_class_or_creator_function_or_value === "function") {
        this[DEFAULT_CREATOR_FUNCTION] = <(()=>V)> default_class_or_creator_function_or_value;
    }
    // is value
    else this[DEFAULT_VALUE] = <V>default_class_or_creator_function_or_value;
    return this;
}

Map.prototype.getAuto = function<K,V>(key: K): V {
    if (!this.has(key)) this.set(key, 
        this[DEFAULT_CREATOR_FUNCTION] ? 
            this[DEFAULT_CREATOR_FUNCTION]() : 
            (this[DEFAULT_IS_CLASS] ? 
                (this[DEFAULT_CLASS_PRIMITIVE] ?
                    (this[DEFAULT_CLASS_PRIMITIVE] == BigInt ?
                    (<((n:number) => V)>this[DEFAULT_CLASS])(0) : 
                    (<(() => V)>this[DEFAULT_CLASS])()) : 
                    new (<(new () => V)>this[DEFAULT_CLASS])()) : 
                this[DEFAULT_VALUE]
            )
    );
    return this.get(key);
}

export namespace Datex {

// general storage for DATEX Values

export interface PointerSource {
    getPointer(pointer_id:string, pointerify?:boolean): Promise<any>|any
    syncPointer?(pointer:Pointer):Promise<void>|void
}


/** save values as DXB (base64) in the localStorage */


export class Storage {
    
    static cache:Map<string,any> = new Map(); // save stored values in a Map, return when calling getItem

    static state_prefix = "dxstate::"+site_suffix+"::"

    static pointer_prefix = "dxptr::"+site_suffix+"::"
    static item_prefix = "dxitem::"+site_suffix+"::"
    static label_prefix = "dxlbl::"+site_suffix+"::"

    static #location: Storage.Location

    static get location() {return this.#location}
    static set location(location: Storage.Location) {
        // asynchronous saving on exit not possible in browser
        if (client_type == "browser" && Storage.mode == Storage.Mode.SAVE_ON_EXIT && location == Storage.Location.DATABASE) throw new Datex.Error("Invalid DATEX Storage location: DATABASE with SAVE_ON_EXIT mode");
        this.#location = location
    }

    static #mode: Storage.Mode; // Storage.Mode.SAVE_ON_REQUEST

    static set mode(mode: Storage.Mode) {
        this.#mode = mode;

        if (Storage.mode == Storage.Mode.SAVE_ON_EXIT) {
            // page exit listener
            if (client_type == "browser") {
                addEventListener("beforeunload", ()=>{
                    console.log(`Page exit. Saving DATEX Values in cache...`);
                    this.updateLocalStorage();
                }, {capture: true});
            }
            // process exit listener
            else {
    
                process.on('exit', (code)=>{
                    console.log(`Process exit: ${code}. Saving DATEX Values in cache...`);
                    this.updateLocalStorage();
                });

                process.on('SIGINT', ()=>process.exit());
                //process.on('SIGHUP', handler);
                //process.on('SIGKILL', handler);
                //process.on('SIGSTOP', handler);
            }
            
        }
    }

    static get mode() {
        return this.#mode    
    }

    // call to reload page without saving any data (for resetting)
    static #exit_without_save = false;
    public static allowExitWithoutSave(){
        this.#exit_without_save = true;
    }

    static updateLocalStorage(){
        if (this.#exit_without_save) {
            console.log(`Exiting without save`);
            return;
        }

        // update items
        for (let [key, val] of Storage.cache) {
            this.setItem(key, val);
        }

        // update pointers
        for (let ptr of this.#local_storage_active_pointers) {
            this.setPointer(ptr);
        }
        for (let id of this.#local_storage_active_pointer_ids) {
            this.setPointer(Pointer.get(id));
        }
    }
    

    static setItem(key:string, value:any, listen_for_pointer_changes = true):Promise<boolean>|boolean {
        Storage.cache.set(key, value); // save in cache
        const pointer = value instanceof Pointer ? value : Pointer.getByValue(value);

        if (this.location == Storage.Location.DATABASE) return this.setItemDB(key, value, pointer, listen_for_pointer_changes);
        else if (this.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) return this.setItemLocalStorage(key, value, pointer, listen_for_pointer_changes);
    }

    static setItemLocalStorage(key:string, value:any, pointer?:Datex.Pointer, listen_for_pointer_changes = true):boolean {
        // also store pointer
        if (pointer) {
            let res = this.setPointer(pointer, listen_for_pointer_changes);
            if (!res) return false;
        }
        logger.debug("storing item in local storage: " + key);

        localStorage.setItem(this.item_prefix+key, DatexCompiler.encodeValueBase64(value))
        return true;
    }

    static async setItemDB(key:string, value:any, pointer?:Datex.Pointer, listen_for_pointer_changes = true):Promise<boolean> {
        // also store pointer
        if (pointer) {
            let res = await this.setPointer(pointer, listen_for_pointer_changes);
            if (!res) return false;
        }

        logger.debug("storing item in db storage: " + key);

        // store value (might be pointer reference)
        await datex_item_storage.setItem(key, DatexCompiler.encodeValue(value));  // value to buffer (no header)
        return true;
    }

    private static setPointer(pointer:Pointer, listen_for_changes = true):Promise<boolean>|boolean {
        if (this.location == Storage.Location.DATABASE) return this.setPointerDB(pointer, listen_for_changes);
        else if (this.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) return this.setPointerLocalStorage(pointer, listen_for_changes);
    }

    static #local_storage_active_pointers = new Set<Pointer>();
    static #local_storage_active_pointer_ids = new Set<string>();

    private static setPointerLocalStorage(pointer:Pointer, listen_for_changes = true):boolean {

        logger.debug("storing pointer in local storage: " + pointer);

        const serialized_value = pointer.getSerializedValue();
        const inserted_ptrs = new Set<Pointer>();
        localStorage.setItem(this.pointer_prefix+pointer.id, DatexCompiler.encodeValueBase64(serialized_value, inserted_ptrs, true));  // serialized pointer

        // add required pointers for this pointer (only same-origin pointers)
        for (let ptr of inserted_ptrs) {
            // add if not yet in storage
            if (ptr != pointer && ptr.is_origin && !localStorage.getItem(this.pointer_prefix+ptr.id)) this.setPointer(ptr, listen_for_changes)
        }

        this.#local_storage_active_pointers.add(pointer);
    
        return true;
    }

    private static async setPointerDB(pointer:Pointer, listen_for_changes = true):Promise<boolean>{
        // already syncing?
        if (this.synced_pointers.has(pointer)) return;

        logger.debug("storing pointer in db storage: " + pointer);

        const serialized_value = pointer.getSerializedValue();
        const inserted_ptrs = new Set<Pointer>();
        await datex_pointer_storage.setItem(pointer.id, DatexCompiler.encodeValue(serialized_value, inserted_ptrs, true));  // serialized pointer

        // add required pointers for this pointer (only same-origin pointers)
        for (let ptr of inserted_ptrs) {
            // add if not yet in storage
            if (ptr != pointer && ptr.is_origin && !await this.hasPointer(ptr)) await this.setPointer(ptr, listen_for_changes)
        }

        // listen for changes
        if (listen_for_changes) this.syncPointer(pointer);
    
        return true;
    }

    private static synced_pointers = new Set<Pointer>();

    static syncPointer(pointer: Pointer) {
        if (this.mode != Storage.Mode.SAVE_AUTOMATICALLY) return;

        if (!pointer) {
            logger.error("tried to sync non-existing pointer with storage")
            return;
        }

        // already syncing?
        if (this.synced_pointers.has(pointer)) return;
        this.synced_pointers.add(pointer)

        const serialized_value = pointer.getSerializedValue();

        // any value change
        pointer.observe(async ()=>{
            const inserted_ptrs = new Set<Pointer>();
            datex_pointer_storage.setItem(pointer.id, DatexCompiler.encodeValue(serialized_value, inserted_ptrs, true));  // serialize pointer

            // add new required pointers for this pointer
            for (let ptr of inserted_ptrs) {
                this.setPointer(ptr)
            }
        })
        
    }

    public static async hasPointer(pointer:Pointer) {
        if (this.location == Storage.Location.DATABASE) return (await datex_pointer_storage.getItem(pointer.id)) !== null
        else if (this.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) return localStorage.getItem(this.pointer_prefix+pointer.id) != null;
    }

    public static getPointer(pointer_id:string, pointerify?:boolean):Promise<any>|any {
        if (this.location == Storage.Location.DATABASE) return this.getPointerDB(pointer_id, pointerify);
        else if (this.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) return this.getPointerLocalStorage(pointer_id, pointerify);
    }

    public static async getPointerLocalStorage(pointer_id:string, pointerify?:boolean) {

        let pointer:Pointer;
        if (pointerify && (pointer = Pointer.get(pointer_id))) return pointer.value; // pointer still exists in runtime

        // load from storage
        let base64 = localStorage.getItem(this.pointer_prefix+pointer_id);
        if (base64 == null) return NOT_EXISTING;

        const val = await Runtime.decodeValueBase64(base64);
        // create pointer with saved id and value + start syncing, if pointer not already created in DATEX
        if (pointerify) {
            const pointer = Pointer.create(pointer_id, val, false, Runtime.endpoint);
            this.#local_storage_active_pointers.add(pointer);
            if (pointer instanceof PrimitivePointer) return pointer;
            else return pointer.value;
        }

        else {
            this.#local_storage_active_pointer_ids.add(pointer_id);
            return val;
        }

    }

    public static async getPointerDB(pointer_id:string, pointerify?:boolean) {

        let pointer:Pointer;
        if (pointerify && (pointer = Pointer.get(pointer_id))) return pointer.value; // pointer still exists in runtime

        // load from storage
        let buffer = <ArrayBuffer><any>await datex_pointer_storage.getItem(pointer_id);
        if (buffer == null) return NOT_EXISTING;

        const val = await Runtime.decodeValue(buffer);
        // create pointer with saved id and value + start syncing, if pointer not already created in DATEX
        if (pointerify) {
            const pointer = Pointer.create(pointer_id, val, false, Runtime.endpoint);
            this.syncPointer(pointer);
            if (pointer instanceof PrimitivePointer) return pointer;
            else return pointer.value;
        }

        else return val;
    }


    private static async removePointer(pointer_id:string) {
        if (Storage.location == Storage.Location.DATABASE) { 
            await datex_pointer_storage.removeItem(pointer_id);
        }

        else if (Storage.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) { 
            localStorage.removeItem(this.pointer_prefix+pointer_id);
        }
    }

    static async getPointerDecompiled(key:string):Promise<string> {
        // get from datex_storage
        if (Storage.location == Storage.Location.DATABASE) { 
            let buffer = <ArrayBuffer><any>await datex_pointer_storage.getItem(key);
            if (buffer == null) return null;
            return Runtime.decompile(buffer, true, false, true, false);
        }

        // get from local storage
        else if (Storage.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) { 
            const base64 = localStorage.getItem(this.pointer_prefix+key);
            if (base64==null) return null;
            return Runtime.decompile(base64ToArrayBuffer(base64), true, false, true, false);
        }
    }

    static async getItemDecompiled(key:string):Promise<string> {
        // get from datex_storage
        if (Storage.location == Storage.Location.DATABASE) { 
            let buffer = <ArrayBuffer><any>await datex_item_storage.getItem(key);
            if (buffer == null) return null;
            return Runtime.decompile(buffer, true, false, true, false);
        }

        // get from local storage
        else if (Storage.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) { 
            const base64 = localStorage.getItem(this.item_prefix+key);
            if (base64==null) return null;
            return Runtime.decompile(base64ToArrayBuffer(base64), true, false, true, false);
        }
    }

    static async getItemKeys(){
        if (Storage.location == Storage.Location.DATABASE) return await datex_item_storage.keys();

        else if (Storage.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) { 
            const keys = []
            for (let key of Object.keys(localStorage)) {
                if (key.startsWith(this.item_prefix)) keys.push(key.replace(this.item_prefix,""))
            }
            return keys;
        }
    }

    static async getPointerKeys(){
        if (Storage.location == Storage.Location.DATABASE) return await datex_pointer_storage.keys();

        else if (Storage.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) { 
            const keys = []
            for (let key of Object.keys(localStorage)) {
                if (key.startsWith(this.pointer_prefix)) keys.push(key.replace(this.pointer_prefix,""))
            }
            return keys;
        }
         
    }

    static async getItem(key:string):Promise<any> {
        let val:any;
        // get from cache
        if (Storage.cache.has(key)) return Storage.cache.get(key);

        // get from datex_storage
        else if (Storage.location == Storage.Location.DATABASE) { 
            let buffer = <ArrayBuffer><any>await datex_item_storage.getItem(key);
            if (buffer == null) return null;
            val = await Runtime.decodeValue(buffer);
        }

        // get from local storage
        else if (Storage.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) { 
            const base64 = localStorage.getItem(this.item_prefix+key);
            if (base64==null) return null;
            val = await Runtime.decodeValueBase64(base64);
        }
    
        Storage.cache.set(key, val);
        return val;
    }

    

    static async hasItem(key:string):Promise<boolean> {
        if (Storage.cache.has(key)) return true; // get from cache
        
        // get from datex_storage
        else if (Storage.location == Storage.Location.DATABASE) { 
            return (await datex_item_storage.getItem(key) != null)
        }

        // get from local storage
        else if (Storage.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) { 
            return localStorage.getItem(this.item_prefix+key) != null
        }

        return false;
    }

    static async removeItem(key:string):Promise<void> {
        if (Storage.cache.has(key)) Storage.cache.delete(key); // delete from cache

        if (Storage.location == Storage.Location.DATABASE) { 
            await datex_item_storage.removeItem(key) // delete from db storage
        }

        else if(Storage.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) { 
            await localStorage.removeItem(this.item_prefix+key) // delete from local storage
        }
        
    }

    // clear all storages
    static async clear():Promise<void> {
        await datex_item_storage?.clear();
        await datex_pointer_storage?.clear();
        await datex_storage?.clear();
        for (let key of Object.keys(localStorage)) {
            if (key.startsWith(this.item_prefix) || key.startsWith(this.pointer_prefix) || key.startsWith(this.label_prefix)) localStorage.removeItem(key);
        }
    }

    // load saved state
    static async loadOrCreate<T>(id:string|number, create?:()=>Promise<T>|T):Promise<Storage.created_state_value<T>> {
        const state_name = this.state_prefix+id.toString();
        // already has a saved state
        if (await this.hasItem(state_name)) {
            return await this.getItem(state_name)
        }
        // create state
        else if (create){
            const state = pointer(await create());
            await this.setItem(state_name, state, true);
            return <any>state;
        }
        else throw new Error("Cannot find or create the state '" + id + "'")
    }


    // plaintext DATEX Script 'config files' storage (.datex directory in node.js)
    static async setConfigValue(key:any, value:any) {
        await datex_storage.setItem(key, Datex.Runtime.valueToDatexStringExperimental(value))
    }
    static async getConfigValue(key:any) {
        const datex = await datex_storage.getItem(key);
        if (typeof datex != "string" || !datex) return null;
        else return Datex.Runtime.executeDatexLocally(datex)
    }
    static async hasConfigValue(key:any) {
        return (await datex_storage.getItem(key)) != null;
    }
}



export namespace Storage {
    export enum Mode {
        SAVE_ON_EXIT,
        SAVE_AUTOMATICALLY,
    }

    export enum Location {
        DATABASE,
        FILESYSTEM_OR_LOCALSTORAGE
    }

    export type created_state_value<T> = T extends object ? (
        T extends globalThis.Number ? Datex.Float :
        T extends globalThis.BigInt ? Datex.Int :
        T extends globalThis.String ? Datex.String :
        T extends globalThis.Boolean ? Datex.Boolean :
        T extends globalThis.ArrayBuffer ? Datex.Buffer :
        T
    ) : Datex.PrimitivePointer<T>
}

Storage.mode = Storage.Mode.SAVE_ON_EXIT // client_type=="browser" ? Storage.Mode.SAVE_ON_EXIT : Storage.Mode.SAVE_CONTINUOSLY;
Storage.location = Storage.Location.FILESYSTEM_OR_LOCALSTORAGE // client_type=="browser" ? Storage.Mode.SAVE_ON_EXIT : Storage.Mode.SAVE_CONTINUOSLY;


class DatexStoragePointerSource implements PointerSource {
    getPointer(pointer_id:string, pointerify?:boolean) {
        return Storage.getPointer(pointer_id, pointerify)
    }
    syncPointer(pointer:Pointer) {
        return Storage.syncPointer(pointer)
    }
} 

export namespace Crypto {
    export interface ExportedKeySet {
        sign: [ArrayBuffer, ArrayBuffer],
        encrypt: [ArrayBuffer, ArrayBuffer]
    }
}

/** takes care of encryption, signing, etc.. */
export class Crypto {
    
    // cached public keys for endpoints
    private static public_keys = new Map<Datex.Addresses.Endpoint, [CryptoKey, CryptoKey]>(); // verify_key, enc_key
    private static public_keys_exported = new Map<Datex.Addresses.Endpoint, [ArrayBuffer, ArrayBuffer]>(); // only because node crypto is causing problems

    // own keys
    private static rsa_sign_key:CryptoKey
    private static rsa_verify_key:CryptoKey
    private static rsa_dec_key:CryptoKey
    private static rsa_enc_key:CryptoKey

    // own keys as exported ArrayBuffers
    private static rsa_sign_key_exported:ArrayBuffer
    private static rsa_verify_key_exported:ArrayBuffer
    private static rsa_dec_key_exported:ArrayBuffer
    private static rsa_enc_key_exported:ArrayBuffer

    public static available = false; // true if own keys loaded


    // used for signing/verifying with a sign/verify key
    private static readonly sign_key_options = {
        name: "ECDSA",
        hash: {name: "SHA-384"},
    }

    // used to create a new sign/verify key pair
    private static readonly sign_key_generator = {
        name: "ECDSA",
        namedCurve: "P-384"
    }

    // used for encryption/decryption keys
    private static readonly enc_key_options = {
        name: "RSA-OAEP",
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256"
    }
    // used for import
    private static readonly enc_key_import = {
        name: "RSA-OAEP",
        hash: "SHA-256"
    }

    static readonly SIGN_BUFFER_SIZE = 96;
    static readonly IV_BUFFER_SIZE = 16;

    /** Sign + Verify */
    static async sign(buffer:ArrayBuffer): Promise<ArrayBuffer> {
        if (!this.available) throw new SecurityError("Cannot sign DATEX requests, missing private keys");
        return await crypto.subtle.sign(this.sign_key_options, this.rsa_sign_key, buffer);
    }
    static async verify(data:ArrayBuffer, signature:ArrayBuffer, endpoint:Datex.Addresses.Endpoint): Promise<boolean> {
        let keys = await this.getKeysForEndpoint(endpoint);
        if (!keys || !keys[0]) return false;
        return await crypto.subtle.verify(this.sign_key_options, keys[0], signature, data);
    }

    /** Encypt + Decrypt (RSA) */
    static async encrypt(buffer:ArrayBuffer, endpoint:Datex.Addresses.Endpoint): Promise<ArrayBuffer> {
        if (!this.available) throw new SecurityError("Cannot encrypt DATEX requests, missing private keys");
        let keys = await this.getKeysForEndpoint(endpoint);
        if (!keys || keys[1]==null) return null;
        return await crypto.subtle.encrypt("RSA-OAEP", keys[1], buffer);
    }
    static async decrypt(data:ArrayBuffer): Promise<ArrayBuffer> {
        return await crypto.subtle.decrypt("RSA-OAEP", this.rsa_dec_key, data);
    }


    /** Symmetric Encypt + Decrypt (AES-GCM) */
    // returns [encrypted, iv]
    static async encryptSymmetric(data:ArrayBuffer, key:CryptoKey): Promise<[ArrayBuffer,Uint8Array]> {
        let iv = crypto.getRandomValues(new Uint8Array(this.IV_BUFFER_SIZE));
        return [await crypto.subtle.encrypt({name:"AES-GCM", iv: iv}, key, data), iv]
    }

    // returns decrypted
    static async decryptSymmetric(encrypted:ArrayBuffer, key:CryptoKey, iv:Uint8Array): Promise<ArrayBuffer> {
        try {
            return await crypto.subtle.decrypt({name:"AES-GCM", iv: iv}, key, encrypted);
        } catch (e) {
            throw new SecurityError("Invalid encrypted DATEX");
        }
    }

    // returns an assymetrically encrypted symmetric key
    static async encryptSymmetricKeyForEndpoint(key:CryptoKey, endpoint:Datex.Addresses.Endpoint) {
        let exported_key = await crypto.subtle.exportKey("raw", key);
        return this.encrypt(exported_key, endpoint);
    }

    // returns a symmetric encryption key
    static async extractEncryptedKey(encrypted: ArrayBuffer): Promise<CryptoKey> {
        let key_data = await this.decrypt(encrypted);
        return crypto.subtle.importKey("raw",  key_data, "AES-GCM", true, ["encrypt", "decrypt"]);
    }

    // generates a new symmetric (AES) key
    static generateSymmetricKey():Promise<CryptoKey> {
        return crypto.subtle.generateKey({
                name: "AES-GCM",
                length: 256
            },true, ["encrypt", "decrypt"]
        );
    }


    // returns the public verify + encrypt keys for an endpoint (from cache or from network)
    static async getKeysForEndpoint(endpoint:Datex.Addresses.Endpoint):Promise<[CryptoKey, CryptoKey]> {
        if (this.public_keys.has(endpoint)) return this.public_keys.get(endpoint);
        // keys not found, request from network
        else return this.requestKeys(endpoint); 
    }


    // saves public verify and encrypt keys for an endpoint locally
    static async bindKeys(endpoint:Datex.Addresses.Endpoint, verify_key:ArrayBuffer, enc_key:ArrayBuffer):Promise<boolean> {
        if (!(endpoint instanceof Datex.Addresses.Endpoint)) throw new ValueError("Invalid endpoint");
        if (verify_key && !(verify_key instanceof ArrayBuffer)) throw new ValueError("Invalid verify key");
        if (enc_key && !(enc_key instanceof ArrayBuffer)) throw new ValueError("Invalid encryption key");

        if (this.public_keys.has(endpoint)) return false; // keys already exist

        try {            
            this.public_keys.set(endpoint, [
                verify_key ? await Crypto.importVerifyKey(verify_key) : null,
                enc_key ? await Crypto.importEncKey(enc_key): null
            ])
            this.public_keys_exported.set(endpoint, [verify_key, enc_key]);
            await Datex.Storage.setItem("keys_"+endpoint, [verify_key, enc_key]);
            return true;
        } catch(e) {
            logger.error(e);
            throw new Error("Could not register keys for endpoint " + endpoint + " (invalid keys or no permisssion)");
        }
    }

    static #waiting_key_requests = new Map<Datex.Addresses.Endpoint, Promise<[CryptoKey, CryptoKey]>>();
    
    // loads keys from network or cache
    static async requestKeys(endpoint:Datex.Addresses.Endpoint):Promise<[CryptoKey, CryptoKey]> {
        
        // already requesting/loading keys for this endpoint
        if (this.#waiting_key_requests.has(endpoint)) return this.#waiting_key_requests.get(endpoint);

        let keyPromise:Promise<[CryptoKey, CryptoKey]>;
        this.#waiting_key_requests.set(endpoint, keyPromise = new Promise(async (resolve, reject)=>{

            let exported_keys:[ArrayBuffer, ArrayBuffer];

            // first check cache:
            if (exported_keys=await Datex.Storage.getItem("keys_"+endpoint)) {
                logger.info("getting keys from cache for " + endpoint);
            }
            if (!exported_keys) {
                logger.info("requesting keys for " + endpoint);
                exported_keys = await NetworkUtils.get_keys(endpoint); // fetch keys from network; TODO blockchain
                if (exported_keys) await Datex.Storage.setItem("keys_"+endpoint, exported_keys);
                else {
                    reject(new Error("could not get keys from network"));
                    this.#waiting_key_requests.delete(endpoint); // remove from key promises
                    return;
                }
            }
    
            // convert to CryptoKeys
            try {
                let keys:[CryptoKey, CryptoKey] = [await this.importVerifyKey(exported_keys[0])||null, await this.importEncKey(exported_keys[1])||null];
                this.public_keys.set(endpoint, keys);
                resolve(keys);
                this.#waiting_key_requests.delete(endpoint); // remove from key promises
                return;
            }
            catch (e) {
                reject(new Error("Error importing keys"));
                await Datex.Storage.removeItem("keys_"+endpoint);
                this.#waiting_key_requests.delete(endpoint); // remove from key promises
                return;
            }

        }));

        return keyPromise;
    }


    // set own public and private keys, returns the exported base64 keys
    static async loadOwnKeys(verify_key:ArrayBuffer|CryptoKey, sign_key:ArrayBuffer|CryptoKey, enc_key:ArrayBuffer|CryptoKey, dec_key:ArrayBuffer|CryptoKey) {
        
        // export/load keys

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

        // save in local endpoint key storage
        this.saveOwnPublicKeysInEndpointKeyMap();
        this.available = true; // encryption / signing now possible

        return [this.rsa_verify_key_exported, this.rsa_sign_key_exported, this.rsa_enc_key_exported, this.rsa_dec_key_exported]
    }

    private static saveOwnPublicKeysInEndpointKeyMap () {
        // save in local endpoint key storage
        if (!this.public_keys.has(Runtime.endpoint)) this.public_keys.set(Runtime.endpoint, [null,null]);
        this.public_keys.get(Runtime.endpoint)[0] = this.rsa_verify_key;
        this.public_keys.get(Runtime.endpoint)[1] = this.rsa_enc_key;
    }

    // returns current public verify + encrypt keys
    static getOwnPublicKeysExported():[ArrayBuffer, ArrayBuffer] {
        return [this.rsa_verify_key_exported, this.rsa_enc_key_exported]
    }
    static getOwnPublicKeys():[CryptoKey, CryptoKey] {
        return [this.rsa_verify_key, this.rsa_enc_key]
    }


    // returns the current private sign and decrypt keys
    static getOwnPrivateKeysExported():[ArrayBuffer, ArrayBuffer] {
        return [this.rsa_sign_key_exported, this.rsa_dec_key_exported]
    }
    static getOwnPrivateKeys():[CryptoKey, CryptoKey] {
        return [this.rsa_sign_key, this.rsa_dec_key]
    }


    // returns current exported public sign + encrypt key for an endpoint, if found
    static async getEndpointPublicKeys(endpoint:Datex.Addresses.Endpoint):Promise<[ArrayBuffer, ArrayBuffer]> {
        let keys:[CryptoKey, CryptoKey];
        if (this.public_keys.has(endpoint)) keys = this.public_keys.get(endpoint);
        else throw new Error("No public keys available for this endpoint");
        return [
            keys[0] ? await this.exportPublicKey(keys[0]) : null,
            keys[1] ? await this.exportPublicKey(keys[1]) : null
        ];
    }

    // return already exported keys
    static async getEndpointPublicKeys2(endpoint:Datex.Addresses.Endpoint):Promise<[ArrayBuffer, ArrayBuffer]> {
        if (this.public_keys_exported.has(endpoint)) return this.public_keys_exported.get(endpoint);
        else throw new Error("No public keys available for this endpoint");
    }


    // generate new sign + encryption (public + private) keys, returns base64 verify, sign, enc, dec keys
    static async createOwnKeys(): Promise<Crypto.ExportedKeySet> { 
        // create new encrpytion key pair
        let enc_key_pair = <CryptoKeyPair> await crypto.subtle.generateKey(
            this.enc_key_options,
            true,
            ["encrypt", "decrypt"]
        );

        // create new sign key pair
        let sign_key_pair = <CryptoKeyPair>await crypto.subtle.generateKey(
            this.sign_key_generator,
            true,
            ["sign", "verify"]
        );
    
        this.rsa_dec_key = enc_key_pair.privateKey
        this.rsa_enc_key = enc_key_pair.publicKey
        this.rsa_sign_key = sign_key_pair.privateKey
        this.rsa_verify_key = sign_key_pair.publicKey

        this.rsa_enc_key_exported = await this.exportPublicKey(this.rsa_enc_key);
        this.rsa_dec_key_exported = await this.exportPrivateKey(this.rsa_dec_key);
        this.rsa_verify_key_exported = await this.exportPublicKey(this.rsa_verify_key);
        this.rsa_sign_key_exported = await this.exportPrivateKey(this.rsa_sign_key);

        // save in local endpoint key storage
        this.saveOwnPublicKeysInEndpointKeyMap();
        this.available = true; // encryption / signing now possible

        return {
            sign: [this.rsa_verify_key_exported, this.rsa_sign_key_exported],
            encrypt: [this.rsa_enc_key_exported, this.rsa_dec_key_exported]
        }
    }

    // export an public key to base64
    public static async exportPublicKeyBase64(key: CryptoKey): Promise<string> {
        return btoa(globalThis.String.fromCharCode.apply(null, new Uint8Array(await this.exportPublicKey(key))));
    }
    // export a private key to base64
    public static async exportPrivateKeyBase64(key: CryptoKey): Promise<string> {
        return btoa(globalThis.String.fromCharCode.apply(null, new Uint8Array(await this.exportPrivateKey(key))));
    }

    // export an public key
    public static async exportPublicKey(key: CryptoKey): Promise<ArrayBuffer> {
        return crypto.subtle.exportKey("spki", key);
    }
    // export a private key
    public static async exportPrivateKey(key: CryptoKey): Promise<ArrayBuffer> {
        return crypto.subtle.exportKey("pkcs8", key);
    }

    // import private keys: sign, dec
    public static async importSignKey(key: string|ArrayBuffer): Promise<CryptoKey> {
        let key_buffer = key instanceof ArrayBuffer ? new Uint8Array(key) : Uint8Array.from(atob(key), c => c.charCodeAt(0)).buffer;
        return await crypto.subtle.importKey("pkcs8", key_buffer, this.sign_key_generator, true, ["sign"])
    }
    public static async importDecKey(key: string|ArrayBuffer): Promise<CryptoKey> {
        let key_buffer = key instanceof ArrayBuffer ? new Uint8Array(key) : Uint8Array.from(atob(key), c => c.charCodeAt(0)).buffer;
        return await crypto.subtle.importKey("pkcs8", key_buffer, this.enc_key_import, true, ["decrypt"])
    }
    
    // import public keys: enc, verify
    public static async importVerifyKey(key: string|ArrayBuffer): Promise<CryptoKey> {
        let key_buffer = key instanceof ArrayBuffer ? new Uint8Array(key) : Uint8Array.from(atob(key), c => c.charCodeAt(0)).buffer;
        return await crypto.subtle.importKey("spki", key_buffer, this.sign_key_generator, true, ["verify"])
    }
    public static async importEncKey(key: string|ArrayBuffer): Promise<CryptoKey> {
        let key_buffer = key instanceof ArrayBuffer ? new Uint8Array(key) : Uint8Array.from(atob(key), c => c.charCodeAt(0));
        return await crypto.subtle.importKey("spki", key_buffer, this.enc_key_import, true, ["encrypt"])
    }

}



// NetworkUtils: get public keys for endpoints + register push notifiction channels (TODO move)
export abstract class NetworkUtils {
    /** get public keys for endpoint [unsigned dxb] */
    static _get_keys:globalThis.Function
    static get_keys (endpoint:Datex.Addresses.Endpoint):Promise<[ArrayBuffer, ArrayBuffer]> {  
        if (!this._get_keys) this._get_keys = getProxyFunction("get_keys", {scope_name:"network", sign:false, filter:Runtime.main_node});
        return this._get_keys(endpoint)
    }

    /** add push notification channel connection data */
    static _add_push_channel:globalThis.Function
    static add_push_channel (channel:string, data:object):Promise<any> {
        if (!this._add_push_channel) this._add_push_channel = getProxyFunction("add_push_channel", {scope_name:"network", sign:false, filter:Runtime.main_node});
        return this._add_push_channel(channel, data)
    }
}


/***** Enums */


/***** Type definitions */

export type primitive = number|bigint|string|boolean|null|Unit|Datex.Addresses.Target|ArrayBuffer|Type;
export type fundamental = primitive|{[key:string]:any}|Array<any>|Tuple;

export type CNF = Datex.Addresses.AndSet<Set<Datex.Addresses.Target|Datex.Addresses.Not<Datex.Addresses.Target>>|Datex.Addresses.Target|Datex.Addresses.Not<Datex.Addresses.Target>>;

export type filter = Set<filter>|Datex.Addresses.Target|Datex.Addresses.Filter|Datex.Addresses.Not|endpoint_name|Array<filter>|Tuple<filter>;


type datex_sub_scope = {    
    result?: any, // 'global' sub scope variable (-> return value), corresponds to __scope_global internal variable

    is_outer_scope?:boolean // is outer scope?

    type_casts?: Type[],

    root: object, // root object containing default static scopes and variables
    ctx_intern?: any, // use as __this internal variable pointing to a parent object for <Functions>

    last_insert_value?: any, // last inserted value (+)
    active_object?: object|any[],
    auto_obj_index?: number, // increment index for auto object indexation (0,1,2,3,...)
    active_object_new?: boolean, // is true at the beginning when no previous element inside the object exists
    waiting_key?: number|bigint|string, // key of an object waiting to be assigned, null if currently in array
    waiting_vars?: Set<[name:string|number,action?:BinaryCode]>, // variable waiting for a value
    waiting_ptrs?: Set<[ptr:Pointer,action?:BinaryCode]>, // new Pointer waiting for a value
    waiting_internal_vars?: Set<[name:string|number,action?:BinaryCode]>, // internal variable waiting for a value

    waiting_ext_type?: Type, // waiting for type parameters 
    waiting_labels?: Set<string|number>,

    waiting_for_child?: 0|1|2, // next value is key for active value, 1 = normal get, 2 = ref get
    waiting_for_child_action?: BinaryCode, // next vaule is key for active value, treat as assignment

    return?:boolean, // return current #scope_result after subscope closed

    waiting_range?: [any?, any?], // range (x..y)

    waiting_collapse?: boolean, // ... operator
    inner_spread?: boolean, // ... operator, inside element, pass to parent subscope

    compare_type?: BinaryCode, // for comparisons (==, <=, ~=, ...)

    about?: boolean, // 'about' command (docs)
    count?: boolean, // get count for next value
    request?: boolean, // resolve url (next value)
    template?: boolean|Type, // set type template
    observe?: boolean|Value, // observe value
    scope_block_for?: BinaryCode, // type of scope block
    scope_block_vars?: any[], // #0, #1, ... for scope block
    wait_await?: boolean, // await
    wait_iterator?: boolean, // iterator x
    wait_hold?: boolean, // wait_hold
    wait_extends?:boolean, // x extends y
    wait_implements?:boolean, // x implements y
    wait_matches?:boolean, // x matches y
    wait_freeze?:boolean, // freeze x
    wait_seal?:boolean, // seal x
    has_prop?: boolean, // x has y
    wait_dynamic_key?: boolean, // (x):y

    waiting_for_action?: [type:BinaryCode, parent:any, key:any][], // path waiting for a value
    create_pointer?: boolean, // proxify next value to pointer
    delete_pointer?: boolean, // delete next pointer
    sync?: boolean, // sync next pointer to active value
    stop_sync?: boolean, // stop sync next pointer to active value
    unsubscribe?: boolean, // unsubscribe from next pointer
    get_value?: boolean, // get next pointer value
    get_type?: boolean, // get type of value
    get_origin?: boolean, // get next pointer origin
    get_subscribers?: boolean, // get next pointer subscribers

    waiting_for_key_perm?: boolean, // waiting for key permission followed by key
    key_perm?: any, // permission value for key

    active_value?:any // last assigned value
    
    auto_exit?:1|2, // auto exit from this scope at next possibility (end code), needed for child paths, 1 initializes auto_exit, is 2 after next value

    stream_consumer?: StreamConsumer, // active stream reader

    jmp?: number, // jump to index if next value is true
    jmp_true?: boolean, // is jtr or jfa

    operator?: BinaryCode // current active operator (+, ...)
    negate_operator?: boolean // has active ~ operator
} 

export type dxb_header = {
    sid?:number, 
    return_index?: number,
    inc?:number,
    type?:DatexProtocolDataType,
    version?:number,
    sender?:Datex.Addresses.Endpoint,
    timestamp?:Date,
    signed?:boolean,
    executable?:boolean,
    encrypted?:boolean,
    end_of_scope?:boolean,
    routing?: routing_info,
    redirect?: boolean
}
export type routing_info = {
    sender?: Datex.Addresses.Endpoint,
    ttl?: number,
    prio?: number,
    receivers?: Datex.Addresses.Filter,
    flood?: boolean
}


export type datex_variables_scope = { [key: string]: any } & { // all available variables in the scope, including defaults
    __current: Datex.Addresses.Target,
    __sender: Datex.Addresses.Target,
    __timestamp: Date, 
    __signed: boolean,
    __encrypted: boolean,
}

export type datex_meta = {encrypted?:boolean, signed?:boolean, sender?:Datex.Addresses.Endpoint, timestamp?:Date, type?:DatexProtocolDataType};


export type datex_scope = {
    sid: number,
    header: dxb_header,
    sender: Datex.Addresses.Endpoint, // sender of the scope
    origin: Datex.Addresses.Endpoint, // origin to use for pointers / casting (default is sender)

    current_index: number,
    start_index: number, // keep track of index to jump back to
    index_offset: number, // current_index + index_offset = actual index, everything left of the index_offset is no longer cached in the buffer
    cache_previous?: boolean // if set to true, the current block will remain in the dxb buffer for the next run() iteration

    cache_after_index?: number, // cache all blocks if they are after this index

    root: object, // root object containing default static scopes and variables
    internal_vars:  { [key: string]: any },

    context?: any, // parent object (context), e.g. in Function
    it?: any, // referenced value (iterator, item, it)

    execution_permission: boolean, // can execute functions
    impersonation_permission: boolean, // can do everything the current endpoint can do: make requests to other endpoints

    sync?:boolean, // anywhere waiting for subscribe?
    unsubscribe?:boolean, // anywhere waiting for unsubscribe?

    sub_scopes: datex_sub_scope[],
    inner_scope: datex_sub_scope, // current sub scope

    result?: any // result value (__result internal variable)

    meta: datex_meta,
    remote: {insert?:object, sign?:boolean, encrypt?:boolean, eos?:boolean, type?:DatexProtocolDataType}, // outgoing remote configuration

    buffer_views: {data_view?:DataView, uint8?:Uint8Array, buffer?:ArrayBuffer}

    closed?: boolean // is scope completely closed?
}

type Class = (new (...args: any[]) => any); // type for a JS class

type compile_info = [datex:string|PrecompiledDXB, data?:any[], options?:compiler_options, add_header?:boolean, is_child_scope_block?:boolean, insert_parent_scope_vars_default?:0|1|2|3, save_precompiled?:PrecompiledDXB, max_block_size?:number];

/** create a custom DATEX JS Interface for a type with handlers 
 *  
 * - serialize efficiently with the serialize function and de-serialize in the cast function
 * - do not use @sync classes in combination with an additional js_interface_configuration!; 
 *   @sync classes are handled like <std:Object> and proxified per default
*/
type js_interface_configuration = {
    __type?: Type,
    // either type or generate_type is needed
    get_type?: (value:any)=>Type, // get a specific <Type> for a value (with variation/parameters)
    cast?: (value:any, type:Type, context?:any, origin?:Datex.Addresses.Endpoint)=>any,     // a function that casts a given value to a value of the type of the pseudo cast, if possible
    serialize?: (value:any)=>fundamental, // a function that creates a fundamental value from a given pseudo class value
                                                // if not provided, assume the value is already a DATEX fundamental value
    empty_generator?: ()=>any // return an default empty value if the type is casted from <Void>

    class?: Class, // the corresponding JS class or a prototype
    prototype?: object, // the inherited JS prototype
    detect_class?: (value:any)=>boolean, // a function that returns whether the value has the type of the pseudo class

    is_normal_object?: boolean, // if true, handle properties like object properties (no custom handling), ignore add_property, set_property, etc.

    property_action?: (type:BinaryCode, parent:any, value:any)=>void,
    set_property?: (parent:any, key:any, value:any)=>void,
    get_property?: (parent:any, key:any)=>any,
    has_property?: (parent:any, key:any)=>boolean,
    delete_property?: (parent:any, key:any)=>void,
    clear?: (parent:any)=>void,
    apply_value?: (parent:any, args:any[])=>Promise<any>,

    property_action_silently?: (type:BinaryCode, parent:any, value:any, pointer:Pointer)=>void,
    set_property_silently?: (parent:any, key:any, value:any, pointer:Pointer)=>void,
    get_property_silently?: (parent:any, key:any, pointer:Pointer)=>any,
    delete_property_silently?: (parent:any, key:any, pointer:Pointer)=>void,
    clear_silently?: (parent:any, pointer:Pointer)=>void,

    keys?: (parent:any)=>Promise<Iterable<any>>|Iterable<any>, // get keys for value
    values?: (parent:any)=>Promise<Iterable<any>>|Iterable<any>, // get values

    count?: (parent:any)=>Promise<number|bigint>|number|bigint // return size of parent (number of child elements)

    proxify_children?: boolean // set to true if children should be proxified per default
    
    visible_children?: Set<any>

    create_proxy?: (value:any, pointer:Pointer)=>any, // return a Proxy for an object (can also be the same, modified object)
}


const iterateMapReverse = function (this:Map<any,any>) {
    const values = Array.from(this.entries());
    // start at the end of the array
    let index = values.length;
    return <IterableIterator<any>>{
      next: function () {
        return {
          done: index === 0,
          value: values[--index]
        };
      }
    }
};
const iterateSetReverse = function (this:Set<any>) {
    const values = Array.from(this.values());
    // start at the end of the array
    let index = values.length;
    return <IterableIterator<any>>{
      next: function () {
        return {
          done: index === 0,
          value: values[--index]
        };
      }
    }
};


/** handles (custom) type interfaces with custom JS methods */
class JSInterface {

    // list of all pseudo class configurations
    static configurations_by_type: Map<Type, js_interface_configuration> = new Map();
    // JS class -> configuration
    static configurations_by_class: Map<Class, js_interface_configuration> = new Map();
    static configurations_by_prototype: Map<object, js_interface_configuration> = new Map();

    static configurations_loaders_by_namespace:Map<string,(type:Type)=>Promise<js_interface_configuration|boolean>> = new Map();


    /** fetch type configuration for a datex type when required, returns the corresponding JS class */
    public static async loadTypeConfiguration(type:Type):Promise<boolean> {
        if (JSInterface.configurations_by_type.has(type)) return true; // already exists
        else {
            if (JSInterface.configurations_loaders_by_namespace.has(type.namespace)) {
                const config = await JSInterface.configurations_loaders_by_namespace.get(type.namespace)(type);

                if (typeof config == "boolean") return config;
                else if (config) type.setJSInterface(config);
                else return false;
                return true;
            }
            else return false;
        }
    }
    
    /** add type namespace handler */
    public static typeConfigurationLoader(namespace:string|string[], loader: (type:Type)=>Promise<js_interface_configuration|boolean>) {
        if (namespace instanceof Array) {
            for (let n of namespace) JSInterface.configurations_loaders_by_namespace.set(n, loader);
        }
        else JSInterface.configurations_loaders_by_namespace.set(namespace, loader);
    }

    public static async getClassForType(type:Type):Promise<Class> {
        // first make sure the configuration is loaded
        if (!JSInterface.loadTypeConfiguration(type)) throw new TypeError("Could not load type " + type);
        else return JSInterface.configurations_by_type.get(type).class;
    }


    // update a existing pseudo class configuration property or create and update a new configuration
    public static updateJSInterfaceConfiguration<T extends keyof js_interface_configuration>(type:Type, key:T, value:js_interface_configuration[T]){
        // make sure a configuration for the type exists
        let config = JSInterface.configurations_by_type.get(type);

        // create new config
        if (!config) {
            config = {};
            JSInterface.configurations_by_type.set(type, config);
        }
        // update config
        else {
            config[key] = value;
        }

        JSInterface.handleConfigUpdate(type, config);
    }



    public static handleConfigUpdate(type:Type, config:js_interface_configuration){

        if (!type) throw new Error ("A type is required for a type configuration")
        if (!config.class && !config.prototype) throw new Error ("The  'class' or 'prototype' property is required for a type configuration")

        config.__type = type; // save type to config for faster type reference

        JSInterface.configurations_by_type.set(type, config);
        if (config.prototype)  JSInterface.configurations_by_prototype.set(config.prototype, config);
        if (config.class) JSInterface.configurations_by_class.set(config.class, config);

    }

    // apply get_property, set_property, ... if parent matches a pseudo type
    private static applyMethod(type:Type, parent:any, method_name:string, args:any[]):any {
        const config = this.configurations_by_type.get(type);
        if (!config) return NOT_EXISTING;
        if (config.is_normal_object && !(method_name in config)) return NOT_EXISTING; // act like this pseudo class does not exist, handle default (if method is not implemented)
        if (config.detect_class instanceof globalThis.Function && !(<globalThis.Function>config.detect_class)(parent)) return NOT_EXISTING; // detect class invalid
        if (config[method_name] instanceof globalThis.Function) return config[method_name](...args);
        return INVALID;
    }


    // return if a value has a matching pseudo class configuration
    static hasPseudoClass(value:any):boolean {
        for (let [_class, config] of this.configurations_by_class) {
            if (value instanceof _class) { // is class instance
                if (config.detect_class instanceof globalThis.Function && !(<globalThis.Function>config.detect_class)(value)) return false; // detect class invalid
                return true;
            }
        }

        for (let [proto, config] of this.configurations_by_prototype) {
            if (proto.isPrototypeOf(value)) { // has prototype
                if (config.detect_class instanceof globalThis.Function && !(<globalThis.Function>config.detect_class)(value)) return false; // detect class invalid
                return true;
            }
        }
        return false;
    }

    // sets the property of a value
    static handleSetProperty(parent:any, key:any, value:any, type:Type = Type.getValueDatexType(parent)):void|(typeof INVALID| typeof NOT_EXISTING) {
        return this.applyMethod(type, parent, "set_property", [parent, key, value])
    }

    // count value content
    static handleCount(parent:any, type:Type = Type.getValueDatexType(parent)):number|bigint|(typeof INVALID| typeof NOT_EXISTING) {
        return this.applyMethod(type, parent, "count", [parent]);
    }

    // get the property of a value
    static handleHasProperty( parent:any, property:any, type:Type = Type.getValueDatexType(parent)):boolean|(typeof INVALID| typeof NOT_EXISTING) {
        return this.applyMethod(type, parent, "has_property", [parent, property]);
    }
    

    // get the property of a value
    static handleGetProperty( parent:any, key:any, type:Type = Type.getValueDatexType(parent)):any|(typeof INVALID| typeof NOT_EXISTING) {
        return this.applyMethod(type, parent, "get_property", [parent, key]);
    }

    // property action (+=, -=, ...)
    static handlePropertyAction(action_type:BinaryCode, parent:any, value:any, type:Type = Type.getValueDatexType(parent)):void|(typeof INVALID| typeof NOT_EXISTING) {
        return this.applyMethod(type, parent, "property_action", [action_type, parent, value]);
    }

    // delete a value (= void)
    static handleDeleteProperty(parent:any, value:any, type:Type = Type.getValueDatexType(parent)):void|(typeof INVALID| typeof NOT_EXISTING) {
        return this.applyMethod(type, parent, "delete_property", [parent, value]);
    }
    
    // get iterable for all values
    static handleGetAllValues(parent:any, type:Type = Type.getValueDatexType(parent)):Iterable<any>|(typeof INVALID| typeof NOT_EXISTING) {
        return this.applyMethod(type, parent, "values", [parent]);
    }

    // clear value (remove all children)
    static handleClear(parent:any, type:Type = Type.getValueDatexType(parent)):void|(typeof INVALID| typeof NOT_EXISTING) {
        return this.applyMethod(type, parent, "clear", [parent]);
    }

    // get keys for a value
    static handleKeys(parent:any, type:Type = Type.getValueDatexType(parent)):Iterable<any>|(typeof INVALID| typeof NOT_EXISTING) {
        return this.applyMethod(type, parent, "keys", [parent]);
    }
    // convert a value to a serializable (fundamental) value
    static serializeValue(value:any, type:Type = Type.getValueDatexType(value)):fundamental|(typeof INVALID| typeof NOT_EXISTING) {
        return this.applyMethod(type, value, "serialize", [value]);
    }

    // creates a proxy object for a given value
    static createProxy(value:any, pointer:Pointer, type:Type = Type.getValueDatexType(value)):any|(typeof INVALID| typeof NOT_EXISTING) {
        return this.applyMethod(type, value, "create_proxy", [value, pointer]);
    }



    // silent property changes (don't trigger DATEX updates)

    // sets the property of a value
    static handleSetPropertySilently(parent:any, key:any, value:any, pointer:Pointer, type:Type = Type.getValueDatexType(parent)):void|(typeof INVALID| typeof NOT_EXISTING) {
        return this.applyMethod(type, parent, "set_property_silently", [parent, key, value, pointer])
    }

    // add a value to another value (-=)
    static handlePropertyActionSilently(action_type: BinaryCode, parent:any, value:any, pointer:Pointer, type:Type = Type.getValueDatexType(parent)):void|(typeof INVALID| typeof NOT_EXISTING) {
        return this.applyMethod(type, parent, "property_action_silently", [action_type, parent, value, pointer]);
    }

    // delete a value (= void)
    static handleDeletePropertySilently(parent:any, key:any, pointer:Pointer, type:Type = Type.getValueDatexType(parent)):void|(typeof INVALID| typeof NOT_EXISTING) {
        return this.applyMethod(type, parent, "delete_property_silently", [parent, key, pointer]);
    }
    
    // clear value (remove all children)
    static handleClearSilently(parent:any, pointer:Pointer, type:Type = Type.getValueDatexType(parent)):void|(typeof INVALID| typeof NOT_EXISTING) {
        return this.applyMethod(type, parent, "clear_silently", [parent, pointer]);
    }



    // value -> <Type>
    static getValueDatexType(value:any):Type {

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

        // try afterwards (less likely to happen)
        for (let [_class, config] of this.configurations_by_class) {
            if (config.detect_class instanceof globalThis.Function && (<globalThis.Function>config.detect_class)(value) ) {
                return config.get_type ? config.get_type(value) : config.__type;
            }
        }
    }

    // js class -> <Type>
    static getClassDatexType(class_constructor:Class):Type {
        let config:js_interface_configuration;

        // get directly from class
        if (config = this.configurations_by_class.get(class_constructor)) return config.__type;
        // get from prototype of class
        if (config = this.configurations_by_class.get(Object.getPrototypeOf(class_constructor))) return config.__type;

        // check full prototype chain (should not happen normally, unnessary to loop through every time)
        // for (let [_class, config] of this.configurations_by_class) {
        //     console.log(_class)
        //     if (class_constructor == _class || _class.isPrototypeOf(class_constructor)) {
        //         return config.__type ?? undefined;
        //     }
        // }
    }
    

    // // cast a value to specific <Type>
    // static castValue(type:Type, value:any, context?:any, origin:Datex.Addresses.Endpoint = Runtime.endpoint, root_type?:Type): any{

    //     console.log("cast " + type);
    //     const config = root_type ? this.configurations_by_type.get(root_type) : this.configurations_by_type.get(type);
        
    //     if (config){
    //         // generate default value
    //         if (value === VOID && config.empty_generator instanceof globalThis.Function) return config.empty_generator();
    //         else if (config.cast) {
    //             return config.cast(value, type, context, origin);
    //         }
    //         // special cast: prototype
    //         else if (typeof value == "object" && config.prototype) {
    //             const object = Object.create(config.prototype)
    //             Object.assign(object, value);
    //             return object;
    //         }
    //     }
    //     // try cast with variation and parameters
    //     else if (!root_type && (root_type = type.root_type) != type) {
    //         return this.castValue(type, value, context, origin, root_type);
    //     }
    //     else return UNKNOWN_TYPE;
    // }

}
// add reverse map/set iterators to cast values in correct order
JSInterface.configurations_by_class[Symbol.iterator] = iterateMapReverse;
JSInterface.configurations_by_type[Symbol.iterator] = iterateSetReverse;
JSInterface.configurations_by_prototype[Symbol.iterator] = iterateMapReverse;


// exposed DatexCustomPseudoClasses methods
export const typeConfigurationLoader = JSInterface.typeConfigurationLoader;
export const updateJSInterfaceConfiguration = JSInterface.updateJSInterfaceConfiguration;

// get a JS class corresponding to a DatexType (try loading the class configuration dynamically if possible)
export function DX_CLASS(type:Type|string){
    return JSInterface.getClassForType(type instanceof Type ? type :  Type.get(type));
}




// handles std input and output
// handles observers for all incoming/outgoing DATEX
export class IOHandler {

    // redirect std/print
    private static std_out:(data:any[])=>void|Promise<void> = async (data:any[])=>{
        for (let d=0; d<data.length;d++) {
            data[d] = await Runtime.castValue(Type.std.String, data[d]);
        }
        client_type == "browser" ? console.log(...data) : console.log("\n std/print > ", ...data, "\n")
    }
    // redirect std/printf
    private static std_outf = (data:any[])=>{
        client_type == "browser" ? console.log(...data) : console.log("\n std/printf > ", ...data.map(v=>Runtime.valueToDatexString(v)), "\n")
    }
    // redirect to std/read
    private static std_in:(data:any[])=>any = ()=>{throw new RuntimeError("No input available")};
    

    // std/print, std/printf, std/read redirects for specific targets
    private static e_std_outs = new Map<Datex.Addresses.Target, globalThis.Function>();
    private static e_std_outfs = new Map<Datex.Addresses.Target, globalThis.Function>();;
    private static e_std_ins = new Map<Datex.Addresses.Target, globalThis.Function>();

    // listeners for all incoming DATEX requests
    private static datex_in_handler: (header:dxb_header, dxb:ArrayBuffer)=>void/* = (header, dxb)=>{
        console.debug('from ' + header.sender, DatexRuntime.decompile(dxb));
    }*/
    private static datex_in_handlers_per_endpoint = new Map<Datex.Addresses.Target, (header:dxb_header,dxb:ArrayBuffer)=>void>();

    // listeners for all outgoing DATEX requests
    private static datex_out_handler: (header:dxb_header, dxb:ArrayBuffer)=>void
    private static datex_out_handlers_per_endpoint = new Map<Datex.Addresses.Endpoint, (header:dxb_header,dxb:ArrayBuffer)=>void>();
    
    // listen for finished scopes with return value: sid -> callback
    private static scope_result_listeners = new Map<number, (scope:datex_scope)=>void>();

    // set std redirects
    static setStdOut(output_callback:(data:any[])=>void|Promise<void>, endpoint?:Datex.Addresses.Target){
        if (endpoint) this.e_std_outs.set(endpoint, output_callback);
        else this.std_out = output_callback;
    }
    static setStdOutF(output_callback:(data:any[])=>void|Promise<void>, endpoint?:Datex.Addresses.Target){
        if (endpoint) this.e_std_outfs.set(endpoint, output_callback);
        else this.std_outf = output_callback;
    }
    static setStdIn(output_callback:(data:any[])=>any, endpoint?:Datex.Addresses.Target){
        if (endpoint) this.e_std_ins.set(endpoint, output_callback);
        else this.std_in = output_callback;
    }

    // set DATEX listeners
    static onDatexReceived(handler:(header:dxb_header,dxb:ArrayBuffer)=>void, endpoint?:Datex.Addresses.Target){
        if (endpoint) this.datex_in_handlers_per_endpoint.set(endpoint, handler);
        else this.datex_in_handler = handler;
    }
    static onDatexSent(handler:(header:dxb_header,dxb:ArrayBuffer)=>void, endpoint?:Datex.Addresses.Endpoint){
        if (endpoint) this.datex_out_handlers_per_endpoint.set(endpoint, handler);  
        else this.datex_out_handler = handler;
    } 

    // add scope result listener
    static addScopeResultListener(sid:number, output_callback:(data:datex_scope)=>void){
        this.scope_result_listeners.set(sid, output_callback);
    }
    

    // redirected from std/print etc.
    public static async stdOutF(params:any[], endpoint:Datex.Addresses.Target){
        if(this.e_std_outfs.has(endpoint)) await this.e_std_outfs.get(endpoint)(params);
        else if (this.std_outf) await this.std_outf(params);
    }
    public static stdOut(params:any[], endpoint:Datex.Addresses.Target){
        if(this.e_std_outs.has(endpoint)) this.e_std_outs.get(endpoint)(params);
        else if (this.std_out) this.std_out(params);
    }
    public static async stdIn(msg_start:any, msg_end:any, endpoint:Datex.Addresses.Target){
        if(this.e_std_ins.has(endpoint)) return this.e_std_ins.get(endpoint)([msg_start, msg_end]);
        else return this.std_in([msg_start, msg_end]);
    }

    // called when scope received 
    static handleDatexReceived(scope:datex_scope, dxb:ArrayBuffer) {
        let endpoint = scope.sender;

        if (this.datex_in_handlers_per_endpoint.has(endpoint)) this.datex_in_handlers_per_endpoint.get(endpoint)(scope.header, dxb);
        if (this.datex_in_handler) this.datex_in_handler(scope.header, dxb);
    }

    // called when datex sent out
    static async handleDatexSent(dxb:ArrayBuffer, to:filter) {
        if (this.datex_out_handler || this.datex_out_handlers_per_endpoint.has(<Datex.Addresses.Endpoint>to)) {
            let header = <dxb_header> (await Runtime.parseHeader(dxb, null, true));

            if (this.datex_out_handler) this.datex_out_handler(header, dxb)
            if (this.datex_out_handlers_per_endpoint.has(<Datex.Addresses.Endpoint>to)) this.datex_out_handlers_per_endpoint.get(<Datex.Addresses.Endpoint>to)(header, dxb)
        }
    }
  
    // when scope execution finished succesfully
    static handleScopeFinished(sid:number, scope:datex_scope) {
        if (this.scope_result_listeners.has(sid)) {
            this.scope_result_listeners.get(sid)(scope);
            this.scope_result_listeners.delete(sid);
        }
    }
}




/**
 *  Classes corresponding to DATEX Pseudo Classes:
 */


/** <std:Markdown> */
export class Markdown {
    content:string
    constructor(content?:string) {
        this.content = content;
    }
    toString(){
        return this.content;
    }

    private static code_colorizer:globalThis.Function
    static setCodeColorizer(code_colorizer:globalThis.Function){
        this.code_colorizer = code_colorizer;
    }

    // return formatted HTML for markdown
    async getHTML(){
        // @ts-ignore
        if (!globalThis['$']) {
            throw new Error("JQuery not available");
        }
        let code = $("<code style='padding-left:10px;padding-right:10px;margin-top:10px;margin-bottom:10px'>" + marked(this.content) + "</code>");
        
        // higlight code
        if (Markdown.code_colorizer) {
            for (let c of code.find("code")) {
                let jc = $(c);
                let lang = jc.attr("class")?.replace("language-", "") || "datex";
                if (lang) jc.html(await Markdown.code_colorizer(jc.text(), lang));
            }
        }

        return code;
    }
}



export const WITH = 'w';


/** <std:Scope> */
export class Scope {

    // injected variable names ^= arguments
    internal_vars:any[] = []
    // compiled dxb
    compiled: ArrayBuffer;

    // object containing all variables from a parent scope
    parent_variables:any;

    // decompiled dxb (unformatted and formatted)
    private _decompiled = "### DATEX ###";
    private _decompiled_f = "### DATEX ###";

    constructor(internal_vars:any[], compiled:ArrayBuffer, generate_decompiled=true) {
        this.internal_vars = internal_vars;
        this.compiled = compiled;
        // decompile
        if (generate_decompiled) {
            this._decompiled_f = Runtime.decompile(this.compiled, false, true, false, false);
            this._decompiled   = Runtime.decompile(this.compiled, false, false, true, false);
        }
    }

    // run the dxb with arguments, executed by a specific endpoint
    public async execute(variables:{[name:string]:any}, executed_by:Datex.Addresses.Endpoint, context?:any, it?:any):Promise<any> {
        
        // generate new header using executor scope header
        const header:dxb_header = {
            sender: executed_by,
            type: DatexProtocolDataType.LOCAL_REQ,
            executable: true,
            sid: DatexCompiler.generateSID()
        }

        // create scope
        const scope = Runtime.createNewInitialScope(header, variables, this.internal_vars, context, it);
        // update scope buffers
        Runtime.updateScope(scope, this.compiled, header)
        // execute scope
        return Runtime.simpleScopeExecution(scope)
    }

    get decompiled():string {
        return this._decompiled;
    }
    get decompiled_formatted():string {
        return this._decompiled_f;
    }


    bodyToString(formatted=false, parentheses=true, spaces = '  '){
        return (parentheses?'(':'') + (formatted&&parentheses ? "\n":"") + (formatted ? this.decompiled_formatted?.replace(/^/gm, spaces) : this.decompiled).replace(/ *$/,'') + (parentheses?')':'')
    }

    toString(formatted=false, spaces = '  '){
        return `scope ${this.bodyToString(formatted, true, spaces)}`;
    }
}


// for classes that can have a value applied to it (e.g. DatexFunction)
// <std:ValueConsumer>
export interface ValueConsumer {
    handleApply: (value:any, SCOPE: datex_scope)=>Promise<any>|any
}

// for reading binary streams or strings (e.g. WritableStream)
// <std:StreamConsumer>
export interface StreamConsumer<T=any> {
    write: (next:T, scope?:datex_scope)=>Promise<any>|any
    pipe: (in_stream:Stream<T>, scope?:datex_scope)=>Promise<any>|any
}


// <Stream> is stream sink and readable stream at the same time
export class Stream<T = ArrayBuffer> implements StreamConsumer<T> {


    controller: ReadableStreamDefaultController

    readable_stream: ReadableStream<T> 

    constructor(readable_stream?:ReadableStream<T>) {
        this.readable_stream = readable_stream ?? new ReadableStream({
            start: controller => this.controller = controller
        });
    }

    started_ptr_stream = false

    write(chunk: T, scope?: datex_scope) {

        // convert buffers
        if (chunk instanceof TypedArray) chunk = (<any>chunk).buffer;

        if (!this.started_ptr_stream && !scope) {  // no scope -> assume called from JS, not DATEX
            this.started_ptr_stream = true;
            const ptr = Pointer.getByValue(this);
            if (ptr instanceof Pointer) {
                console.log("Start stream out for " + ptr);
                ptr.startStreamOut(); // stream to all subscribers or origin
            }
        }

        this.controller.enqueue(chunk);
    }

    async pipe(in_stream:Stream<T>, scope?: datex_scope) {
        const reader = in_stream.getReader();
        let next:ReadableStreamReadResult<T>;
        while (true) {
            next = await reader.read()
            if (next.done) break;
            this.write(next.value, scope);
        }
    }

    close() {
        this.controller.close()
    }

    getReader() {
        // split in two readable streams
        let streams = this.readable_stream.tee()
        this.readable_stream = streams[1];
        return streams[0].getReader()
    }

}


// root class for pointers and pointer properties, value changes can be observed
export abstract class Value<T = any> {

    #observers: Set<(value: any, key?:any, type?:Value.UPDATE_TYPE) => void>
    #observers_bound_objects: Map<object, Set<globalThis.Function>>

    #value: T;

    constructor(value?:CompatValue<T>) {
        value = Value.collapseValue(value)
        if (value!=undefined) this.value = value;
    }

    public get value(): T {
        return this.#value;
    }
    public set value(value: CompatValue<T>) {
        this.#value = Value.collapseValue(value);
        for (let o of this.#observers??[]) {
            o(this.#value, VOID, Value.UPDATE_TYPE.INIT);
        }
        for (let [object, observers] of this.#observers_bound_objects??[]) {
            for (let o of observers??[]) {
                o.call(object, this.#value, VOID, Value.UPDATE_TYPE.INIT);
            }
        }
    }

   
    // call handler when value changes
    // unobserve if handler returns false
    public static observe<K=any>(value: any, handler:(value:any, key?:K, type?:Value.UPDATE_TYPE)=>void, bound_object?:object, key?:K):void {
        let pointer = Pointer.pointerifyValue(value);
        if (pointer instanceof Pointer) pointer.observe(handler, bound_object, key);
        else if (pointer instanceof Value) pointer.observe(handler, bound_object);
        else throw new ValueError("Cannot observe this value because it has no pointer")
    }

    // call handler when value changes
    public static unobserve<K=any>(value: any, handler:(value:any, key?:K, type?:Value.UPDATE_TYPE)=>void, bound_object?:object, key?:K):void {
        let pointer = Pointer.pointerifyValue(value);
        if (pointer instanceof Pointer) pointer.unobserve(handler, bound_object, key);
        else if (pointer instanceof Value) pointer.unobserve(handler, bound_object);
        else throw new ValueError("Cannot unobserve this value because it has no pointer")
    }
    

    // callback on property value change
    // general handler structure is: (value:any, key?:any, type?:T)=>void 
    // when a specific property is updated, the key is set, and value is the property value
    // when the value itself is changed, the new value is available in 'value' and the key is void
    public observe(handler: (value: any, key?:any, type?:Value.UPDATE_TYPE) => void, bound_object?:object) {
        if (!handler) throw new ValueError("Missing observer handler")

        // bind object to observer
        if (bound_object) {
            if (!this.#observers_bound_objects) this.#observers_bound_objects = new Map();
            if (!this.#observers_bound_objects.has(bound_object)) this.#observers_bound_objects.set(bound_object, new Set());
            this.#observers_bound_objects.get(bound_object).add(handler)
        }

        // normal observer
        else {
            if (!this.#observers) this.#observers = new Set();
            this.#observers.add(handler);
        }
    }

    // stop observation
    public unobserve(handler:(value: any, key?:any, type?:Value.UPDATE_TYPE) => void) 
    // remove this observer for bound_object
    public unobserve(handler:(value: any, key?:any, type?:Value.UPDATE_TYPE) => void, bound_object:object) 
    // remove all observers for bound_object
    public unobserve(bound_object:object) 

    public unobserve(handler_or_bound_object:(value: any, key?:any, type?:Value.UPDATE_TYPE) => void|object, bound_object?:object) {

        let handler: globalThis.Function
        if (handler_or_bound_object instanceof globalThis.Function) handler = handler_or_bound_object;
        else bound_object = handler_or_bound_object;

        if (bound_object) {
            if (handler) {
                this.#observers_bound_objects.get(bound_object)?.delete(handler)
                if (this.#observers_bound_objects.get(bound_object).size == 0) this.#observers_bound_objects.delete(bound_object)
            }
            else this.#observers_bound_objects.delete(bound_object);
        }
        else this.#observers.delete(handler_or_bound_object);
    }

    toString(){
        return this.value?.toString()
    }

    toJSON(){
        return this.value;
    }

    valueOf(){
        return this.value;
    }

    // utility functions

    static collapseValue<V = any>(value:CompatValue<V>, collapse_pointer_properties = false, collapse_primitive_pointers = false):V {
        // don't collapse DatexPrimitivePointer per default
        if (value instanceof Value && (collapse_primitive_pointers || !(value instanceof PrimitivePointer)) && (collapse_pointer_properties || !(value instanceof PointerProperty))) return value.value
        else return <any>value;
    }

    // create a new DatexValue from a DatexCompatValue that is updated based on a transform function
    static transform<OUT, V = any>(value:CompatValue<V>, transform:(v:V)=>CompatValue<OUT>):Value<OUT> {
        const initialValue = transform(Value.collapseValue(value, true, true)); // transform current value
        if (initialValue === VOID) throw new ValueError("initial tranform value cannot be void");
        const dx_value = Pointer.create(undefined, initialValue);
        if (value instanceof Value) value.observe(()=>{
            const newValue = transform(value.value);
            if (newValue !== VOID) dx_value.value = newValue;
        }); // transform updates
        return dx_value;
    }
    static async transformMultiple<OUT>(values:CompatValue<any>[], transform:(...values:CompatValue<any>[])=>CompatValue<OUT>):Promise<Value<OUT>> {
        const initialValue = transform(...values.map(v=>Value.collapseValue(v, true, true))); // transform current value
        if (initialValue === VOID) throw new ValueError("initial tranform value cannot be void");
        const dx_value = Pointer.create(undefined, initialValue);
        for (let value of values) {
            if (value instanceof Value) value.observe(async ()=>{
                const newValue = transform(...values.map(v=>Value.collapseValue(v, true, true)));
                if (newValue !== VOID) dx_value.value = newValue;
            }) // transform updates
        }
        return dx_value;
    }

    // same as transform, but transform function is async
    static async transformAsync<OUT, V = any>(value:CompatValue<V>, transform:(v:V)=>Promise<CompatValue<OUT>>):Promise<Value<OUT>> {
        const initialValue = await transform(Value.collapseValue(value, true, true)); // transform current value
        if (initialValue === VOID) throw new ValueError("initial tranform value cannot be void");
        const dx_value = Pointer.create(undefined, initialValue);
        if (value instanceof Value) value.observe(async ()=>{
            const newValue = await transform(value.value);
            if (newValue !== VOID) dx_value.value = newValue;
        }); // transform updates
        return dx_value;
    }
    static async transformMultipleAsync<OUT>(values:CompatValue<any>[], transform:(...values:CompatValue<any>[])=>Promise<CompatValue<OUT>>):Promise<Value<OUT>> {
        const initialValue = await transform(...values.map(v=>Value.collapseValue(v, true, true))); // transform current value
        if (initialValue === VOID) throw new ValueError("initial tranform value cannot be void");
        const dx_value = Pointer.create(undefined, initialValue);
        for (let value of values) {
            if (value instanceof Value) value.observe(async ()=>{
                const newValue = await transform(...values.map(v=>Value.collapseValue(v, true, true)));
                if (newValue !== VOID) dx_value.value = newValue;
            }); // transform updates
        }
        return dx_value;
    }

    // copy the value of a primitive datex value to another primitive value
    static mirror<T extends primitive>(from:Value<T>, to:Value<T>) {
        from.observe((v,k,p)=> to.value = v);
    }
}


// interface to access (read/write) pointer value properties
export class PointerProperty<T=any> extends Value<T> {


    private constructor(public pointer: Pointer, public key: any) {
        super();
        PointerProperty.synced_pairs.get(pointer).set(key, this); // save in map
    }

    private static synced_pairs = new WeakMap<Pointer, Map<any, PointerProperty>>()

    // when label_binding is set, the pointer property is strongly bound to the label and also saved with the label instead of the pointer
    public static get<K extends keyof T, T extends object = object>(parent: T|Pointer, key: K):PointerProperty<T[K]> {
        let pointer:Pointer;
        if (parent instanceof Pointer) pointer = parent;
        else pointer = Pointer.createOrGet(parent);

        if (!this.synced_pairs.has(pointer)) this.synced_pairs.set(pointer, new Map());

        if (this.synced_pairs.get(pointer).has(key)) return this.synced_pairs.get(pointer).get(key);
        else return new PointerProperty(pointer, key);
    }

    // get current pointer property
    public override get value():T {
        return this.pointer.getProperty(this.key)
    }

    // update pointer property
    public override set value(value:T) {
        this.pointer.handleSet(this.key, Value.collapseValue(value, true, true));
    }

    #observer_internal_handlers = new WeakMap<(value:any, key?:any, type?:Value.UPDATE_TYPE)=>void, (value:any, key?:any, type?:Value.UPDATE_TYPE)=>void>()
    #observer_internal_bound_handlers = new WeakMap<object, WeakMap<(value:any, key?:any, type?:Value.UPDATE_TYPE)=>void, (value:any, key?:any, type?:Value.UPDATE_TYPE)=>void>>()

    // callback on property value change and when the property value changes internally
    public override observe(handler: (value:any, key?:any, type?:Value.UPDATE_TYPE)=>void, bound_object?:object) {
        const value_pointer = Pointer.pointerifyValue(this.value);
        if (value_pointer instanceof Value) value_pointer.observe(handler, bound_object); // also observe internal value changes

        const internal_handler = (v)=>{
            const value_pointer = Pointer.pointerifyValue(v);
            if (value_pointer instanceof Value) value_pointer.observe(handler); // also update observe for internal value changes
            handler.call(bound_object, v,undefined,Value.UPDATE_TYPE.INIT)
        };
        this.pointer.observe(internal_handler, bound_object, this.key)

        if (bound_object) {
            if (!this.#observer_internal_bound_handlers.has(bound_object)) this.#observer_internal_bound_handlers.set(bound_object, new WeakMap);
            this.#observer_internal_bound_handlers.get(bound_object).set(handler, internal_handler)
        }
        else this.#observer_internal_handlers.set(handler, internal_handler)
    }

    public override unobserve(handler: (value:any, key?:any, type?:Value.UPDATE_TYPE)=>void, bound_object?:object) {
        const value_pointer = Pointer.pointerifyValue(this.value);
        if (value_pointer instanceof Value) value_pointer.unobserve(handler, bound_object); // also unobserve internal value changes

        let internal_handler:(value:any, key?:any, type?:Value.UPDATE_TYPE)=>void

        if (bound_object) {
            internal_handler = this.#observer_internal_bound_handlers.get(bound_object)?.get(handler);
            this.#observer_internal_bound_handlers.get(bound_object)?.delete(handler);
        }
        else {
            internal_handler = this.#observer_internal_handlers.get(handler);
            this.#observer_internal_handlers.delete(handler);
        }

        if (internal_handler) this.pointer.unobserve(internal_handler, bound_object, this.key); // get associated internal handler and unobserve
    }

}


// DatexValue or normal value
export type ValueReadonly<T> = Readonly<Value<T>>;
export type CompatValue<T> = Value<T>|T;

export type ObjectWithDatexValues<T> = {[K in keyof T]: T[K] extends CompatValue<infer TT> ? (Value<TT>&TT) : (Value<T[K]>&T[K])}; // proxy object generated by props() function

export type int = bigint;
export type float = number;

// send datex updates from pointers only at specific times / intervals
// either create new DatexUpdateScheduler(update_interval) or manually call trigger() to trigger an update for all pointers
export class UpdateScheduler {

    updates_per_receiver: Map<Datex.Addresses.Filter|Datex.Addresses.Target, Map<Pointer, Map<string|symbol,[string|PrecompiledDXB, any[]]>>> = new Map();
    update_interval: number;
    active = false;
    #interval:any

    datex_timeout?:number

    constructor(update_interval?:number){
        this.update_interval = update_interval;
        this.start();
    }

    private setUpdateInterval(){
        if (this.update_interval != null) {
            this.#interval = setInterval(()=>{
                this.trigger()
            }, this.update_interval)
        }
    }
    private clearUpdateInterval(){
        if (this.update_interval != null) clearInterval(this.#interval);
    }

    // start all update triggers
    start(){
        this.active = true;
        this.setUpdateInterval(); // set interval if update_interval defined
    }

    // stop all update triggers
    stop(){
        this.active = false;
        this.clearUpdateInterval();
    }

    // trigger an update
    async trigger(){
        if (!this.active) return;
         for (let [receiver, map] of this.updates_per_receiver) {
            let data = [];
            let datex:string|PrecompiledDXB = ''
            let pdxb_array = []; // precompiled datex
            let is_datex_strings = true;

            for (let [ptr, entries] of map) {
                if (!entries.size) continue;

                for (let [entry_datex, entry_data] of entries.values()) {
                    // first entry decides if PrecompiledDXB or string
                    if (is_datex_strings && entry_datex instanceof PrecompiledDXB) is_datex_strings = false;

                    // join dx strings
                    if (typeof entry_datex == "string") {
                        datex+=entry_datex+';';
                    }
                    // join multiple PrecompiledDXB
                    else if (entry_datex instanceof PrecompiledDXB) {
                        pdxb_array.push(entry_datex);
                    }
                    data.push(...entry_data);
                }
                entries.clear();
            }

            // empty string?
            if (is_datex_strings && !datex) continue;
            // empty precompiled?, else generate
            else if (!is_datex_strings) {
                if (pdxb_array.length==0) continue;
                if (pdxb_array.length==0) datex = pdxb_array[0]; // single PrecompiledDXB, just use it
                else datex = PrecompiledDXB.combine(...pdxb_array); // combine multiple
            }

            try {
                await Runtime.datexOut([datex, data, {end_of_scope:false}], receiver, undefined, false, undefined, undefined, false, undefined, this.datex_timeout);
            } catch(e) {
                logger.error("forwarding failed", e)
            }
        }

    }

    intermediate_updates_pointers = new Set<Pointer>();

    // add a pointer for scheduling
    // if skip_intermediate_updates = true, intermediate update are not guaranteed to be transmitted
    addPointer(ptr: Pointer|any, intermediate_updates = false) {
        if (!(ptr instanceof Pointer)) ptr = Pointer.pointerifyValue(ptr);
        if (!(ptr instanceof Pointer)) throw new RuntimeError("value is not a pointer");
        if (intermediate_updates) this.intermediate_updates_pointers.add(ptr);
        ptr.setScheduler(this);
        // use timeout from last pointer
        this.datex_timeout = ptr.datex_timeout;
    }

    // remove pointer from scheduling
    removePointer(ptr: Pointer|any) {
        if (!(ptr instanceof Pointer)) ptr = Pointer.pointerifyValue(ptr);
        if (!(ptr instanceof Pointer)) throw new RuntimeError("value is not a pointer");
        ptr.deleteScheduler();
    }


    /** for the pointers */
    /** important: datex for one pointer either all PrecompiledDXB or all string */
    addUpdate(pointer:Pointer, identifier:string, datex:string|PrecompiledDXB, data:any[], receiver:Datex.Addresses.Filter|Datex.Addresses.Target) {
        if (!this.updates_per_receiver.has(receiver)) this.updates_per_receiver.set(receiver, new Map());
        let ptr_map = this.updates_per_receiver.get(receiver);
        if (!ptr_map.has(pointer)) ptr_map.set(pointer, new Map())
        ptr_map.get(pointer).set((!this.intermediate_updates_pointers.has(pointer) && identifier) ? identifier : Symbol(), [datex, data]);
    }
}



export const MAX_UINT_16 = 65535;

export const VOID = undefined; // corresponds to DATEX value 'void'
export const WILDCARD: unique symbol = Symbol("*"); // corresponds to wildcard (*)
export const INVALID: unique symbol = Symbol("Invalid"); // use for error propagation without throwing errors
export const NOT_EXISTING: unique symbol = Symbol("Not existing"); // use for marking non existing values (that are not void)
export const UNKNOWN_TYPE: unique symbol = Symbol("Unknown type") // return for unknown types when casting

export const DX_PTR: unique symbol = Symbol("DX_PTR"); // key for pointer objects to access the respective DatexPointer
export const DX_TYPE: unique symbol = Symbol("DX_TYPE");
export const DX_VALUE: unique symbol = Symbol("DX_VALUE");
export const DX_TEMPLATE: unique symbol = Symbol("DX_TEMPLATE");
export const DX_PERMISSIONS: unique symbol = Symbol("DX_PERMISSIONS");
export const DX_PERMISSIONS_R: unique symbol = Symbol("DX_PERMISSIONS_R");
export const DX_PERMISSIONS_U: unique symbol = Symbol("DX_PERMISSIONS_U");
export const DX_PERMISSIONS_X: unique symbol = Symbol("DX_PERMISSIONS_X");


// interface for handling synced, sealed, ... properties
// implemented in datex_js_interface.ts
export interface PropertyTypeAssigner {
    saveSyncedPropertiesAndMethods: (pointer:Pointer)=>void // collect new properties for a value with a specific class
    getBroadcastMethods: (class_name:string)=>Set<string>
    getSyncedProperties: (class_name:string)=>Set<string>
    getSealedProperties: (class_name:string)=>Set<string>
    getAnonymousProperties: (class_name:string)=>Set<string>
    getSyncedMethods:    (class_name:string)=>Set<string>
    getSealedMethods:    (class_name:string)=>Set<string>
    getAnonymizingMethods: (class_name:string)=>Set<string>
    getObserverFunctions:  (class_name:string)=>Map<string, any>
    getGeneralObserverFunctions:  (class_name:string)=>Set<string>
    getMethodParams: (target:any, method_name:string, meta_param_index?:number)=>Datex.Tuple<Datex.Type>
    getMethodMetaParamIndex: (target:any, method_name:string)=>number
}


export type pointer_type = number;

// never expose those properties to DATEX (constructor, toString, ...)
const DEFAULT_HIDDEN_OBJECT_PROPERTIES = new Set(Object.getOwnPropertyNames(Object.prototype));


/** Wrapper class for all pointer values ($xxxxxxxx) */
export class Pointer<T = any> extends Value<T> {

    /** STATIC */

    /** Pointer observers */
    private static pointer_add_listeners = new Set<(p:Pointer)=>void>();
    private static pointer_remove_listeners = new Set<(p:Pointer)=>void>();
    private static pointer_property_add_listeners = new Set<(p:Pointer, key:any, value:any)=>void>();
    private static pointer_property_change_listeners = new Set<(p:Pointer, key:any, value:any)=>void>();
    private static pointer_property_delete_listeners = new Set<(p:Pointer, key:any)=>void>();
    private static pointer_value_change_listeners =new Set<(p:Pointer)=>void>();
    private static pointer_for_value_created_listeners = new WeakMap<any, (Set<((p:Pointer)=>void)>)>();

    public static onPointerAdded(listener: (p:Pointer)=>void) {
        this.pointer_add_listeners.add(listener);
    }
    public static onPointerRemoved(listener: (p:Pointer)=>void) {
        this.pointer_remove_listeners.add(listener);
    }
    public static onPointerPropertyAdded(listener: (p:Pointer, key:any, value:any)=>void) {
        this.pointer_property_add_listeners.add(listener);
    }
    public static onPointerPropertyChanged(listener: (p:Pointer, key:any, value:any)=>void) {
        this.pointer_property_change_listeners.add(listener);
    }
    public static onPointerPropertyDeleted(listener: (p:Pointer, key:any)=>void) {
        this.pointer_property_delete_listeners.add(listener);
    }
    public static onPointerValueChanged(listener: (p:Pointer)=>void) {
        this.pointer_value_change_listeners.add(listener);
    }

    public static onPointerForValueCreated(value:any, listener: (p:Pointer)=>void){
        if (!this.pointer_for_value_created_listeners.has(value)) this.pointer_for_value_created_listeners.set(value, new Set());
        this.pointer_for_value_created_listeners.get(value)?.add(listener);
    }
   

    // unsubscribe from all external pointers
    public static unsubscribeFromAllPointers(){
        for (let pointer of this.pointers.values()) {
            if (!pointer.is_anonymous && !pointer.is_origin) pointer.unsubscribeFromPointerUpdates()
        }
    }

    /**
     *  Pointer Storage
     *  stores all unique pointers + their values
     */

    public static pointers = new Map<string, Pointer>();   // pointer id -> pointer
    public static pointer_value_map  = new WeakMap<any, Pointer>(); // value -> pointer
    public static pointer_label_map  = new Map<string|number, Pointer>(); // label -> pointer

    /**
     * returns a unique pointer hash: HASH + UNIQUE TIME
     */
    public static readonly MAX_POINTER_ID_SIZE = 26;
    public static readonly STATIC_POINTER_SIZE = 18;

    private static last_c = 0;
    private static last_t = 0;

    private static time_shift = 0;

    public static POINTER_TYPE:
    {
        DEFAULT:pointer_type,
        IPV6_ID:pointer_type,
        STATIC:pointer_type,
        BLOCKCHAIN_PTR:pointer_type,
        PUBLIC:pointer_type
    } = {
        DEFAULT: 1,
        IPV6_ID: 2,
        STATIC:  3,
        BLOCKCHAIN_PTR:  0xBC, // blockchain ptr $BC, ...
        PUBLIC:  5, // static public address
    }

    public static pointer_prefix = new Uint8Array(21); // gets overwritten in DatexRuntime when endpoint id exists

    static #is_local = true;
    static #local_pointers = new Set<Pointer>();
    public static set is_local(local: boolean) {
        this.#is_local = local;
        // update pointer ids if no longer local
        if (!this.#is_local) {
            for (let pointer of this.#local_pointers) {
                pointer.id = Pointer.getUniquePointerID(pointer);
            }
            this.#local_pointers.clear();
        }
    }
    public static get is_local() {return this.#is_local}

    /** 21 bytes address: 1 byte address type () 12/16 byte origin id - 8/4 byte origin instance - 4 bytes timestamp - 1 byte counter*/
    /**
     * Endpoint id types:
     *  + Full Endpoint ID:   EEEE EEEE EEEE / IIII IIII
     *  + IPv6 compatible ID: IIII IIII IIII IIII / PPPP 
     * Pointer id types:
     * Associaated with an endpoint id:
     *  + Full Endpoint ID pointer: A EEEE EEEE EEEE IIII IIII TTTT C    (A = Address type, E = endpoint id, I = instance id, T = timestamp, C = counter )
     *  + IPv6 compatible Address:  A IIII IIII IIII IIII PPPP TTTT C    (I = IPv6 address, P = port) 
     *  + Endpoint static pointer:  A EEEE EEEE EEEE UUUU U              (E = endpoint id, U = unique id (agreed among all instances))
     * Global / public:
     *  + Blockchain address:       A BBBB BBBB BBBB                     (B = unique block address)
     *  + Global static pointer:    A UUUU UUUU UUUU                     (U = unique id, stored in blockchain / decentralized) 
     * 
     * 'A' byte: first 3 bits for type, last 5 bits unused, can be used for custom flags 
     * */
    /** total pointer id size: 26 bytes */
    static getUniquePointerID(forPointer:Pointer): Uint8Array {
        let id = new Uint8Array(this.MAX_POINTER_ID_SIZE);
        let id_view = new DataView(id.buffer)
        // add hash
        id.set(this.pointer_prefix)

        const timestamp = Math.round((new Date().getTime() - DatexCompiler.BIG_BANG_TIME)/1000);

        // reset on new timestamp
        if (timestamp !== this.last_t) {
            // reset time shift if actual time catches up with time shift 
            if (timestamp>this.last_t+this.time_shift) this.time_shift = 0;
            // reset counter if no time shift
            if (this.time_shift == 0) this.last_c = 0;
        }

        // counter overflow -> increment timestamp (should only happen if really necessary)
        if (this.last_c > 255) {
            this.last_c = 0;
            this.time_shift ++;
        }

        // add timestamp (in seconds)
        id_view.setUint32(21,timestamp+this.time_shift, true); // timestamp + time_shift

        // add unique counter
        id_view.setUint8(25, this.last_c++)

        this.last_t = timestamp; // save actual last time a pointer was created

        // add to local pointers list if no global endpoint id yet -> update pointer id as soon as global id available
        if (Pointer.is_local) {
            this.#local_pointers.add(forPointer)
        }

        return id;
    }

    static getStaticPointerId(endpoint:Datex.Addresses.IdEndpoint, unique_id:number): Uint8Array {
        let id = new Uint8Array(this.STATIC_POINTER_SIZE);
        let id_view = new DataView(id.buffer)

        id.set(endpoint.getStaticPointerPrefix());
        id_view.setUint32(13, unique_id);

        return id;
    }

    static ANONYMOUS_ID = new Uint8Array(/*24*/1) // is anonymous pointer

    // returns the existing pointer for a value, or the value, if no pointer exists
    public static pointerifyValue(value:any):Pointer|any {
        return value instanceof Pointer ? value : this.pointer_value_map.get(value) ?? value;
    }
    // returns pointer only if pointer exists
    public static getByValue<T>(value:CompatValue<T>):Pointer<T>{
        return <Pointer<T>>this.pointer_value_map.get(Pointer.collapseValue(value));
    }

    // returns pointer only if pointer exists
    public static getByLabel(label:string|number):Pointer {
        if (!this.pointer_label_map.has(label)) throw new PointerError("Label "+Runtime.formatVariableName(label, '$')+" does not exist");
        return this.pointer_label_map.get(label);
    }

    // get pointer by id, only returns pointer if pointer already exists
    static get(id:Uint8Array|string):Pointer {
        return this.pointers.get(Pointer.normalizePointerId(id))
    }

    static #pointer_sources = new Set<PointerSource>();
    public static registerPointerSource(source: PointerSource) {
        this.#pointer_sources.add(source);
    }

    private static loading_pointers:WeakMap<datex_scope, Set<string>> = new WeakMap();

    // load from storage or request from remote endpoint if pointer not yet loaded
    static async load(id:string|Uint8Array, SCOPE?:datex_scope){

        const id_string = Pointer.normalizePointerId(id);

        if (SCOPE && !this.loading_pointers.has(SCOPE)) this.loading_pointers.set(SCOPE, new Set())
        const loading_pointers = SCOPE ? this.loading_pointers.get(SCOPE) : undefined;

        // recursive pointer loading! TODO
        if (loading_pointers?.has(id_string)) {
            logger.error("recursive pointer loading: "+ id_string);
            return null;
        }

        loading_pointers?.add(id_string);

        // get pointer or create new
        let pointer:Pointer<any> = Pointer.create(id, NOT_EXISTING, false);

        //logger.info("loading pointer: " + pointer, "origin = " + pointer.origin)

        // not allowed: anonymous pointer
        if (pointer.is_anonymous) {
            loading_pointers?.delete(id_string);
            throw new PointerError("The anonymous pointer has no value", SCOPE)
        }

        // get value if pointer value not yet loaded
        if (pointer.value === VOID) {
            // first try loading from storage
            let stored:any
            let source:PointerSource;
            for (source of this.#pointer_sources) {
                stored = await source.getPointer(pointer.id, !SCOPE);
                if (stored != NOT_EXISTING) break;
            }

            if (stored!=NOT_EXISTING) {
                pointer = pointer.setValue(stored);
                // now sync if source (pointer storage) can sync pointer
                if (source.syncPointer) source.syncPointer(pointer);

                // use local endpoint as default origin for storage pointer (TODO change?)
                pointer.origin = Runtime.endpoint;
            }

            // special pointers
          
            // request BC pointer from network
            else if (id_string.startsWith("BC")) {
                // try to subscribe (default: main_node)
                try {
                    pointer = await pointer.subscribeForPointerUpdates(Runtime.main_node); // TODO relay node?
                } catch (e) {
                    loading_pointers?.delete(id_string);
                    // could not subscribe, remove pointer again
                    pointer.delete();
                    throw e;
                }
            }

            // request pointer value from original sender, if pointer not yet loaded & not subscribe to own endpoint & fix: infinite loop: subscribe invalid pointer <-> subscribe
            else if (!pointer.is_origin) {

                // waiting subscribe / unsubscribe ! should not happen TODO improve 
                if (SCOPE?.sync) {
                    loading_pointers?.delete(id_string);
                    throw new RuntimeError("Cannot subscribe to non-existing pointer", SCOPE);
                }
                else if (SCOPE?.unsubscribe) {
                    loading_pointers?.delete(id_string);
                    throw new RuntimeError("Cannot unsubscribe from non-existing pointer", SCOPE)
                }

                // // cannot subscribe to own pointer, this pointer does not exist on the endpoint
                // if (DatexRuntime.endpoint.equals(SCOPE.header.sender)) {
                //     this.loading_pointers.delete(id_string);
                //     throw new DatexRuntimeError("Pointer does not exist 1", SCOPE)
                // }

                // try to subscribe
                try {
                    pointer = await pointer.subscribeForPointerUpdates();
                } catch (e) {
                    loading_pointers?.delete(id_string);
                    // could not subscribe, remove pointer again
                    pointer.delete();
                    throw e;
                }

            }

            // pointer does not exist / has no value
            else  {
                loading_pointers?.delete(id_string);
                throw new PointerError("Pointer has no assigned value", SCOPE)
            }
        }

        loading_pointers?.delete(id_string);

        return pointer;
    }

    // create/get DatexPointer for value if possible (not primitive) and return value
    static proxifyValue<T,C extends CompatValue<T> = CompatValue<T>>(value:C, sealed = false, allowed_access?:Datex.Addresses.Filter, anonymous = false, persistant= false): C extends PrimitivePointer | PointerProperty ? C : T {
        if (value instanceof PrimitivePointer || value instanceof PointerProperty) return <any>value; // return by reference
        else if (value instanceof Value) return value.value; // return by value
        const type = Type.getValueDatexType(value)
        const collapsed_value = <T> Value.collapseValue(value,true,true)
        // don' create pointer for this value, return original value
        if (type.is_primitive || collapsed_value instanceof Date) {
            return <any>collapsed_value;
        }

        // create or get pointer
        else return <any>Pointer.createOrGet(collapsed_value, sealed, allowed_access, anonymous, persistant).value;
    } 

    // create a new pointer or return the existing pointer for this value
    static createOrGet<T>(value:CompatValue<T>, sealed = false, allowed_access?:Datex.Addresses.Filter, anonymous = false, persistant= false):Pointer<T>{
        const ptr = Pointer.getByValue(value); // try proxify
        // pointer already exists
        if (ptr) {
            if (ptr.is_placeholder) ptr.unPlaceholder(); // no longer placeholder, becomes normal pointer
            return ptr;
        }
        // create new pointer
        else return Pointer.create(undefined, value, sealed, undefined, persistant, anonymous, false, allowed_access); 
    }

    // create a new pointer or return the existing pointer + add a label
    static createLabel<T>(value:CompatValue<T>, label:string|number):Pointer<T>{
        let ptr = Pointer.getByValue(value); // try proxify
        // create new pointer
        if (!ptr) {
           ptr = Pointer.create(undefined, value); 
        }
        ptr.addLabel(label);
        return ptr;
    }
    
    // only creates the same pointer once => unique pointers
    // throws error if pointer is already allocated or pointer value is primitive
    static create<T>(id?:string|Uint8Array, value:CompatValue<T>|typeof NOT_EXISTING=NOT_EXISTING, sealed = false, origin?:Datex.Addresses.Endpoint, persistant=false, anonymous = false, is_placeholder = false, allowed_access?:Datex.Addresses.Filter, timeout?:number):Pointer<T> {
        let p:Pointer<T>;

        // DatexValue: DatexPointer or DatexPointerProperty not valid as object, get the actual value instead
        value = <T|typeof NOT_EXISTING> Value.collapseValue(value,true,true)


        // is primitive value
        if ((Object(value) !== value && typeof value != "symbol") || value instanceof ArrayBuffer || value instanceof TypedArray || value instanceof NodeBuffer || value instanceof Addresses.Target) {
            
            if (value instanceof TypedArray || value instanceof NodeBuffer) value = <T>Runtime.serializeValue(value); // convert to ArrayBuffer

            // id already in use
            if (typeof id != "symbol" && id && (p = <Pointer<T>> this.pointers.get(this.normalizePointerId(id)))) {
                if (p instanceof PrimitivePointer) {
                    if (value!=NOT_EXISTING) p.value = value; // update value of this pointer
                    if (origin) p.origin = origin; // override origin
                }
                else {
                    throw new PointerError("Cannot assign a primitive value to a non-primitive pointer");
                }
            }
            else {
                let pp:any;

                if (value instanceof ArrayBuffer) pp = Buffer;
                else if (value instanceof Addresses.Target) pp = PrimitivePointer; // default pointer for endpoint addresses
                else switch (typeof value) {
                    case "string": pp = String; break;
                    case "number": pp = Float; break;
                    case "bigint": pp = Int; break;
                    case "boolean": pp = Boolean; break;
                }
                
                if (!pp) throw new PointerError("Cannot create a pointer for this value type");
               
                // create new
                return new (<typeof Pointer>pp)(id, <any>value, sealed, origin, persistant, anonymous, is_placeholder, allowed_access, timeout)
            }
        }
        
        // value already allocated to a pointer
        else if (this.pointer_value_map.has(value)) {
            let existing_pointer = <Pointer<T>> Pointer.pointer_value_map.get(value);
            // is placeholder, add id
            if (existing_pointer.is_placeholder) {
                existing_pointer.unPlaceholder(id)
                return existing_pointer;
            }
            // stays anonymous
            if (existing_pointer.is_anonymous) return existing_pointer;
            // value already has a pointer
            else throw new PointerError("A pointer has already been allocated to this value ("+Runtime.valueToDatexString(value)+")");
        }

        // id already allocated to a pointer
        else if (typeof id != "symbol" && id && (p = <Pointer<T>> this.pointers.get(this.normalizePointerId(id)))) {
            if (value!=NOT_EXISTING) p.value = value; // set value of this pointer, if not yet set
            if (origin) p.origin = origin; // override origin
            return p;
        }

        // create a completely new pointer
        else {
            return new Pointer<T>(id, <any>value, sealed, origin, persistant, anonymous, is_placeholder, allowed_access, timeout)
        }
    }

    public static normalizePointerId(id:string|Uint8Array):string {
        // correct size depending on pointer id type
        if (id instanceof Uint8Array) {
            if (id[0] == Pointer.POINTER_TYPE.STATIC) return this.buffer2hex(id,null,Pointer.STATIC_POINTER_SIZE, true) 
            else return this.buffer2hex(id,null,Pointer.MAX_POINTER_ID_SIZE, true)
        }
        else return id // TODO also normalize string?
    }


    /**
     *  Pointer Garbage collection
     *  handles no longer needed pointers
     */

    private static garbage_registry = new FinalizationRegistry<string>(pointer_name => {
        if (!Pointer.pointers.has(pointer_name)) return;
    
        // clean up after garbage collection:

        let pointer = Pointer.pointers.get(pointer_name);
        logger.warn("garbage collected " + pointer.toString());

        // remove actual pointer from list
        Pointer.pointers.delete(pointer_name);
        // remove references in other maps
        if (pointer.value) Pointer.pointer_value_map.delete(pointer.value);
        if (pointer.original_value) {
            Pointer.pointer_value_map.delete(pointer.original_value);
            delete pointer.original_value[DX_PTR]
        }
        for (const label of pointer.labels) {
            this.pointer_label_map.delete(label);
        }
        
        // call remove listeners
        if (!pointer.is_anonymous) for (let l of Pointer.pointer_remove_listeners) l(pointer);
        // unsubscribe from pointer if remote origin
        if (!pointer.is_origin && pointer.origin) pointer.unsubscribeFromPointerUpdates();
    });

    // get hex string id from buffer
    static buffer2hex(buffer:Uint8Array, seperator?:string, pad_size_bytes?:number, x_shorthand = false):string {
        let array:string[] = Array.prototype.map.call(buffer, x => ('00' + x.toString(16).toUpperCase()).slice(-2))
        // collapse multiple 0s to x...
        if (x_shorthand) {
            array = array.reduce((previous, current) => {
                if (current == '00') {
                    if (previous.endsWith('00')) return previous.slice(0, -2) + "x2"; // add to existing 00
                    else if (previous[previous.length-2] == 'x') {
                        const count = (parseInt(previous[previous.length-1],16)+1);
                        if (count <= 0xf) return previous.slice(0, -1) + count.toString(16).toUpperCase()  // add to existing x... max 15
                    }
                }
                return previous + current;
            }).split(/(..)/g).filter(s=>!!s);
        }

        if (pad_size_bytes != undefined) array = Array.from({...array, length: pad_size_bytes}); // pad

        return array.join(seperator??'');
    }

    // get buffer from hex string id, x_shorthand: replace [x2] with [00 00], [xa] with [00] * 10
    static hex2buffer(hex:string, pad_size_bytes?:number, x_shorthand = false):Uint8Array { 
        if (!hex) return new Uint8Array(0); // empty buffer

        hex = hex.replace(/[_-]/g, "");
        if (hex.length%2 != 0) throw new ValueError('Invalid hexadecimal buffer: ' + hex);    
        if ((x_shorthand && hex.match(/[G-WYZ\s]/i)) || (!x_shorthand && hex.match(/[G-Z\s]/i))) throw new ValueError('Invalid hexadecimal buffer: ' + hex);       
    
        let array:number[];

        if (!x_shorthand) array = hex.match(/[\dA-Fa-fxX]{2}/gi).map( s => parseInt(s, 16));
        else array = hex.match(/[\dA-Fa-fxX]{2}/gi).map((s, i, a) => {
            s = s.toLowerCase();
            if (s.startsWith("x") && s[1]!="x") return Array(parseInt(s[1],16)).fill(0); // expand x...
            else if (s.includes("x")) throw new ValueError('Invalid buffer "x" shorthand: ' + hex.slice(0, 30)); 
            return parseInt(s, 16)
        }).flat(1)

        if (pad_size_bytes != undefined) return new Uint8Array({...array, length: pad_size_bytes});
        else return new Uint8Array(array);
    }


    // returns <Function> for native js function
    private static convertNativeFunctionToDatexFunction(value:((...params: any[]) => any), parent?:object|Pointer, key_in_parent?:any, anonymize_result=false) {
        const parent_value = parent instanceof Pointer ? parent.value : parent;

        if (typeof value == "function" && !(value instanceof Function)) {
            // try to get more type info for the method params (from JS decorators etc.)
            let meta_param_index = this.property_type_assigner.getMethodMetaParamIndex(parent_value, key_in_parent)
            let method_params = this.property_type_assigner.getMethodParams(parent_value, key_in_parent, meta_param_index)
            return new Function(null, value, Datex.Runtime.endpoint, method_params, null, meta_param_index, parent, anonymize_result);
        }
        throw new ValueError("Cannot auto-cast native value to <Function>");
    }

    // custom datex pointer array splice function
    private static arraySplice(start?: number, deleteCount?: number, ...items: any[]):any[] {
        // is clear?
        if (start == 0 && deleteCount == this.length && items.length == 0) {
            this[DX_PTR]?.handleClear();
            return [];
        }
        if (deleteCount && deleteCount < 0) deleteCount = 0;
        return this[DX_PTR]?.handleSplice(start, deleteCount, items);
    }
    

    /** END STATIC */



    protected constructor(id?:Uint8Array|string, value:T=<any>NOT_EXISTING, sealed:boolean = false, origin?:Datex.Addresses.Endpoint, persistant = false/*TODO handle persistant?*/, anonymous = false, is_placeholder = false, allowed_access?:Datex.Addresses.Filter, timeout?:number) {
        super();
        // TODO is_placeholder is deprecated? (no longer in use)
        // is only a temporary placeholder pointer (has to be replaced with another pointer with an id, behaves like an anonymous pointer until then)
        if (is_placeholder) {
            this.#is_placeholder = true;
            anonymous = true;
        }
        // is id anonymous ($00)?
        if ((typeof id == "string" && id.match(/^0+$/)) || (id instanceof Uint8Array && id.every(x => x == 0))) {
            anonymous = true;
        }

        this.#is_persistent = persistant;
        this.sealed = sealed;
        if (origin) this.origin = origin; // also updates #is_origin
        this.#is_anonymous = anonymous;
        this.#allowed_access = allowed_access;

        this.datex_timeout = timeout;

        // set pointer id (after this.#is_anonymous is set)
        if (anonymous) {
            this.id = Pointer.ANONYMOUS_ID;
        }
        else if (typeof id == "string" || id instanceof Uint8Array) {
            this.id = id;
        }
        // generate new random pointer id
        else {
            this.id = Pointer.getUniquePointerID(this);
        }

        // get origin based on pointer id if no origin provided
        // TODO different pointer address formats / types
        if (!this.origin && id && !anonymous && this.#id_buffer && this.pointer_type == Pointer.POINTER_TYPE.DEFAULT) {
            this.origin = <Datex.Addresses.IdEndpoint> Datex.Addresses.Target.get(this.#id_buffer.slice(1,13), null, this.#id_buffer.slice(13,21), null, BinaryCode.ENDPOINT);
            //console.log("pointer origin based on id: " + this.toString() + " -> " + this.origin)
        }
        else if (!this.origin) this.origin = Runtime.endpoint; // default origin is local endpoint

        // set value
        if (<any>value != NOT_EXISTING) this.value = value;

    }
    
    // delete pointer again (reset everything) if not needed
    public delete() {
        if (this.is_anonymous) logger.info("Deleting anoynmous pointer");
        else logger.error("Deleting pointer " + this);

        // delete from maps
        if (this.value) {
            Pointer.pointer_value_map.delete(this.value);
        } 
        if (this.original_value) {
            Pointer.pointer_value_map.delete(this.original_value);
            delete this.original_value[DX_PTR]
        }

        // delete labels
        for (let label of this.labels??[]) Pointer.pointer_label_map.delete(label);
        
        Pointer.pointers.delete(this.#id);
        delete globalThis[this.toString()];

        // call remove listeners
        if (!this.is_anonymous) for (let l of Pointer.pointer_remove_listeners) l(this);
        // unsubscribe from pointer if remote origin
        if (!this.is_origin && this.origin) this.unsubscribeFromPointerUpdates();
    }
    

    #original_value: T extends object ? WeakRef<T> : void //  weak ref to original value (not proxyfied)
    #shadow_object: WeakRef<object>|T // object to make changes and get values from without triggering DATEX updates
    #type:Type // type of the value

    #value_updated = false

    #is_placeholder = false

    #is_persistent: boolean // indicates if this pointer can get garbage collected
    #is_anonymous: boolean // pointer should never be sent via datex as reference, always serialize the value
    
    #pointer_type:pointer_type // pointer type (full id, static, ...)

    // id as hex string and ArrayBuffer
    #id:string
    #id_buffer:Uint8Array
    #origin: Datex.Addresses.Endpoint
    #is_origin = true;
    #subscribed: boolean

    //readonly:boolean = false; // can the value ever be changed?
    sealed:boolean = false; // can the value be changed from the client side? (otherwise, it can only be changed via DATEX calls)
    #scheduleder: UpdateScheduler = null  // has fixed update_interval

    #allowed_access: Datex.Addresses.Filter // who has access to this pointer?, undefined = all

    #garbage_collectable = false;

    #labels = new Set<string|number>();
   
    get garbage_collectable () {return this.#garbage_collectable} // indicates if pointer can be garbage collected
    get allowed_access(){return this.#allowed_access}
    get is_placeholder(){return this.#is_placeholder}
    get id_buffer(){return this.#id_buffer}
    get is_origin(){return this.#is_origin}
    get is_anonymous(){return this.#is_anonymous}
    get origin(){return this.#origin}
    get is_persistant() { return this.#is_persistent;}
    get labels(){return this.#labels}
    get pointer_type(){return this.#pointer_type}

    protected _setType(type:Type) {this.#type = type}
    protected _setValue(value:T extends object ? T | WeakRef<T> : T) {
        super.value = <any>value;
        // pointer value change listeners
        for (let l of Pointer.pointer_value_change_listeners) l(this);
    }
    protected _getValueUpdated() {return this.#value_updated}

    set origin(origin:Datex.Addresses.Endpoint){
        this.#origin = origin
        this.#is_origin = Runtime.endpoint.equals(this.#origin);
    }

    // change the persistant state of this pointer
    set is_persistant(persistant:boolean) {
        if (persistant && !this.#is_persistent) {
            super.value = <any>this.value;
            this.#is_persistent = true;
            this.updateGarbageCollection()
        }
        else if (!persistant && this.#is_persistent){
            super.value = <any>new WeakRef(<any>this.value);
            this.#is_persistent = false;
            this.updateGarbageCollection()
        }
    }

    // don't call this method, call addPointer on DatexUpdateScheduler
    setScheduler(scheduleder: UpdateScheduler){
        this.#scheduleder = scheduleder
    }
    // don't call this method, call deletePointer on DatexUpdateScheduler
    deleteScheduler(){
        this.#scheduleder = null;
    }

    public addLabel(label: string|number){
        if (Pointer.pointer_label_map.has(label)) throw new PointerError("Label " + Runtime.formatVariableName(label, '$') + " is already assigned to a pointer");
        this.#labels.add(label);
        this.is_persistant = true; // make pointer persistant
        Pointer.pointer_label_map.set(label, this)

        // add to globalThis
        Object.defineProperty(globalThis, Runtime.formatVariableName(label, '$'), {get:()=>this.value, set:(value)=>this.value=value, configurable:true})
    }

    /**
    * Subscribe for external pointer updates at remote endpoint -> might return a different pointer if current pointer was placeholder
    */

    public async subscribeForPointerUpdates(override_endpoint?:Datex.Addresses.Endpoint):Promise<Pointer> {
        if (this.#subscribed) {
            logger.info("already subscribed to " + this);
            return;
        }
        

        const endpoint = override_endpoint ?? this.origin;

        logger.info("subscribing to " + this + ", origin = " + endpoint);

        try {
            let result = await Runtime.datexOut(['subscribe ?', [this]], endpoint) 
            //console.log("result", result)
            this.#subscribed = true;
            let pointer_value = result;

            // // set function receiver
            // if (pointer_value instanceof Function) {
            //     pointer_value.setRemoteEndpoint(endpoint);
            // }
            this.origin = endpoint;

            if (this.value == VOID) return this.setValue(pointer_value); // set value
            else return this;
        }
        // probably not the right origin
        catch (e) {
            logger.error(e)
            // find origin and subscribe
            try {
                let origin:Datex.Addresses.Endpoint = await Runtime.datexOut(['origin ?', [this]], endpoint) 
                if (origin instanceof Datex.Addresses.Endpoint) return this.subscribeForPointerUpdates(origin);
                else throw new Error("Cannot find origin for pointer " + this);
            }  catch (e) {
                logger.error(e)
            }
        }
    
    }

    public unsubscribeFromPointerUpdates() {
        if (!this.#subscribed) return; // already unsubscribed
        let endpoint = this.origin;
        logger.info("unsubscribing from " + this + " ("+endpoint+")");
        Runtime.datexOut(['unsubscribe ?', [this]], endpoint);
        this.#subscribed = false;
    }

    // make normal pointer from placeholder
    unPlaceholder(id?:string|Uint8Array) {
        this.#is_anonymous = false; // before id change
        this.id = id ?? Pointer.getUniquePointerID(this) // set id
        this.#is_placeholder = false; // after id change
        // first time actual visible pointer
        for (let l of Pointer.pointer_add_listeners) l(this);
    }

    // set id if not set initially set
    get id():string{ return this.#id }
    
    set id (id:Uint8Array|string) {
        if (!this.is_placeholder && this.id !== undefined && !Pointer.#local_pointers.has(this)) {
            throw new PointerError("Cannot change the id of a pointer");
        }

        if (typeof id == "string") {
            // convert string to buffer
            try {this.#id_buffer = Pointer.hex2buffer(id, Pointer.MAX_POINTER_ID_SIZE, true);}
            catch (e) {throw new SyntaxError('Invalid pointer id: $' + id.slice(0, 48));}
            this.#id = id;
        }
        else if (id instanceof Uint8Array) {
            this.#id_buffer = id;
            this.#id = Pointer.normalizePointerId(id)
        }
        else this.#id = id;

        // get pointer type
        this.#pointer_type = this.#id_buffer[0];

        // set global
        if (!this.is_anonymous) Object.defineProperty(globalThis, this.toString(), {get:()=>this.value, set:(value)=>this.value=value, configurable:true})

        // add to pointer list
        if (!this.is_anonymous) Pointer.pointers.set(this.#id, this); 
    }

    // set value, might return new pointer if placeholder pointer existed or converted to primitive pointer
    setValue<TT>(v:T extends typeof NOT_EXISTING ? TT : T):Pointer<T extends typeof NOT_EXISTING ? TT : T> {
        // primitive value -> new pointer
        if ((Object(v) !== v || v instanceof ArrayBuffer) && !(this instanceof PrimitivePointer)) {
            Pointer.pointers.delete(this.id); // force remove previous non-primitive pointer (assume it has not yet been used)
            return <any>Pointer.create(this.id, v, this.sealed, this.origin, this.is_persistant, this.is_anonymous, false, this.allowed_access, this.datex_timeout)
        }
        // placeholder replacement
        else if (Pointer.pointer_value_map.has(v)) {
            if (super.value != undefined) {throw new PointerError("Cannot assign a new value to an already initialized pointer")}
            let existing_pointer = Pointer.pointer_value_map.get(v);
            existing_pointer.unPlaceholder(this.id) // no longer placeholder, this pointer gets 'overriden' by existing_pointer
            return existing_pointer;
        }
        else {
            this.value = <any>v;
            return <any>this;
        }
    }

    // stored value get + set
    // map value -> pointer
    override set value(_v:CompatValue<T>) {
        const v = Value.collapseValue(_v,true,true);

        if (this.#value_updated) throw new PointerError("Cannot assign a new value to an already initialized non-primitive pointer")

        // add reference to this DatexPointer to the value
        if (!this.is_anonymous) {
            try {
                v[DX_PTR] = this;
            } catch(e) {}
            
            // add toJSON -> dx::$xxxxx TODO should be hidden, error:cannot assign to read-only property...
            /*Object.defineProperty(v, 'toJSON',{
                value : ()=>this.toJSON(),
                enumerable: false
                })*/
        }

        // Save reference to original
        this.#original_value = this.#shadow_object = <any> new WeakRef(<any>v);
        this.#type = Type.getValueDatexType(v);

        if (this.sealed) this.visible_children = new Set(Object.keys(v)); // get current keys and don't allow any other children
        else if (this.type.visible_children) this.visible_children = this.type.visible_children; // use visible_children from type

        // save original value in map to find the right pointer for this value in the future
        Pointer.pointer_value_map.set(v, this);

        // create proxy (only if not primitive)
        let value = this.addObjProxy((v instanceof UnresolvedValue) ? v[DX_VALUE] : v); 

        if (v instanceof UnresolvedValue) {
            this.#shadow_object = new WeakRef(v[DX_VALUE]) // original value, update here
            v[DX_VALUE] = value; // override DX_VALUE with proxified value
            super.value = <any> v;
        } 
        else super.value = <any> value;

        this.updateGarbageCollection(); // creates weakref & adds garbage collection listener

        // proxify children, if not anonymous
        if (this.type.proxify_children) this.objProxifyChildren();

        // save proxy + original value in map to find the right pointer for this value in the future
        Pointer.pointer_value_map.set(value, this);

        // pointer for value listeners?
        if (Pointer.pointer_for_value_created_listeners.has(v)) {
            for (let l of Pointer.pointer_for_value_created_listeners.get(v)) l(this);
        }

        // seal original value
        if (this.sealed) Object.seal(this.original_value);
    
        this.afterFirstValueSet();
    }

    protected afterFirstValueSet(){
        this.#value_updated = true;
        // custom timeout from type?
        if (this.type.timeout!=undefined && this.datex_timeout==undefined) this.datex_timeout = this.type.timeout
        // set global variable (direct reference does not allow garbage collector to remove the value)
        if (this.id && !this.is_anonymous) Object.defineProperty(globalThis, this.toString(), {get:()=>this.value, set:(value)=>this.value=value,configurable:true})
        setTimeout(()=>{for (let l of Pointer.pointer_add_listeners) l(this)},0);
        Object.freeze(this);
    }

    // enable / disable garbage collection based on subscribers & is_persistant
    updateGarbageCollection(){

        // remove WeakRef (keep value) if persistant, or has subscribers
        if (this.is_persistant || this.subscribers.size != 0) {
            //logger.warn("blocking " + this + " from beeing garbage collected")
            this.#garbage_collectable = false;
            if (super.value instanceof WeakRef) super.value = super.value.deref()
        }
        else {
            //logger.success("giving " + this + " free for garbage collection")
            // add listener
            if (!this.#garbage_collectable) {
                this.#garbage_collectable = true;
                // add to garbage collection after timeout
                setTimeout(()=>{
                    const value = this.value;
                    if (value) Pointer.garbage_registry.register(<any>value, <string>this.id)
                }, Runtime.OPTIONS.DEFAULT_REQUEST_TIMEOUT);
            }
            // add WeakRef if not yet added
            if (!(super.value instanceof WeakRef)) super.value = <any>new WeakRef(<any>super.value);
        }
    }


    override get value():T {
        // return either the #value directly or deref if neeeded
        return super.value instanceof WeakRef ? super.value.deref() : super.value;
    }

    public get original_value():T {    
        return (<WeakRef<any>>this.#original_value)?.deref()
    }

    public get shadow_object():object {    
        return (<WeakRef<any>>this.#shadow_object)?.deref()
    }

    get type():Type{
        return this.#type;
    }


    public extended_pointers = new Set<Pointer>()

    /**
     * sync all properties from one pointer with an other
     * only guaranteed to work for pointers with the same type, other (incompatible) types might cause problems
     * @param otherPointer 
     */
    public extend(otherPointer:Pointer|object, update_back = true) {
        if (!(otherPointer instanceof Pointer)) throw "not a pointer";
        logger.info(this + " is extending pointer " + otherPointer);

        for (let property of otherPointer.getKeys()) {
            this.extendProperty(otherPointer, property, update_back)
        }
    }

    // extend pointer (updates in both directions or in one direction)
    public extendProperty(otherPointer:Pointer, key:any, update_back = true) {
        console.log("extend poperty",key);
        if (!(otherPointer instanceof Pointer)) throw "not a pointer";

        this.extended_pointers.add(otherPointer);

        // add property
        this.value[key] = otherPointer.value[key];
        
        // prevent infinite loops
        let changing1 = false;
        let changing2 = false;

        // reflect changes from other pointer
        otherPointer.observe(value=>{
            if (changing2) return;
            changing1 = true;
            console.warn("other pointer cahnged", key, value)
            this.handleSet(key, value, false)
            changing1 = false;
        }, undefined, key);

        if (update_back) {
            // reflect own changes to other pointer
            this.observe(value=>{
                if (changing1) return;
                changing2 = true;
                console.warn("own pointer cahnged", key, value)
                otherPointer.handleSet(key, value)
                changing2 = false;
            }, undefined, key);
        }

    }



    public datex_timeout?:number

    public visible_children?:Set<string>; // list of all children that are visible to DATEX
    public sealed_properties?:Set<string>;
    public anonymous_properties?:Set<string>;

    // returns if a property of a @sync class can be read, returns true if not a @sync class
    public canReadProperty(property_name:string):boolean {
        return (!this.visible_children&& !DEFAULT_HIDDEN_OBJECT_PROPERTIES.has(property_name)) || this.visible_children.has(property_name)
    }
    
    // returns if a property of a @sync class can be updated, returns true if not a @sync class
    public canUpdateProperty(property_name:string):boolean {
        return this.canReadProperty(property_name) && (!this.sealed_properties || !this.sealed_properties.has(property_name));
    }


    private subscribers = new Set<Datex.Addresses.Endpoint>();
    private subscribers_filter = new Datex.Addresses.Filter(this.subscribers);
    private subscribers_filter_pointer:[Datex.Addresses.Filter?] = []; // per default, subscriber filter does not exist as pointer, only if requested

    public addSubscriber(subscriber: Datex.Addresses.Endpoint) {
        if (this.subscribers.has(subscriber)) {
            logger.warn(subscriber.toString() + " re-subscribed to " + this);
            //return;
        }
        this.subscribers.add(subscriber);
        if (this.subscribers.size == 1) this.updateGarbageCollection() // first subscriber
        if (this.streaming.length) setTimeout(()=>this.startStreamOutForEndpoint(subscriber), 1000); // TODO do without timeout?
    }

    public removeSubscriber(subscriber: Datex.Addresses.Endpoint) {
        this.subscribers.delete(subscriber);
        if (this.subscribers.size == 0) this.updateGarbageCollection() // no subscribers left
    }
    

    // get subscribers filter (is a pointer value)
    public async getSubscribersFilter(){
        // already available
        if (this.subscribers_filter_pointer.length) return this.subscribers_filter_pointer[0];

        // is origin, other endpoints =  subscribers
        if (this.is_origin) {
            this.subscribers_filter_pointer[0] = Pointer.create(null, this.subscribers_filter).value;
        }
        // is remote pointer: get subscribers pointer first + add origin to filter
        else {
            this.subscribers_filter_pointer[0] = await Runtime.datexOut(['subscribers ?', [this]], this.origin); 
        }

        return this.subscribers_filter_pointer[0];
    }

    // updates are from datex (external) and should not be distributed again or local update -> should be distributed to subscribers
    #update_filter:Datex.Addresses.Filter = this.subscribers_filter; // subscribers filter per default
    #exclude_origin_from_updates:boolean;
    public excludeEndpointFromUpdates(endpoint:Datex.Addresses.Endpoint) {
        // TODO origin equals id also for remote endpoints!
        if (this.origin.equals(endpoint)) this.#exclude_origin_from_updates = true;
        this.#update_filter = Datex.Addresses.Filter.createMergedFilter(this.subscribers_filter, Datex.Addresses.Not.get(endpoint));
    }
    public enableUpdatesForAll() {
        this.#exclude_origin_from_updates = false;
        this.#update_filter = this.subscribers_filter;
    }
    get update_filter() {
        return this.#update_filter;
    }


    // says which properties are synced, sealed...
    public static property_type_assigner: PropertyTypeAssigner
    public static setPropertyTypeAssigner(assigner: PropertyTypeAssigner) {
        this.property_type_assigner = assigner;
    }

    public getSerializedValue(){
        return SerializedValue.get(this.value);
    }

    public getKeys(array_indices_as_numbers = false):Iterable<any> {
        // restricted to visible_children
        if (this.visible_children) return this.visible_children;

        let keys = JSInterface.handleKeys(this.value, this.type);
        if (keys == INVALID) throw new ValueError("Value has no iterable content");
        if (keys == NOT_EXISTING) {
            if (this.value instanceof Array) {
                if (array_indices_as_numbers) return [...this.value.keys()]
                else return [...this.value.keys()].map(BigInt);
            }
            else keys = Object.keys(this.value); // default Object.keys
        }
        return keys;
    }

    // proxify a (child) value, use the pointer context
    private proxifyChild(name:any, value:any) {
        let child = value === NOT_EXISTING ? this.value[name] : value;

        // special native function -> <Function> conversion
        if (typeof child == "function" && !(child instanceof Function)) 
            child = Pointer.convertNativeFunctionToDatexFunction(child, this, name);
        
        // create/get pointer, same permission filter
        return Pointer.proxifyValue(child, false, this.allowed_access, this.anonymous_properties?.has(name))
    }

    /** proxify the child elements of a proxified value */
    private objProxifyChildren() {

        const value = this.value;
        for (let name of this.visible_children ?? Object.keys(value)) {
            // only proxify non-primitive values
            const type = Type.getValueDatexType(value[name])
            if (!type.is_primitive && !(value[name] instanceof Date)) {
                // custom timeout for remote proxy function
                if (value[name] instanceof Function && this.type?.children_timeouts?.has(name)) {
                    value[name].datex_timeout = this.type.children_timeouts.get(name);
                }

                // save property to shadow_object
                this.shadow_object[name] = this.proxifyChild(name, NOT_EXISTING);
            }
        }

        // ... TODO

        return;
    }

    /** create proxy for object and adds listeners */
    private addObjProxy(obj:T):T {

        if (Object(obj) !== obj) return; // is primitive value

        // custom proxy
        let res = JSInterface.createProxy(obj, this, this.type);
        if (res != INVALID && res != NOT_EXISTING) return res; // proxy created successfully

        if (obj instanceof Stream || obj instanceof Function) { // no proxy needed?!
            return obj;
        }

    
        // get prototype and prototype of prototype (TODO go up the full protoype chain??!)
        let prototype1 = Object.getPrototypeOf(obj);
        let prototype2 = prototype1 && Object.getPrototypeOf(prototype1);
        if (prototype1 == Object.prototype) prototype1 = undefined;
        if (prototype2 == Object.prototype) prototype2 = undefined;

        // is a sealed 'DatexObject' (no proxy needed, getters/setters already included in DatexObject)
        if (obj[SHADOW_OBJECT] && Object.isSealed(obj)) {
            obj[SET_PROXY] = (k,v)=>this.handleSet(k,v);
            this.#shadow_object = new WeakRef(obj[SHADOW_OBJECT]);
            return obj;
        }

        // only define getters/setters (no Proxy wrapper class)
        else if (!Object.isSealed(obj) &&this.visible_children) {

            // set new shadow_object to handle properties in background
            const shadow_object = {[DX_PTR]:this};
            this.#shadow_object = new WeakRef(shadow_object);


            for (let name of this.visible_children) {

                /** extract existing getter + setter */
                // get descriptor containing getter/setter
                const property_descriptor = Object.getOwnPropertyDescriptor(obj,name) 
                    ?? (prototype1 && Object.getOwnPropertyDescriptor(prototype1,name))
                    ?? (prototype2 && Object.getOwnPropertyDescriptor(prototype2,name));

                // add original getters/setters to shadow_object if they exist (and call with right 'this' context)
                if (property_descriptor?.set || property_descriptor?.get) {
                    const descriptor:PropertyDescriptor = {};
                    if (property_descriptor.set) descriptor.set = val => property_descriptor.set?.call(obj,val);
                    if (property_descriptor.get) descriptor.get = () =>  property_descriptor.get?.call(obj)

                    Object.defineProperty(shadow_object, name, descriptor);
                }
                // no original getter/setter
                else shadow_object[name] = obj[name];

                // new getter + setter
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
 
        // create Proxy class around object
        if (((obj instanceof Function) || typeof obj == "object") && obj != null) {

            const is_array = Array.isArray(obj);

            if (is_array) {
                // overwrite special array methods TODO

                Object.defineProperty(obj, "splice", {
                    value: Pointer.arraySplice,
                    enumerable: false,
                    writable: false
                })
            }

            let proxy = new Proxy(<any>obj, {
                set: (target, val_name: keyof any, val: any) => {

                    // length changed
                    if (is_array && val_name == "length") {
                        // add empty values
                        if (val > obj.length) {
                            // do not change in DATEX
                            //for (let i=obj.length; i<val;i++) this.handleSet(i, undefined);
                            throw new ValueError("<Array> property 'length' cannot be increased");
                        }
                        // delete values
                        else if (val < obj.length) {
                            for (let i=obj.length-1; i>=val;i--) {
                                if (i in obj) this.handleDelete(BigInt(i));
                            }
                            // update array length if shorter than previous
                            obj.length = val;
                        }
                        
                        return true;
                    }

                    // ignore DATEX handling if array and not an index property
                    if (is_array && !(typeof val_name == "number" || typeof val_name == "bigint" || /^[0-9]+$/.test(globalThis.String(val_name)))) {
                        target[val_name] = val;
                        return true;
                    }

                    this.handleSet(is_array ? BigInt(Number(val_name)) : val_name, val);

                    // x = void => delete; trim array to match DATEX Arrays
                    if (is_array && val === VOID && Number(val_name)+1==obj.length) Runtime.runtime_actions.trimArray(obj)

                    return true;
                },
                deleteProperty: (target, prop) => {

                    this.handleDelete(is_array ? BigInt(Number(prop)) : prop);   
                    
                    // trim array to match DATEX Arrays
                    if (is_array && Number(prop)+1==obj.length) Runtime.runtime_actions.trimArray(obj)

                    return true
                }
            });



            // set right 'this' context for getters / setters
            for (let name of [...Object.getOwnPropertyNames(obj), ...Object.getOwnPropertyNames(prototype1??{}), ...Object.getOwnPropertyNames(prototype2??{})]) {
                // get descriptor containing getter/setter
                const property_descriptor = Object.getOwnPropertyDescriptor(obj,name) 
                ?? Object.getOwnPropertyDescriptor(prototype1,name) 
                ?? (prototype2 && Object.getOwnPropertyDescriptor(prototype2,name));

                // add original getters/setters to shadow_object if they exist (and call with right 'this' context)
                if (property_descriptor?.set || property_descriptor?.get) {
                    Object.defineProperty(obj, name, {
                        set: val => {property_descriptor.set?.call(proxy,val)},
                        get: () =>  property_descriptor.get?.call(proxy)
                    });
                }
            }

        

            return proxy;
        }

        else {
            return obj;
        }
    }

    // get property by key
    public getProperty(key:any) {
        let property_value = JSInterface.handleGetProperty(this.shadow_object, key, this.type)
        if (property_value == INVALID || property_value == NOT_EXISTING) property_value = this.shadow_object[key];
        return property_value;
    }

    handleSet(key:any, value:any, ignore_if_unchanged = true) {

        if(!this.value) return;

        // convert value/key to datex conform value/key
        value = this.proxifyChild(key, value);
        key = Pointer.proxifyValue(key);
        
        let obj = this.value;
        let existed_before = false;

        // does property exist in DATEX?
        if (!this.type.isPropertyAllowed(key)) {
            throw new ValueError("Property '" + key + '" does not exist')
        }

        // JS number -> bigint conversion
        if (typeof value == "number" && this.type.getAllowedPropertyType(key).root_type == Type.std.Int) value = BigInt(value);

        // invalid type for value?
        if (!this.type.isPropertyValueAllowed(key, value)) {
            throw new ValueError("Property '" + key + "' must be of type " + this.type.getAllowedPropertyType(key));
        }

        // get current value
        const current_value = this.getProperty(key);


        // value has not changed, TODO ? only okay if undefined and not key not previously in object (explicitly setting to void/undefined)
        if (current_value === value && ignore_if_unchanged) {
            return;
        }


        if (current_value !== undefined) existed_before = true;
  
        // try set on custom pseudo class
        let res = JSInterface.handleSetPropertySilently(obj, key, value, this, this.type);
        if (res == INVALID || res == NOT_EXISTING)  this.shadow_object[key] = value // set on original_value

        // propagate updates via datex
        if ((res == INVALID || res == NOT_EXISTING) && this.shadow_object instanceof Array) key = BigInt(key); // change to <Int> for DATEX if <Array>

        if (this.origin && !this.is_origin) {
            if (!this.#exclude_origin_from_updates) this.handleDatexUpdate(key, Runtime.PRECOMPILED_DXB.SET_PROPERTY, [this, key, value], this.origin)
        }
        else if (this.is_origin && this.subscribers.size) {
            this.handleDatexUpdate(key, Runtime.PRECOMPILED_DXB.SET_PROPERTY, [this, key, value], this.#update_filter )
        }

        // make sure the array index is a number
        if (this.value instanceof Array) key = Number(key);

        // inform observers
        this.callObservers(value, key, Value.UPDATE_TYPE.SET)

        // inform listeners
        // property changed
        if (existed_before && Pointer.pointer_property_change_listeners.size) {
            setTimeout(()=>{
                for (let l of Pointer.pointer_property_change_listeners) l(this, key, value)
            }, 0)
        }
        // property was added new
        else if (!existed_before && Pointer.pointer_property_add_listeners.size) {
            setTimeout(()=>{
                for (let l of Pointer.pointer_property_add_listeners) l(this, key, value)
            }, 0)
        }

    }

    handleAdd(value:any) {
        if(!this.value) return;

        // convert value to datex conform value
        value = this.proxifyChild(undefined, value);

        let obj = this.value;

        let index;

        // try set on custom pseudo class
        let res = JSInterface.handlePropertyActionSilently(BinaryCode.ADD, obj, value, this, this.type);
        if (res == INVALID || res == NOT_EXISTING) {
            if (this.shadow_object instanceof Array) index = this.shadow_object.push(value); // Array push
            else throw new ValueError("Cannot add values to this value");
        }

        // propagate updates via datex
        if (this.origin && !this.is_origin) {
            if (!this.#exclude_origin_from_updates) this.handleDatexUpdate(null, '? += ?', [this, value], this.origin)
        }
        else if (this.is_origin && this.subscribers.size) {
            this.handleDatexUpdate(null, '? += ?', [this, value], this.#update_filter)
        }
        

        // inform observers
        this.callObservers(value, VOID, Value.UPDATE_TYPE.ADD)

        // inform listeners
        if (Pointer.pointer_property_add_listeners.size) {
            setTimeout(()=>{
                index = index ?? (<any[]>Runtime.serializeValue(this.value))?.indexOf(value) // array: use index, Set: first serialize to array and get index
                for (let l of Pointer.pointer_property_add_listeners) l(this, index, value)
            }, 0);
        }

    }

    private streaming = []; // use array because DatexPointer is sealed
    startStreamOut() {
        let obj = this.value;

        // only if this.value is a DatexStream
        if (!obj || !(obj instanceof Stream)) return;

        this.streaming.push(true); // also stream for all future subscribers

        if (this.origin && !this.is_origin) {
            logger.info("streaming to parent " + this.origin);
            if (!this.#exclude_origin_from_updates) this.handleDatexUpdate(null, '? << ?'/*DatexRuntime.PRECOMPILED_DXB.STREAM*/, [this, obj], this.origin)
        }
        else if (this.is_origin && this.subscribers.size) {
            logger.info("streaming to subscribers " + this.subscribers_filter);
            this.handleDatexUpdate(null, '? << ?'/*DatexRuntime.PRECOMPILED_DXB.STREAM*/, [this, obj], this.#update_filter)
        }
    }

    // TODO better way than streaming individually to every new subscriber?
    startStreamOutForEndpoint(endpoint:Datex.Addresses.Endpoint) {
        logger.info("streaming to new subscriber " + endpoint);
        this.handleDatexUpdate(null, '? << ?'/*DatexRuntime.PRECOMPILED_DXB.STREAM*/, [this, this.value], endpoint)
    }
    

    /** all values are removed */
    handleClear() {
        if(!this.value) return;

        let obj = this.value;

        // get keys before clear (array indices as numbers, not integers)
        const keys = this.getKeys(true);

        let res = JSInterface.handleClearSilently(obj, this, this.type);
        if (res == INVALID || res == NOT_EXISTING) {
            if (this.shadow_object instanceof Array) Array.prototype.splice.call(this.shadow_object, 0, this.shadow_object.length); // Array clear
            else throw new ValueError("Cannot perform clear operation on this value");
        }


        // propagate updates via datex?
        if (this.origin && !this.is_origin) {
            if (!this.#exclude_origin_from_updates) this.handleDatexUpdate(null, Runtime.PRECOMPILED_DXB.CLEAR_WILDCARD, [this], this.origin)
        }
        else if (this.is_origin && this.subscribers.size) {
            this.handleDatexUpdate(null, Runtime.PRECOMPILED_DXB.CLEAR_WILDCARD, [this], this.#update_filter)
        }

        // TODO inform observers?
        // inform observers
        for (let key of keys) {
            this.callObservers(VOID, key, Value.UPDATE_TYPE.CLEAR)
        }
        

        // inform listeners
        if (Pointer.pointer_property_delete_listeners.size) {
            setTimeout(()=>{
                for (let l of Pointer.pointer_property_delete_listeners) l(this, undefined)
            }, 0)
        }
    }

    /** all values are removed */
    handleSplice(start_index:number, deleteCount:number, replace:Array<bigint>) {
        if(!this.value) return;

        if (deleteCount == 0 && !replace.length) return; // nothing changes

        let obj = this.value;

        
        const start = BigInt(start_index);
        const end = BigInt(start_index+deleteCount);
        let size = BigInt(deleteCount);
        const replace_length = BigInt(replace.length);

        // removed overflows array length
        if (obj instanceof Array && start+size > obj.length) size = BigInt(obj.length) - start;

        let ret:any;

        // array splice
        if (obj instanceof Array) {
            ret = Array.prototype.splice.call(this.shadow_object, start_index, deleteCount, ...replace);
        }

        // propagate updates via datex?
        if (this.origin && !this.is_origin) {
            if (!this.#exclude_origin_from_updates) {
                if (!replace?.length) this.handleDatexUpdate(null, '#0 = ?0; #1 = count #0;#0.(?1..?2) = void;#0.(?1..#1) = #0.(?3..#1);', [this, start, end, start+size], this.origin) // no insert
                else this.handleDatexUpdate(null, '#0=?0;#0.(?4..?1) = void; #0.(?2..((count #0) + ?3)) = #0.(?4..(count #0));#0.(?4..?5) = ?6;', [this, end, start-size+replace_length, replace_length, start, start+replace_length, replace], this.origin) // insert
            }
        }
        else if (this.is_origin && this.subscribers.size) {
            if (!replace?.length) this.handleDatexUpdate(null, '#0 = ?0; #1 = count #0;#0.(?1..?2) = void;#0.(?1..#1) = #0.(?3..#1);', [this, start, end, start+size], this.#update_filter) // no insert
            else  this.handleDatexUpdate(null, '#0=?0;#0.(?4..?1) = void; #0.(?2..((count #0) + ?3)) = #0.(?4..(count #0));#0.(?4..?5) = ?6;', [this, end, start-size+replace_length, replace_length, start, start+replace_length, replace], this.#update_filter) // insert
        }

        // inform observers TODO what to do here?
        //for (let o of this.general_change_observers||[]) o(undefined); 
        
        // inform listeners
        if (Pointer.pointer_property_delete_listeners.size) {
            setTimeout(()=>{
                for (let l of Pointer.pointer_property_delete_listeners) l(this, undefined)
            }, 0)
        }

        return ret;
    }

    /** value is removed (by key)*/
    handleDelete(key:any) {
        if(!this.value) return;

        let obj = this.value;

        // does property exist in DATEX?
        if (!this.type.isPropertyAllowed(key)) {
            throw new ValueError("Property '" + key + '" does not exist')
        }

        let res = JSInterface.handleDeletePropertySilently(obj, key, this, this.type);
        if (res == INVALID || res == NOT_EXISTING)  delete this.shadow_object[key]; // normal object

        // propagate updates via datex
        
        if ((res == INVALID || res == NOT_EXISTING) && this.shadow_object instanceof Array) key = BigInt(key); // change to <Int> for DATEX if <Array>

        if (this.origin && !this.is_origin) {
            if (!this.#exclude_origin_from_updates) this.handleDatexUpdate(null, '?.? = void', [this, key], this.origin)
        }
        else if (this.is_origin && this.subscribers.size) {
            this.handleDatexUpdate(null, '?.? = void', [this, key], this.#update_filter)
        }
        
        // inform observers
        this.callObservers(VOID, key, Value.UPDATE_TYPE.DELETE)

       
        // inform listeners
        if (Pointer.pointer_property_delete_listeners.size) {
            setTimeout(()=>{
                for (let l of Pointer.pointer_property_delete_listeners) l(this, key)
            }, 0);
        }
    }

    /** value is removed */
    handleRemove(value:any) {
        if(!this.value) return;

        let obj = this.value;

        let res = JSInterface.handlePropertyActionSilently(BinaryCode.SUBTRACT, obj, value, this, this.type);
        if (res == INVALID || res == NOT_EXISTING) {
            throw new ValueError("Cannot subtract values from this value");
        }

        // propagate updates via datex
        if (this.origin && !this.is_origin) {
            if (!this.#exclude_origin_from_updates) this.handleDatexUpdate(null, '? -= ?', [this, value], this.origin)
        }
        else if (this.is_origin && this.subscribers.size) {
            logger.info("forwarding delete to subscribers " + this.#update_filter);
            this.handleDatexUpdate(null, '? -= ?', [this, value], this.#update_filter)
        }

        // inform observers
        this.callObservers(value, VOID, Value.UPDATE_TYPE.REMOVE)

        // inform listeners
        if (Pointer.pointer_property_delete_listeners.size) {
            setTimeout(()=>{
                for (let l of Pointer.pointer_property_delete_listeners) l(this, value)
            }, 0);
        }
    }

    // actual update to subscribers/origin
    // if identifier is set, further updates to the same identifier are overwritten
    async handleDatexUpdate(identifier:string, datex:string|PrecompiledDXB, data:any[], receiver:Datex.Addresses.Filter|Datex.Addresses.Target){

        // let schedulter handle updates (cannot throw errors)
        if (this.#scheduleder) {
            this.#scheduleder.addUpdate(this, identifier, datex, data, receiver);
        }

        // directly send update
        else {
            try {
                await Runtime.datexOut([datex, data], receiver, undefined, true, undefined, undefined, false, undefined, this.datex_timeout);
            } catch(e) {
                throw e;
                //logger.error("forwarding failed", e, datex, data)
            }
        }

    }


    private change_observers: Map<any, Set<(value:any, key:any, type?:Value.UPDATE_TYPE)=>void>> = new Map();
    private bound_change_observers: Map<object, Map<any, Set<(value:any, key:any, type?:Value.UPDATE_TYPE)=>void>>> = new Map();
    private general_change_observers: Set<(value:any, key:any, type?:Value.UPDATE_TYPE)=>void> = new Set(); // property_update is always true, undefined for other DatexValues / when the actual value is updated
    private bound_general_change_observers: Map<object, Set<(value:any, key:any, type?:Value.UPDATE_TYPE)=>void>> = new Map(); // property_update is always true, undefined for other DatexValues / when the actual value is updated


    // observe pointer value change (primitive) of change of a key
    public override observe<K=any>(handler:(value:any, key?:K, type?:Value.UPDATE_TYPE)=>void, bound_object?:object, key?:K):void {
        if (!handler) throw new ValueError("Missing observer handler")

        // TODO handle bound_object in pointer observers/unobserve
        // observe all changes
        if (key == undefined) {
            super.observe(handler, bound_object); // default observer

            if (bound_object) {
                if (!this.bound_general_change_observers.has(bound_object)) this.bound_general_change_observers.set(bound_object, new Set());
                this.bound_general_change_observers.get(bound_object).add(handler);
            }
            else this.general_change_observers.add(handler); // observer property updates
        }
        // observe specific property
        else {
            // make sure the array index is a number
            if (this.value instanceof Array) key = <K><unknown>Number(key);

            if (bound_object) {
                if (!this.bound_change_observers.has(bound_object)) this.bound_change_observers.set(bound_object, new Map());
                let bound_object_map = this.bound_change_observers.get(bound_object);
                if (!bound_object_map.has(key)) bound_object_map.set(key, new Set());
                bound_object_map.get(key).add(handler);
            }
            else {
                if (!this.change_observers.has(key)) this.change_observers.set(key, new Set());
                this.change_observers.get(key).add(handler);
            }
        }
    }

    public override unobserve<K=any>(handler:(value:any, key?:K, type?:Value.UPDATE_TYPE)=>void, bound_object?:object, key?:K):void {
        // unobserve all changes
        if (key == undefined) {
            super.unobserve(handler, bound_object); // default observer

            if (bound_object) {
                this.bound_general_change_observers.get(bound_object)?.delete(handler);
                if (this.bound_general_change_observers.get(bound_object).size == 0) this.bound_general_change_observers.delete(bound_object)
            }
            else this.general_change_observers.delete(handler); // observer property updates
        }

        // unobserve observer for specific property
        else {
            if (bound_object) {
                this.bound_change_observers.get(bound_object)?.get(key)?.delete(handler);
                if (this.bound_change_observers.get(bound_object)?.size == 0) this.bound_change_observers.delete(bound_object);
                else if (this.bound_change_observers.get(bound_object)?.get(key)?.size == 0) this.bound_change_observers.get(bound_object).delete(key);
            }
            else this.change_observers.get(key)?.delete(handler);
        }
    }


    private callObservers(value:any, key:any, type:Value.UPDATE_TYPE) {
        // key specific observers
        if (key!=undefined) {
            for (let o of this.change_observers.get(key)||[]) o(value, key, type); 
            // bound observers
            for (let [object, entries] of this.bound_change_observers.entries()) {
                for (let [k, handlers] of entries) {
                    if (k === key) {
                        for (let handler of handlers) {
                            if (handler.call(object, value, key, type) === false) this.unobserve(handler, object, key);
                        }
                    }
                }
            }
        } 
        // general observers
        for (let o of this.general_change_observers||[]) o(value, key, type);     
        // bound generalobservers
        for (let [object, handlers] of this.bound_general_change_observers||[]) {
            for (let handler of handlers) {
                if (handler.call(object, value, key, type) === false) this.unobserve(handler, object, key);
            }
        }
    }


    override toString(){
        return `$${this.id}`
    }

}


export namespace Value {
    export enum UPDATE_TYPE {
        INIT,
        SET,
        DELETE,
        CLEAR,
        ADD,
        REMOVE
    }
}

globalThis["p"] = Pointer.pointers;
globalThis["DatexPointer"] = Pointer;

// register DatexStorage as pointer source
Pointer.registerPointerSource(new DatexStoragePointerSource());


// class for primitive value pointers
export class PrimitivePointer<T=any> extends Pointer<T> {

    override get is_persistant() {return true}
    override set is_persistant(persistant:boolean) {}
    override updateGarbageCollection(){}

    override get original_value():T {return <T>this.value}

    // TODO typescript not working (any)
    override get value() {return super.value}

    override set value(_v:T) {
        const v = Value.collapseValue(_v,true,true);

        // set new
        if (!this._getValueUpdated()) {
            
            this._setValue(<any>v);
            this._setType(Type.getValueDatexType(v));

            this.afterFirstValueSet();
        }
        // update
        else {
            const newType = Type.getValueDatexType(v);
            if (newType !== this.type) throw new ValueError("Invalid value type for pointer: " + newType + " - must be " + this.type);
            // new value
            this._setValue(<any>v);
        }
    }

    public override getSerializedValue(){
        return SerializedValue.get(this);
    }
}

export class String<T extends string = string> extends PrimitivePointer<T> {}
export class Int extends PrimitivePointer<int> {}
export class Float extends PrimitivePointer<float> {}
export class Boolean extends PrimitivePointer<boolean> {}
export class Buffer extends PrimitivePointer<ArrayBuffer> {}






/** proxy function (for remote calls) */

export function getProxyFunction(method_name:string, params:{dynamic_filter?:Datex.Addresses.Filter, filter:Datex.Addresses.Filter|Datex.Addresses.Target, sign?:boolean, scope_name?:string, timeout?:number}):(...args:any[])=>Promise<any> {
    return function(...args:any[]) {
        // compile dx and send
        
        // copy dynamic filter !!! might change while executing this function
        let dynamic_filter = params.dynamic_filter ? params.dynamic_filter.clone() : null;
        let filter = dynamic_filter ? (params.filter ? Datex.Addresses.Filter.createMergedFilter(dynamic_filter, params.filter) : dynamic_filter) : params.filter||new Datex.Addresses.Filter(); 
        
        //console.log("proxy function filter", dynamic_filter, filter)

        let compile_info:compile_info = [`#static.${params.scope_name}.${method_name} ?`, [new Tuple(args)], {to:filter, sign:params.sign}];
        return Runtime.datexOut(compile_info, filter, undefined, true, undefined, undefined, false, undefined, params.timeout);
    }
}


export function getProxyStaticValue(name:string, params:{dynamic_filter?:Datex.Addresses.Filter, filter:Datex.Addresses.Filter|Datex.Addresses.Target, sign?:boolean, scope_name?:string, timeout?:number}):(...args:any[])=>Promise<any> {
    return function() {
        // compile dx and send
        
        // copy dynamic filter !!! might change while executing this function
        let dynamic_filter = params.dynamic_filter ? params.dynamic_filter.clone() : null;
        let filter = dynamic_filter ? (params.filter ? Datex.Addresses.Filter.createMergedFilter(dynamic_filter, params.filter) : dynamic_filter) : params.filter||new Datex.Addresses.Filter(); 
        
        let compile_info:compile_info = [`#static.${params.scope_name}.${name}`, [], {to:filter, sign:params.sign}];
        return Runtime.datexOut(compile_info, filter, undefined, true, undefined, undefined, false, undefined, params.timeout);
    }
}

// DATEX class wrapper around JS Promises to support remote executed Task

export class Task<R=any,E=any> {

    datex:Datex.Scope
    #executed = false;
    
    promise:Promise<any>

    // locally executed task, can be awaited
    get is_local(){return !!this.datex}

    result: R|E
    state: 0n|1n|2n = 0n // 0 = running, 1 = success, 2 = error

    constructor(datex?:Datex.Scope) {
        this.datex = datex;
    }

    replicate(){
        // not local, no this.datex, create remote awaiting promise, because run is/was called externally
        this.#remotePromise();
    }

    // TODO default create anonymouse pointer for this class -> pointer available immediately at construct/replicate?
    #remotePromise(){
        this.promise = new Promise((resolve, reject) => {
            // already finished
            if (this.state > 0n) {
                if (this.state == 2n) reject(this.result);
                else resolve(this.result);
            }
            // wait for state change
            Datex.Pointer.observe(this, ()=>{
                console.log("finished task:",this);
                if (this.state > 0n) {
                    if (this.state == 2n) reject(this.result);
                    else resolve(this.result);
                    return false; // unobserve
                }
            }, this, 'state')
        })
    }

    run (SCOPE:datex_scope) {
        if (!this.#executed) {
            this.#executed = true;
            this.promise = new Promise(async (resolve, reject)=>{
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
            })
        }
    }
}

export class LazyValue extends Task {}



class ExtensibleFunction {
    constructor(f:globalThis.Function) {
        return Object.setPrototypeOf(f, new.target.prototype);
    }
}


/** function - execute datex or js code - use for normal functions, not for static scope functions */
export class Function extends ExtensibleFunction implements ValueConsumer, StreamConsumer {
    
    public context?: object|Pointer;  // the context (this) in which the function exists, if part of an object
    public body: Scope
    public ntarget: (...params:any[])=>any
    public location:Datex.Addresses.Endpoint

    fn:(...params:any[])=>any

    allowed_callers:Datex.Addresses.Filter
    serialize_result:boolean // return pointer values, not pointers
    anonymize_result:boolean
    params: Tuple
    params_keys: string[]

    meta_index: number

    datex_timeout?: number

    about:Markdown

    private proxy_fn?: globalThis.Function // in case the function should be called remotely, a proxy function

    constructor(body:Scope, ntarget:(...params:any[])=>any, location:Datex.Addresses.Endpoint = Runtime.endpoint, params?:Tuple, allowed_callers?:Datex.Addresses.Filter|Datex.Addresses.Target, meta_index=undefined, context?:object|Pointer, anonymize_result=false) {
        super((...args:any[]) => this.handleApply(new Tuple(args)));
        
        this.meta_index = meta_index;
        this.params = params??new Datex.Tuple();
        this.params_keys = [...this.params.named.keys()];

        this.body = body;
        this.ntarget = ntarget;
        this.location = location;

        // execute DATEX code
        if (body instanceof Scope) {
            this.meta_index = 0;
            let ctx = context instanceof Pointer ? context.value : context;
            this.fn = (meta, ...args:any[])=>body.execute(this.mapArgs(args), meta.sender, ctx); // execute DATEX code
        }
        // execute native JS code
        else if (typeof ntarget == "function") {
            this.fn = ntarget;
        }

        if (allowed_callers instanceof Datex.Addresses.Target) allowed_callers = new Datex.Addresses.Filter(allowed_callers);
        this.allowed_callers = <Datex.Addresses.Filter> allowed_callers;
        this.anonymize_result = anonymize_result;

        Object.defineProperty(this,'context',{
            enumerable:false,
            value: context
        });

        // update location if currently @@local, as soon as connected to cloud
        if (this.location == Datex.Addresses.LOCAL_ENDPOINT) {
            Datex.Runtime.onEndpointChanged((endpoint)=>{
                logger.info("update local function location for " + Datex.Runtime.valueToDatexString(this))
                this.location = endpoint;
            })
        }


    }

    private mapArgs(args:any[]){
        // generate variables from arguments
        const variables = {};
        let i = 0;
        for (let name of this.params_keys) {
            variables[name] = args[i++];
        }
        return variables;
    }

    // execute this function remotely, set the endpoint
    private setRemoteEndpoint(endpoint: Datex.Addresses.Endpoint){
        let filter = new Datex.Addresses.Filter(endpoint); 
        //let my_pointer = <Pointer> Pointer.pointerifyValue(this);

        let sid = DatexCompiler.generateSID(); // fixed sid to keep order
        
        // save pointer in variable:
        /**
         * _ = $aaaaa328749823749234;
         * return _(a,b,c);
         * return _(d,e,f);
         * return _(g,h,i);
         * ...
         */
        
        Runtime.datexOut(['_=?;', [this], {to:filter, end_of_scope:false, sid, return_index: DatexCompiler.getNextReturnIndexForSID(sid)}], filter, sid, false);

        this.proxy_fn = async (value: any) => {
            let compile_info:compile_info = [this.serialize_result ? 'value (_ ?);return;' : '_ ?;return;', [value], {to:filter, end_of_scope:false, sid, return_index: DatexCompiler.getNextReturnIndexForSID(sid)}];
            
            // run in scope, get result
            try {
                let res = await Runtime.datexOut(compile_info, filter, undefined, true, undefined, undefined, false, undefined, this.datex_timeout);
                return res;
            } catch (e) {
                // error occured during scope execution => scope is broken, can no longer be used => create new scope
                console.log(e);
                logger.debug("Error ocurred, resetting DATEX scope for proxy function");
                this.setRemoteEndpoint(endpoint); // new DATEX scope
                throw e;
            }
        }
    }

    __call__(...params:any[]):any {
        logger.error("HERE NOT")
    }

    // handle streams
    write(data:any, scope?:datex_scope) {
        return this.handleApply(data, scope);
    }

    async pipe(in_stream:Stream) {
        const reader = in_stream.getReader();
        let next:ReadableStreamReadResult<ArrayBuffer>;
        while (true) {
            next = await reader.read()
            if (next.done) break;
            this.write(next.value);
        }
    }

    // call the function either from JS directly (meta data is automatically generated, sender is always the current endpoint) or from a DATEX scope
    handleApply(value:any, SCOPE?: datex_scope){


        // call function remotely
        if (!Runtime.endpoint.equals(this.location) && this.location != Datex.Addresses.LOCAL_ENDPOINT) this.setRemoteEndpoint(this.location);

        let meta:any; // meta (scope variables)

        // called from DATEX scope
        if (SCOPE) {
            // check exec permissions
            if (!SCOPE.execution_permission || (this.allowed_callers && !this.allowed_callers.test(SCOPE.sender))) {
                throw new PermissionError("No execution permission", SCOPE);
            }

            // is proxy function: call remote, only if has impersonation permission!
            if (this.proxy_fn) {
                if (SCOPE.impersonation_permission) return this.proxy_fn(value);
                else throw new PermissionError("No permission to execute functions on external endpoints", SCOPE)
            }
            // else local call ...
            meta = SCOPE.meta;
        }

        // called locally
        else {
            // proxy function: call remote
            if (this.proxy_fn) return this.proxy_fn(value);
            // else generate meta data
            meta = {
                sender: Runtime.endpoint,
                current: Runtime.endpoint,
                timestamp: new Date(),
                signed: true,
                type: DatexProtocolDataType.LOCAL_REQ,
                local: true // set true if function was executed locally, not via DATEX (not a DATEX variable)
            }
        }

        // no function or DATEX provided
        if (!this.fn) throw new Datex.RuntimeError("Cannot apply values to a <Function> with no executable DATEX or valid native target");

        let context = this.context instanceof Value ? this.context.value : this.context;

        let params:any[];
       
        // record
        if (value instanceof Tuple) {
            params = [];
            for (let [key, val] of value.entries()) {
                // normal number index
                if (!isNaN(Number(key.toString()))) {
                    if (Number(key.toString()) < 0) throw new RuntimeError("Invalid function arguments: '" + key + "'");
                    if (Number(key.toString()) >= this.params_keys.length) throw new RuntimeError("Maximum number of function arguments is " + (this.params_keys.length), SCOPE);
                    params[Number(key.toString())] = val;
                }
                // get index of named argument
                else {
                    const index = this.params_keys.indexOf(key.toString());
                    if (index == -1) throw new RuntimeError("Invalid function argument: '" + key + "'", SCOPE);
                    params[index] = val; 
                }
            }
        }
        // no args
        else if (value == VOID) params = [];
        // single arg
        else {
            params = [value];
        }

        // argument type checking
        if (this.params) {
            let i = 0;
            for (let [name, required_type] of this.params.entries()) {
                let actual_type = Type.getValueDatexType(params[i]);
                if (
                    required_type
                    && required_type != Type.std.Object  // argument type is not further specified (can be any typescript type)

                    && actual_type!=Type.std.Null
                    && actual_type!=Type.std.Void // void and null are accepted by default

                    && !(<Type>required_type).matchesType(actual_type) // root type of actual type match
    
                ) {
                    throw new TypeError(`Invalid argument '${name}': type should be ${required_type.toString()}`, SCOPE);
                }
                i++;
            }
        }

        let required_param_nr = this.params.size;
        // no meta index, still crop the params to the required size if possible
        if (this.meta_index==undefined) {
            if (required_param_nr==undefined || params.length<=required_param_nr) return this.fn.call(context, ...params);
            else if (params.length>required_param_nr) return this.fn.call(context, ...params.slice(0,required_param_nr));
        }
        // inject meta information at given index when calling the function
        else if (this.meta_index==-1) {
            // crop params to required size
            if (required_param_nr==undefined || params.length==required_param_nr) return this.fn.call(context, ...params, meta);
            else if (params.length>required_param_nr) return this.fn.call(context, ...params.slice(0,required_param_nr), meta);
            else if (params.length<required_param_nr) return this.fn.call(context, ...params, ...Array(required_param_nr-params.length), meta);
        }
        // add meta index at the beginning
        else if (this.meta_index==0) return this.fn.call(context, meta, ...params);
        // insert meta index inbetween
        else if (this.meta_index > 0) {
            let p1 = params.slice(0,this.meta_index);
            let p2 = params.slice(this.meta_index);
            // is the size of p1 right?
            if (p1.length == this.meta_index) return this.fn.call(context, ...p1, meta, ...p2);
            // p1 too short (p2 is empty in this case)
            else return this.fn.call(context, ...p1, ...Array(this.meta_index-p1.length), meta);
        }
        else {
            throw new RuntimeError("Invalid index for the meta parameter", SCOPE);
        }
    }


    bodyToString(formatted=false, parentheses=true, spaces = '  '){
        if (this.body) return this.body.bodyToString(formatted, parentheses, spaces)
        else return '(### native code ###)'; // <Void> 'native code';
    }

    override toString(formatted=false, spaces = '  '){
        return `function ${this.params_keys.length == 0 ? '()' : Runtime.valueToDatexString(this.params)}${(formatted ? " ":"")}${this.bodyToString(formatted, true, spaces)}`;
    }

}


export class IterationFunction extends Function {


    override handleApply(value: any, SCOPE?: datex_scope) {
        // don't await result
        this.handleApply(value, SCOPE);
    }

}


// unit
export class Unit extends Number {

    override toString(){
        return Runtime.floatToString(Number(this))+ "u"
    }
}

// Tuple
export class Tuple<T=any> {

    // '#' not working with proxy?
    #indexed:Array<T> = [];
    #named:Map<string,T> = new Map();

    constructor(initial_value?:T[]|Set<T>|Map<string,T>|Object){
        if (initial_value instanceof Array || initial_value instanceof Set) {
            this.#indexed.push(...initial_value);
        }
        else if (initial_value instanceof Map) {
            for (const [k,v] of initial_value) this.#named.set(k,v);
        }
        else if (typeof initial_value === "object"){
            for (let [name,value] of Object.entries(initial_value)) this.#named.set(name, value);
        }
        else if (initial_value != null) throw new Datex.ValueError("Invalid initial value for <Tuple>");
    }

    seal(){
        DatexObject.seal(this);
        return this;
    }

    get indexed(){
        return this.#indexed;
    }

    get named(){
        return this.#named;
    }

    // total size (number + string indices)
    get size(){
        return this.#named.size + this.#indexed.length;
    }

    // set value at index
    set(index:number|bigint|string, value:any) {
        if (typeof index === "number" || typeof index === "bigint") this.#indexed[Number(index)] = value;
        else if (typeof index === "string") this.#named.set(index, value);
        else throw new Datex.ValueError("<Tuple> key must be <String> or <Int>")
    }

    // get value at index
    get(index:number|bigint|string) {
        if (typeof index === "number" || typeof index === "bigint") return this.#indexed[Number(index)];
        else if (typeof index === "string") return this.#named.get(index);
        else throw new Datex.ValueError("<Tuple> key must be <String> or <Int>")
    }

    // return copy of internal array if only number indices
    toArray() {
        if (this.#named.size == 0) return [...this.#indexed];
        else throw new Datex.ValueError("<Tuple> has non-integer indices");
    }

    // to object
    toObject() {
        if (this.#indexed.length == 0) return Object.fromEntries(this.#named);
        else throw new Datex.ValueError("<Tuple> has integer indices");
    }

    entries() {
        return this[Symbol.iterator]();
    }

    // create full copy
    clone(){
        const cloned = new Tuple(this.named);
        cloned.indexed.push(...this.indexed)
        return cloned;
    }

    // push to array
    push(...values:any[]){
        this.#indexed.push(...values);
    }


    // push and add
    spread(other:Tuple) {
        this.#indexed.push(...other.indexed);
        for (let [name,value] of other.named.entries()) this.#named.set(name, value);
    }

    *[Symbol.iterator]() {
        for (const entry of this.#indexed.entries()) yield entry;
        for (const entry of this.#named.entries()) yield entry;
    }

    // generate Tuple of start..end
    static generateRange(start:bigint|number, end:bigint|number): Tuple<bigint>{
        if (typeof start == "number") start = BigInt(start);
        if (typeof end == "number") end = BigInt(end);

        if (typeof start != "bigint" || typeof end != "bigint") throw new ValueError("Range only accepts <Int> as boundaries");
        if (end<start) throw new ValueError("Second range boundary must be greater than or equal to the first boundary");

        const N = Number(end-start), range = new Tuple<bigint>();
        let i = 0n;
        while (i < N) range[Number(i)] = start + i++;

        return range.seal();
    }
}

export const EXTENDED_OBJECTS = Symbol("EXTENDED_OBJECTS");
export const INHERITED_PROPERTIES = Symbol("INHERITED_PROPERTIES");
const SET_PROXY = Symbol("SET_PROXY");
const SHADOW_OBJECT = Symbol("SHADOW_OBJECT");

// only "interface" for all DATEX objects, has special hidden properties (symbols) and static methods for object extending
// base class for all Datex object based types (Record, custom typed values)
export abstract class DatexObject {

    constructor(object?:Object){
        if (object) Object.assign(this, object);
    }

    // enable iteratation over DatexObjects like Maps (for (x of object))
    *[Symbol.iterator](){for (const entry of Object.entries(this)) yield entry;}


    private [EXTENDED_OBJECTS]: Set<object>;
    private [INHERITED_PROPERTIES]: Set<string>;
    private [SET_PROXY]:(k:any, v:any)=>void
    private [SHADOW_OBJECT]:object;


    // return whether this objects extends an other object (recursive check)
    static extends(object:object,extends_object:object):boolean {
        const extended_objects = object[EXTENDED_OBJECTS];
        if (!extended_objects) return false; // does not extend any object
        if (extended_objects.has(extends_object)) return true;
        // recursive check all extended objects
        else {
            for (let ext_object of extended_objects) {
                if (ext_object[EXTENDED_OBJECTS] && DatexObject.extends(ext_object, extends_object)) {
                    return true;
                }
            }
            return false;
        }
    }


    // extend any object (only currently available properties are bound to this object, properties that are added later are ignored)
    // if update_back is false, changes on this object do not reflect onto the extended object
    static extend(object:object, extend_object:object, update_back = true):object {
        if (typeof extend_object != "object") throw new ValueError("Cannot extend an object with a primitive value");
        if (typeof object != "object" || object == null) throw new ValueError("Not an object or null");

        // add sets
        if (!object[EXTENDED_OBJECTS]) object[EXTENDED_OBJECTS] = new Set();
        if (!object[INHERITED_PROPERTIES]) object[INHERITED_PROPERTIES] = new Set();

        // already extends
        if (DatexObject.extends(object, extend_object)) return;

        // cross referenced extension - not allowed
        if (DatexObject.extends(extend_object, object)) throw new ValueError("Cross-referenced extensions are not allowed");

        // extended object does not change, just copy key-value pairs
        if (Object.isFrozen(extend_object) || !update_back) {
            for (const key of Object.keys(extend_object)) {
                object[INHERITED_PROPERTIES].add(key);
                object[key] = extend_object[key];
            }
        }

        else {
            for (const key of Object.keys(extend_object)) {
                const descriptor = Object.getOwnPropertyDescriptor(object, key);
                if (!descriptor || descriptor.configurable) {
                    Object.defineProperty(object, key, <PropertyDescriptor>{
                        set(v){
                            extend_object[key] = v;
                        },
                        get(){
                            return extend_object[key]
                        },
                        enumerable: true,
                        configurable: true
                    })
                }
                // cannot define new getter/setters!
                else {
                    logger.warn("Cannot create new getter/setter for extendable object key: " + key);
                    object[key] = extend_object[key];
                }
                object[INHERITED_PROPERTIES].add(key);
            }
        }

        object[EXTENDED_OBJECTS].add(extend_object);

        return object;
    }

    // always call this method to seal a DatexObject, not Object.seal(...)
    static seal(object:Object){
        if (Object.isSealed(object)) return; // already sealed

        // add required symbol properties (SET_PROXY)
        object[SET_PROXY] = undefined;

        // add getter / setter proxies for all properties (not extended properties)
        // required if DatexObject is a pointer
        const shadow_object = object[SHADOW_OBJECT] = {};
        for (const key of Object.keys(object)) {
            // only add if not inherited from an extended object
            if (!object[INHERITED_PROPERTIES]?.has(key)) {


                // get descriptor containing getter/setter
                const property_descriptor = Object.getOwnPropertyDescriptor(object,key);

                // add original getters/setters to shadow_object if they exist (and call with right 'this' context)
                if (property_descriptor?.set || property_descriptor?.get) {
                    const descriptor:PropertyDescriptor = {};
                    if (property_descriptor.set) descriptor.set = val => property_descriptor.set?.call(object,val);
                    if (property_descriptor.get) descriptor.get = () =>  property_descriptor.get?.call(object)

                    Object.defineProperty(shadow_object, key, descriptor);
                }
                else shadow_object[key] = object[key];

                Object.defineProperty(object, key, <PropertyDescriptor>{
                    set(v){
                        if (object[SET_PROXY]) object[SET_PROXY](key, v); // set via proxy
                        else shadow_object[key] = v;
                    },
                    get(){
                        return shadow_object[key]
                    },
                    enumerable: true,
                    configurable: false
                })
            }
        }

        Object.seal(shadow_object);
        Object.seal(object);
        return object;
    }

    static freeze(object:Object){
        Object.freeze(object);
        return object;
    }

    // get / set methods
    // get<K extends keyof T>(key:K):T[K] {return (<T><unknown>this)[key];}
    // set<K extends keyof T, V extends T[K]>(key:K, value:V) {(<T><unknown>this)[key] = value;}
    // has<K extends keyof T>(key:K) {return this.hasOwnProperty(key);}
}





export class StaticScope {

    public static STD: StaticScope;
    public static scopes: {[name:string]:StaticScope} = {};

    public static readonly NAME: unique symbol = Symbol("name");
    public static readonly DOCS: unique symbol = Symbol("docs");

    // return a scope with a given name, if it already exists
    public static get(name?:string):StaticScope {
        return this.scopes[name] || new StaticScope(name);
    }

    private constructor(name?:string){
        const proxy = <this> Pointer.proxifyValue(this, false, undefined, false);
        if (name) proxy.name = name;
        return proxy;
    }

    // handle scope variables
    getVariable(name: string) {
        return this[name];
    }
    setVariable(name: string, value: any) {
        return this[name] = value;
    }
    hasVariable(name: string) {
        return this.hasOwnProperty(name)
    }

    // update/set the name of this static scope
    set name(name:string){
        if (this[StaticScope.NAME]) delete StaticScope.scopes[this[StaticScope.NAME]];
        this[StaticScope.NAME] = name;
        StaticScope.scopes[this[StaticScope.NAME]] = this;
        if (this[StaticScope.NAME] == "std") StaticScope.STD = this;
    }

    get name() {
        return this[StaticScope.NAME]
    }

    set docs(docs:string) {
        this[StaticScope.DOCS] = docs;
    }
    
    get docs() {
        return this[StaticScope.DOCS];
    }
}



// typed object
export class TypedValue<T extends Type = Type> extends DatexObject {

    [DX_TYPE]: Type

    constructor(type:T, value?:T extends Type<infer TT> ? TT : unknown) {
        super(value)
        this[DX_TYPE] = type;
    }

}


// typed value that can not be mapped to an object
export class UnresolvedValue {

    [DX_TYPE]: Type
    [DX_VALUE]: any

    constructor(type:Type, value:any) {
        this[DX_VALUE] = value;
        this[DX_TYPE] = type;
    }

}

// TODO remove SerializedValue ? redundant
/** contains serialized pointer value and type */
export class SerializedValue extends UnresolvedValue {

    private constructor(value:any, type?:Type) {
        super(type ?? Type.getValueDatexType(value), value);
    }

    static get(value:any):SerializedValue|number|bigint|string|ArrayBuffer|boolean {
        if (value instanceof SerializedValue) return value;
        else if (value instanceof UnresolvedValue) return new SerializedValue(value[DX_VALUE], value[DX_TYPE]);
        // TODO required somewhere (does not work with DatexStorage pointer sync)
        //else if (value instanceof DatexPrimitivePointer) return value.value; // collapse primitive pointer and return primitive value
        else return new SerializedValue(value)
    }

    getSerialized():[type:Type, value:any] {
        let value;

        // save type and serialize value
        if (this[DX_TYPE]?.is_complex) {
            value = Runtime.serializeValue(this[DX_VALUE]);
        }
        // serialize value
        else if (this[DX_TYPE]?.serializable_not_complex) {
            value = Runtime.serializeValue(this[DX_VALUE]);
        }
        // don't serialize value, already a datex fundamental
        else value = this[DX_VALUE]

        // collapse primitive pointers
        if (value instanceof Pointer) value = value.value;

        return [this[DX_TYPE], value];
    }
}


/** <ns:type> */
export class Type<T = any> {

    // part of the datex standard types, complex or primitive, no specific type casting needed
    static fundamental_types = ["String", "Float", "Int", "Boolean", "Target", "Endpoint", "Filter", "Null", "Void", "Array", "Object", "Tuple", "Type", "Buffer", "Datex", "Unit", "Url"]
    // have a primitive datex representation:
    static primitive_types = ["String", "Float", "Int", "Boolean", "Null", "Void", "Unit", "Target", "Endpoint", "Buffer", "Type", "Url"];
    // have a custom datex representation (+ all primitive)
    static compact_rep_types = ["Datex", "Filter"];
    // should be serialized, but is not a complex type (per default, only complex types are serialized)
    static serializable_not_complex_types = ["Buffer"]

    public static types = new Map<string, Type>();   // type name -> type

    public static type_templates = new Map<Type, object>();   // type name -> type (only required for Datex viewer tree view)
    public static template_types = new WeakMap<object, Type>();   // type name -> type (only required for Datex viewer tree view)

    // <namespace:name/variation(parameters)>
    namespace:string = 'std'
    name:string = ''
    variation:string = ''
    parameters:any[] // special type parameters

    root_type: Type; // DatexType without parameters and variation
    base_type: Type; // DatexType without parameters

    is_complex = true;
    is_primitive = false;
    has_compact_rep = false; // has special compact representation, like @sdfaf or <type>
    serializable_not_complex = false
    
    timeout?: number // timeout for request on values of this type

    #proxify_children: boolean // proxify all (new) children of this type

    children_timeouts?: Map<string, number> // individual timeouts for children

    get proxify_children() {return this.interface_config?.proxify_children ?? this.#proxify_children}
    set proxify_children(proxify: boolean) {if (this.interface_config) {this.interface_config.proxify_children = proxify}; this.#proxify_children = proxify}

    // all children allowed by the template
    #visible_children: Set<any>
    get visible_children() {return this.#visible_children ?? this.interface_config?.visible_children}

    // get about Markdown
    #about: string
    #about_md: Markdown
    get about() {
        if (!this.#about_md) {
            this.#about_md = new Markdown(`## ${this.toString().replace("<","\\<").replace(">","\\>")}\n${this.#about}`);
        }
        return this.#about_md
    }


    // templated type (struct)
    #template: {[key:string]:Type}|any[] & T
    // constructor, replicator, destructor
    #constructor_fn: globalThis.Function
    #replicator_fn: globalThis.Function
    #destructor_fn: globalThis.Function

    // configuration for advanced JS interface
    get interface_config(){
        return this.#interface_config ?? (this.root_type != this ? this.root_type?.interface_config : undefined);
    }

    #interface_config: js_interface_configuration

    #implemented_types = new Set<Type>(); // template [EXTENDED_OBJECTS] + additional types
    get implemented_types(){
        return this.#implemented_types;
    }

    public addImplementedType(type: Type) {
        this.#implemented_types.add(type);
    }

    // add a constructor function
    public setConstructor(constructor_fn:globalThis.Function) {
        this.#constructor_fn = constructor_fn;
    }
    // add a replicator function
    public setReplicator(replicator_fn:globalThis.Function) {
        this.#replicator_fn = replicator_fn;
    }  
    // add a destructor function
    public setDestructor(destructor_fn:globalThis.Function) {
        this.#destructor_fn = destructor_fn;
    }

    // maps DATEX template type representation to corresponding typescript types
    public setTemplate<NT extends Object>(template: NT):Type<Partial<({ [key in keyof NT]: (NT[key] extends Type<infer TT> ? TT : any ) })>>
    public setTemplate(template: object) {
        DatexObject.freeze(template);
        this.#template = <any>template;
        this.#visible_children = new Set(Object.keys(this.#template));
        // add extended types from template
        for (let t of this.#template[EXTENDED_OBJECTS]??[]) {
            this.#implemented_types.add(Type.template_types.get(t))
        }
        
        Type.type_templates.set(this, template)
        Type.template_types.set(template, this);

        return <any>this;
    }


    get template() {
        return this.#template;
    }

    // cast object with template to new <Tuple>
    private createFromTemplate(value:object = {}, assign_to_object:object = new TypedValue(this)):T {
        if (!this.#template) throw new RuntimeError("Type has no template");
        if (!(typeof value == "object")) throw new RuntimeError("Cannot create template value from non-object value");

        // add all allowed properties (check template types)
        for (let key of Object.keys(this.#template)) {
            // @ts-ignore this.#template is always a Tuple
            const required_type = this.#template[key];
            
            // no type check available
            if (!required_type) {
                assign_to_object[key] = value[key];
            }
            // check value type
            else if (key in value && required_type.matches(value[key])) {
                assign_to_object[key] = value[key];
            }
            // JS number->bigint conversion
            else if (key in value && required_type.root_type == Type.std.Int && typeof value[key] == "number" && Number.isInteger(value[key])) {
                assign_to_object[key] = BigInt(value[key]);
            }
            // add default template value
            else if (value[key] == VOID && required_type.template) {
                assign_to_object[key] = required_type.createFromTemplate();
            }
            else if (value[key] == VOID) assign_to_object[key] = VOID;
            else throw new ValueError("Property '" + key + "' must be of type " + required_type);
        }
        // copy permissions from template
        if (this.#template[DX_PERMISSIONS]) {
            const permissions = assign_to_object[DX_PERMISSIONS] = {}
            for (let [key,val] of Object.entries(this.#template[DX_PERMISSIONS])) {
                permissions[key] = val;
            }
        }

        assign_to_object[DX_TEMPLATE] = this.#template;

        return <any>(assign_to_object instanceof DatexObject ? DatexObject.seal(assign_to_object) : assign_to_object);
    }

    public createDefaultValue(context?:any, origin:Datex.Addresses.Endpoint = Runtime.endpoint): Promise<any>{
        return Datex.Runtime.castValue(this, VOID, context, origin);
    }

    static #current_constructor:globalThis.Function;

    public static isConstructing(value:object) {
        return value.constructor == this.#current_constructor;
    }

    // cast any value to a value of this type (for custom types)
    public cast(value: any, context?:any, origin:Datex.Addresses.Endpoint = Runtime.endpoint, make_pointer = false):T|typeof UNKNOWN_TYPE {
        // unknown type (no template or config)
        if (!this.interface_config && !this.template) return UNKNOWN_TYPE;
        
        // has a JS configuration
        if (this.interface_config){
            // generate default value
            if (value === VOID && this.interface_config.empty_generator instanceof globalThis.Function) return this.interface_config.empty_generator();
            // custom cast method
            else if (this.interface_config.cast) {
                return this.interface_config.cast(value, this, context, origin);
            }
            // special cast: prototype
            else if (typeof value == "object" && this.interface_config.prototype) {
                const object = Object.create(this.interface_config.prototype)
                Object.assign(object, value);
                return object;
            }
        }

        // no JS config or no custom casting -> handle default constructor
        // 'pseudo constructor arguments', multiple args if tuple, if not object! (normal cast), use value as single argument
        let args:any[];
        let is_constructor = true;
        if (value instanceof Tuple) args = value.toArray(); // multiple constructor arguments with tuple (ignores keys!)
        else if (typeof value != "object" || value === null) args = [value] // interpret any non-object value as a constructor argument
        else {
            args = [];
            is_constructor = false; // is replicated object, not created with constructor arguments
        }

        // create new instance - TODO 'this' as last constructor argument still required?
        Type.#current_constructor = this.interface_config?.class;
        let instance = this.interface_config?.class ? Reflect.construct(Type.#current_constructor, is_constructor?[...args/*,this*/]:[]) : new TypedValue(this);
        Type.#current_constructor = null;

        // initialize properties
        if (!is_constructor) {
            // initialize with template
            if (this.#template) this.createFromTemplate(value, instance)
            // just copy all properties if no template found
            else {
                Object.assign(instance, value);
            }
        }
        
        // call DATEX construct methods and create pointer
        return this.construct(instance, args, is_constructor, make_pointer);
    }

    public construct(instance:any, args:any[], is_constructor = true, make_pointer = false) {
        instance[DX_TEMPLATE] = this.#template;

        // make pointer?
        if (make_pointer) {
            instance = Pointer.create(null, instance, false, undefined, false, false).value
        }

        // call custom DATEX constructor or replicator
        if (is_constructor && this.#constructor_fn) this.#constructor_fn.apply(instance, args);
        else if (!is_constructor && this.#replicator_fn) this.#replicator_fn.apply(instance, args);
        
        return instance;
    }


    // JS interface configuration

    public setJSInterface(configuration:js_interface_configuration):Type<T>{
        this.#interface_config = configuration;
        JSInterface.handleConfigUpdate(this, configuration);
        return this;
    }


    // about (documentation/description)

    public setAbout(about: string | Markdown) {
        if (about instanceof Markdown) this.#about_md = about;
        else if (typeof about == "string") this.#about = about;
        else throw new ValueError("Invalid about, must be <String>");
    }


    private constructor(namespace?:string, name?:string, variation?:string, parameters?:any[]) {
        if (name) this.name = name;
        if (namespace) this.namespace = namespace;
        if (variation) this.variation = variation;
        
        this.parameters = parameters;
        this.base_type = parameters ? Type.get(namespace, name, variation) : this; // get base type without parameters
        this.root_type = (variation||parameters) ? Type.get(namespace, name) : this; // get root type without variation and parameters

        this.is_primitive = namespace=="std" && Type.primitive_types.includes(this.name);
        this.is_complex   = namespace!="std" || !Type.fundamental_types.includes(this.name);
        this.has_compact_rep = namespace=="std" && (this.is_primitive || Type.compact_rep_types.includes(this.name));
        this.serializable_not_complex = Type.serializable_not_complex_types.includes(this.name);

        
        if (!parameters) Type.types.set((this.namespace||"std")+":"+this.name+"/"+(this.variation??""), this); // add to pointer list
    }

    // get parametrized type
    public getParametrized(parameters:any[]):Type<T>{
        return Type.get(this.namespace, this.name, this.variation, parameters);
    }

    // get type variation
    public getVariation(variation:string):Type<T>{
        return Type.get(this.namespace, this.name, variation, this.parameters);
    }

    // type check (type is a subtype of this)
    public matchesType(type:any){
        return Type.matchesType(type, this);
    }
    public matches(value:any){
        return Type.matches(value, this);
    }


    public setChildTimeout(child:string, timeout: number) {
        if (!this.children_timeouts) this.children_timeouts = new Map();
        this.children_timeouts.set(child, timeout)
    }

    // TODO remove
    public addVisibleChild(child:string) {
        if (!this.#visible_children) this.#visible_children = new Set();
        this.#visible_children.add(child)
    }

    // match type against visible_children
    public isPropertyAllowed(property:any) {
        // all children allowed or specific child allowed
        return !this.visible_children || this.visible_children.has(property);
    }

    // match type against template
    public isPropertyValueAllowed(property:any, value:any) {
        if (!this.#template) return true;
        else if (typeof property !== "string") return true; // only strings handled by templates
        else return (!this.#template[property] || this.#template[property].matches?.(value)) // check if value allowed
    }

    // get type for value in template
    public getAllowedPropertyType(property:any):Type {
        if (!this.#template) return Type.std.Any;
        else if (typeof property !== "string") return Type.std.Void; // key must be a string (TOOD type None?)
        else return this.#template[property]
    }

    #string:string

    toString(){
        if (!this.#string) {
            this.#string = `<${
                (this.namespace && this.namespace != 'std') ? this.namespace+":":""}${this.name}${
                this.variation?'/'+this.variation:''}${
                this.parameters?(
                    this.parameters.length == 1 ? '('+Runtime.valueToDatexString(this.parameters[0])+')':
                    '('+this.parameters.map(p=>Runtime.valueToDatexString(p)).join(",")+')'
                ):''
            }>`;
        }
        return this.#string;
    }

    toJSON(){
        return "dx::"+this.toString();
    }

    /** static */

    public static or(...types:Type[]){
        if (types.length == 1) return types[0]; // no or required
        return Datex.Type.std.Or.getParametrized(types);
    }

    // type check (type is a subtype of matches_type)
    public static matchesType(type:Type, matches_type: Type) {
        return matches_type == Type.std.Any || Type._matchesType(type, matches_type) || Type._matchesType(type.root_type, matches_type)
    }

    private static _matchesType(type:Type, matches_type: Type) {
        // or
        if (matches_type.base_type == Type.std.Or) {
            if (!matches_type.parameters) return false;
            for (let [_,t] of matches_type.parameters) {
                if (Type._matchesType(type, t)) return true; // any type matches
            }
            return false;
        }
        if (type.base_type == Type.std.Or) {
            if (!type.parameters) return false;
            for (let [_,t] of type.parameters) {
                if (Type._matchesType(t, matches_type)) return true; // any type matches
            }
            return false;
        }
        // and
        if (matches_type.base_type == Type.std.And) {
            if (!matches_type.parameters) return false;
            for (let [_,t] of matches_type.parameters) {
                if (!Type._matchesType(type, t)) return false; // any type does not match
            }
            return true;
        }
        // default
        return (matches_type == Type.std.Any || (matches_type === type || (type.implemented_types.has(matches_type)))) ?? false
    }

    private static matchesTemplate(template:object, parent_template:object){
        if (template == parent_template) return true;
        // recursive check all templates
        else {
            for (let object of template[EXTENDED_OBJECTS]||[]) {
                if (typeof object == "object" && this.matchesTemplate(object, parent_template)) return true;
            }
            return false;
        }
    }

    // check if root type of value matches exactly
    public static matches(value:any, type: Type) {
        // value has a matching DX_TEMPLATE
        if (type.template && value[DX_TEMPLATE] && this.matchesTemplate(value[DX_TEMPLATE], type.template)) return true;
        // compare types
        return Type.matchesType(Type.getValueDatexType(value), type);
    }

    public static extends(type:Type, extends_type:Type){
        console.log("extemds",type,extends_type)
        return type!=extends_type && Type.matchesType(type, extends_type);
    }

    public static get<T = any>(name:string, parameters?:any[]):Type<T>
    public static get<T = any>(namespace:string, name:string, variation?:string, parameters?:any[]):Type<T>
    public static get<T = any>(namespace:string, name_or_parameters?:string|any[], variation?:string, parameters?:any[]):Type<T> {
        let name:string;
        if (name_or_parameters instanceof Array) parameters = name_or_parameters;
        else if (typeof name_or_parameters == "string") name = name_or_parameters;
        else if (name_or_parameters!=undefined) throw new TypeError("Invalid type name or parameters");

        if (namespace?.includes(":")) [namespace, name] = namespace.split(":");
        if (name === undefined) {
            name = namespace;
            namespace = "std";
        }
        if (!namespace) namespace = "std";
        if (!name) throw new Error("Invalid type");
        if (name?.includes("/")) [name, variation] = name.split("/");

        if (parameters) return new Type(namespace, name, variation, parameters);
        else return this.types.get(namespace+":"+name+"/"+(variation??"")) || new Type(namespace, name, variation, parameters);
    }

    public static has(namespace?:string, name?:string, variation?:string) {
        if (namespace.includes(":")) [namespace, name] = namespace.split(":");
        if (name.includes("/")) [name, variation] = name.split("/");
        return this.types.has((namespace||"std")+":"+name+"/"+(variation??""));
    }

    // get datex type from value
    public static getValueDatexType(value:any):Type {

        value = Value.collapseValue(value,false,true)

        if (value instanceof PrimitivePointer) {
            return value.type;
        }
        // should not happen
        else if (value instanceof Pointer) {
            console.warn("Tried to get the type of a pointer reference")
            throw new RuntimeError("Tried to get the type of a pointer reference");
        }

        // get type from DX_TYPE property
        if (value?.[DX_TYPE]) return value[DX_TYPE];

        // get type from pointer
        let type:Type
        if (type = Pointer.getByValue(value)?.type) return type;

        // get custom type
        let custom_type = JSInterface.getValueDatexType(value);

        if (!custom_type) {
            if (value === VOID) return Type.std.Void;
            if (value === null) return Type.std.Null;

            if (value?.[DX_TYPE]) return value[DX_TYPE]; // override Datex Type

            if (value instanceof Unit) return Type.std.Unit;
            if (typeof value == "string") return Type.std.String;
            if (typeof value == "bigint") return Type.std.Int;
            if (typeof value == "number") return Type.std.Float;
            if (typeof value == "boolean") return Type.std.Boolean;
            if (typeof value == "symbol") return Type.std.Void; // TODO?, ignores symbols

            if (value instanceof ArrayBuffer || value instanceof NodeBuffer || value instanceof TypedArray) return Type.std.Buffer;
            if (value instanceof Tuple) return Type.std.Tuple;
            if (value instanceof Array) return Type.std.Array;

            if (value instanceof SyntaxError) return Type.std.SyntaxError;
            if (value instanceof CompilerError) return Type.std.CompilerError;
            if (value instanceof PointerError) return Type.std.PointerError;
            if (value instanceof ValueError) return Type.std.ValueError;
            if (value instanceof PermissionError) return Type.std.PermissionError;
            if (value instanceof TypeError) return Type.std.TypeError;
            if (value instanceof NetworkError) return Type.std.NetworkError;
            if (value instanceof RuntimeError) return Type.std.RuntimeError;
            if (value instanceof SecurityError) return Type.std.SecurityError;
            if (value instanceof AssertionError) return Type.std.AssertionError;

            if (value instanceof Error) return Type.std.Error;
    
            if (value instanceof Markdown) return Type.std.Markdown;
            if (value instanceof Date) return Type.std.Time;
            if (value instanceof URL) return Type.std.Url;

            if (value instanceof Function) return Type.std.Function;
            if (value instanceof Stream) return Type.std.Stream;
            if (value instanceof Type) return Type.std.Type;
            if (value instanceof Datex.Addresses.Endpoint) return Type.std.Endpoint;
            if (value instanceof Datex.Addresses.Target) return Type.std.Target;
            if (value instanceof Datex.Addresses.Filter) return Type.std.Filter;
            if (value instanceof Datex.Addresses.Not) return Type.std.Not;
            if (value instanceof Scope) return Type.std.Scope;
    

            if (typeof value == "object") return Type.std.Object;
    
            else return Type.std.Object;
        }
        return custom_type;
    }


    // get datex type from js class
    public static getClassDatexType(class_constructor:any):Type {

        if (class_constructor[DX_TYPE]) return class_constructor[DX_TYPE]; // type shortcut

        let custom_type = JSInterface.getClassDatexType(class_constructor);
        let type:Type;
        if (!custom_type) {

            if (class_constructor == Unit || Unit.isPrototypeOf(class_constructor)) return Type.std.Unit;
            if (class_constructor == globalThis.String || globalThis.String.isPrototypeOf(class_constructor)) return Type.std.String;
            if (class_constructor == BigInt || BigInt.isPrototypeOf(class_constructor)) return Type.std.Int;
            if (class_constructor == Number || Number.isPrototypeOf(class_constructor)) return Type.std.Float;
            if (class_constructor == globalThis.Boolean || globalThis.Boolean.isPrototypeOf(class_constructor)) return Type.std.Boolean;

            if (class_constructor == ArrayBuffer || class_constructor == NodeBuffer || TypedArray.isPrototypeOf(class_constructor)) return Type.std.Buffer;
            if (class_constructor == Tuple || Tuple.isPrototypeOf(class_constructor)) return Type.std.Tuple;
            if (class_constructor == Array || Array.isPrototypeOf(class_constructor)) return Type.std.Array;

            if (class_constructor ==  SyntaxError || SyntaxError.isPrototypeOf(class_constructor)) return Type.std.SyntaxError;
            if (class_constructor ==  CompilerError || CompilerError.isPrototypeOf(class_constructor)) return Type.std.CompilerError;
            if (class_constructor ==  PointerError || PointerError.isPrototypeOf(class_constructor)) return Type.std.PointerError;
            if (class_constructor ==  ValueError || ValueError.isPrototypeOf(class_constructor)) return Type.std.ValueError;
            if (class_constructor ==  PermissionError || PermissionError.isPrototypeOf(class_constructor)) return Type.std.PermissionError;
            if (class_constructor ==  TypeError || TypeError.isPrototypeOf(class_constructor)) return Type.std.TypeError;
            if (class_constructor ==  NetworkError || NetworkError.isPrototypeOf(class_constructor)) return Type.std.NetworkError;
            if (class_constructor ==  RuntimeError || RuntimeError.isPrototypeOf(class_constructor)) return Type.std.RuntimeError;
            if (class_constructor ==  SecurityError || SecurityError.isPrototypeOf(class_constructor)) return Type.std.SecurityError;
            if (class_constructor ==  AssertionError || AssertionError.isPrototypeOf(class_constructor)) return Type.std.AssertionError;

            if (class_constructor ==  Error || Error.isPrototypeOf(class_constructor)) return Type.std.Error;

            if (class_constructor ==  Markdown || Markdown.isPrototypeOf(class_constructor)) return Type.std.Markdown;
            if (class_constructor ==  Date || Date.isPrototypeOf(class_constructor)) return Type.std.Time;
            if (class_constructor ==  URL || URL.isPrototypeOf(class_constructor)) return Type.std.Url;

            if (class_constructor ==  Function || Function.isPrototypeOf(class_constructor)) return Type.std.Function;
            if (class_constructor ==  Stream || Stream.isPrototypeOf(class_constructor)) return Type.std.Stream;
            if (class_constructor ==  Type || Type.isPrototypeOf(class_constructor)) return Type.std.Type;
            if (class_constructor ==  Datex.Addresses.Endpoint || Datex.Addresses.Endpoint.isPrototypeOf(class_constructor)) return Type.std.Endpoint;
            if (class_constructor ==  Datex.Addresses.Target || Datex.Addresses.Target.isPrototypeOf(class_constructor)) return Type.std.Target;
            if (class_constructor ==  Datex.Addresses.Filter || Datex.Addresses.Filter.isPrototypeOf(class_constructor)) return Type.std.Filter;
            if (class_constructor ==  Datex.Addresses.Not || Datex.Addresses.Not.isPrototypeOf(class_constructor)) return Type.std.Not;
            if (class_constructor ==  Scope || Scope.isPrototypeOf(class_constructor)) return Type.std.Scope;

            if (class_constructor == Object) return Type.std.Object;

            else return Type.std.Object;
        }
        return custom_type;
    }

    public static doesValueHaveProperties(value:any):boolean {
        return value && typeof value == "object" && !(
            value instanceof Datex.Addresses.Filter || 
            value instanceof globalThis.Function || 
            value instanceof Unit ||
            value instanceof Date ||
           // value instanceof Datex.Addresses.Target ||
            value instanceof ArrayBuffer
        ) 
    }

    // can change object properties of none-primitive (x[y] = z)
    public static isValueObjectEditable(value:any):boolean {
        return !(value instanceof Set || value instanceof Function) 
    }



    static std = {
        Int: Type.get<bigint>("std:Int"),
        Int_8: Type.get<bigint>("std:Int").getVariation("8"),
        Int_16: Type.get<bigint>("std:Int").getVariation("16"),
        Int_32: Type.get<bigint>("std:Int").getVariation("32"),
        Int_64: Type.get<bigint>("std:Int").getVariation("64"),

        Int_u8: Type.get<bigint>("std:Int").getVariation("u8"),
        Int_u16: Type.get<bigint>("std:Int").getVariation("u16"),
        Int_u32: Type.get<bigint>("std:Int").getVariation("u32"),
        Int_u64: Type.get<bigint>("std:Int").getVariation("u64"),

        String: Type.get<string>("std:String"),
        Float: Type.get<number>("std:Float"),
        Unit: Type.get<Unit>("std:Unit"),
        Boolean: Type.get<boolean>("std:Boolean"),
        Null: Type.get<null>("std:Null"),
        Void: Type.get<undefined>("std:Void"),
        Buffer: Type.get<ArrayBuffer>("std:Buffer"),

        Set: Type.get<Set<any>>("std:Set"),
        Map: Type.get<(Map<any,any>)>("std:Map"),
        Transaction: Type.get("std:Transaction"),

        Object: Type.get<object>("std:Object"),
        Array: Type.get<Array<any>>("std:Array"),
        Tuple: Type.get<Tuple>("std:Tuple"),
        ExtObject: Type.get<object>("std:ExtObject"),

        Type: Type.get<Type>("std:Type"),
        Function: Type.get<Function>("std:Function"),
        Stream: Type.get<Stream>("std:Stream"),
        Markdown: Type.get<Markdown>("std:Markdown"),
        Filter: Type.get<Datex.Addresses.Filter>("std:Filter"),
        Target: Type.get<Datex.Addresses.Target>("std:Target"),
        Endpoint: Type.get<Datex.Addresses.Endpoint>("std:Endpoint"),
        Time: Type.get<Date>("std:Time"),
        Not: Type.get<Datex.Addresses.Not>("std:Not"),
        Url: Type.get<Datex.Addresses.Not>("std:Url"),
        Task: Type.get<Date>("std:Task"),
        Assertion:  Type.get<Date>("std:Assertion"),
        Iterator: Type.get<Date>("std:Iterator"),
        Iteration: Type.get<Date>("std:Iteration"), // iteration function, returns iterator

        Error: Type.get<Error>("std:Error"),
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

        Scope: Type.get<Scope>("std:Scope"),

        And: Type.get<any>("std:And"),
        Or: Type.get<any>("std:Or"),

        // abstract types
        Any: Type.get<any>("std:Any"),
        SyncConsumer: Type.get<any>("std:SyncConsumer"), // <<<
        ValueConsumer: Type.get<any>("std:ValueConsumer"), // any function or stream sink
        StreamConsumer: Type.get<any>("std:StreamConsumer"), // any function or stream sink

    }


    static short_types:{[key:number]:Type} = {
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
    }
}

// add type implementation references
Type.std.Function.addImplementedType(Type.std.ValueConsumer);
Type.std.Endpoint.addImplementedType(Type.std.ValueConsumer);
Type.std.Filter.addImplementedType(Type.std.ValueConsumer);
Type.std.Assertion.addImplementedType(Type.std.StreamConsumer);

Type.std.Function.addImplementedType(Type.std.StreamConsumer);
Type.std.Stream.addImplementedType(Type.std.StreamConsumer);


let total_size = 30//52; // Max safe int is 2**53-1
let current_binary_index = 0;
let current_filters = [];

function enableFilterLogicOperations(target_class:any){
    target_class.prototype[Symbol.toPrimitive] = function(hint) {
        if (hint === 'number') return _customLogicOperators(this);
        return this.toString();
    }
}


function _customLogicOperators(object:any) {
    let binary:string;

    // and / or detector bit
    if (current_binary_index == 0) { 
        // put '1' at first position
        binary = ("0".repeat(current_binary_index) + "1").padEnd(total_size/2,"0")
    }
    else { 
        // put a '1' for current calculation, and a '1' for the next one
        binary = ("0".repeat(current_binary_index-1) + "11").padEnd(total_size/2,"0")
    }

    // activation decector bit (checks if this target/filter was even involved in the current operation)
    binary += ("0".repeat(current_binary_index) + "1").padEnd(total_size/2,"0")

    console.debug(":: ", binary.match(/.{1,15}/g).join(" "));
    current_binary_index++;
    current_filters.push(object);
    return parseInt(binary, 2);
}


// let x = new DatexTypedValue(DatexType.std.String, "sf");
// const type2 = DatexType.get("x").addTemplate(new DatexRecord({x:DatexType.std.Map, xx:DatexType.std.Array}))
// const type = DatexType.get("x").addTemplate({a:DatexType.std.Int, b:type2})
// let y = type.createFromTemplate();

export class Iterator<T> {

    // @property
    val: T;
    done = false;

    internal_iterator: globalThis.Iterator<T>

    constructor(iterator?:globalThis.Iterator<T>) {
        this.internal_iterator = iterator ?? this.generator();
    }

    // @property
    async next(): Promise<boolean> {
        if (this.done) return false; // already done

        // use internal JS iterator / generator method
        let res = await this.internal_iterator.next()
        this.val = res.value;
        this.done = res.done;
        return !this.done;
    }


    async *[Symbol.iterator] (){
        while (await this.next()) yield this.val;
    }

    async collapse():Promise<Datex.Tuple>{
        let result = new Tuple();
        while (await this.next()) result.push(this.val)
        return result;
    }


    // convert value to default iterator
    public static get<T>(iterator_or_iterable:globalThis.Iterator<T>|globalThis.Iterable<T>|Datex.Iterator<T>|Datex.IterationFunction):Datex.Iterator<T> {
        if (iterator_or_iterable instanceof Iterator) return iterator_or_iterable;
        else if (iterator_or_iterable instanceof Datex.IterationFunction) {
            console.log("iterator for iteration function", iterator_or_iterable)
        }
        // indexed tuple
        else if (iterator_or_iterable instanceof Datex.Tuple && iterator_or_iterable.named.size == 0) return new Iterator(Iterator.getJSIterator(iterator_or_iterable.toArray()))
        else return new Iterator(Iterator.getJSIterator(iterator_or_iterable)); // create any other iterator or single value iterator
    }

    protected static getJSIterator<T>(iterator_or_iterable:Datex.Iterator<T>|globalThis.Iterator<T>|globalThis.Iterable<T>):globalThis.Iterator<T> {
        if (iterator_or_iterable instanceof Datex.Iterator) return iterator_or_iterable.internal_iterator;
        else if (typeof iterator_or_iterable == "function") return iterator_or_iterable;
        else return (typeof iterator_or_iterable != "string" && iterator_or_iterable?.[Symbol.iterator]) ? 
            iterator_or_iterable?.[Symbol.iterator]() : 
            [iterator_or_iterable][Symbol.iterator]()
    }

    // map globalThis.Iterator with function
    
    public static map<T,N>(iterator_or_iterable:Datex.Iterator<T>|globalThis.Iterator<T>|globalThis.Iterable<T>, map:(value:T)=>N):MappingIterator<T,N> {
        return new MappingIterator(iterator_or_iterable, map);
    }

    protected *generator():Generator<T>{}
}


class MappingIterator<T,N> extends Iterator<N> {

    #iterator:globalThis.Iterator<T>;
    #map:(value:T)=>N;

    constructor(iterator_or_iterable:Datex.Iterator<T>|globalThis.Iterator<T>|globalThis.Iterable<T>, map:(value:T)=>N) {
        super();
        this.#iterator = Iterator.getJSIterator(iterator_or_iterable);
        this.#map = map;
    }

    protected override *generator() {
        let result = this.#iterator?.next();
        while (!result?.done) {
            console.log("map",result.value)
            yield this.#map(result.value);
            result = this.#iterator.next();
        }
    }
    
}



export class RangeIterator extends Iterator<int> {

    #min:bigint;
    #max:bigint;

    constructor(min:number|bigint, max:number|bigint) {
        super();

        this.#min = typeof min == "number" ? BigInt(Math.floor(min)) : min;
        this.#max = typeof max == "number" ? BigInt(Math.floor(max)) : max;

    }

    protected override *generator() {
        while (this.#min < this.#max) {
            yield this.#min;
            this.#min++;
        }
    }
    
}


/**
 * ^: 01, 00 (and)
 * |: 10, 11 (or)
 
    active element: 10

    10 ^ 10 -> 00  |01 -> 01 ^01 -> 00 ^01 -> 01
    10 | 10 -> 10  |01 -> 11 ^01 -> 10 

    neutral element: 0

    neutral element: 0
    active elemnt: 1

    1 ^ 1 -> 0  |0 -> 0 
    1 | 1 -> 1  |0 -> 1 

    // toggle if target was added (one extra bit)
    1 ^ 0 -> 1
    1 | 0 -> 1

    second bit: 0 ~ -> 1 

    // #1: 010, 000, 001, 011
    // #2: 111, 

    // letzte operation eindeutig & or | erkennbar !

            00 11 01
        00 11 01 01
    & 00 11 01 01 01 
    | 11 01 01 01 01
    = 11 01 11
=> &  |         

    first: 11 = |, 00 = &

=> for &: 01 -> |, 00 -> &
    for |: 01 -> &, 11 -> |

    00 & 11 -> 0
    00 | 11 -> 1

    01 probe
*/ 



export class Assertion implements ValueConsumer {

    datex:Datex.Scope
    
    constructor(datex?:Datex.Scope) {
        this.datex = datex;
    }

    async assert(value:any, SCOPE?:Datex.datex_scope){
        const valid = await this.datex.execute([], SCOPE?.sender, SCOPE?.context, value);
        if (valid !== true && valid !== VOID) throw new Datex.AssertionError(valid === false ? 'Invalid' : Datex.Runtime.valueToDatexString(valid));
    }

    handleApply(value: any, SCOPE: datex_scope) {
        return this.assert(value, SCOPE);
    }
}



// parent class for &,| value compositions (logical formulas)
export class Composition<T=any> {

}




export namespace Addresses {


    export class AndSet<T> extends Set<T>{}


    /** a complex filter consisting of filter targets and negations, CNF */
    export class Filter {

        filter:Datex.Addresses.AndSet<filter> = new Datex.Addresses.AndSet();
        normal_filter: CNF;

        set(...ors:filter[]):void {
            // convert all strings to filters
            for (let o=0; o<ors.length;o++) {
                const or = ors[o];
                if (typeof or == "string") ors[o] = Filter.fromString(or);
            }
            this.filter = new Datex.Addresses.AndSet(ors);
            this.calculateNormalForm();
        }

        constructor(...ors:filter[]) {
            this.set(...<any>ors)
        }

        // append a filter (AND) to the current filter
        appendFilter(filter:filter) {
            if (typeof filter == "string") filter = Filter.fromString(filter);
            this.filter.add(filter)
            this.calculateNormalForm();
        }


        static createMergedFilter(f1:filter, f2:filter) {
            return new Filter(f1, f2);
        }

        /** helper functions */
        // merge cnf with other cnf
        static concatAndCNFs(cnf1:CNF, cnf2:CNF):boolean {

            or2: for (let or2 of cnf2||[]) {
                // iterate over all literals of new cnf2
                for (let literal2 of (or2 instanceof Set ? or2 : [or2])) {
                    
                    // iterate over all literals of cnf1
                    for (const or1 of cnf1||[]) {

                        let or1_it = (or1 instanceof Set ? or1 : [or1]); // iterator for or1

                        // check if all literals endpoints
                        let all_1_endpoints = true;
                        for (let literal1 of or1_it) {
                            if (!(literal1 instanceof Datex.Addresses.Endpoint)) {all_1_endpoints = false; break;}
                        }

                        // all literals are endpoints in or1 (@x | @y | +app)
                        if (all_1_endpoints) {

                            for (let literal1 of or1_it) {

                                // literal1 in first or, negated literal2 in second or -> delete both
                                if (literal1 == Datex.Addresses.Not.get(literal2)) {
                                    // delete literal1
                                    if (or1 instanceof Set) or1.delete(literal1); 
                                    else cnf1.delete(literal1)
                                    // delete literal2
                                    if (or2 instanceof Set) or2.delete(literal2); 
                                    else continue or2; // literal2 only a single value, don't add or2
                                }
        
                                
        
                                // (main part of literal2) == literal1 -> literal1 is redundant
                                if (literal2 instanceof Datex.Addresses.Endpoint && literal1 == literal2.main) {
                                    // delete literal1
                                    if (or1 instanceof Set) or1.delete(literal1); 
                                    else cnf1.delete(literal1)
                                }
                                // (main part of literal1) == literal2 -> literal2 is redundant
                                if (literal1 instanceof Datex.Addresses.Endpoint && literal2 == literal1.main) {
                                    // delete literal2
                                    if (or2 instanceof Set) or2.delete(literal2); 
                                    else continue or2; // literal2 only a single value, don't add or2
                                }
        
                                // ~literal1, literal2/xy -> invalid
                                if (literal1 instanceof Datex.Addresses.Not && literal2 instanceof Datex.Addresses.Endpoint && literal1.value == literal2.main) return false
                                if (literal2 instanceof Datex.Addresses.Not && literal1 instanceof Datex.Addresses.Endpoint && literal2.value == literal1.main) return false
        
                                if (literal1 instanceof Datex.Addresses.Endpoint && literal2 instanceof Datex.Addresses.Endpoint) {
                                    // literal1 = a/xy already exists, literal2 == a, can be removed
                                    if (literal1.main == literal2.main && literal1.instance!=undefined && literal2.instance==undefined) {
                                        // delete literal2
                                        if (or2 instanceof Set) or2.delete(literal2); 
                                        else continue or2; // literal2 only a single value, don't add or2
                                    }
                                }
                            }
                        }
                        
                    }
                }

                if (or2 instanceof Set && or2.size == 0) continue; // is empty now, ignore
                if (or2 instanceof Set && or2.size==1) or2 = [...or2][0] // if or-Set with single value, collapse Set

                // now add or2 to cnf1 AndSet 
                cnf1.add(or2);
            }
        
            return true;
        }

        // all possible (valid) combinations of n sets
        static* cartesian(...tail:any[]):Generator<Set<Datex.Addresses.Target|Datex.Addresses.Not<Datex.Addresses.Target>>,void,any> {
            let head = tail.shift();
            let remainder = tail.length ? Filter.cartesian(...tail) : [[]];
            for (const r of remainder||[]) for (const h of head||[]) {
                let ors = new Set([...(h instanceof Set ? h : [h]), ...r]);
                for (const o of ors) {
                    // check if contradicting values (!x | x) can be deleted
                    let not_o = Datex.Addresses.Not.get(o);
                    if (ors.has(not_o)) {ors.delete(not_o);ors.delete(o)} 

                    // main part already exists
                    if (o instanceof Datex.Addresses.Endpoint && ors.has(o.main)) {ors.delete(o)} 
                }
                yield ors;
            }
        }

        // create new a or b or c filter
        public static OR(...ors:(Filter|Datex.Addresses.Target|Datex.Addresses.Not|string)[]):Filter {
            let ors_set:Set<filter> = new Set();
            for (let or of ors) {
                if (typeof or == "string") ors_set.add(Filter.fromString(or));
                else ors_set.add(or);
            }
            return new Filter(ors_set);
        }
        // create new a and b and c filter
        public static AND(...ands:(Filter|Datex.Addresses.Target|Datex.Addresses.Not|string)[]):Filter {
            let and_set:Set<filter> = new Set();
            for (let and of ands) {
                if (typeof and == "string") and_set.add(Filter.fromString(and));
                else and_set.add(and);
            }
            return new Filter(...and_set);
        }


        /**
         * returns a datex_filter from a single target string (e.g. '@xy') or label ('#xy')
         * @param target_string a single filter target or a label
         * @returns a <Filter>, <Target>, <Array>, <Set> or <Tuple> that the given string describes
         */
        public static fromString(target_string: string):filter {
            // is label
            if (target_string.match(Regex.LABELED_POINTER)) {
                let filter = Pointer.getByLabel(target_string.slice(1)).value;
                if(!(filter instanceof Filter || filter instanceof Datex.Addresses.Target || filter instanceof Array || filter instanceof Set)) {
                    throw new ValueError("Invalid type: <Filter>, <Target>, <Tuple>, <Set> or <Array> expected")
                }
                return filter;
            }
            // is target
            return Datex.Addresses.Target.get(target_string);
        }

        /**
         * returns a datex_filter evaluated from a valid DATEX Script string that evaluates to a filter (e.g '@x & #yz | +app')
         * @param filter_string a DATEX Script string that returns a valid <Filter>, <Target>, <Array>, <Set> or <Tuple>
         */
        public static async fromFilterString(filter_string:string): Promise<filter> {
            const filter = await Runtime.executeDatexLocally(filter_string, {type:DatexProtocolDataType.DATA});
            if(!(filter instanceof Filter || filter instanceof Datex.Addresses.Target || filter instanceof Array || filter instanceof Set)) {
                console.warn(filter);
                throw new ValueError("Invalid type: <Filter>, <Target>, <Tuple>, <Set>, or <Array> expected")
            }
            else return filter;
        }

        public toString(formatted=false){
            let string = '';//'(';
            let cnf = this.calculateNormalForm();
            
            let i = cnf.size;
            for (let and of cnf) {
                string += "("
                let j = (and instanceof Set ? and.size : 1);
                for (let or of (and instanceof Set ? and : [and])) {
                    if (or instanceof Datex.Addresses.Not) string += "~" + or.value.toString()
                    else string += or.toString()
                    j--;
                    if (j > 0) string += " | ";
                }
                string += ")";
                i--;
                if (i > 0) string += " & ";
            }

            if (cnf.size == 0) string = "()";

            //string += ')';

            return string;
        }

        // returns all endpoints of the filter that could possible be valid (does not evaluate labels etc...!)
        public getPositiveEndpoints(){
            let cnf = this.calculateNormalForm();
            let endpoints = new Set<Datex.Addresses.Endpoint>();

            for (let and of cnf) {
                for (let or of (and instanceof Set ? and : [and])) {
                    if (or instanceof Datex.Addresses.Endpoint) endpoints.add(or);
                }
            }
            return endpoints;
        }

        public calculateNormalForm(resolve_pointers = true) {
            //if (this.normal_filter) return this.normal_filter;
            const cnf = Filter.toNormalForm(this, resolve_pointers);
            if (resolve_pointers) this.normal_filter = cnf;
            return cnf;    }

        // check if a set of properties are valid properties for this <Filter>
        public test(...properties:Datex.Addresses.Target[]){
            let props = new Set(properties)
            let main_parts = new Set<Datex.Addresses.Target>();
            for (let prop of props) {
                if (prop instanceof Datex.Addresses.Endpoint && prop.main) main_parts.add(prop.main);
            }

            let cnf = this.calculateNormalForm();
            for (let and of cnf) {
                let valid = false;
                for (let or of (and instanceof Set ? and : [and])) {
                    if (or instanceof Datex.Addresses.Not && !props.has((<Datex.Addresses.Not<Datex.Addresses.Target>> or).value) && !main_parts.has((<Datex.Addresses.Not<Datex.Addresses.Target>> or).value)) {valid=true;break} // or is okay
                    if (or instanceof Datex.Addresses.Target && props.has(or)) {valid=true;break}; // or is okay 
                    if (or instanceof Datex.Addresses.Target && main_parts.has(or)) {valid=true;break}; // or is okay 
                }
                if (!valid) return false;
            }
            return true;
        }

        // check if filter is exactly equal to a given target
        public equals(target:Datex.Addresses.Endpoint) {
            if (this.filter.size == 1) {
                let first = [...this.filter][0];
                if (first instanceof Set && first.size == 1) first = [...first][0];
                // is same as target endpoint?
                if (first instanceof Datex.Addresses.Endpoint && target.equals(first)) return true;
            }
            return false;
        }


        // creates NF from any filter, always returns a DatexAnd value
        private static toNormalForm(filter:filter, resolve_pointers = true) {
            return this._toNormalForm(filter, resolve_pointers) || new Datex.Addresses.AndSet();
        }

        // creates CNF from any filter, false if invalid
        private static _toNormalForm(filter:filter, resolve_pointers = true):CNF|false {
            
            // return pointer value as is
            if (!resolve_pointers) {
                const pointer = Pointer.getByValue(<any>filter);
                if (pointer) return <any> pointer; // return the pointer directly
            }
        

            // collapse <Filter>
            if (filter instanceof Filter) filter = filter.filter;

            let cnf:CNF


            // filter is a literal
            if (filter instanceof Datex.Addresses.Target) {
                cnf = new Datex.Addresses.AndSet();
                cnf.add(filter)
                return cnf;
            }
            

            // and
            if (filter instanceof Datex.Addresses.AndSet) {
                let first = true;
                for (let f of filter) {
                    // cnf ist first element of and set
                    if (first) {
                        let _cnf = Filter._toNormalForm(f);
                        if (_cnf==false) return false;
                        else cnf = _cnf;
                        first = false;
                        continue;
                    }

                    // concat other and elements
                    let cnf2 = Filter._toNormalForm(f);
                    if (cnf2==false) return false;
                    if (!Filter.concatAndCNFs(cnf,cnf2)) return false;
                }
                return cnf ?? new Datex.Addresses.AndSet();
            }

            // or
            if (filter instanceof Set) {
                cnf = new Datex.Addresses.AndSet();
                let literals = [];
                for (let f of filter) {
                    let lit = Filter._toNormalForm(f);
                    if (lit!==false) literals.push(lit);
                }
                // get all (valid) combinations
                for (let c of Filter.cartesian(...literals)) {
                    cnf.add(c.size == 1 ? [...c][0] : c);
                }

                return cnf;
            }

            // not 
            if (filter instanceof Datex.Addresses.Not) {
                cnf = new Datex.Addresses.AndSet();

                // collapse <Filter>
                let not_value = filter.value;
                if (not_value instanceof Filter) not_value = not_value.filter;

                // not variable
                if (not_value instanceof Datex.Addresses.Target) {
                    cnf.add(<Datex.Addresses.Not<Datex.Addresses.Target>>filter);
                    return cnf;
                }

                // double not
                if (not_value instanceof Datex.Addresses.Not) return Filter._toNormalForm(not_value.value);

                // not and
                if (not_value instanceof Datex.Addresses.AndSet) {
                    let ors = new Set<any>();
                    for (let f of not_value) ors.add(Datex.Addresses.Not.get(f));
                    return Filter._toNormalForm(new Datex.Addresses.AndSet([ors]))
                }
                // not or
                if (not_value instanceof Set) {
                    let ors = new Datex.Addresses.AndSet<any>();
                    for (let f of not_value) ors.add(Datex.Addresses.Not.get(f));
                    return Filter._toNormalForm(ors)
                }

            }
        }


        serialize() {
            return Runtime.serializeValue(Filter.toNormalForm(this));
        }

        // get copy (normalized)
        clone(){
            this.calculateNormalForm();
            return new Filter(this.normal_filter);
        }

        // get set of filter endpoints
        evaluate(): Set<Datex.Addresses.Target> {
            this.calculateNormalForm();
            let all = new Set<Datex.Addresses.Target>();
            for (let ands of this.normal_filter) {
                // check each and
                if (ands instanceof Datex.Addresses.Target) all.add(ands)
                else if (ands instanceof Set) {
                    for (let and of ands) {
                        if (and instanceof Datex.Addresses.Target) all.add(and);
                    }
                }
            }
            return all;
        }
    }



    /* negatet Datex filters / targets */
    export class Not<T=filter> {
        static negation_map = new WeakMap<any,any>()

        value:T;

        public static get(value:filter):filter {
            if (value instanceof Not) return value.value // double not - return original filter
            if (this.negation_map.has(value)) return this.negation_map.get(value);
            else return new Not(value);
        }

        private constructor(value:T) {
            this.value = value
            Not.negation_map.set(value, this);
        }
    }


    export enum ElType {
        PERSON, LABEL, INSTITUTION, BOT, FLAG
    }


    export abstract class Target implements ValueConsumer {

        protected static targets = new Map<string, Datex.Addresses.Endpoint>();   // target string -> target element
        static readonly prefix:target_prefix = "@"
        static readonly type:BinaryCode

        // TODO filter
        handleApply(value:any, SCOPE:datex_scope) {
            // if (params[0] instanceof Datex.Addresses.Endpoint) return Datex.Addresses.Target.get(this.name, this.subspaces, this.instance, params[0], <any> this.constructor);
            // else return this;
        }
        
        public static getClassFromBinaryCode(binary_code?:BinaryCode): typeof Datex.Addresses.Person | typeof Datex.Addresses.Institution | typeof Datex.Addresses.Bot | typeof Datex.Addresses.IdEndpoint {
            switch (binary_code) {
                case BinaryCode.PERSON_ALIAS: return Datex.Addresses.Person;
                case BinaryCode.INSTITUTION_ALIAS: return Datex.Addresses.Institution;
                case BinaryCode.BOT:return Datex.Addresses.Bot;
                case BinaryCode.ENDPOINT: return Datex.Addresses.IdEndpoint;

                case BinaryCode.PERSON_ALIAS_WILDCARD: return Datex.Addresses.Person;
                case BinaryCode.INSTITUTION_ALIAS_WILDCARD: return Datex.Addresses.Institution;
                case BinaryCode.BOT_WILDCARD:return Datex.Addresses.Bot;
                case BinaryCode.ENDPOINT_WILDCARD: return Datex.Addresses.IdEndpoint;
            }
        }

        public static isWildcardBinaryCode(binary_code?:BinaryCode): boolean {
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

        /** create new Filter element or return stored 
         * @param name: 'user' or '@user' or '@user/3'
         * @param instance: instance as extra parameter (optional)
        */
        public static get<T extends endpoint_name>(name:T, subspaces?:string[], instance?:string|number, appspace?:Datex.Addresses.Endpoint):endpoint_by_endpoint_name<T>|WildcardTarget
        public static get<T extends typeof Datex.Addresses.Endpoint=typeof Datex.Addresses.Endpoint>(name:string|Uint8Array, subspaces?:string[], instance?:string|number|Uint8Array, appspace?:Datex.Addresses.Endpoint, type?:BinaryCode|T):InstanceType<T>|WildcardTarget
        public static get<T extends typeof Datex.Addresses.Endpoint=typeof Datex.Addresses.Endpoint>(name:string|Uint8Array, subspaces?:string[], instance?:string|number|Uint8Array, appspace?:Datex.Addresses.Endpoint, filter_class_or_type?:BinaryCode|T):InstanceType<T>|WildcardTarget {
            
            let classType = this.getClassFromBinaryCode(<BinaryCode>filter_class_or_type) ?? <any>filter_class_or_type;
            // handle string
            if (typeof name == "string") {
                // institution
                if (name.startsWith("@+")) {
                    name = name.substring(2);
                    classType = Datex.Addresses.Institution;
                }
                // id
                else if (name.startsWith("@@")) {
                    name = name.substring(2);
                    classType = Datex.Addresses.IdEndpoint;
                }
                // individual
                else if (name.startsWith("@")) {
                    name = name.substring(1);
                    classType = Datex.Addresses.Person;
                }
    
                // bot (TODO remove)
                else if (name.startsWith("*")) {
                    name = name.substring(1);
                    classType = Datex.Addresses.Bot;
                }
    
                // split instance and subspaces
                let split = name.split("/");
                name = split[0];
                if (split[1]) instance = split[1];
                split = name.split(":");
                name = split[0];
                if (split[1]) subspaces = split.slice(1).filter(s=>s);
    
            }
    
            if (typeof classType != "function") throw new SyntaxError("Invalid Target: " + name);
    
            // target or wildcard target?
            const target = new classType(name, subspaces, instance, appspace);
            if (typeof filter_class_or_type == "number" && this.isWildcardBinaryCode(filter_class_or_type)) return WildcardTarget.getWildcardTarget(target);
            else return <InstanceType<T>>target;
        }
    }

    /** parent class for all filters (@user, ...) */
    export class Endpoint extends Datex.Addresses.Target {
        #name:string
        #subspaces:string[] = []
        #appspace:Endpoint
        #binary:Uint8Array
        #instance:string
        #instance_binary:Uint8Array
        #prefix: target_prefix
        #type: BinaryCode
        #base: Datex.Addresses.Target // without subspaces or appspace
        #main: Datex.Addresses.Target // without instance

        #n: string
        n: string // show for debugging

        get name() {return this.#name}
        get instance() {return this.#instance}
        get instance_binary() {return this.#instance_binary}
        get prefix() {return this.#prefix}
        get type() {return this.#type}
        get main() {return this.#main}
        get base() {return this.#base}
        get binary() {return this.#binary}
        get subspaces() {return this.#subspaces}
        get appspace() {return this.#appspace}

        protected static readonly DEFAULT_INSTANCE = new Uint8Array(8);

        // must declare, # does not work
        declare private __id_endpoint: Datex.Addresses.IdEndpoint; // id endpoint corresponding to the person, institution or bot

        get id_endpoint () {
            return this.__id_endpoint;
        }


        // important!! do not call constructor directly (constructor only public for typescript types to work properly)
        constructor(name:string|Uint8Array, subspaces?:string[], instance?:string|number|Uint8Array, appspace?:Endpoint) {
            super();

            // Buffer to string
            if (name instanceof Uint8Array) {
                this.#binary = name;
                name = Pointer.buffer2hex(name);
            }
            else if (typeof name != "string") throw new ValueError("<Target> name must be a <String> or a <Buffer>");
            
            if (!name) throw new ValueError("Cannot create an empty filter target");

            // Instance buffer/string/int
            if (instance instanceof Uint8Array) {
                this.#instance_binary = instance;
                instance = new TextDecoder().decode(instance).replaceAll("\u0000","");
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
                console.log("inst",instance)
                throw new ValueError("<Target> instance must be a <String>, <Integer> or a <Buffer>");
            }

        
            // add binary if IdEndpoint
            if (typeof name == "string" && !this.#binary && (<typeof Datex.Addresses.Endpoint>this.constructor).prefix == "@@") {
                try {
                    this.#binary = Pointer.hex2buffer(name); 
                }
                catch (e) {
                    throw new ValueError("Invalid binary id for <Target>");
                }
            }

            if ((this.#binary?.byteLength??0 + this.#instance_binary?.byteLength??0) > 20) throw new ValueError("ID Endpoint size must be <=20 bytes")

            if (subspaces?.length) {
                this.#subspaces = subspaces;
                this.#base = Datex.Addresses.Target.get(name, null, null, null, <typeof Datex.Addresses.Endpoint>this.constructor);
            }
            if (instance) {
                this.#instance = instance;
                this.#main = Datex.Addresses.Target.get(name, subspaces, null, appspace, <typeof Datex.Addresses.Endpoint>this.constructor)
            }

            this.#prefix = (<typeof Datex.Addresses.Endpoint>this.constructor).prefix;
            this.#type = (<typeof Datex.Addresses.Endpoint>this.constructor).type;
            this.#name = name;
            this.#appspace = appspace;

            // get toString() value
            this.#n = this.toString()
            this.n = this.#n; // just for debugging/display purposes
            
            // check if name is valid
            //if (!(this._toString().match(Regex._ANY_FILTER_TARGET) || (this.#prefix == "+" && this.#name == "+"))) throw new DatexValueError("Invalid filter target name: '"+this._toString()+"'");

            // target already exists? return existing filtertarget
            if (Datex.Addresses.Target.targets.has(this.#n)) {
                return Datex.Addresses.Target.targets.get(this.#n)
            }
            // add to filter target list
            else Datex.Addresses.Target.targets.set(this.#n, this);
        }

        // create string representation of filter (-> '@user')
        override toString(with_instance=true): string {
            return this._toString(with_instance);
        }
        // return string for JSON
        toJSON() {
        return 'dx::' + this.toString() 
        }


        protected _toString(with_instance=true): endpoint_name {
            return `${this.prefix}${this.name}${this.subspaces.length ? "." + this.subspaces.join(".") : ""}${with_instance&&this.instance? "/"+this.instance : ""}${this.appspace ? this.appspace.toString() : ""}`
        }

        
        /** returns a certain instance of an existing filter */
        public getInstance(instance:string){
            return Datex.Addresses.Target.get(this.name, this.subspaces, instance, this.appspace, <any> this.constructor);
        }

        /** returns a certain subspace of an existing filter */
        public getSubspace(subspace:string){
            return Datex.Addresses.Target.get(this.name, [...this.subspaces, subspace], this.instance, this.appspace, <any> this.constructor);
        }
        
        // returns if two endpoints point to the same endpoint (id or user/...)
        public equals(other: Datex.Addresses.Endpoint) {
            return other == this || (other?.instance == this.instance && (other?.id_endpoint == <Datex.Addresses.IdEndpoint><any>this || this.id_endpoint == other || this.id_endpoint == other?.id_endpoint));
        }

        public setIdEndpoint(id_endpoint:Datex.Addresses.IdEndpoint) {
            if (this.__id_endpoint != undefined) throw new SecurityError("Id Endpoint for this Target is already set");
            else this.__id_endpoint = id_endpoint;
        }

        declare private interface_channel_info:{[channel_name:string]:any}
        public setInterfaceChannels(info:{[channel_name:string]:any}){
            this.interface_channel_info = info
        }

        public getInterfaceChannelInfo(channel:string):any {
            return this.interface_channel_info[channel]
        }


        // get endpoint from string
        public static fromString(string:string) {
            // normal DATEX endpoint
            try {
                return Datex.Addresses.Target.get(string)
            }
            // TODO Id Endpoint from ipv6 address, ...
            catch {
                return Datex.Addresses.Target.get("@TODO_IPV6")
            }
        }


        public static createNewID():Datex.filter_target_name_id{
            const id = new DataView(new ArrayBuffer(12));
            const timestamp = Math.round((new Date().getTime() - DatexCompiler.BIG_BANG_TIME)/1000);
            id.setUint32(0,timestamp); // timestamp
            id.setBigUint64(4, BigInt(Math.floor(Math.random() * (2**64)))); // random number
            return `@@${Datex.Pointer.buffer2hex(new Uint8Array(id.buffer))}`;
        }

        public static getNewEndpoint():Addresses.IdEndpoint{
            return IdEndpoint.get(Addresses.Endpoint.createNewID())
        }

    }



    export class WildcardTarget extends Datex.Addresses.Target {

        private static wildcard_targets = new WeakMap<Datex.Addresses.Endpoint, WildcardTarget>()

        public static getWildcardTarget(target: Datex.Addresses.Endpoint){
            if (this.wildcard_targets.has(target)) return this.wildcard_targets.get(target);
            else {
                const wildcard_target = new WildcardTarget(target);
                this.wildcard_targets.get(target);
                return wildcard_target;
            }
        }

        override toString() {
            return this.target?.toString() ?? "### invalid wildcard target ###";
        }

        constructor(public target:Datex.Addresses.Endpoint) {super()}
    }


    export class Person extends Datex.Addresses.Endpoint {
        static override prefix:target_prefix = "@"
        static override type = BinaryCode.PERSON_ALIAS
        static override get(name:string, subspaces?:string[], instance?:string, appspace?:Datex.Addresses.Endpoint){return <Datex.Addresses.Person>super.get(name, subspaces, instance, appspace, Datex.Addresses.Person)}
    }
    export class Bot extends Datex.Addresses.Endpoint {
        static override prefix:target_prefix = "*"
        static override type = BinaryCode.BOT
        static override get(name:string, subspaces?:string[], instance?:string, appspace?:Datex.Addresses.Endpoint){return  <Datex.Addresses.Bot>super.get(name, subspaces, instance, appspace, Datex.Addresses.Bot)}
    }
    export class Institution extends Datex.Addresses.Endpoint {
        static override prefix:target_prefix = "@+"
        static override type = BinaryCode.INSTITUTION_ALIAS
        static override get(name:string, subspaces?:string[], instance?:string, appspace?:Datex.Addresses.Endpoint){return  <Datex.Addresses.Institution>super.get(name, subspaces, instance, appspace, Datex.Addresses.Institution)}
    }
    export class IdEndpoint extends Datex.Addresses.Endpoint {
        static override prefix:target_prefix = "@@"
        static override type = BinaryCode.ENDPOINT
        static override get(name:string|Uint8Array, subspaces?:string[], instance?:string, appspace?:Datex.Addresses.Endpoint){return  <Datex.Addresses.IdEndpoint>super.get(name, subspaces, instance, appspace, Datex.Addresses.IdEndpoint)}

        constructor(name: string | Uint8Array, subspaces?:string[], instance?: string | number | Uint8Array, appspace?:Datex.Addresses.Endpoint) {
            super(name, subspaces, instance, appspace);
            if (this.id_endpoint == undefined) this.setIdEndpoint(this); // is own id endpoint
        }

        // get prefix for pointer (with address type)
        public getPointerPrefix(){
            return new Uint8Array([
                this.binary.byteLength == 16 ? Pointer.POINTER_TYPE.IPV6_ID : Pointer.POINTER_TYPE.DEFAULT,
                ...this.binary, 
                ...this.instance_binary
            ])
        }

        public getStaticPointerPrefix(){
            return new Uint8Array([
                Pointer.POINTER_TYPE.STATIC,
                ...this.binary
            ])
        }
    }

    // default local endpoint
    export const LOCAL_ENDPOINT = Datex.Addresses.IdEndpoint.get("@@000000000000000000000000");
    export const BROADCAST      = Datex.Addresses.IdEndpoint.get("@@FFFFFFFFFFFFFFFFFFFFFFFF");

}




type target_prefix_person = "@";
type target_prefix_id = "@@";
type target_prefix_institution = "@+";
type target_prefix_bot = "*";
type target_prefix = target_prefix_person | target_prefix_id | target_prefix_institution | target_prefix_bot;

export type filter_target_name_person = `${target_prefix_person}${string}`;
export type filter_target_name_id = `${target_prefix_id}${string}`;
export type filter_target_name_institution = `${target_prefix_institution}${string}`;
export type filter_target_name_bot = `${target_prefix_bot}${string}`;
type _endpoint_name = filter_target_name_person | filter_target_name_id | filter_target_name_institution | filter_target_name_bot
export type endpoint_name = `${_endpoint_name}${_endpoint_name|''}`

export type endpoint_by_endpoint_name<name extends endpoint_name> = 
     name extends filter_target_name_id ? Datex.Addresses.IdEndpoint : 
    (name extends filter_target_name_institution ? Datex.Addresses.Institution :
    (name extends filter_target_name_person ? Datex.Addresses.Person :
    (name extends filter_target_name_bot ? Datex.Addresses.Bot : never
    )));


// enable JS | and ^
//enableFilterLogicOperations(DatexFilter);
//enableFilterLogicOperations(DatexFilterTarget);
//enableFilterLogicOperations(DatexNot);


// error codes
const DATEX_ERROR = {
    // ValueError
    NO_VALUE: 0x00,
    
    // NetworkError
    NO_EXTERNAL_CONNECTION: 0x10,
    NO_OUTPUT: 0x11,
    NO_RECEIVERS: 0x12,
    TOO_MANY_REDIRECTS: 0x13,
}

// error messages
const DATEX_ERROR_MESSAGE = {
    // ValueError
    [DATEX_ERROR.NO_VALUE]: "No value provided",
    
    // NetworkError
    [DATEX_ERROR.NO_EXTERNAL_CONNECTION]: "No external connections, can only execute DATEX locally",
    [DATEX_ERROR.NO_OUTPUT]:  "No DATEX output available",
    [DATEX_ERROR.NO_RECEIVERS]: "DATEX has no receivers and is not flooding, cannot send",
    [DATEX_ERROR.TOO_MANY_REDIRECTS]: "Too many redirects",

}

// <*Error>
export class Error extends globalThis.Error {
    override message:string;
    datex_stack: [Datex.Addresses.Endpoint, string?][]
    type:string = "";
    code?:bigint

    constructor(message:string|number|bigint)
    constructor(message:string|number|bigint, scope:datex_scope)
    constructor(message:string|number|bigint, stack:[Datex.Addresses.Endpoint, string?][])
    constructor(message:string|number|bigint = '', stack:datex_scope|[Datex.Addresses.Endpoint, string?][] = [[Runtime.endpoint]]) {
        super();

        // extract name from class name
        this.name = this.constructor.name.replace("Datex","");

        // convert scope to stack
        if (typeof stack == "object" && stack!=null && !(stack instanceof Array)) {
            this.addScopeToStack(stack)
        }
        // stack already provided (as array)
        else if (Runtime.OPTIONS.ERROR_STACK_TRACES && stack instanceof Array) this.datex_stack = stack;
        // no stack
        else this.datex_stack = [];

        // error message
        if (typeof message == "string") this.message = message;
        // error code
        else if (typeof message == "number" || typeof message == "bigint"){
            this.code = BigInt(message);
            this.message = DATEX_ERROR_MESSAGE[Number(this.code)];
        }
        else this.message = null;
        
        this.updateStackMessage();
    }

    addScopeToStack(scope:datex_scope){
        if (Runtime.OPTIONS.ERROR_STACK_TRACES) {
            if (!this.datex_stack) this.datex_stack = []
            this.datex_stack.push([Runtime.endpoint, scope.sender + " " + scope.header.sid?.toString(16) + ":" + scope.current_index?.toString(16)]);
            this.updateStackMessage();
        }
    }

    updateStackMessage() {
        this.stack = this.name +": " + (this.message??"Unknown") + '\n';

        for (let d of this.datex_stack.reverse()) {
            this.stack += `    on ${d[0]} (${d[1]??"Unknown"})\n`
        }
    }

    override toString(){
        return this.message;
    }
}

export class SyntaxError extends Error {}
export class CompilerError extends Error {}
export class PointerError extends Error {}
export class ValueError extends Error {}
export class PermissionError extends Error {}
export class TypeError extends Error {}
export class NetworkError extends Error {}
export class RuntimeError extends Error {}
export class SecurityError extends Error {}
export class AssertionError extends Error {}



export async function getFileContent(url:string, file_path?:string): Promise<string>{
    // get local file
    if (file_path && fs) {
        // @ts-ignore
        return new TextDecoder().decode(fs.readFileSync(new URL(file_path, import.meta.url)))
    }
    let res;
    try {
        res = await (await fetch(url, {credentials: 'include', mode:'cors'})).text();
        await Datex.Storage.setItem(url, res);
    } catch(e) { // network error or similar - try to get from cache
        res = await Datex.Storage.getItem(url);
    }
    return res;
}



/** Runtime */

export class Runtime {


    // can be changed
    public static OPTIONS = {
        DEFAULT_REQUEST_TIMEOUT: 5000, // default timeout for DATEX requests in ms
        USE_BIGINTS: true,  // DATEX integers are interpreted as JS BigInts 
                            // otherwise DATEX floats and integers are interpreted as numbers
                            // recommended: true, otherwise all integers are implicitly casted to the type <Float> in DATEX
        ERROR_STACK_TRACES: true // create detailed stack traces with all DATEX Errors
        
    }

    public static PRECOMPILED_DXB: {[key:string]:PrecompiledDXB}

    public static VERSION = "0.1.0";

    // @ts-ignore
    public static HOST_ENV = '';

    static #blockchain_interface:BlockchainAdapter;

    static get blockchain_interface(){
            return this.#blockchain_interface
    }

    static set blockchain_interface(blockchain_interface: BlockchainAdapter){
         this.#blockchain_interface = blockchain_interface
    }

    static #endpoint: Datex.Addresses.Endpoint;  // this endpoint (default is special local endpoint %000000000000000000000000)

    static get endpoint(){
        return this.#endpoint
    }

    static set endpoint(endpoint: Datex.Addresses.Endpoint){
        if (!endpoint.id_endpoint) {
            throw new RuntimeError("Endpoint has no associated Endpoint Id, cannot set local runtime endpoint");
        }
        logger.success("Changing local endpoint to " + endpoint);
        this.#endpoint = endpoint;

        Pointer.pointer_prefix = this.endpoint.id_endpoint.getPointerPrefix();
        // has only local endpoint id (%0000) or global id?
        if (endpoint != Datex.Addresses.LOCAL_ENDPOINT) Pointer.is_local = false;
        else Pointer.is_local = true;

        Observers.call(this,"endpoint",this.#endpoint);
    }


    static onEndpointChanged(listener:(endpoint:Datex.Addresses.Endpoint)=>void){
        Observers.add(this,"endpoint",listener);
    }

    public static main_node:Datex.Addresses.Endpoint; // TODO remove?


    private static utf8_decoder = new TextDecoder("utf-8");
    private static utf8_encoder = new TextEncoder();

    // initialize std pointers if not yet initialized
    private static initialized = false;

    // binary codes that always indicate the end of a subscope
    private static END_BIN_CODES = [
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


    private static readonly_internal_vars = new Set<string|number>([
        'current',
        'sender',
        'timestamp', 
        'signed',
        'encrypted',
        'meta',
        'this',
        'static'
    ])

    // DATEX OUT + REDIRECT

    private static callbacks_by_sid = new Map<string, [globalThis.Function, globalThis.Function]>();
    private static detailed_result_callbacks_by_sid = new Map<string, (scope:datex_scope, header:dxb_header, error?:Error)=>void>(); // call only once
    private static detailed_result_callbacks_by_sid_multi = new Map<string, (scope:datex_scope, header:dxb_header, error?:Error)=>void>(); // call multiple times


    public static setMainNode(main_node:Datex.Addresses.Endpoint){
        this.main_node = main_node
    }


    // default static scope: std
    static STD_STATIC_SCOPE:StaticScope;

    private static STD_TYPES_ABOUT:Map<Type,Markdown>;
    
    // default static scopes to import?
    private static default_static_scope: Tuple = new Tuple();
    // add static scope as root extension
    public static addRootExtension(scope:StaticScope) {
        DatexObject.extend(this.default_static_scope, scope);
    }

    // add value as default root variable
    public static addRootVariable(name:string, value:any) {
        this.default_static_scope[name] = value;
    }

    static #datex_out_handler_initialized_resolve:(value: void | PromiseLike<void>) => void
    static #datex_out_init_promise = new Promise<void>(resolve=>this.#datex_out_handler_initialized_resolve=resolve);

    private static local_input_handler = Runtime.getDatexInputHandler();

    // default datex out: send to self (if no routing available)
    private static datex_out:(dxb:ArrayBuffer, to?:Datex.Addresses.Target, flood?:boolean)=>Promise<void> = async (dxb, to, flood)=>{
        // external datex out request, but this is the default interface (only access to local endpoint)
        if (!(to instanceof Datex.Addresses.Endpoint && Runtime.endpoint.equals(to))) {
            throw new NetworkError(DATEX_ERROR.NO_EXTERNAL_CONNECTION)
        }
        // directly redirect to local input
        else this.local_input_handler(dxb);
    } 

    public static setDatexOut(handler:(dxb:ArrayBuffer, to?:Datex.Addresses.Filter|Datex.Addresses.Target, flood?:boolean)=>Promise<void>){
        this.datex_out = handler;

        if (this.#datex_out_handler_initialized_resolve) {
            this.#datex_out_handler_initialized_resolve();
            // initialized, delete promise
            this.#datex_out_handler_initialized_resolve = undefined;
            this.#datex_out_init_promise = undefined;
        }
    }


    /** handles symmetric keys for scope sessions */
    private static scope_symmetric_keys:Map<Datex.Addresses.Endpoint,Map<number, CryptoKey>> = new Map();


    // get key for a sender
    protected static async getOwnSymmetricKey(scope_id:number):Promise<CryptoKey> {
        if (!this.scope_symmetric_keys.has(this.endpoint)) this.scope_symmetric_keys.set(this.endpoint, new Map())
        let sender_map = this.scope_symmetric_keys.get(this.endpoint);
        // create new if not yet created
        if (!sender_map.has(scope_id)) sender_map.set(scope_id, await Crypto.generateSymmetricKey())
        return sender_map.get(scope_id)
    }

    // get key for a sender
    protected static async getScopeSymmetricKeyForSender(scope_id:number, sender:Datex.Addresses.Endpoint):Promise<CryptoKey> {
        if (!this.scope_symmetric_keys.has(sender)) this.scope_symmetric_keys.set(sender, new Map())
        let sender_map = this.scope_symmetric_keys.get(sender);
        if (!sender_map.has(scope_id)) {
            throw new SecurityError("Found no encryption key for this scope");
        }
        return sender_map.get(scope_id)
    }


    // set key if received from remote endpoint
    protected static async setScopeSymmetricKeyForSender(scope_id:number, sender:Datex.Addresses.Endpoint, key:CryptoKey) {
        if (!this.scope_symmetric_keys.has(sender)) this.scope_symmetric_keys.set(sender, new Map())
        this.scope_symmetric_keys.get(sender).set(scope_id, key)
    }

    protected static async removeScopeSymmetricKeyForSender(scope_id:number, sender:Datex.Addresses.Endpoint) {
        this.scope_symmetric_keys.get(sender)?.delete(scope_id)
    }

    // resolve a url
    protected static async resolveUrl(url_string:string): Promise<any>
    protected static async resolveUrl(url:URL): Promise<any>
    protected static async resolveUrl(url_string:string|URL) {
        const url = url_string instanceof URL ? url_string : new URL(url_string);
        if (url.protocol == "https:" || url.protocol == "http:") {
            let response = await fetch(url_string, {headers: {
                // TODO remove when unyt.org goes public
                Cookie: 'secret=njh23zjod%C3%96%C3%84A%3D)JNCBnvoaidjsako1mncvdfsnuafhlaidosfjmDASDFAJFEDNnbcuai28z9ueaof9jnncbgaabdADAF'
            }});
            let type = response.headers.get('content-type');

            if (type == "application/datex" || type == "text/dxb") {
                return this.executeDXBLocally(await response.arrayBuffer());
            }
            else if (type?.startsWith("text/datex")) {
                //let compiled = <ArrayBuffer> await DatexCompiler.compile(await response.text(), [], {}, false);  
                return this.executeDatexLocally(await response.text()); // new Function(new CodeBlock([], compiled, true)); 
            }
            else if (type?.startsWith("application/json")) {
                return response.json()
            }
            else if (type?.startsWith("image/")) {
                return Datex.Type.get('std:image').cast(await response.arrayBuffer());
            }
            else return response.text()
        }
    }


    /*** reads a datex file / text and returns the data */
    static async parseDatexData(dx:string, data?:any[]):Promise<any> {
        return Runtime.executeDXBLocally(<ArrayBuffer> await DatexCompiler.compile(dx, data, {sign:false, encrypt:false, type:DatexProtocolDataType.DATA}))
    }

    // dxb saved as base64 string -> execute and get value
    public static getValueFromBase64DXB(dxb_base64:string):Promise<any> {
        return Runtime.executeDXBLocally(base64ToArrayBuffer(dxb_base64))
    }

    // reads dxb base64 without header and returns value (! not secure)
    public static async decodeValueBase64(dxb_base64:string):Promise<any> {
        // create scope
        const scope = Runtime.createNewInitialScope();
        // set dxb as scope buffer
        Runtime.updateScope(scope, base64ToArrayBuffer(dxb_base64), {end_of_scope:true, sender:Runtime.endpoint})
        // execute scope
        return Runtime.simpleScopeExecution(scope)
    }

    // reads dxb without header and returns value (! not secure)
    public static async decodeValue(dxb:ArrayBuffer):Promise<any> {
        // create scope
        const scope = Runtime.createNewInitialScope();
        // set dxb as scope buffer
        Runtime.updateScope(scope, dxb, {end_of_scope:true, sender:Runtime.endpoint})
        // execute scope
        return Runtime.simpleScopeExecution(scope)
    }

    // serialize -> deserialize
    public static async cloneValue<T>(value:T):Promise<T> {
        const pointer = Pointer.pointerifyValue(value);
        //if (pointer instanceof Pointer) value = <any> pointer.getSerializedValue();
        return await Runtime.decodeValue(DatexCompiler.encodeValue(value, undefined, true, false, true));
    }
    
    // serialize -> deserialize
    public static async deepCloneValue<T>(value:T):Promise<T> {
        return await Runtime.decodeValue(DatexCompiler.encodeValue(value, undefined, true, true));
    }

    // datex string -> compile -> execute and return result
    public static async executeDatexLocally(datex:string, options?:compiler_options):Promise<any> {
        return Runtime.executeDXBLocally(<ArrayBuffer> await DatexCompiler.compile(datex, [], {sign:false, encrypt:false, ...options}))
    }

    // dxb -> execute and return result
    public static async executeDXBLocally(dxb:ArrayBuffer):Promise<any> {
        // generate new header using executor scope header
        let header:dxb_header;
        let dxb_body:ArrayBuffer;

        const res = await this.parseHeader(dxb)
        if (res instanceof Array) {
            header = res[0];
            dxb_body = res[1].buffer;
        }
        else {
            throw new Error("Cannot execute dxb locally, the receiver defined in the header is external")
        }

        // create scope
        const scope = Runtime.createNewInitialScope(header);
        // set dxb as scope buffer
        Runtime.updateScope(scope, dxb_body, header)
        // execute scope
        return Runtime.simpleScopeExecution(scope)
    }

    /**
     * Handle compilation in Runtime (actually compile using datex_compiler)
     * handles sids, encryption keys
     */
    protected static async compileAdvanced(data:compile_info):Promise<ArrayBuffer|ReadableStream> {
        let header_options = data[2];

        // get sid or generate new
        if (header_options.sid == null) header_options.sid = DatexCompiler.generateSID();

        // encryption?
        if (header_options.encrypt && !header_options.sym_encrypt_key) {
            header_options.sym_encrypt_key = await this.getOwnSymmetricKey(header_options.sid);
            header_options.send_sym_encrypt_key = true; // TODO handle
        }

        return DatexCompiler.compile(...data) // TODO currently workaround bridge to get generator value
    }


    /** 
     * Default datex output - provide a DatexCompiler.compile result (AsyncGenerator) or an array with compilation info
     * Optional sid: set if compile result already provided any sid is already known, otherwise automatically generated
     */
    public static async datexOut(data:ArrayBuffer|compile_info, to:Datex.Addresses.Filter|Datex.Addresses.Target=Runtime.endpoint, sid?:number, wait_for_result=true, encrypt=false, detailed_result_callback?:(scope:datex_scope, header:dxb_header, error:Error)=>void, flood = false, flood_exclude?:Datex.Addresses.Endpoint, timeout?:number):Promise<any>{

        // external request, but datex out not yet initialized, wait for initialization
        if (!(to instanceof Datex.Addresses.Endpoint && Runtime.endpoint.equals(to)) && this.#datex_out_init_promise /*instanceof Promise*/) {
            await this.#datex_out_init_promise;
        }
       
        // one or multiple blocks
        let dxb:ArrayBuffer|ReadableStream<ArrayBuffer>;

        // only info about what to compile, not yet compiled
        if (data instanceof Array) {
            if (!data[2]) data[2] = {}
            if (!data[2].to && to!=null) data[2].to = to; // add receiver if not found in compile options
            if (!data[2].sid && sid!=null) data[2].sid = sid; // add sid if not found in compile options
            if (data[2].flood==null && flood!=null) data[2].flood = flood; // add flood if not found in compile options
            if (data[2].encrypt==null && encrypt!=null) data[2].encrypt = encrypt; // add flood if not found in compile options
            dxb = await this.compileAdvanced(data);
            // override values from compiled data
            sid = data[2].sid ?? sid;
            flood = data[2].flood ?? flood;
            encrypt = data[2].encrypt ?? encrypt;
        }
        // already compiled
        else dxb = data;

        // no sid provided, and not compiled with new sid
        if (!sid) throw new RuntimeError("Could not get an SID for sending data");
        if (!this.datex_out) throw new NetworkError(DATEX_ERROR.NO_OUTPUT);
        if (!flood && !to) throw new NetworkError(DATEX_ERROR.NO_RECEIVERS);

        const unique_sid = sid+"-"+(data[2]?.return_index??0); // sid + block index;
        const evaluated_receivers = to ? this.evaluateFilter(to) : null;

        // single block
        if (dxb instanceof ArrayBuffer) {
            return this.datexOutSingleBlock(dxb, evaluated_receivers, sid, unique_sid, <compile_info>data, wait_for_result, encrypt, detailed_result_callback, flood, flood_exclude, timeout);
        }

        // multiple blocks
        else {
            const reader = dxb.getReader();
            let next:ReadableStreamReadResult<ArrayBuffer>;
            let end_of_scope = false;
            // read all blocks (before the last block)
            while (true) {
                next = await reader.read()
                if (next.done) break;

                // empty arraybuffer indicates that next block is end_of_scope
                if (next.value.byteLength == 0) end_of_scope = true;
                // end_of_scope, now return result for last block (wait_for_result)
                else if (end_of_scope) return this.datexOutSingleBlock(next.value, evaluated_receivers, sid, unique_sid, <compile_info>data, wait_for_result, encrypt, detailed_result_callback, flood, flood_exclude, timeout);
                // not last block,  wait_for_result = false, no detailed_result_callback
                else this.datexOutSingleBlock(next.value, evaluated_receivers, sid, unique_sid, <compile_info>data, false, encrypt, null, flood, flood_exclude, timeout);
            }
            
        }
        
    }

    // handle sending a single dxb block out
    private static datexOutSingleBlock(dxb:ArrayBuffer, to:Set<Datex.Addresses.Target>, sid:number, unique_sid:string, data:compile_info, wait_for_result=true, encrypt=false, detailed_result_callback?:(scope:datex_scope, header:dxb_header, error:Error)=>void, flood = false, flood_exclude?:Datex.Addresses.Endpoint, timeout?:number) {
        
        // empty filter?
        if (to?.size == 0) return;

        return new Promise<any>((resolve, reject) => {

            // listener
            IOHandler.handleDatexSent(dxb, to)

            // flood exclude flood_exclude receiver
            if (flood) {
                this.datex_out(dxb, flood_exclude, true)?.catch(e=>reject(e));
            }           
            // send to receivers
            else if (to) {
                // send and catch errors while sending, like NetworkError
                for (let to_endpoint of to) {
                    this.datex_out(dxb, to_endpoint)?.catch(e=>reject(e));
                }
            }

            // callback for detailed results?
            if (detailed_result_callback) {
                // only one expected response
                if (to.size == 1)
                    this.detailed_result_callbacks_by_sid.set(unique_sid, detailed_result_callback);

                // multiple reponses expected
                else 
                    this.detailed_result_callbacks_by_sid_multi.set(unique_sid, detailed_result_callback);
            }
          

            if (wait_for_result) { // only set callback if required
                this.callbacks_by_sid.set(unique_sid, [resolve, reject]);
                // default timeout
                if (timeout == undefined) timeout = this.OPTIONS.DEFAULT_REQUEST_TIMEOUT;
                setTimeout(()=>{
                    reject(new NetworkError("DATEX request timeout after "+timeout+"ms: " + unique_sid));
                }, timeout);
            }
            else resolve(true)
        })
    }

    // evaluate filter
    private static evaluateFilter(filter:Datex.Addresses.Filter|Datex.Addresses.Target):Set<Datex.Addresses.Target> {
        if (filter instanceof Datex.Addresses.Target) return new Set([filter])
        else if (filter instanceof Datex.Addresses.Filter) return filter.evaluate();
        else logger.error("cannot evaluate non-filter", filter);
    }

    // redirect to filter (decreases ttl and checks if too many redirects)
    static async redirectDatex(datex:ArrayBuffer, header:dxb_header, wait_for_result=true):Promise<any> {

        // too many redirects (ttl is 0)
        if (header.routing.ttl == 0) throw new NetworkError(DATEX_ERROR.TOO_MANY_REDIRECTS);

        datex = DatexCompiler.setHeaderTTL(datex, header.routing.ttl-1);
            
        logger.debug("redirect :: ", header.sid + " > " + header.routing.receivers?.toString());

        let res = await this.datexOut(datex, header.routing.receivers, header.sid, wait_for_result);
        return res;
    }

    // flood
    static floodDatex(datex:ArrayBuffer, exclude:Datex.Addresses.Endpoint, ttl:number) {
        datex = DatexCompiler.setHeaderTTL(datex, ttl);

        let [dxb_header] = <dxb_header[]> this.parseHeaderSynchronousPart(datex);
        this.datexOut(datex, null, dxb_header.sid, false, false, null, true, exclude);
    }

    // create default static scopes, init other stuff
    public static async init(endpoint?:Datex.Addresses.Endpoint) {

        if (endpoint) Runtime.endpoint = endpoint;

        if (this.initialized) return;
        this.initialized = true;

        // precompile dxb
        this.PRECOMPILED_DXB = {
            SET_PROPERTY:   await PrecompiledDXB.create('?.? = ?'),
            SET_WILDCARD:   await PrecompiledDXB.create('?.* = ?'),
            CLEAR_WILDCARD:   await PrecompiledDXB.create('?.* = void'),
            // PROPERTY_ADD:   await PrecompiledDXB.create('? += ?'),
            // PROPERTY_SUB:   await PrecompiledDXB.create('? -= ?'),
            STREAM:         await PrecompiledDXB.create('? << ?'),
        }

        // default labels:
        Pointer.createLabel({
            REQUEST:DatexProtocolDataType.REQUEST,
            RESPONSE:DatexProtocolDataType.RESPONSE,
            DATA:DatexProtocolDataType.DATA,
            HELLO:DatexProtocolDataType.HELLO,
            LOCAL_REQ:DatexProtocolDataType.LOCAL_REQ,
            BC_TRNSCT:DatexProtocolDataType.BC_TRNSCT            
        }, "TYPE");

        // create std static scope
        this.STD_STATIC_SCOPE = StaticScope.get("std");

        // std/print
        this.STD_STATIC_SCOPE.setVariable('print',  Pointer.create(null, new Function(null, (meta, ...params:any[])=>{
            IOHandler.stdOut(params, meta.sender);
        }, Datex.Runtime.endpoint, new Tuple({value:Type.std.Object}), null, 0), true, undefined, false).value);

        // std/printf (formatted output)
        this.STD_STATIC_SCOPE.setVariable('printf', Pointer.create(null, new Function(null, async (meta,...params:any[])=>{
            await IOHandler.stdOutF(params, meta.sender);
        }, Datex.Runtime.endpoint, new Tuple({value:Type.std.Object}), null, 0), true, undefined, false).value);


        // std/printn (native output)
        this.STD_STATIC_SCOPE.setVariable('printn', Pointer.create(null, new Function(null, (meta,...params:any[])=>{
            logger.success("std.printn >", ...params);
        }, Datex.Runtime.endpoint, new Tuple({value:Type.std.Object}), null, 0), true, undefined, false).value);

        // std/read
        this.STD_STATIC_SCOPE.setVariable('read', Pointer.create(null, new Function(null, (meta, msg_start:any="", msg_end:any="")=>{
            return IOHandler.stdIn(msg_start, msg_end, meta.sender);
        }, Datex.Runtime.endpoint, new Tuple({msg_start:Type.std.String, msg_end:Type.std.String}), null, 0), true, undefined, false).value);

        // _ debug methods

        // std.sleep
        this.STD_STATIC_SCOPE.setVariable('sleep', Pointer.create(null, new Function(null, async (meta, time_ms:bigint)=>{
            return new Promise<void>(resolve=>setTimeout(()=>resolve(), Number(time_ms)));
        }, Datex.Runtime.endpoint, new Tuple({time_ms:Type.std.Int}), null, 0), true, undefined, false).value);

        // std.types 
        this.STD_TYPES_ABOUT = await this.parseDatexData(await getFileContent("/unyt_core/dx_data/type_info.dx", './dx_data/type_info.dx')) // await datex('https://docs.unyt.org/unyt_web/unyt_core/dx_data/type_info.dx ()')

        DatexObject.seal(this.STD_STATIC_SCOPE);

        Runtime.addRootExtension(Runtime.STD_STATIC_SCOPE);

        logger.success("Initialized <std:> library")
    }


    static decompileBase64(dxb_base64: string, formatted = false, has_header = true) {
        return Runtime.decompile(base64ToArrayBuffer(dxb_base64), false, formatted, false, has_header);
    }

    public static formatVariableName(name:string|number, prefix:string) {
        return prefix + (typeof name == "number" ? name.toString(16) : name)
    }

    /**
     * Decompiles datex parser
     * @param dxb Valid compiled datex binary
     * @param [comments] show debug comments
     * @param [formatted] format automatically (new lines, indentation)
     * @param [formatted_strings] display new lines in strings as actual new lines
     * @returns decompiled datex
     */


    static decompile(dxb:ArrayBuffer, comments=true, formatted=true, formatted_strings=true, has_header=true): string {

        let uint8 = new Uint8Array(dxb);          

        if (!dxb) {
            logger.error("DATEX missing");
            return "### INVALID DATEX ###";
        }

        // first extract body from datex
        if (has_header) {
            try {
                let res = this.parseHeaderSynchronousPart(dxb);
                if (!(res instanceof Array)) return "### ERROR: Invalid DATEX Header ###";
                uint8 = res[1];
            } catch (e) {
                return "### ERROR: Invalid DATEX Header ###";
            }
        }
      
        
        let buffer    = uint8.buffer;
        let data_view = new DataView(buffer);  

        let append_comments = "";

        let current_index = 0;

        enum TOKEN_TYPE  {
            VALUE, SUBSCOPE
        }

        type token = {type?:TOKEN_TYPE, value?:any, string?:string, meta_string?:string, bin?:BinaryCode};
        type token_list = token[];
 
        let tokens:token_list = [{type:TOKEN_TYPE.SUBSCOPE, value:[]}];
        let current_scope:token_list = tokens[0].value;
        let parent_scopes:token_list[] = [];

        const extractVariableName = ():string|number => {
            let length = uint8[current_index++];
            let name:string|number;
            if (length == 0) { // binary name (2 byte number)
                name = data_view.getUint16(current_index, true);
                current_index += Uint16Array.BYTES_PER_ELEMENT;
            }
            else {
                name = Runtime.utf8_decoder.decode(uint8.subarray(current_index, current_index+length));
                current_index += length;
            }
            return name;
        }

        const extractType = (is_extended = false):[Type,boolean] => {
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
            let varation = is_extended ?  Runtime.utf8_decoder.decode(uint8.subarray(current_index, current_index += variation_length)) : undefined;

            return [Type.get(ns, type, varation), has_parameters]
        }

        const actionToString = (action:BinaryCode) => {
            let action_string:string;
            switch (action) {
                case BinaryCode.ADD: action_string = "+";break;
                case BinaryCode.SUBTRACT: action_string = "-";break;
                case BinaryCode.MULTIPLY: action_string = "*";break;
                case BinaryCode.DIVIDE: action_string = "/";break;
                case BinaryCode.AND: action_string = "&";break;
                case BinaryCode.OR: action_string = "|";break;
                case BinaryCode.CREATE_POINTER: action_string = ":";break;

            }
            return action_string;
        }

        const enterSubScope = (type:BinaryCode) => {
            parent_scopes.push(current_scope);
            current_scope.push({type:TOKEN_TYPE.SUBSCOPE, bin:type, value:[]});
            current_scope = current_scope[current_scope.length-1].value;
        }

        const exitSubScope = () => {
            if (!parent_scopes.length) {
                logger.error("No parent scope to go to");
                append_comments += "### ERROR: No parent scope to go to ###"
                throw "No parent scope to go to";
            }
            current_scope = parent_scopes.pop(); // go back to parent scope
        }


        const constructFilterElement = (type:BinaryCode, target_list?:Datex.Addresses.Endpoint[]):Datex.Addresses.Target => {

            const name_is_binary = type == BinaryCode.ENDPOINT || type == BinaryCode.ENDPOINT_WILDCARD;

            let instance:string;

            let name_length = uint8[current_index++]; // get name length
            let subspace_number = uint8[current_index++]; // get subspace number
            let instance_length = uint8[current_index++]; // get instance length

            if (instance_length == 0) instance = "*";
            else if (instance_length == 255) instance_length = 0;

            let name_binary = uint8.subarray(current_index, current_index+=name_length);
            let name = name_is_binary ? name_binary : Runtime.utf8_decoder.decode(name_binary)  // get name
            let subspaces:string[] = [];
            for (let n=0; n<subspace_number; n++) {
                let length = uint8[current_index++];
                if (length == 0) {
                    subspaces.push("*");
                }
                else {
                    let subspace_name = Runtime.utf8_decoder.decode(uint8.subarray(current_index, current_index+=length));
                    subspaces.push(subspace_name);
                }
            }
            
            if (!instance) instance = Runtime.utf8_decoder.decode(uint8.subarray(current_index, current_index+=instance_length))  // get instance

            let app_index:number
            if (target_list) app_index = uint8[current_index++];

            return Datex.Addresses.Target.get(name, subspaces, instance, app_index ? target_list[app_index-1] : null, type);
        }

        // loop through instructions
        loop: while (true) {

            // pause scope - not necessarily end
            if (current_index>=uint8.byteLength) {
                break;
            }

            let token = uint8[current_index++];
            if (token == undefined) break;

            // ASSIGN_SET = 
            switch (token) {

                // end scope
                case BinaryCode.END: { 
                    current_scope.push({string:"end"})
                    break;
                }

                // STRING
                case BinaryCode.SHORT_STRING:
                case BinaryCode.STRING: {

                    let length:number;
                    if (token == BinaryCode.SHORT_STRING) {
                        length = uint8[current_index++];
                    }
                    else {
                        length = data_view.getUint32(current_index, true);
                        current_index += Uint32Array.BYTES_PER_ELEMENT;
                    }
                  
                                    
                    let string = Runtime.utf8_decoder.decode(uint8.subarray(current_index, current_index+length));
                    current_index += length;

                    current_scope.push({type:TOKEN_TYPE.VALUE, string:Runtime.valueToDatexString(string, formatted_strings)});
                    break;
                }


                // BUFFER 
                case BinaryCode.BUFFER: {   

                    let buffer_length = data_view.getUint32(current_index, true);
                    current_index += Uint32Array.BYTES_PER_ELEMENT;
                    
                    let _buffer = buffer.slice(current_index, current_index+buffer_length);
                    current_index += buffer_length;

                    current_scope.push({type:TOKEN_TYPE.VALUE, string:Runtime.valueToDatexString(_buffer)});
                    break;
                }

                // CHILD_SET =
                case BinaryCode.CHILD_SET: { 
                    current_scope.push({bin:BinaryCode.CHILD_SET, string:"."});
                    break;
                }

                // CHILD_ACTION (+=, -=, ...)
                case BinaryCode.CHILD_ACTION: { 
                    let action_string = actionToString(uint8[current_index++]) // get action specifier
                    current_scope.push({bin:BinaryCode.CHILD_ACTION, string:".", meta_string:action_string});
                    break;
                }

                // RANGE ..
                case BinaryCode.RANGE: {             
                    current_scope.push({bin:BinaryCode.RANGE});
                    break;
                }

                // SPREAD ...
                case BinaryCode.EXTEND: {             
                    current_scope.push({string:"..."});
                    break;
                }

                // ERROR
                case BinaryCode.THROW_ERROR: {
                    current_scope.push({string:"!"});
                    break;
                }

                // COMPARE
                case BinaryCode.EQUAL_VALUE: {
                    current_scope.push({string:"=="});
                    break;
                }
                case BinaryCode.EQUAL: {
                    current_scope.push({string:"==="});
                    break;
                }
                case BinaryCode.NOT_EQUAL_VALUE:{
                    current_scope.push({string:"~="});
                    break;
                }
                case BinaryCode.NOT_EQUAL:{
                    current_scope.push({string:"~=="});
                    break;
                }
                case BinaryCode.GREATER:{
                    current_scope.push({string:">"});
                    break;
                }
                case BinaryCode.GREATER_EQUAL:{
                    current_scope.push({string:">="});
                    break;
                }
                case BinaryCode.LESS:{
                    current_scope.push({string:"<"});
                    break;
                }
                case BinaryCode.LESS_EQUAL:{
                    current_scope.push({string:"<="});
                    break;
                }
                
                // PATH_GET
                case BinaryCode.CHILD_GET: { 
                    current_scope.push({bin:BinaryCode.CHILD_GET, string:"."});
                    break;
                }
                
                // CHILD_GET_REF
                case BinaryCode.CHILD_GET_REF: { 
                    current_scope.push({bin:BinaryCode.CHILD_GET_REF, string:"->"});
                    break;
                }

                // CACHE POINTS
                case BinaryCode.CACHE_POINT: {
                    current_scope.push({bin:BinaryCode.CACHE_POINT});
                    break;
                }
                case BinaryCode.CACHE_RESET: {
                    current_scope.push({bin:BinaryCode.CACHE_RESET});
                    break;
                }


                // REMOTE Call (::)
                case BinaryCode.REMOTE:{
                    current_scope.push({string:"::"});
                    break;
                }

                // JMPS
                case BinaryCode.JMP: {
                    let index = data_view.getUint32(current_index, true);
                    current_index += Uint32Array.BYTES_PER_ELEMENT;
                    current_scope.push({string: "jmp " + index.toString(16)});
                    break;
                }

                case BinaryCode.JTR: {
                    let index = data_view.getUint32(current_index, true);
                    current_index += Uint32Array.BYTES_PER_ELEMENT;
                    current_scope.push({string: "jtr " + index.toString(16) + " "});
                    break;
                }

                case BinaryCode.JFA: {
                    let index = data_view.getUint32(current_index, true);
                    current_index += Uint32Array.BYTES_PER_ELEMENT;
                    current_scope.push({string: "jfa " + index.toString(16) + " "});
                    break;
                }


                // SET_LABEL  
                case BinaryCode.SET_LABEL: { 
                    let name = extractVariableName();
                    current_scope.push({string: Runtime.formatVariableName(name, '$') + " = "});
                    break;
                }

                // LABEL  
                case BinaryCode.LABEL: { 
                    let name = extractVariableName();
                    current_scope.push({type:TOKEN_TYPE.VALUE, string: Runtime.formatVariableName(name, '$')});
                    break;
                }

                // LABEL_ACTION  
                case BinaryCode.LABEL_ACTION: { 
                    let action_string = actionToString(uint8[current_index++]) // get action specifier
                    let name = extractVariableName()
                    current_scope.push({string: Runtime.formatVariableName(name, '$') + ` ${action_string}= `});
                    break;
                }


                
                // ASSIGN_INTERNAL_VAR  
                case BinaryCode.SET_INTERNAL_VAR: { 
                    let name = extractVariableName();
                    current_scope.push({string: Runtime.formatVariableName(name, '#') + " = "});
                    break;
                }

                // INTERNAL_VAR  
                case BinaryCode.INTERNAL_VAR: { 
                    let name = extractVariableName();
                    current_scope.push({type:TOKEN_TYPE.VALUE, string: Runtime.formatVariableName(name, '#')});
                    break;
                }

                // INTERNAL_VAR_ACTION  
                case BinaryCode.INTERNAL_VAR_ACTION: { 
                    let action_string = actionToString(uint8[current_index++]) // get action specifier
                    let name = extractVariableName()
                    current_scope.push({string: Runtime.formatVariableName(name, '#') + ` ${action_string}= `});
                    break;
                }


                // INTERNAL VAR shorthands
                case BinaryCode.VAR_RESULT:{ 
                    current_scope.push({type:TOKEN_TYPE.VALUE, string: "#result"});
                    break;
                }
                case BinaryCode.VAR_SUB_RESULT: { 
                    current_scope.push({type:TOKEN_TYPE.VALUE, string: "#sub_result"});
                    break;
                }
                case BinaryCode.VAR_ENCRYPTED: { 
                    current_scope.push({type:TOKEN_TYPE.VALUE, string: "#encrypted"});
                    break;
                }
                case BinaryCode.VAR_SIGNED: { 
                    current_scope.push({type:TOKEN_TYPE.VALUE, string: "#signed"});
                    break;
                }
                case BinaryCode.VAR_SENDER: { 
                    current_scope.push({type:TOKEN_TYPE.VALUE, string: "#sender"});
                    break;
                }
                case BinaryCode.VAR_CURRENT: { 
                    current_scope.push({type:TOKEN_TYPE.VALUE, string: "#current"});
                    break;
                }
                case BinaryCode.VAR_TIMESTAMP: { 
                    current_scope.push({type:TOKEN_TYPE.VALUE, string: "#timestamp"});
                    break;
                }
                case BinaryCode.VAR_META: { 
                    current_scope.push({type:TOKEN_TYPE.VALUE, string: "#meta"});
                    break;
                }
                case BinaryCode.VAR_REMOTE: { 
                    current_scope.push({type:TOKEN_TYPE.VALUE, string: "#remote"});
                    break;
                }

                case BinaryCode.VAR_STATIC: { 
                    current_scope.push({type:TOKEN_TYPE.VALUE, string: "#static"});
                    break;
                }
                case BinaryCode.VAR_ROOT: { 
                    current_scope.push({type:TOKEN_TYPE.VALUE, string: "#root"});
                    break;
                }
                case BinaryCode.VAR_THIS:  { 
                    current_scope.push({type:TOKEN_TYPE.VALUE, string: "#this"});
                    break;
                }
                case BinaryCode.VAR_IT:  { 
                    current_scope.push({type:TOKEN_TYPE.VALUE, string: "#it"});
                    break;
                }


                case BinaryCode.SET_VAR_RESULT: { 
                    current_scope.push({string: "#result = "});
                    break;
                }
                case BinaryCode.SET_VAR_SUB_RESULT: { 
                    current_scope.push({string: "#sub_result = "});
                    break;
                }
                case BinaryCode.SET_VAR_ROOT:  { 
                    current_scope.push({string: "#root = "});
                    break;
                }

                case BinaryCode.VAR_ROOT_ACTION: { 
                    let action_string = actionToString(uint8[current_index++]) // get action specifier
                    current_scope.push({string:  "#root" + ` ${action_string}= `});
                    break;
                }
                case BinaryCode.VAR_SUB_RESULT_ACTION: { 
                    let action_string = actionToString(uint8[current_index++]) // get action specifier
                    current_scope.push({string:  "#sub_result" + ` ${action_string}= `});
                    break;
                }
                case BinaryCode.VAR_RESULT_ACTION: { 
                    let action_string = actionToString(uint8[current_index++]) // get action specifier
                    current_scope.push({string:  "#result" + ` ${action_string}= `});
                    break;
                }
                case BinaryCode.VAR_REMOTE_ACTION: { 
                    let action_string = actionToString(uint8[current_index++]) // get action specifier
                    current_scope.push({string:  "#remote" + ` ${action_string}= `});
                    break;
                }

                // VARIABLE  
                case BinaryCode.VAR: {
                    let name = extractVariableName()
                    current_scope.push({type:TOKEN_TYPE.VALUE, string: (typeof name == "number" ? "_" + name.toString(16) : name)});
                    break;
                }
                // SET_VAR  
                case BinaryCode.SET_VAR: { 
                    let name = extractVariableName()
                    current_scope.push({string: (typeof name == "number" ? "_" + name.toString(16) : name) + " = "});
                    break;
                }
 
                // VAR_ACTION  
                case BinaryCode.VAR_ACTION: { 
                    let action_string = actionToString(uint8[current_index++]) // get action specifier
                    let name = extractVariableName()
                    current_scope.push({string: (typeof name == "number" ? "_" + name.toString(16) : name) + ` ${action_string}= `});
                    break;
                }

                // COMMAND END  
                case BinaryCode.CLOSE_AND_STORE: {
                    current_scope.push({string: ";\n"});
                    break;
                }

                // CODE_BLOCK 
                case BinaryCode.SCOPE_BLOCK: {  
                   
                    let size = data_view.getUint32(current_index, true);   // buffer length
                    current_index += Uint32Array.BYTES_PER_ELEMENT;
                    const buffer = uint8.subarray(current_index, current_index+size);
                    const decompiled = Runtime.decompile(buffer, comments, formatted, formatted_strings, false);
                    current_index += size;
                    // current_index += Uint16Array.BYTES_PER_ELEMENT;
                    // let args = [];

                    // // variables
                    // for (let i=0;i<nr_of_args;i++) {
                    //     let type:Type|typeof WITH;

                    //     let token = uint8[current_index++];

                    //     // get type
                    //     if (token == BinaryCode.TYPE) [type] = extractType();
                    //     else if (token >= BinaryCode.STD_TYPE_STRING && token <= BinaryCode.STD_TYPE_FUNCTION) type = Type.short_types[token];
                    //     else if (token == 1) type = WITH

                    //     let length = uint8[current_index++];

                    //     args.push([type, Runtime.utf8_decoder.decode(uint8.subarray(current_index, current_index+length))]);
                    //     current_index += length;
                    // }
                    
                    // // Compiled buffer

                    // let buffer_length = data_view.getUint32(current_index, true);
                    // current_index += Uint32Array.BYTES_PER_ELEMENT;

                    // let _buffer = buffer.slice(current_index, current_index+buffer_length);
                    // current_index += buffer_length;

                    // // show datex block as default 
                    // let code_block_string = Runtime.valueToDatexString(new ScopeBlock(args, _buffer), formatted)

                    current_scope.push({type: TOKEN_TYPE.VALUE, string:'('+decompiled+')'});

                    break;
                }

                // NULL
                case BinaryCode.NULL: {
                    current_scope.push({type: TOKEN_TYPE.VALUE, string:"null"});
                    break;
                }

                // VOID
                case BinaryCode.VOID: {
                    current_scope.push({type: TOKEN_TYPE.VALUE, string:"void"});
                    break;
                }

                // WILDCARD
                case BinaryCode.WILDCARD: {
                    current_scope.push({type: TOKEN_TYPE.VALUE, string:"*"});
                    break;
                }

                // RETURN
                case BinaryCode.RETURN: {
                    current_scope.push({string:"return"});
                    break;
                }

                // ABOUT
                case BinaryCode.ABOUT: {
                    current_scope.push({string:"about "});
                    break;
                }

                // COUNT
                case BinaryCode.COUNT: {
                    current_scope.push({string:"count "});
                    break;
                }

                // FREEZE
                case BinaryCode.FREEZE: {
                    current_scope.push({string:"freeze "});
                    break;
                }

                // SEAL
                case BinaryCode.SEAL: {
                    current_scope.push({string:"seal "});
                    break;
                }

                // HAS
                case BinaryCode.HAS: {
                    current_scope.push({string:" has "});
                    break;
                }

                // KEYS
                case BinaryCode.KEYS: {
                    current_scope.push({string:"keys "});
                    break;
                }

                // TEMPLATE
                case BinaryCode.TEMPLATE: {
                    current_scope.push({string:"template "});
                    break;
                }

                // EXTENDS
                case BinaryCode.EXTENDS: {
                    current_scope.push({string:" extends "});
                    break;
                }

                // SCOPE
                case BinaryCode.PLAIN_SCOPE: {
                    current_scope.push({string:"scope "});
                    break;
                }

                // TRANSFORM
                case BinaryCode.TRANSFORM: {
                    current_scope.push({string:"transform "});
                    break;
                }

                // DO
                case BinaryCode.DO: {
                    current_scope.push({string:"do "});
                    break;
                }

                // ITERATOR
                case BinaryCode.ITERATOR: {
                    current_scope.push({string:"iterator "});
                    break;
                }

                // ITERATION
                case BinaryCode.ITERATION: {
                    current_scope.push({string:"iteration "});
                    break;
                }

                // ASSERT
                case BinaryCode.ASSERT: {
                    current_scope.push({string:"assert "});
                    break;
                }

                // AWAIT
                case BinaryCode.AWAIT: {
                    current_scope.push({string:"await "});
                    break;
                }

                // FUNCTION
                case BinaryCode.FUNCTION: {
                    current_scope.push({string:"function "});
                    break;
                }


                // HOLD
                case BinaryCode.HOLD: {
                    current_scope.push({string:"hold "});
                    break;
                }

                // OBSERVE
                case BinaryCode.OBSERVE: {
                    current_scope.push({string:"observe "});
                    break;
                }

                // IMPLEMENTS
                case BinaryCode.IMPLEMENTS: {
                    current_scope.push({string:" implements "});
                    break;
                }

                // MATCHES
                case BinaryCode.MATCHES: {
                    current_scope.push({string:" matches "});
                    break;
                }

                // DEBUG
                case BinaryCode.DEBUG: {
                    current_scope.push({string:"debug "});
                    break;
                }


                // REQUEST
                case BinaryCode.REQUEST: {
                    current_scope.push({string:"request "});
                    break;
                }

                // URL
                case BinaryCode.URL: {
                    let length = data_view.getUint32(current_index, true);
                    current_index += Uint32Array.BYTES_PER_ELEMENT;
                                    
                    let url = new URL(Runtime.utf8_decoder.decode(uint8.subarray(current_index, current_index+length)));
                    current_index += length;

                    current_scope.push({type:TOKEN_TYPE.VALUE, string:Runtime.valueToDatexString(url, formatted_strings)});
                    break;
                }

                // ARRAY_START
                case BinaryCode.ARRAY_START: {
                    enterSubScope(BinaryCode.ARRAY_START);
                    break;
                }

                // TUPLE_START
                case BinaryCode.TUPLE_START: {
                    enterSubScope(BinaryCode.TUPLE_START);
                    break;
                }

                // OBJECT_START
                case BinaryCode.OBJECT_START: {
                    enterSubScope(BinaryCode.OBJECT_START);
                    break;
                }


                // list element with key
                case BinaryCode.ELEMENT_WITH_KEY: {
                    let length = uint8[current_index++];
                    let key = Runtime.utf8_decoder.decode(uint8.subarray(current_index, current_index+length));
                    current_index += length;

                    current_scope.push({bin:BinaryCode.ELEMENT_WITH_KEY, string:`"${key.replace(/\'/g, "\\'")}": `});
                    break;
                }

                case BinaryCode.ELEMENT_WITH_INT_KEY: {
                    let key = data_view.getUint32(current_index);
                    current_index += Uint32Array.BYTES_PER_ELEMENT;

                    current_scope.push({bin:BinaryCode.ELEMENT_WITH_KEY, string:`${key}: `});
                    break;
                }

                case BinaryCode.ELEMENT_WITH_DYNAMIC_KEY: {
                    current_scope.push({bin:BinaryCode.ELEMENT_WITH_KEY, string:`: `});
                    break;
                }

                case BinaryCode.KEY_PERMISSION: {
                    current_scope.push({string:`!!`});
                    break;
                }


                // keyless list element 
                case BinaryCode.ELEMENT: {
                    current_scope.push({bin:BinaryCode.ELEMENT});
                    break;
                }
                
                // ARRAY_END, OBJECT_END, TUPLE_END, RECORD_END
                case BinaryCode.ARRAY_END:
                case BinaryCode.OBJECT_END:
                case BinaryCode.TUPLE_END: {
                    try {
                        exitSubScope()
                    } catch (e) {
                        break loop;
                    }
                    break;
                }

                // STD SHORT TYPES
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
                    current_scope.push({type: TOKEN_TYPE.VALUE, string: Type.short_types[token].toString()});
                    break;
                }

                // ADD (+)
                case BinaryCode.ADD: {
                    current_scope.push({string:" + "});
                    break;
                }

                // SUBTRACT (-)
                case BinaryCode.SUBTRACT: {
                    current_scope.push({string:" - "});
                    break;
                }

                // MULTIPLY (*)
                case BinaryCode.MULTIPLY: {
                    current_scope.push({string:" * "});
                    break;
                }

                // DIVIDE (/)
                case BinaryCode.DIVIDE: {
                    current_scope.push({string:" / "});
                    break;
                }

                // SYNC (<<<)
                case BinaryCode.SYNC: {
                    current_scope.push({string:" <<< "});
                    break;
                }

                // STOP_SYNC (=/>)
                case BinaryCode.STOP_SYNC: {
                    current_scope.push({string:" <</ "});
                    break;
                }

                // AND (&)
                case BinaryCode.AND: {
                    current_scope.push({string:" & "});
                    break;
                }

                // OR (|)
                case BinaryCode.OR: {
                    current_scope.push({string:" | "});
                    break;
                }

                // NOT (~)
                case BinaryCode.NOT: {
                    current_scope.push({string:"~"});
                    break;
                }

                // SUBSCOPE_START
                case BinaryCode.SUBSCOPE_START: {
                    enterSubScope(BinaryCode.SUBSCOPE_START);
                    break;
                }
                // SUBSCOPE_END
                case BinaryCode.SUBSCOPE_END: {   
                    try {
                        exitSubScope()
                    } catch (e) {
                        break loop;
                    }
                    break;
                }
            
                // TRUE
                case BinaryCode.TRUE: {
                    current_scope.push({type: TOKEN_TYPE.VALUE, string: "true"});
                    break;
                }

                // FALSE
                case BinaryCode.FALSE: {
                    current_scope.push({type: TOKEN_TYPE.VALUE, string: "false"});
                    break;
                }

                // UNIT
                case BinaryCode.UNIT: {
                    let unit = new Unit(data_view.getFloat64(current_index, true));
                    current_index += Float64Array.BYTES_PER_ELEMENT;
                    current_scope.push({type: TOKEN_TYPE.VALUE, string: unit.toString()});
                    break;
                }

                // INT_8
                case BinaryCode.INT_8: {
                    let integer:bigint|number = data_view.getInt8(current_index);
                    current_index += Int8Array.BYTES_PER_ELEMENT;
                    current_scope.push({type: TOKEN_TYPE.VALUE, string: integer.toString()});
                    break;
                }

                // INT_16
                case BinaryCode.INT_16: {
                    let integer:bigint|number = data_view.getInt16(current_index, true);
                    current_index += Int16Array.BYTES_PER_ELEMENT;
                    current_scope.push({type: TOKEN_TYPE.VALUE, string: integer.toString()});
                    break;
                }

                // INT_32
                case BinaryCode.INT_32: {
                    let integer:bigint|number = data_view.getInt32(current_index, true);
                    current_index += Int32Array.BYTES_PER_ELEMENT;
                    current_scope.push({type: TOKEN_TYPE.VALUE, string: integer.toString()});
                    break;
                }

                // INT_64
                case BinaryCode.INT_64: {
                    let integer:bigint|number = data_view.getBigInt64(current_index, true);
                    current_index += BigInt64Array.BYTES_PER_ELEMENT;
                    current_scope.push({type: TOKEN_TYPE.VALUE, string: integer.toString()});
                    break;
                }

                // FLOAT
                case BinaryCode.FLOAT_64: {
                    let float = data_view.getFloat64(current_index, true);
                    current_index += Float64Array.BYTES_PER_ELEMENT;
                    current_scope.push({type: TOKEN_TYPE.VALUE, string: Runtime.valueToDatexString(float)});
                    break;
                }

            
                // FLOAT
                case BinaryCode.FLOAT_AS_INT: {
                    let float = data_view.getInt32(current_index, true);
                    current_index += Int32Array.BYTES_PER_ELEMENT;
                    current_scope.push({type: TOKEN_TYPE.VALUE, string: Runtime.valueToDatexString(float)});
                    break;
                }

                // TYPE
                case BinaryCode.TYPE: {
                    const [type] = extractType();
                    current_scope.push({type: TOKEN_TYPE.VALUE, string: type.toString()});
                    break;
                }

                // EXTENDED_TYPE
                case BinaryCode.EXTENDED_TYPE: {
                    const [type, has_parameters] = extractType(true);
                    if (has_parameters) current_scope.push({type: TOKEN_TYPE.VALUE, bin:BinaryCode.EXTENDED_TYPE, string: type.toString().slice(0,-1)});
                    else current_scope.push({type: TOKEN_TYPE.VALUE, string: type.toString()});
                    break;
                }

                // FILTER
                case BinaryCode.FILTER: {
                    let targets_size = uint8[current_index++];
                    let target_list = [];

                    for (let n=0; n<targets_size; n++) {
                        let type = uint8[current_index++];
                        const target = constructFilterElement(type, target_list);
                        target_list.push(target);
                    }

                    let cnf:CNF = new Datex.Addresses.AndSet();

                    // filter clauses part
                    
                    let ands_nr = uint8[current_index++];

                    for (let n=0; n<ands_nr; n++) {
                        let ors_nr = uint8[current_index++];

                        let ors = new Set<Datex.Addresses.Target | Datex.Addresses.Not<Datex.Addresses.Target>>();
                        for (let m=0; m<ors_nr; m++) {
                            let index = data_view.getInt8(current_index++);
                            ors.add(index<0 ? Datex.Addresses.Not.get(target_list[-index-1]) : target_list[index-1]);
                        }
                        cnf.add(ors);
                    }
                    
                    current_scope.push({type: TOKEN_TYPE.VALUE, string: new Datex.Addresses.Filter(...cnf).toString()});
                    break;
                }


                // ENDPOINTS / ALIASES
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
                    current_scope.push({type: TOKEN_TYPE.VALUE, string: f.toString()});
                    break;
                }


                // SET_POINTER
                case BinaryCode.SET_POINTER: {
                    let id = uint8.slice(current_index, current_index+=Pointer.MAX_POINTER_ID_SIZE);
                    current_scope.push({string: `$${id}=`});
                    break;
                }

                // DELETE_POINTER
                case BinaryCode.DELETE_POINTER: {
                    current_scope.push({string: `delete `});
                    break;
                }

                // SUBSCRIBE
                case BinaryCode.SUBSCRIBE: {
                    current_scope.push({string: `subscribe `});
                    break;
                }

                // UNSUBSCRIBE
                case BinaryCode.UNSUBSCRIBE: {
                    current_scope.push({string: `unsubscribe `});
                    break;
                }

                // SCOPE
                case BinaryCode.PLAIN_SCOPE: {
                    current_scope.push({string: `scope `});
                    break;
                }

                // VALUE
                case BinaryCode.VALUE: {
                    current_scope.push({string: `value `});
                    break;
                }

                // GET_TYPE
                case BinaryCode.GET_TYPE: {
                    current_scope.push({string: `type `});
                    break;
                }

                // ORIGIN
                case BinaryCode.ORIGIN: {
                    current_scope.push({string: `origin `});
                    break;
                }

                // SUBSCRIBERS
                case BinaryCode.SUBSCRIBERS: {
                    current_scope.push({string: `subscribers `});
                    break;
                }

                // POINTER
                case BinaryCode.POINTER: {
                    let id = uint8.slice(current_index, current_index+=Pointer.MAX_POINTER_ID_SIZE);
                    current_scope.push({string: `$${Pointer.normalizePointerId(id)}`});
                    break;
                }

                // POINTER_ACTION
                case BinaryCode.POINTER_ACTION: {
                    let action_string = actionToString(uint8[current_index++]) // get action specifier

                    let id = uint8.slice(current_index, current_index+=Pointer.MAX_POINTER_ID_SIZE);
                    current_scope.push({string: `$${Pointer.normalizePointerId(id)} ${action_string}= `});
                    break;
                }

                // CREATE_POINTER ($$ ())
                case BinaryCode.CREATE_POINTER: {
                    current_scope.push({string: `$$`});
                    break;
                }

                
                
                // STREAM (<<)
                case BinaryCode.STREAM: {
                    current_scope.push({string: ` << `});
                    break;
                }

                case BinaryCode.STOP_STREAM: {
                    current_scope.push({string: ` </ `});
                    break;
                }


                default: {
                    current_scope.push({string: `###${token?.toString(16)??'?'}###`});
                }

            }
                    
        }


        // now parse tokens to DATEX script

        const parse_tokens = (tokens:token_list, indentation=0)=> {
            let datex_tmp = "";

            let append:string;

            for (let t=0;t<tokens.length;t++) {
                let current_token = tokens[t];

                if (current_token.type == TOKEN_TYPE.SUBSCOPE) {
                    let indentation = 0;
                    // open bracket
                    if (current_token.bin == BinaryCode.SUBSCOPE_START) {
                        datex_tmp += "("
                        //indentation = 5;
                    } 
                    else if (current_token.bin == BinaryCode.TUPLE_START) datex_tmp += "("
                    else if (current_token.bin == BinaryCode.ARRAY_START) datex_tmp += "["
                    else if (current_token.bin == BinaryCode.OBJECT_START) datex_tmp += "{"

                    datex_tmp += parse_tokens(<token_list>current_token.value, indentation) // recursive call with indentation

                    // close bracket
                    if (current_token.bin == BinaryCode.SUBSCOPE_START) datex_tmp += ")"
                    else if (current_token.bin == BinaryCode.TUPLE_START) datex_tmp += ")"
                    else if (current_token.bin == BinaryCode.ARRAY_START) datex_tmp += "]"
                    else if (current_token.bin == BinaryCode.OBJECT_START) datex_tmp += "}"
                }
    

                // string value
                else {
                    if (current_token.string) datex_tmp += current_token.string;
                }

                // add comma after element (before new element)
                if (tokens[t+1]?.bin == BinaryCode.ELEMENT_WITH_KEY || tokens[t+1]?.bin == BinaryCode.ELEMENT) datex_tmp += ","

                // append something
                if (append) {
                    datex_tmp += append;
                    append = null;
                }

                // =, +=, -=, ...
                if (current_token.bin == BinaryCode.CHILD_SET) append = " = ";
                else if (current_token.bin == BinaryCode.RANGE) append = "..";
                else if (current_token.bin == BinaryCode.EXTENDED_TYPE) append = ">";
                else if (current_token.bin == BinaryCode.CHILD_ACTION) append = ` ${current_token.meta_string}= `;
            }

            // add indentation at newlines
            return (indentation? " ".repeat(indentation) : "") +  datex_tmp.replace(/\n/g, "\n" + (" ".repeat(indentation)))
        }

        let datex_string = (parse_tokens(tokens) + append_comments).replace(/\n$/,''); // remove last newline
        
        return datex_string;
    }



    private static getAbout(type:Type):Markdown|null {
        if (type instanceof Type) return type.about;
        else return VOID;
    }


    // byte -> 0 2 1 5
    public static convertByteToNumbers(bit_distribution:number[], byte:number):number[] {
        let byte_str = byte.toString(2).padStart(8, '0');
        let nrs = [];
        let pos = 0;
        for (let size of bit_distribution) {
            nrs.push(parseInt(byte_str.slice(pos, pos+size), 2));
            pos += size;
        }
        return nrs;
    }
    
    
    // parseHeader, synchronous Part
    public static parseHeaderSynchronousPart(dxb:ArrayBuffer):[dxb_header, Uint8Array, Uint8Array, number, Uint8Array, ArrayBuffer] {
        let header_data_view = new DataView(dxb);
        let header_uint8     = new Uint8Array(dxb); 

        if (header_uint8[0] !== 0x01 || header_uint8[1] !== 0x64) {
            throw new SecurityError("DXB Format not recognized")
        }

        if (dxb.byteLength<4) throw new SecurityError("DXB Block must be at least 4 bytes")

        let header:dxb_header = {};
        let routing_info:routing_info = {}

        // version
        header.version = header_uint8[2];

        let i = 3;

        const block_size = header_data_view.getInt16(i, true);
        i += Int16Array.BYTES_PER_ELEMENT;

        // ROUTING HEADER /////////////////////////////////////////////////
        routing_info.ttl = header_uint8[i++];
        routing_info.prio = header_uint8[i++];

        const signed_encrypted = header_uint8[i++];
        header.signed = signed_encrypted == 1 || signed_encrypted == 2; // is signed?
        header.encrypted = signed_encrypted == 2 || signed_encrypted == 3; // is encrypted?

        header.routing = routing_info;

        // sender
        const last_index:[number] = [0];
        routing_info.sender = header.sender = DatexCompiler.extractHeaderSender(header_uint8, last_index);
        i = last_index[0];
       
        
        let receiver_size = header_data_view.getUint16(i, true);
        i += Uint16Array.BYTES_PER_ELEMENT;

        let encrypted_key:ArrayBuffer;

        // indicates flooding
        if (receiver_size == MAX_UINT_16) {
            routing_info.flood = true;
        }
        else if (receiver_size!=0) {
            // receivers
            let targets_nr = header_uint8[i++];
            let target_list = [];

            for (let n=0; n<targets_nr; n++) {
                let type = header_uint8[i++];

                // is pointer
                if (type == BinaryCode.POINTER) {
                    const id_buffer = header_uint8.subarray(i, i+=Pointer.MAX_POINTER_ID_SIZE);
                    const target = Pointer.get(id_buffer)?.value;
                    if (!target) throw new ValueError("Receiver filter pointer not found (TODO request)")
                    if (!(target instanceof Datex.Addresses.Target || target instanceof Datex.Addresses.Filter || target instanceof Array || target instanceof Set || target instanceof Datex.Addresses.Not)) throw new ValueError("Receiver filter pointer is not a filter")
                    else target_list.push(target);
                    console.log("TARGET", target)
                }

                // filter target
                else {           
                    let name_length = header_uint8[i++]; // get name length
                    let subspace_number = header_uint8[i++]; // get subspace number
                    let instance_length = header_uint8[i++]; // get instance length
        
                    let name_binary = header_uint8.subarray(i, i+=name_length);
                    let name = type == BinaryCode.ENDPOINT ? name_binary : Runtime.utf8_decoder.decode(name_binary)  // get name
        
                    let subspaces = [];
                    for (let n=0; n<subspace_number; n++) {
                        let length = header_uint8[i++];
                        let subspace_name = Runtime.utf8_decoder.decode(header_uint8.subarray(i, i+=length));
                        subspaces.push(subspace_name);
                    }
        
                    let instance = Runtime.utf8_decoder.decode(header_uint8.subarray(i, i+=instance_length))  // get instance
                    let app_index = header_uint8[i++];

                    const target = Datex.Addresses.Target.get(name, subspaces, instance, app_index ? target_list[app_index-1] : null, type);

                    
                    target_list.push(target)

                    // get attached symmetric key?
                    let has_key = header_uint8[i++];

                    if (has_key) {
                        // add to keys
                        if (this.endpoint.equals(<Addresses.Endpoint>target)) encrypted_key = header_uint8.slice(i, i+512);
                        i += 512;
                    }
                }

            }

            let cnf:CNF = new Datex.Addresses.AndSet();

            // filter clauses part
            
            let ands_nr = header_uint8[i++];

            for (let n=0; n<ands_nr; n++) {
                let ors_nr = header_uint8[i++];
                let ors = new Set<Datex.Addresses.Target | Datex.Addresses.Not<Datex.Addresses.Target>>();
                for (let m=0; m<ors_nr; m++) {
                    let index = header_data_view.getInt8(i++);
                    ors.add(index<0 ? Datex.Addresses.Not.get(target_list[-index-1]) : target_list[index-1]);
                }
                cnf.add(ors.size == 1 ? [...ors][0] : ors);
            }

            // only a single DatexFilter (poibter) in the AndSet
            if (cnf.size == 1 && [...cnf][0] instanceof Datex.Addresses.Filter) routing_info.receivers = <Datex.Addresses.Filter><any>[...cnf][0]
            // create a new Filter from the CNF
            else routing_info.receivers = new Datex.Addresses.Filter(...cnf);
        }
        

        ///////////////////////////////////////////////////////////////////

        let signature_start = i;
        if (header.signed) i += DatexCompiler.signature_size; // has signature?

        // always get the following values: /////////////
        
        // sid 
        header.sid = header_data_view.getUint32(i, true);
        i+=Uint32Array.BYTES_PER_ELEMENT;

        // block index
        header.return_index = header_data_view.getUint16(i, true);
        i+=Uint16Array.BYTES_PER_ELEMENT;

        header.inc = header_data_view.getUint16(i, true);
        i+=Uint16Array.BYTES_PER_ELEMENT;

        // now save symmetric key
    
        // foreign endpoint (if receiver not self or force eating this response) //////////
        // handle result
        if (routing_info.receivers && !routing_info.receivers.equals(Runtime.endpoint)) {
            header.redirect = true;
        }
        ///////////////////////////////////////////////////////////////////



        // type
        header.type = header_uint8[i++];

        // get additional meta data (header data)

        // flags
        let [_, executable, end_of_scope, device_type] =
            this.convertByteToNumbers([1,1,1,5], header_uint8[i++]);
        header.executable = executable ? true : false;
        header.end_of_scope = end_of_scope ? true : false;
        

        // timestamp
        header.timestamp = new Date(Number(header_data_view.getBigUint64(i, true)) + DatexCompiler.BIG_BANG_TIME);
        i+=BigUint64Array.BYTES_PER_ELEMENT;

        // iv if encrypted
        let iv:Uint8Array;
        if (header.encrypted) {
            iv = header_uint8.slice(i, i+16);
            i+=16;
        }
        
        
        // extract buffers
        let header_buffer = header_uint8.slice(0, i);
        let data_buffer = header_uint8.slice(i);

        return [header, data_buffer, header_buffer, signature_start, iv, encrypted_key] 
    }

    // returns header info and dxb body, or routing information if not directed to own endpoint
    static async parseHeader(dxb:ArrayBuffer, force_sym_enc_key?:CryptoKey, force_only_header_info = false):Promise<[dxb_header, Uint8Array, Uint8Array, Uint8Array]|dxb_header> {

        let res = this.parseHeaderSynchronousPart(dxb);

        let header: dxb_header,
            data_buffer:Uint8Array, 
            header_buffer:Uint8Array, 
            signature_start:number, 
            iv: Uint8Array,
            encrypted_key: ArrayBuffer;

        if (!res[0].redirect && !force_only_header_info) {
            [header, data_buffer, header_buffer, signature_start, iv, encrypted_key] = res;

            // save encrypted key?
            if (encrypted_key) {
                let sym_enc_key = await Crypto.extractEncryptedKey(encrypted_key);
                await this.setScopeSymmetricKeyForSender(header.sid, header.sender, sym_enc_key)
            }

            // get signature
            if (header.signed) {
                if (!header.sender) throw [header, new SecurityError("Signed DATEX without a sender")];
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

            // decrypt

            if (header.encrypted) {
                if (!iv) throw [header, new SecurityError("DATEX not correctly encrypted")];
                // try to decrypt body
                try {
                    data_buffer = new Uint8Array(await Crypto.decryptSymmetric(data_buffer.buffer, force_sym_enc_key ?? await this.getScopeSymmetricKeyForSender(header.sid, header.sender), iv));
                } catch(e)  {
                    console.warn(header, e);
                    throw [header, e];
                }
            }
                        
            // header data , body buffer, header buffer, original (encrypted) body buffer
            return [header, data_buffer, header_buffer, res[1]];

        }

        // only return header
        else return res[0];

    }



    static active_datex_scopes = new Map<Datex.Addresses.Target, Map<number, {next:number, scope?:datex_scope, active:Map<number, [dxb_header, ArrayBuffer, ArrayBuffer]>}>>();

    // get handler function for dxb binary input
    public static getDatexInputHandler(full_scope_callback?:(sid:number, scope:datex_scope|Error)=>void) {
        let handler = (dxb: ArrayBuffer|ReadableStreamDefaultReader<Uint8Array> | {dxb:ArrayBuffer|ReadableStreamDefaultReader<Uint8Array>, variables?:any, header_callback?:(header:dxb_header)=>void}, last_endpoint?:Datex.Addresses.Endpoint): Promise<dxb_header|void>=>{
            if (dxb instanceof ArrayBuffer) return this.handleDatexIn(dxb, last_endpoint, full_scope_callback); 
            else if (dxb instanceof ReadableStreamDefaultReader) return this.handleContinuousBlockStream(dxb, full_scope_callback, undefined, undefined, last_endpoint)
            else {
                if ((<any>dxb).dxb instanceof ArrayBuffer) return this.handleDatexIn((<any>dxb).dxb, last_endpoint, full_scope_callback,(<any>dxb).variables, (<any>dxb).header_callback); 
                else if ((<any>dxb).dxb instanceof ReadableStreamDefaultReader) return this.handleContinuousBlockStream((<any>dxb).dxb, full_scope_callback,  (<any>dxb).variables, (<any>dxb).header_callback, last_endpoint);
            }
        }
        return handler;
    }

    // extract dxb blocks from a continuos stream
    private static async handleContinuousBlockStream(dxb_stream_reader: ReadableStreamDefaultReader<Uint8Array>, full_scope_callback, variables?:any, header_callback?:(header:dxb_header)=>void, last_endpoint?:Datex.Addresses.Endpoint) {
        
        let current_block: Uint8Array;
        let current_block_size: number
        let new_block = new Uint8Array(4);
        let overflow_block: Uint8Array;

        let index = 0;
        let timeout;

        const newValue = (value:Uint8Array) => {

            // reset after some time
            /*clearTimeout(timeout);
            timeout = setTimeout(()=>{
                console.log("reset dxb stream after timeout")
                current_block = null; 
                overflow_block = null;
                index = 0;
            }, 6000)*/

            // insert overflow data
            if (overflow_block) {
                const _overflow_block = overflow_block;
                overflow_block = null;
                newValue(_overflow_block);
            }

            if (current_block) {
                // too big for current_block
                if (index+value.byteLength > current_block_size) {
                    current_block.set(value.subarray(0,current_block_size-index), index);
                    overflow_block = value.subarray(current_block_size-index);
                }
                else current_block.set(value, index);
            }
            else {
                // too big for new_block
                if (index+value.byteLength > 4) {
                    new_block.set(value.subarray(0,4-index), index);
                    overflow_block = value.subarray(4-index);
                }
                else new_block.set(value, index);
            }

            index += value.byteLength;

            // block start and size is available
            if (!current_block && index >= 4) {
                // check magic number and block size
                if (!(new_block[0] == 0x01 && new_block[1] == 0x64)) {
                    logger.error("DXB Format not recognized in block stream");
                    // try again
                    overflow_block = null;
                    index = 0;
                }
                else {
                    // get Uint16 block size and create new buffer
                    current_block_size = new_block[2]*256+new_block[3];
                    current_block = new Uint8Array(current_block_size);
                    current_block.set(new_block); // copy first header part into new block  
                    index = 4; // force to 4
                }
            }

            // block end
            if (current_block && index >= current_block_size) {
                console.log("received new block from stream")
                this.handleDatexIn(current_block.buffer, last_endpoint, full_scope_callback, variables, header_callback); 
                // reset for next block
                current_block = null; 
                index = 0; // force to 0
            }
        }

        try {
            while (true) {
                const { value, done } = await dxb_stream_reader.read();
                if (done) {
                    logger.error("reader has been cancelled")
                    break;
                }
                newValue(value);
            }
        } catch (error) {
            logger.error("disconnected: " + error)
        } finally {
            dxb_stream_reader.releaseLock();
        }
        
    }

    // simple scope execution, no callbacks, multi block scopes, return global or throw error
    public static async simpleScopeExecution(scope:datex_scope) {
        // run scope, result is saved in 'scope' object
        await this.run(scope);
        return scope.result;
    }

    // handle dxb block with optional variable assignments and callbacks
    private static async handleDatexIn(dxb:ArrayBuffer, last_endpoint:Datex.Addresses.Endpoint, full_scope_callback?:(sid:number, scope:any, error?:boolean)=>void, variables?:PropertyDescriptorMap, header_callback?:(header:dxb_header)=>void): Promise<dxb_header> {

        let header:dxb_header, data_uint8:Uint8Array;

        let res:dxb_header|[dxb_header, Uint8Array, Uint8Array, Uint8Array];
        try {
            res = await this.parseHeader(dxb);
        }
        catch (e) {
            // e is [dxb_header, Error]
            //throw e
            console.error(e)
            this.handleScopeError(e[0], e[1]);
            return;
        }

        // normal request
        if (res instanceof Array) {
            [header, data_uint8] = res;
            // + flood, exclude last_endpoint - don't send back in flooding tree
            if (header.routing.flood) {
                this.floodDatex(dxb, last_endpoint??header.sender, header.routing.ttl-1); // exclude the node this was sent from, asume it is header.sender if no last_endpoint was provided
            }

            // callback for header info
            if (header_callback instanceof globalThis.Function) header_callback(header);


        }
        // needs to be redirected 
        else {
            this.redirectDatex(dxb, res, false);

            // callback for header info
            if (header_callback instanceof globalThis.Function) header_callback(res);
            return;
        }

        let data = data_uint8.buffer; // get array buffer

        // create map for this sender
        if (!this.active_datex_scopes.has(header.sender)) {
            if (header.end_of_scope) {} // is new scope and immediately closed
            else this.active_datex_scopes.set(header.sender, new Map());
        }
        // modified sid: negative for own responses to differentiate
        const sid = Runtime.endpoint.equals(header.sender) && header.type == DatexProtocolDataType.RESPONSE ? -header.sid : header.sid;
        // create map for this sid if not yet created
        let sender_map = this.active_datex_scopes.get(header.sender);
        if (sender_map && !sender_map.has(sid)) {
            sender_map.set(sid, {next:0, active:new Map()});
        }
        let scope_map = sender_map?.get(sid);

        // this is the next block or the only block (immediately closed)
        if (!scope_map || (scope_map.next == header.inc)) {

            // get existing scope or create new
            let scope = scope_map?.scope ?? this.createNewInitialScope(header, variables);

            // those values can change later in the while loop
            let _header = header;
            let _data = data;
            let _dxb = dxb;

            // parse current block and try if blocks with higher ids exist
            do {
                let has_error = false;
                try {
                    // update scope buffers
                    this.updateScope(scope, _data, _header) // set new _data (datex body) and _header (header information)
                    IOHandler.handleDatexReceived(scope, _dxb) // send scope, current dxb and sym enc key (might get removed otherwise) to datex receive handler
                    // run scope, result is saved in 'scope' object
                    await this.run(scope);
                }
                // catch global errors
                catch (e) {
                    // return full dxb
                    if (full_scope_callback && typeof full_scope_callback == "function") {
                        full_scope_callback(sid, e, true);
                    }

                    //logger.error("scope error", e);
                    this.handleScopeError(_header, e, scope);
                    has_error = true;
                }

                // end reached (end of scope or 'end' command in scope)
                if (_header.end_of_scope || scope.closed) {

                    // cleanup
                    sender_map?.delete(sid);
                    this.removeScopeSymmetricKeyForSender(sid, _header.sender);
                    
                    // handle result normal
                    if (!has_error) {
                        // return full dxb
                        if (full_scope_callback && typeof full_scope_callback == "function") {
                            full_scope_callback(sid, scope);
                        }

                        // handle result
                        await this.handleScopeResult(_header, scope, scope.result)
                    }
    
                    break;
                }

                else {
                    scope_map.next++; // increase index counter
                    if (scope_map.next > DatexCompiler.MAX_BLOCK) scope_map.next = 0; // index overflow, reset to 0
                    if (!scope_map.scope) scope_map.scope = scope; // save scope

                    // check for waiting block with next index
                    if (scope_map.active.has(scope_map.next)) {
                        [_header, _data, _dxb] = scope_map.active.get(scope_map.next);
                    }
                    else break; // currently no waiting block
                    
                }

            } while(true)

        }

        // has to wait for another block first
        else {
            // should not happen, scope_map.next can't already be higher, because it would have required this block
            // possible reason: this block was already sent earlier
            if (scope_map.next > header.inc) {
                logger.error("invalid scope inc, lower than next required number")
            }
            // block not yet required, wait
            else {
                scope_map.active.set(header.inc, [header, data, dxb]);
            }
        }
    
        return header
    }


    private static handleScopeError(header:dxb_header, e: any, scope?:datex_scope) {
        if (header?.type == undefined) {
            console.log("Scope error occured, cannot get the original error here!");
            return;
        }
        // return error to sender (if request)
        if (header.type == DatexProtocolDataType.REQUEST) {
            // is not a DatexError -> convert to DatexError
            if (e instanceof globalThis.Error && !(e instanceof Error)) {
                e = new Error(e.message, [[Runtime.endpoint, "[native] " + e.name]])
                if (scope) e.addScopeToStack(scope);
            }
            this.datexOut(["!?", [e], {type:DatexProtocolDataType.RESPONSE, to:header.sender, return_index:header.return_index, sign:header.signed}], header.sender,  header.sid, false);
        }
        else if (
            header.type == DatexProtocolDataType.RESPONSE || 
            header.type == DatexProtocolDataType.DATA ||
            header.type == DatexProtocolDataType.LOCAL_REQ) 
        {
            let unique_sid = header.sid+"-"+header.return_index;

            // handle result
            if (this.callbacks_by_sid.has(unique_sid)) {
                this.callbacks_by_sid.get(unique_sid)[1](e, true);
                this.callbacks_by_sid.delete(unique_sid);
            }
            if (this.detailed_result_callbacks_by_sid.has(unique_sid)) {
                this.detailed_result_callbacks_by_sid.get(unique_sid)(scope, header, e);
                this.detailed_result_callbacks_by_sid.delete(unique_sid)
            }
            else if (this.detailed_result_callbacks_by_sid_multi.has(unique_sid)) {
                this.detailed_result_callbacks_by_sid_multi.get(unique_sid)(scope, header, e);
            }

        }
        else {
            logger.error("Invalid proctocol data type: " + header.type)
        }

    }

    private static async handleScopeResult(header:dxb_header, scope: datex_scope, return_value:any){
        
        let unique_sid = header.sid+"-"+header.return_index;
        
        // return global result to sender (if request)
        if (header.type == DatexProtocolDataType.REQUEST) {
            this.datexOut(["?", [return_value], {type:DatexProtocolDataType.RESPONSE, to:header.sender, return_index:header.return_index, encrypt:header.encrypted, sign:header.signed}], header.sender, header.sid, false);
        }

        // handle response
        else if (header.type == DatexProtocolDataType.RESPONSE ||
            header.type == DatexProtocolDataType.DATA ||
            header.type == DatexProtocolDataType.LOCAL_REQ)
        {
            // handle result
            if (this.callbacks_by_sid.has(unique_sid)) {
                this.callbacks_by_sid.get(unique_sid)[0](return_value);      
                this.callbacks_by_sid.delete(unique_sid)                     
            }
            if (this.detailed_result_callbacks_by_sid.has(unique_sid)) {
                this.detailed_result_callbacks_by_sid.get(unique_sid)(scope, header);
                this.detailed_result_callbacks_by_sid.delete(unique_sid)
            }
            else if (this.detailed_result_callbacks_by_sid_multi.has(unique_sid)) {
                this.detailed_result_callbacks_by_sid_multi.get(unique_sid)(scope, header);
            }
            
        }

        // bc transaction
        else if (header.type == DatexProtocolDataType.BC_TRNSCT) {
            console.log("bc transaction");
        }

        // hello (also temp: get public keys)
        else if (header.type == DatexProtocolDataType.HELLO) {
            if (return_value) {
                try {
                    let keys_updated = await Crypto.bindKeys(header.sender, ...<[ArrayBuffer,ArrayBuffer]>return_value);
                    console.log("HELLO from " + header.sender +  ", keys "+(keys_updated?"":"not ")+"updated");
                }
                catch (e) {
                    logger.error("Invalid HELLO keys");
                }
            }
            else console.log("HELLO from " + header.sender +  ", no keys");
        }

        else {
            logger.error("Invalid proctocol data type: " + header.type)
        }
        // global scope output (e.g. for displaying binary data or scope metadata)
        IOHandler.handleScopeFinished(header.sid, scope);

    }


    /** casts an object, handles all <std:*> types */
    public static async castValue(type:Type, value:any, context?:any, origin:Datex.Addresses.Endpoint = Runtime.endpoint, no_fetch?:boolean): Promise<any> {
        
        let old_type = Type.getValueDatexType(value);
        let old_value = value instanceof UnresolvedValue ? value[DX_VALUE] : value;

        // already the right type
        if (old_type == type) return old_value;
        
        let new_value:any = UNKNOWN_TYPE;

        // only handle std namespace
        if (type.namespace == "std") {
            if (old_value instanceof Pointer) old_value = old_value.value;

            // handle default casts
            switch (type) {

                // get <Type>
                case Type.std.Type:{
                    new_value = old_type;
                    break;
                }

                case Type.std.Void: {
                    new_value = VOID;
                    break;
                }

                case Type.std.Null: {
                    new_value = null;
                    break;
                }

                case Type.std.String: {
                    if (old_value === VOID) new_value = globalThis.String()
                    else if (old_value instanceof Markdown) new_value = old_value.toString();
                    else if (old_value instanceof ArrayBuffer) new_value = Runtime.utf8_decoder.decode(old_value); // cast to <String>
                    else new_value = this.valueToDatexString(value, false, true); 
                    break;
                }
                case Type.std.Float: {
                    if (old_value === VOID) new_value = Number()
                    else if (old_value==null) new_value =  0;
                    else if (typeof old_value == "string" || typeof old_value == "boolean" || typeof old_value == "bigint"){
                        new_value = Number(old_value);
                        if (isNaN(new_value)) throw new ValueError("Failed to convert "+ old_type +" to "+type);
                    }
                    break;
                }
                case Type.std.Int: {
                    if (old_value === VOID) new_value = this.OPTIONS.USE_BIGINTS ? 0n : 0;
                    else if (typeof old_value == "number") new_value = Runtime.OPTIONS.USE_BIGINTS ?  BigInt(Math.floor(old_value)) : Math.floor(old_value);
                    else if (old_value==null) new_value = this.OPTIONS.USE_BIGINTS ? 0n : 0;
                    else if (typeof old_value == "string" || typeof old_value == "boolean" || typeof old_value == "bigint"){
                        new_value = Math.floor(Number(old_value));
                        if (isNaN(new_value)) throw new ValueError("Failed to convert "+ old_type+" to "+type);
                        if (Runtime.OPTIONS.USE_BIGINTS) new_value = BigInt(new_value);
                    }
                    else new_value = INVALID;
                    break;
                }
                case Type.std.Unit: {
                    if (old_value === VOID) new_value = new Unit();
                    else if (typeof old_value == "number" || typeof old_value == "bigint") new_value = new Unit(Number(old_value));
                    else if (old_value==null) new_value = new Unit(0);
                    else new_value = INVALID;
                    break;
                }
                case Type.std.Boolean: {
                    if (old_value === VOID) new_value = globalThis.Boolean();
                    new_value = !!old_value;
                    break;
                }
                case Type.std.Endpoint: {
                    if (typeof old_value=="string") new_value = Datex.Addresses.Endpoint.fromString(old_value)
                    else new_value = INVALID;
                    break;
                }
                case Type.std.Target: {
                    if (typeof old_value=="string") new_value = Datex.Addresses.Target.get(old_value);
                    else new_value = INVALID;
                    break;
                }
                case Type.std.Object: {
                    if (old_value === VOID) new_value = Object();
                    else if (old_value && typeof old_value == "object") new_value = {...<object>Runtime.serializeValue(old_value)??{}};
                    else new_value = INVALID;
                    break;
                }
                case Type.std.Tuple: {
                    if (old_value === VOID) new_value = new Tuple().seal();
                    else if (old_value instanceof Array){
                        new_value = new Tuple(old_value).seal();
                    }
                    else if (old_value instanceof Set) {
                        new_value = new Tuple(old_value).seal();
                    }
                    else if (old_value instanceof Map){
                        new_value = new Tuple(old_value.entries()).seal();
                    }
                    else if (old_value instanceof Iterator){
                        new_value = await old_value.collapse()
                    }
                    else new_value = new Tuple(old_value).seal();
                    break;
                }
                

                case Type.std.Array: {
                    if (old_value === VOID) new_value = Array()
                    else if (old_value instanceof Tuple) new_value = old_value.toArray();
                    else if (old_value instanceof Set) new_value = [...old_value];
                    else if (old_value instanceof Map) new_value = [...old_value.entries()];
                    else new_value = INVALID;
                    break;
                }        
                case Type.std.Buffer: {
                    if (old_value === VOID) new_value = new ArrayBuffer(0);
                    else if (typeof old_value=="string") new_value = this.utf8_encoder.encode(old_value).buffer;
                    else new_value = INVALID;
                    break;
                }
                case Type.std.Filter: {
                    if (old_value === VOID) new_value = new Datex.Addresses.Filter();
                    else if (old_value instanceof Datex.Addresses.Target) new_value = new Datex.Addresses.Filter(old_value);
                    else if (old_value instanceof Array) new_value = new Datex.Addresses.Filter(...old_value);
                    else if (typeof old_value == "string") new_value = Datex.Addresses.Filter.fromString(old_value);
                    else new_value = INVALID;
                    break;
                }
                // Errors
                case Type.std.Error: {
                    if (old_value === VOID) new_value = new Error(null, null);
                    else if(typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint") new_value = new Error(old_value, null);
                    else if(old_value instanceof Array) new_value = new Error(old_value[0], old_value[1])
                    else new_value = INVALID;
                    break;
                }
                case Type.std.SyntaxError: {
                    if (old_value === VOID) new_value = new SyntaxError(null, null);
                    else if(typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint") new_value = new SyntaxError(old_value, null);
                    else if(old_value instanceof Array) new_value = new SyntaxError(old_value[0], old_value[1])
                    else new_value = INVALID;
                    break;
                }
                case Type.std.CompilerError: {
                    if (old_value === VOID) new_value = new CompilerError(null, null);
                    else if(typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint") new_value = new CompilerError(old_value, null);
                    else if(old_value instanceof Array) new_value = new CompilerError(old_value[0], old_value[1])
                    else new_value = INVALID;
                    break;
                }
                case Type.std.PointerError: {
                    if (old_value === VOID) new_value = new PointerError(null, null);
                    else if(typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint") new_value = new PointerError(old_value, null);
                    else if(old_value instanceof Array) new_value = new PointerError(old_value[0], old_value[1])
                    else new_value = INVALID;
                    break;
                }
                case Type.std.ValueError: {
                    if (old_value === VOID) new_value = new ValueError(null, null);
                    else if(typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint") new_value = new ValueError(old_value, null);
                    else if(old_value instanceof Array) new_value = new ValueError(old_value[0], old_value[1])
                    else new_value = INVALID;
                    break;
                }
                case Type.std.PermissionError: {
                    if (old_value === VOID) new_value = new PermissionError(null, null);
                    else if(typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint") new_value = new PermissionError(old_value, null);
                    else if(old_value instanceof Array) new_value = new PermissionError(old_value[0], old_value[1])
                    else new_value = INVALID;
                    break;
                } 
                case Type.std.TypeError: {
                    if (old_value === VOID) new_value = new TypeError(null, null);
                    else if(typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint") new_value = new TypeError(old_value, null);
                    else if(old_value instanceof Array) new_value = new TypeError(old_value[0], old_value[1])
                    else new_value = INVALID;
                    break;
                }
                case Type.std.NetworkError: {
                    if (old_value === VOID) new_value = new NetworkError(null, null);
                    else if(typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint") new_value = new NetworkError(old_value, null);
                    else if(old_value instanceof Array) new_value = new NetworkError(old_value[0], old_value[1])
                    else new_value = INVALID;
                    break;
                }
                case Type.std.SecurityError: {
                    if (old_value === VOID) new_value = new SecurityError(null, null);
                    else if(typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint") new_value = new SecurityError(old_value, null);
                    else if(old_value instanceof Array) new_value = new SecurityError(old_value[0], old_value[1])
                    else new_value = INVALID;
                    break;
                }
                case Type.std.RuntimeError: {
                    if (old_value === VOID) new_value = new RuntimeError(null, null);
                    else if(typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint") new_value = new RuntimeError(old_value, null);
                    else if(old_value instanceof Array) new_value = new RuntimeError(old_value[0], old_value[1])
                    else new_value = INVALID;
                    break;
                }
                case Type.std.AssertionError: {
                    if (old_value === VOID) new_value = new AssertionError(null, null);
                    else if(typeof old_value == "string" || typeof old_value == "number" || typeof old_value == "bigint") new_value = new AssertionError(old_value, null);
                    else if(old_value instanceof Array) new_value = new AssertionError(old_value[0], old_value[1])
                    else new_value = INVALID;
                    break;
                }

                case Type.std.Markdown: {
                    if (old_value === VOID) new_value = new Markdown();
                    else if (typeof old_value == "string") new_value = new Markdown(old_value);
                    else new_value = INVALID;
                    break;
                }
                case Type.std.Time: {
                    if (old_value === VOID) new_value = new Date();
                    else if (typeof old_value == "number" || typeof old_value == "bigint") new_value = new Date(Number(old_value));
                    else new_value = INVALID;
                    break;
                }

                case Type.std.Url: {
                    if (typeof old_value == "string") new_value = new URL(old_value);
                    else new_value = INVALID;
                    break;
                }

                case Type.std.Function: {
                    if (old_value instanceof Tuple) {
                        new_value = new Function(old_value.get('body'), null, old_value.get('location'), null, undefined, undefined, old_value.get('context'));
                    }
                    else new_value = INVALID;
                    break;
                }
                
                case Type.std.Stream: {
                    if (old_value === VOID) new_value = new Stream();
                    else if (typeof old_value == "object") new_value = new Stream();
                    else new_value = INVALID;
                    break;
                }
                case Type.std.Scope: {
                    new_value = INVALID;
                    break;
                }
                case Type.std.Not: {
                    new_value = Datex.Addresses.Not.get(old_value);
                    break;
                }
        
            }
        }

        // try custom type cast
        if (new_value === UNKNOWN_TYPE) {
            new_value = type.cast(old_value, context, origin);
        }

        // still unknown type
        if (new_value === UNKNOWN_TYPE){

            // try loading the type configuration dynamically for this type and cast again
            if (!no_fetch) {
                try {
                    await JSInterface.loadTypeConfiguration(type);
                    return Runtime.castValue(type, value, context, origin, true); // no_fetch = true
                } catch (e) {
                    logger.error(e)
                }
            }

            else {
                // cannot fetch type, convert to to DatexUnresolvedValue
                logger.warn("Unknown type '"+type.toString()+"'");
                new_value = new UnresolvedValue(type, old_value);
            }

        }

        // could not cast 
        if (new_value === INVALID) {
            throw new TypeError("Cannot cast "+ old_type +" to "+type);
        }

        // return new value
        return new_value;
    }

    // serialize a value - only serializes the first layer, inner values are serialized to pointers
    static serializeValue(value:any):fundamental {

        let type:Type;

        // pointer property
        if (value instanceof PointerProperty) return value;

        // primitives
        if (typeof value == "string" || typeof value == "boolean" || typeof value == "number" || typeof value == "bigint") return value;
        // directly return, cannot be overwritten
        if (value === VOID || value === null || value instanceof Datex.Addresses.Endpoint || value instanceof Unit || value instanceof Type) return value;
        if (value instanceof Datex.Scope) return value;
        if (value instanceof URL) return value;
        // TODO fix recursive context problem
        if (value instanceof Function) return new Datex.Tuple({/*context:value.context,*/ body:value.body, location:value.location});
        // collapse wildcard target
        if (value instanceof Datex.Addresses.WildcardTarget) return value.target;
        // normal ArrayBuffer does not need to be serialized further:
        if (value instanceof ArrayBuffer) return value;
        // stream has no internal content
        if (value instanceof Stream) return VOID;
        // nodejs Buffer, slice + convert to Uint8Array to prevent memory leaks
        if (value instanceof NodeBuffer) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength / Uint8Array.BYTES_PER_ELEMENT);
        // special Typed Buffer -> get buffer
        if (value instanceof TypedArray) return value.buffer;


        // check if custom serialization available
        let serialized = JSInterface.serializeValue(value); 
        if (value instanceof NodeBuffer) serialized = new Uint8Array((<any>serialized).buffer, (<any>serialized).byteOffset, (<any>serialized).byteLength / Uint8Array.BYTES_PER_ELEMENT);
        else if (serialized instanceof TypedArray) serialized = (<any>serialized).buffer;

        if (serialized!==INVALID  && serialized !==NOT_EXISTING) {} // serialization with DatexCustomPseudoClasses was successful

        // serialization for <std:*> types
        else if (value instanceof Error) serialized = [value.code ?? value.message, value.datex_stack]
        else if (value instanceof Error) serialized = value.toString();
        else if (value instanceof Markdown) serialized = value.toString();
        else if (value instanceof Date) serialized = BigInt(value.getTime());
        else if (value instanceof Datex.Addresses.Not) serialized = value.value;


        // DatexUnresolvedValue without corresponding JS class
        else if (value instanceof UnresolvedValue) serialized = Runtime.serializeValue(value[DX_VALUE])

        // create new object, lose the original reference

        // Array or object: allow all keys/values
        else if (value instanceof Array) {
            serialized = [];
            for (let i=0; i<value.length; i++){
                serialized[i] = value[i];
            }
        }

        else if (value instanceof Tuple) serialized = value.clone();
    
        // type with fixed visible children -> check which properties are actually available to DATEX
        else if ((type = Type.getValueDatexType(value)) && type.visible_children) {
            serialized = {};
            const type = Type.getValueDatexType(value)
            for (let key of type.visible_children){
                serialized[key] = value[key];
            }            
        }

        // is object
        else if (typeof value == "object") {
            serialized = {};
            for (let [key, val] of Object.entries(value)){
                serialized[key] = val
            }
        }

        if (serialized == INVALID || serialized == NOT_EXISTING) return VOID;

        return serialized;
    }

    

    // compares the actual values of to values (async because of hash generation)
    public static async equalValues(a:any, b:any) {
        // collapse (primitive) pointers
        a = Value.collapseValue(a,true,true);
        b = Value.collapseValue(b,true,true);

        // empty Tuple equals void
        if (a === VOID && b instanceof Tuple && Object.keys(b).length == 0) return true;
        if (b === VOID && a instanceof Tuple && Object.keys(a).length == 0) return true;

        // compare ints/floats
        if ((typeof a == "number" || typeof a == "bigint") && (typeof b == "number" || typeof b == "bigint")) return a == b;

        // cannot match
        if (typeof a != typeof b) return false;
        // both primitive values
        if (a !== Object(a) && b !== Object(a !== Object(a))) {
            return a === b;
        }
        // compare hashes
        const [hashA, hashB] = await Promise.all([DatexCompiler.getValueHashString(a), DatexCompiler.getValueHashString(b)])

        return (hashA === hashB)
    }



    private static FORMAT_INDENT = 3;

    public static TEXT_KEY = /^\w+$/;

    private static escapeString(string:string, formatted=false) {
        string = string
            .replace(/\\/g, '\\\\')
            .replace(/\"/g, '\\"');
        if (!formatted) string = string.replace(/\n/g, "\\n");
        return '"'+string+'"';
    }

    // float to string without scientific notation (like 1.23e-23)
    // used for Units
    // modified https://stackoverflow.com/questions/1685680/how-to-avoid-scientific-notation-for-large-numbers-in-javascript
    public static floatToString(float:number) {
        let float_string = float.toString();
        let sign = "";
        (float_string += "").charAt(0) == "-" && (float_string = float_string.substring(1), sign = "-");
        let arr = float_string.split(/[e]/ig);
        if (arr.length < 2) return sign + float_string;
        let dot = (.1).toLocaleString().substr(1, 1), 
            n = arr[0], 
            exp = +arr[1],
            w = (n = n.replace(/^0+/, '')).replace(dot, ''),
            pos = n.split(dot)[1] ? n.indexOf(dot) + exp : w.length + exp,
            L:number|string[]   = pos - w.length, 
            s = "" + BigInt(w);
            w   = exp >= 0 ? (L >= 0 ? s + "0".repeat(L) : r()) : (pos <= 0 ? "0" + dot + "0".repeat(Math.abs(pos)) + s : r());
        L = w.split(dot); 
        if (L[0]=="0" && L[1]=="0" || (+w==0 && +s==0) ) w = "0"; //** added 9/10/2021
        return sign + w;
        function r() {return w.replace(new RegExp(`^(.{${pos}})(.)`), `$1${dot}$2`)}
    }



    // converts values to string by compiling and decompiling (Decompiler not yet 100% correct)
    // resolves recursive structures and references correctly, compared to valueToDatexString
    static valueToDatexStringExperimental(value: any, deep_clone = false, collapse_value = false, formatted = false){
        return Datex.Runtime.decompile(DatexCompiler.encodeValue(value, undefined, false, deep_clone, collapse_value), true, formatted, formatted, false);
    }


    /** converts any value to its datex representation 
     * 
     * @param formatted adds line breaks and indentations
     * @param collapse_pointers collapse value if pointer (not recursive)
     * @param deep_collapse if true, all pointer values are collapsed recursively 
     * @param pointer_anchors add start and end sequence (e.g. html) around a pointer
     * @return value as DATEX Script string
     */


    static valueToDatexString(value:any, formatted = false, collapse_pointers = false, deep_collapse = false, pointer_anchors?:[string,string]): string {
        return this._valueToDatexString(value, formatted, 0, collapse_pointers, deep_collapse, pointer_anchors);
    }

    /**serialized: object already only consists of primitives or arrays / objects */
    private static _valueToDatexString(value:any, formatted = false, depth=0, collapse_pointers=false, deep_collapse = false, pointer_anchors?:[string,string], _serialized = false, parents = new Set<any>()): string {
        let string:string;

        // proxyify pointers
        if (!collapse_pointers && !deep_collapse) value = Pointer.pointerifyValue(value);
        if (collapse_pointers && value instanceof Value) value = value.value; 
        // don't show anonymous pointers as pointers
        if (value instanceof Pointer && value.is_anonymous) value = value.original_value;

        // check for recursive objects
        if (parents.has(value)) return value instanceof Tuple ? "(...)"  : (value instanceof Array ? "[...]" : "{...}");

        // get type
        let type = value instanceof Pointer ? Type.std.Object : Type.getValueDatexType(value);

        if (typeof value == "string") {
            string = Runtime.escapeString(value, formatted);
        }
        else if (value === null) {
            string = "null";
        }
        else if (value === VOID) {
            string = "void";
        }
        else if (value instanceof Unit) {
            string = value.toString();
        }
        // floats (always represented as x.y)
        else if (typeof value == "number") {
            if (isNaN(value)) string = 'nan';
            else if (value ===  -Infinity) string = '-infinity';
            else if (value ===  Infinity) string = 'infinity';
            else if (Object.is(value, -0)) string = '-0.0'; // special edge case for -0.0
            else if (Number.isInteger(value)) {
                string = value.toString()
                if (!string.includes("e")) string += '.0'; // make sure to show float as x.0 (as long as not in exp. representation)
            }
            else string = value.toString(); // normal float
        }
        // ints & booleans
        else if (typeof value == "bigint" || typeof value == "boolean") {
            string = value.toString();
        }
        else if (value instanceof ArrayBuffer || value instanceof NodeBuffer || value instanceof TypedArray) {
            string = "`"+Pointer.buffer2hex(value instanceof Uint8Array ? value : new Uint8Array(value instanceof TypedArray ? value.buffer : value), null, null)+"`"
        }
        else if (value instanceof Scope) {
            let spaces = Array(this.FORMAT_INDENT*(depth+1)).join(' ');
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
            if (pointer_anchors) string = pointer_anchors[0] + value.toString() + pointer_anchors[1];
            else string = value.toString();
        }
        else if (value instanceof PointerProperty) { 
            const string_value = value.pointer.toString() + "->" + (typeof value.key == "string" && value.key.match(Runtime.TEXT_KEY) ? value.key : Runtime.valueToDatexString(value.key,false));
            if (pointer_anchors) string = pointer_anchors[0] + string_value + pointer_anchors[1];
            else string = string_value;
        }
        else if (value instanceof Type) {
            string = value.toString();
        }

        else if (value instanceof Tuple && _serialized) {
            parents.add(value);
            let brackets = ['(', ')'];
            if (value instanceof Tuple && value.indexed.length == 1 && value.named.size == 0) string = Type.std.Tuple.toString();
            else string = "";
            string += brackets[0] + (formatted ? "\n":"")
            let first = true;
            let spaces = Array(this.FORMAT_INDENT*(depth+1)).join(' ');
            for (let [k,v] of value) {
                if (!first) string += ", " + (formatted ? "\n":"")
                // named property
                if (typeof k == 'string')  string += (formatted ? spaces:"") + `${k.match(Runtime.TEXT_KEY) ? k : Runtime.escapeString(k, false)}: ` + this._valueToDatexString(v, formatted, depth+1, false, deep_collapse, pointer_anchors, false, new Set(parents))
                // indexed property
                else string +=  (formatted ? spaces:"") + this._valueToDatexString(v, formatted, depth+1, false, deep_collapse, pointer_anchors, false, new Set(parents))
                first = false;
            }
            string += (formatted ? "\n"+Array(this.FORMAT_INDENT*depth).join(' '):"") + brackets[1];
        }
        // <Array>
        else if (value instanceof Array && _serialized) {
            parents.add(value);
            let brackets = ['[', ']'];
            string = ((value instanceof Tuple && value.length == 0) ? Type.std.Tuple.toString() : "") + brackets[0] + (formatted ? "\n":"")
            // make clear tuple with only 1 element is a tuple (...)
            if (value instanceof Tuple && value.length == 1) string += "...";
            let first = true;
            let spaces = Array(this.FORMAT_INDENT*(depth+1)).join(' ');
            for (let v of value) {
                if (!first) string += ", " + (formatted ? "\n":"")
                string +=  (formatted ? spaces:"") + this._valueToDatexString(v, formatted, depth+1, false, deep_collapse, pointer_anchors, false, new Set(parents))
                first = false;
            }
            string += (formatted ? "\n"+Array(this.FORMAT_INDENT*depth).join(' '):"") + brackets[1];
        }
        // all other sorts of object
        else if ((typeof value == "object" || value instanceof Function /*also an object*/) && _serialized) { // must be a 'JSON' object  
            parents.add(value);   
            let brackets = ['{', '}'];
            let entries = Object.entries(value);
            string = brackets[0] + (formatted ? "\n":"");
            let first = true;
            let spaces = Array(this.FORMAT_INDENT*(depth+1)).join(' ');
            for (let [key, v] of entries) {
                if (!first) string +=  ", " + (formatted ? "\n":"")
                string += (formatted ? spaces:"") + `${key.match(Runtime.TEXT_KEY) ? key : Runtime.escapeString(key, false)}: ` + this._valueToDatexString(v, formatted, depth+1, false, deep_collapse, pointer_anchors, false, new Set(parents))
                first = false;
            }
            string +=  (formatted ? "\n"+Array(this.FORMAT_INDENT*depth).join(' '):"") + brackets[1];
        }
        else if (typeof value == "object" || value instanceof Function  /*also an object*/) {
            parents.add(value);
            let serialized = value!=null ? this.serializeValue(value) : value;
            serialized = Pointer.pointerifyValue(serialized); // try to get a pointer from serialized


            if (serialized == VOID) string = "()"; // display void as ()
            else if (type?.is_primitive) string = this._valueToDatexString(serialized, formatted, depth, true, deep_collapse, pointer_anchors, false, new Set(parents)) // is primitive type - use original value
            else string = this._valueToDatexString(serialized, formatted, depth, true, deep_collapse, pointer_anchors, true, new Set(parents)) // is complex or fundamental type
        }

        else { // all invalid DATEX values (functions, ...)
            string = "void";
        }

        // type cast required: if not primitive and complex
        if (type && !type.is_primitive && type.is_complex && type != Datex.Type.std.Scope) string = type.toString() + (formatted ? " ":"") + string;

        return string;
    }


    static readonly runtime_actions:
    {
        waitForBuffer: (SCOPE: datex_scope, jump_to_index?: number, shift_current_index?: number) => void,
        constructFilterElement: <T extends typeof Datex.Addresses.Endpoint = typeof Datex.Addresses.Endpoint>(SCOPE: datex_scope, type: BinaryCode, appspace_targets?:Datex.Addresses.Endpoint[]) => false | InstanceType<T>
        trimArray: (array: Array<any>) => any[],
        getTrimmedArrayLength: (array: Array<any>) => number,
        returnValue: (SCOPE: datex_scope, value: any) => Promise<void>,
        enterSubScope: (SCOPE: datex_scope) => void,
        exitSubScope: (SCOPE: datex_scope) => Promise<any>,
        newSubScope: (SCOPE: datex_scope) => Promise<void>,
        closeSubScopeAssignments: (SCOPE: datex_scope) => Promise<void>,
        handleAssignAction: (SCOPE: datex_scope, action_type: BinaryCode | -1, parent: any, key: any, value: any, current_val?: any) => Promise<void>,
        checkPointerReadPermission: (parent: any, key: string) => void,
        checkPointerUpdatePermission: (parent: any, key: string) => void,
        countValue: (value: any) => bigint,
        getReferencedProperty: (parent: any, key: any) => PointerProperty<any>,
        getProperty: (SCOPE: datex_scope, parent: any, key: any) => any,
        hasProperty: (SCOPE: datex_scope, parent: any, key: any) => boolean,
        setProperty: (SCOPE: datex_scope, parent: any, key: any, value: any) => void,
        assignAction(SCOPE: datex_scope, action_type: BinaryCode, parent: any, key: any, value: any, current_val?: any): void,
        _removeItemFromArray(arr: any[], value: any): void,
        extractScopeBlock(SCOPE: datex_scope): ArrayBuffer | false,
        extractVariableName(SCOPE: datex_scope): string | number | false,
        extractType(SCOPE: datex_scope, is_extended_type?: boolean): [Type, boolean] | false | Type,
        forkScope(SCOPE: datex_scope): datex_scope,
        insertToScope(SCOPE: datex_scope, el: any, literal_value?: boolean): Promise<void>
    }
    = {

        // shift current index and set cache_previous to true, SCOPE should be stopped after calling this function, to wait for next dxb block
        waitForBuffer(SCOPE:datex_scope, jump_to_index?:number, shift_current_index?:number){
            if (typeof jump_to_index == "number") SCOPE.current_index = jump_to_index;
            else if (typeof shift_current_index == "number") SCOPE.current_index -= shift_current_index; 
            else  SCOPE.current_index = SCOPE.start_index; // use stored jump-back index from SCOPE

            SCOPE.cache_previous = true;
        },

        constructFilterElement<T extends typeof Datex.Addresses.Endpoint=typeof Datex.Addresses.Endpoint>(SCOPE:datex_scope, type:BinaryCode, target_list:Datex.Addresses.Endpoint[]):InstanceType<T>|false {
            /** wait for buffer */
            if (SCOPE.current_index+2 > SCOPE.buffer_views.uint8.byteLength) return false;
            /********************/

            const name_is_binary = type == BinaryCode.ENDPOINT || type == BinaryCode.ENDPOINT_WILDCARD;

            let instance:string;

            let name_length = SCOPE.buffer_views.uint8[SCOPE.current_index++]; // get name length
            let subspace_number = SCOPE.buffer_views.uint8[SCOPE.current_index++]; // get subspace number
            let instance_length = SCOPE.buffer_views.uint8[SCOPE.current_index++]; // get instance length

            if (instance_length == 0) instance = "*";
            else if (instance_length == 255) instance_length = 0;

            /** wait for buffer */
            if (SCOPE.current_index+name_length+instance_length+1 > SCOPE.buffer_views.uint8.byteLength) return false;
            /********************/  

            let name_binary = SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index+=name_length);
            let name = name_is_binary ? name_binary : Runtime.utf8_decoder.decode(name_binary)  // get name

            let subspaces:string[]= [];
            for (let n=0; n<subspace_number; n++) {
                let length = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                if (length == 0) {
                    subspaces.push("*");
                }
                else {
                    let subspace_name = Runtime.utf8_decoder.decode(SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index+=length));
                    subspaces.push(subspace_name);
                }
            }


            if (!instance) instance = Runtime.utf8_decoder.decode(SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index+=instance_length))  // get instance
            
            let app_index:number
            if (target_list) app_index = SCOPE.buffer_views.uint8[SCOPE.current_index++];

            return <InstanceType<T>> Datex.Addresses.Target.get(name, subspaces, instance, app_index ? target_list[app_index-1] : null, type);
        },
        
        // removes trailing undefined/empty values from array (trim length)
        trimArray(array:Array<any>){
            let new_length = array.length;
            for (let i=array.length-1; i>=0; i--) {
                if (array[i] === VOID) new_length--;
                else break;
            }
            array.length = new_length // set new length
            return array;
        },

        // only returns trimmed length, does not trim the array
        getTrimmedArrayLength(array:Array<any>):number{
            let new_length = array.length;
            for (let i=array.length-1; i>=0; i--) {
                if (array[i] === VOID) new_length--;
                else break;
            }
            return new_length;
        },

        async returnValue(SCOPE:datex_scope, value: any){
            await Runtime.handleScopeResult(SCOPE.header, SCOPE, value);
        },

        enterSubScope(SCOPE:datex_scope){
            SCOPE.inner_scope = {root:SCOPE.inner_scope.root, ctx_intern:SCOPE.inner_scope.active_object ?? SCOPE.inner_scope.ctx_intern}; // inherit root and internal context from parent subscope / new internal object
            SCOPE.sub_scopes.push(SCOPE.inner_scope);
        },

        // sub scope end, returns result value
        async exitSubScope (SCOPE:datex_scope){

            // handle scope result variable and make pointer / variable assignments
            await Runtime.runtime_actions.closeSubScopeAssignments(SCOPE);

            let result = SCOPE.inner_scope.result;
            let inner_spread = SCOPE.inner_scope.inner_spread; // remember ... from inner subscope

            if (SCOPE.sub_scopes.length==1) {
                logger.error("Cannot exit out of root scope");
                console.warn(Pointer.buffer2hex(SCOPE.buffer_views.uint8, " "), SCOPE.buffer_views.buffer)// DatexRuntime.decompile(SCOPE.buffer_views.buffer, true, true, true, false));
                return;
            }

            SCOPE.sub_scopes.pop();
            SCOPE.inner_scope = SCOPE.sub_scopes[SCOPE.sub_scopes.length-1];
            if (inner_spread) SCOPE.inner_scope.waiting_collapse = true;

            return result // return last result
        },

        // switch scope between commands(ignore that it is outer scope)
        async newSubScope(SCOPE:datex_scope){
            // currently in outer scope
            const is_outer_scope = SCOPE.inner_scope.is_outer_scope;

            // handle scope result variable and make pointer / variable assignments
            await Runtime.runtime_actions.closeSubScopeAssignments(SCOPE);

            let result = SCOPE.inner_scope.result;
            SCOPE.sub_scopes.pop();

            Runtime.runtime_actions.enterSubScope(SCOPE);

            // insert 'result' to outer scope
            if (is_outer_scope && result!==VOID) {
                SCOPE.result = result;
            }
            // insert sub_result to current scope;
            if (result!==VOID) SCOPE.inner_scope.result = result;

            SCOPE.inner_scope.is_outer_scope = is_outer_scope; // is outer scope?
        },

        // use INNER_SCOPE.active_value, apply remaining assignments -> INNER_SCOPE.result
        async closeSubScopeAssignments(SCOPE:datex_scope){
            const INNER_SCOPE = SCOPE.inner_scope;

            // first check if remaining type casts; inner scope result must be void
            if (INNER_SCOPE.type_casts?.length) {
                // first type cast becomes actual type value
                let el = INNER_SCOPE.type_casts.pop();
                let type:Type;
                // iterate over now remaining type casts
                while (type = INNER_SCOPE.type_casts.pop()) el = await Runtime.castValue(type, el, INNER_SCOPE.ctx_intern??INNER_SCOPE.root, SCOPE.origin)
                INNER_SCOPE.active_value = el;
            }

            // assignments:

            // get current active value
            let el = INNER_SCOPE.active_value;
            let did_assignment = false;

            // ptrs
            if (INNER_SCOPE.waiting_ptrs?.size) {
                for (let p of INNER_SCOPE.waiting_ptrs) {
                    if (p[1] == undefined) p[0].setValue(el); // is set
                    else await Runtime.runtime_actions.handleAssignAction(SCOPE, p[1], null, null, el, p[0]); // other action on pointer
                }
                did_assignment = true;
            }

            // labels (set label to pointer)
            if (INNER_SCOPE.waiting_labels?.size) {
                for (let label of INNER_SCOPE.waiting_labels) {
                    let pointer = Pointer.getByValue(el);
                    // already a pointer
                    if (pointer) pointer.addLabel(label);
                    else {
                        pointer = Pointer.create(null, el);
                        pointer.addLabel(label);
                    }
                }
                did_assignment = true;
            }

            // vars
            if (INNER_SCOPE.waiting_vars?.size) {
                for (let v of INNER_SCOPE.waiting_vars) {
                    // is set
                    if (v[1] == undefined) {
                        // el is void -> delete?
                        // if (el === VOID) delete SCOPE.inner_scope.root[v[0]];
                        // else 
                        SCOPE.inner_scope.root[v[0]] = el; 
                    }
                    else await Runtime.runtime_actions.handleAssignAction(SCOPE, v[1], SCOPE.inner_scope.root, v[0], el); // other action on variable
                }
                did_assignment = true;
            }          

            // handle child assignment
            if (INNER_SCOPE.waiting_for_action?.length) {
                let action:[type: BinaryCode, parent: any, key: any];
                
                // assign for all waiting
                while (action = INNER_SCOPE.waiting_for_action.pop()) {
                    await Runtime.runtime_actions.handleAssignAction(SCOPE, action[0], action[1], action[2], el);   
                }

                did_assignment = true;
            }

            // internal vars (last, because inner scope sub_result might be re-added)
            if (INNER_SCOPE.waiting_internal_vars?.size) {
                did_assignment = true;
                for (let v of INNER_SCOPE.waiting_internal_vars) {
                    if (v[1] == undefined) {  // is set
                        // handle special internal variables -> modify value
                        if (v[0] == 'result') {
                            SCOPE.result = INNER_SCOPE.result = el; // set new result
                        }
                        else if (v[0] == 'sub_result') INNER_SCOPE.result = el;  // set result of current sub scope
                        else if (v[0] == 'it') SCOPE.it = el;  // set it of scope
                        else if (v[0] == 'root') {
                            SCOPE.inner_scope.root = el;  // update root for this subscope
                        }
                        else if (v[0] == 'remote') {
                            if (typeof el == "object") SCOPE.remote = el;
                            else throw new ValueError("Invalid type for #remote");
                        }
                        else {// default internal variable
                            // el is void -> delete
                            if (el === VOID) delete SCOPE.internal_vars[v[0]];
                            else SCOPE.internal_vars[v[0]] = el; 
                        }
                    }
                    
                    else { // other action on internal variable
                        let parent = SCOPE.internal_vars; // default parent
                        let key = v[0];

                        if (v[0] == 'result') parent = SCOPE; // parent is SCOPE, key is 'result'
                        else if (v[0] == 'sub_result') {parent = INNER_SCOPE; key = 'sub_result'}  // parent is INNER_SCOPE, key is 'sub_result'
                        else if (v[0] == 'root') parent = SCOPE.inner_scope;  // parent is SCOPE.inner_scope, key is 'root';
                        else if (v[0] == 'remote') parent = SCOPE;  // parent is SCOPE, key is 'remote';
                        else if (v[0] == 'it') parent = SCOPE;  // parent is SCOPE, key is 'it';

                        await Runtime.runtime_actions.handleAssignAction(SCOPE, v[1], parent, key, el);
                    }
                }
            }

            // has return?
            if (INNER_SCOPE.return) {
                Runtime.runtime_actions.returnValue(SCOPE, el === VOID ? INNER_SCOPE.result : el);
            }

            // update scope result if no assignment happened and value is not void
            else if (!did_assignment && el !== VOID) INNER_SCOPE.result = el;
        },

        async handleAssignAction(SCOPE:datex_scope, action_type:BinaryCode|-1, parent:any, key:any, value:any, current_val?:any){

            // collapse iterator key to tuple
            if (key instanceof Iterator) key = await key.collapse();

            // set value
            if (action_type == -1) {
               Runtime.runtime_actions.setProperty(SCOPE, parent, key, value);
            }
            // all other actions (+=, -=, ...)
            else {
                Runtime.runtime_actions.assignAction(SCOPE, action_type, parent, key, value, current_val);
            }
        },


        // throws an error if no permission
        checkPointerReadPermission(parent:any, key:string){
            parent = Pointer.pointerifyValue(parent) // make sure the parent is proxified
            // check pointer read permission
            if (parent instanceof Pointer && !parent.canReadProperty(key))
                throw new ValueError("Property '"+key.toString()+"' does not exist");
        },

        // throws an error if no permission
        checkPointerUpdatePermission(parent:any, key:string){
            parent = Pointer.pointerifyValue(parent) // make sure the parent is proxified
            // check pointer write permission
            if (parent instanceof Pointer && !parent.canUpdateProperty(key))
                throw new PermissionError("Cannot update the property "+Runtime.valueToDatexString(key)+"");        
        },

        // get count (length) of value
        countValue(value:any){
            if (value === VOID) return 0n; // void is 0

            let count = JSInterface.handleCount(value) 

            if (count == NOT_EXISTING) { 
                if (value instanceof Array) count = value.length; // array or tuple
                else if (value.constructor == Object) count = Object.keys(value).length; // plain object
                else count = 1n; // default value
            }
            else if (count == INVALID) throw new ValueError("Value uncountable");        
            return BigInt(count);
        },


        // get count (length) of value
        hasProperty(SCOPE:datex_scope, parent:any, key:any){

            let has = JSInterface.handleHasProperty(parent, key); 

            if (has == NOT_EXISTING) { 
                if (parent instanceof Array) {
                    if (typeof key != "bigint") throw new ValueError("Invalid key for <Array> - must be of type <Int>", SCOPE);
                    else return key > 0 && key < parent.length;
                // default hidden properties
                }
                else if (typeof parent == "object") {
                    if (typeof key != "string") throw new ValueError("Invalid key for <Object> - must be of type <String>", SCOPE);
                    else if (DEFAULT_HIDDEN_OBJECT_PROPERTIES.has(key) || (parent && !(key in parent))) return false;
                    else return true; // plain object
                }
                else has = INVALID;
            }
            
            if (has == INVALID) throw new ValueError("Cannot check for properties on this value");     
            else return has;   
        },

        // get parent[key] as DatexPointerProperty if possible
        getReferencedProperty(parent:any, key:any){
            const pointer = Pointer.createOrGet(parent);
            if (pointer) {
                return PointerProperty.get(pointer, key);
            }
            else throw new RuntimeError("Could not get a child reference");
        },
        
        // get parent[key]
        getProperty(SCOPE:datex_scope, parent:any, key:any){

            if (parent instanceof UnresolvedValue) parent = parent[DX_VALUE];

            key = Value.collapseValue(key,true,true);

            // check read permission (throws an error)
            Runtime.runtime_actions.checkPointerReadPermission(parent, key)

            // has no properties
            if (!Type.doesValueHaveProperties(parent)) throw new ValueError("Value of type "+Type.getValueDatexType(parent)+" has no properties", SCOPE);
            
            // key is * - get iterator with all values
            if (key === WILDCARD) {
                parent = Value.collapseValue(parent,true,true);
                let values = JSInterface.handleGetAllValues(parent);
                if (values == NOT_EXISTING) {
                    let keys;
                    // create list of integer keys
                    if (parent instanceof Array) {
                        keys = [];
                        const N = parent.length;
                        let i = 0n;
                        while (i < N) keys[Number(i)] = i++;
                    }
                    // list of object property keys
                    else keys = Object.keys(parent);
                    if (!(Symbol.iterator in keys)) throw new RuntimeError("Value keys are not iterable", SCOPE);
                    return Runtime.runtime_actions.getProperty(SCOPE, Pointer.pointerifyValue(parent), new Tuple(keys));
                }
                else if (values == INVALID) throw new ValueError("Value has no iterable content", SCOPE);
                
                if (!(Symbol.iterator in values)) throw new RuntimeError("Value keys are not iterable", SCOPE);
                return values instanceof Tuple ? values: new Tuple(values);
            }
            // key is <Tuple> - get multiple properties (recursive)
            else if (key instanceof Tuple) {
                return Iterator.map(key.toArray(), (k)=>Runtime.runtime_actions.getProperty(SCOPE, parent, k))
                // let multi_result = new Tuple();
                // for (let k of key.toArray()) multi_result.push(Runtime.runtime_actions.getProperty(SCOPE, parent, k));
                // return multi_result.seal();
            }
            // key is <Iterator> - get multiple properties (recursive)
            else if (key instanceof Iterator) {
                return Iterator.map(key, (k)=>Runtime.runtime_actions.getProperty(SCOPE, parent, k))
                //let multi_result = new Tuple();
                // for (let k of key.toArray()) multi_result.push(Runtime.runtime_actions.getProperty(SCOPE, parent, k));
                // return multi_result.seal();
            }

            parent = Value.collapseValue(parent,true,true);

            // custom types get
            let new_obj = JSInterface.handleGetProperty(parent, key) 
            
            // definitly does not exist and can not exist
            if (new_obj == INVALID) throw new ValueError("Property '"+key.toString()+"' does not exist", SCOPE);

            // was not handled by custom pseudo classes
            else if (new_obj == NOT_EXISTING) {
                // get endpoint subspace
                if (parent instanceof Addresses.Endpoint) return parent.getSubspace(key?.toString());
                // invalid key type
                if (parent instanceof Array && typeof key != "bigint" ) throw new ValueError("Invalid key for <Array> - must be of type <Int>", SCOPE);
                // sealed tuple
                else if (parent instanceof Tuple && !(key in parent)) throw new ValueError("Property '"+key.toString()+"' does not exist in <Tuple>", SCOPE)
                // sealed or frozen
                else if ((Object.isSealed(parent) || Object.isFrozen(parent)) && !parent.hasOwnProperty(key)) throw new ValueError("Property '"+key.toString()+"' does not exist", SCOPE)
                // not a key string in a normal object
                else if (typeof key != "string" && !(parent instanceof Array)) throw new ValueError("Invalid key for <Object> - must be of type <String>", SCOPE);
                // default hidden properties
                else if (DEFAULT_HIDDEN_OBJECT_PROPERTIES.has(key) || (parent && !(key in parent))) return VOID;
                // get value
                else {
                    if (parent instanceof Array && typeof key == "bigint" && key < 0n)  key = parent.length+Number(key)  // negative array indices
                   
                    // get single value
                    else return parent[key];
                }
            }

            // was handled by custom pseudo class
            else return new_obj;
        },

        // set parent[key] = value
        setProperty(SCOPE:datex_scope, parent:any, key:any, value:any){

            if (parent instanceof UnresolvedValue) parent = parent[DX_VALUE];

            let o_parent:Pointer = Pointer.pointerifyValue(parent);
            if (!(o_parent instanceof Pointer)) o_parent = null;

            key = Value.collapseValue(key,true,true);
            
            // check read/write permission (throws an error)
            Runtime.runtime_actions.checkPointerUpdatePermission(parent, key)

            // handle values without properties
            if (!Type.doesValueHaveProperties(parent)) {
                throw new PermissionError("Cannot set a property for value of type "+Type.getValueDatexType(parent)+"", SCOPE);
            }

            // key is * -  set for all matching keys (recursive)
            if (key === WILDCARD) {
                parent = Value.collapseValue(parent,true,true);
                // handle custom pseudo class
                if (JSInterface.hasPseudoClass(parent)) {
                    // void => clear
                    if (value === VOID) {
                        let res = JSInterface.handleClear(parent);
                        // note: keys == NOT_EXISTING is always false since hasPseudoClass == true
                        if (res == INVALID || res == NOT_EXISTING) throw new ValueError("Cannot clear value", SCOPE);
                    }
                    else {
                        let keys = JSInterface.handleKeys(parent);
                        // note: keys == NOT_EXISTING is always false since hasPseudoClass == true
                        if (keys == INVALID || keys == NOT_EXISTING) throw new ValueError("Value has no iterable content", SCOPE);
                        Runtime.runtime_actions.setProperty(SCOPE, Pointer.pointerifyValue(parent), new Tuple(keys), value);
                    }
                }

                else if (value instanceof Tuple && (typeof parent == "object")) {
                    DatexObject.extend(parent, value); // link value, don't copy
                }
               
                // handle other objects
                else {
                    let keys:any[];
                    // create list of integer keys
                    if (parent instanceof Array) {
                        keys = [];
                        const N = parent.length;
                        let i = 0n;
                        while (i < N) keys[Number(i)] = i++;
                    }
                    // list of object property keys
                    else keys = Object.keys(parent);
                    if (!(Symbol.iterator in keys)) throw new RuntimeError("Value keys are not iterable", SCOPE);
                    Runtime.runtime_actions.setProperty(SCOPE, Pointer.pointerifyValue(parent), new Tuple(keys), value);
                }
                return;
            }

            // key is <Tuple> - set multiple properties (recursive)
            else if (key instanceof Tuple) {
                // distribute values over keys (tuple)
                if (value instanceof Tuple) {
                    for (let [k, v] of Object.entries(value)) {
                        Runtime.runtime_actions.setProperty(SCOPE, parent, k, v)
                    }
                }

                // set same value for all keys
                else {
                    for (let k of key.toArray()) Runtime.runtime_actions.setProperty(SCOPE, parent, k, value)
                }
                return;
            }
           

            parent = Value.collapseValue(parent,true,true);
            value = Value.collapseValue(value,true);

            if (parent[DX_PERMISSIONS]?.[key] && !(<Datex.Addresses.Filter>parent[DX_PERMISSIONS][key]).test(SCOPE.sender)) {
                throw new PermissionError("Cannot update this value");
            }

            // get current value
            let current_value = JSInterface.handleGetProperty(parent, key)
            // value has not changed
            if (current_value === value) {
                return;
            }

            o_parent?.excludeEndpointFromUpdates(SCOPE.sender);

            // custom types assign or delete
            let assigned;
            if (value === VOID) assigned = JSInterface.handleDeleteProperty(parent, key);
            else assigned = JSInterface.handleSetProperty(parent, key, value);

            if (assigned === INVALID) {
                o_parent?.enableUpdatesForAll();
                throw new ValueError("Property '"+key.toString()+"' can not be "+ (value === VOID ? "deleted" : "set"), SCOPE);
            } 

            else if (assigned == NOT_EXISTING) {
                // invalid key type
                if (parent instanceof Array && (typeof key != "bigint")) {
                    o_parent?.enableUpdatesForAll();
                    throw new ValueError("Invalid key for <Array> - must be of type <Int>", SCOPE);
                } 
                else if (typeof key != "string" && !(parent instanceof Array)) {
                    o_parent?.enableUpdatesForAll();
                    throw new ValueError("Invalid key for <Object> - must be of type <String>", SCOPE);
                }
                // default hidden properties                
                else if (DEFAULT_HIDDEN_OBJECT_PROPERTIES.has(key)) {
                    o_parent?.enableUpdatesForAll();
                    throw new ValueError("Property '"+key.toString()+"' can not be " + (value === VOID ? "deleted" : "set"), SCOPE);
                }
                // set value
                else {
                    if (parent instanceof Array && typeof key == "bigint" && key < 0n)  key = parent.length+Number(key)  // negative array indices
                    
                    // check template types first
                    const type = Type.getValueDatexType(parent);

                    if (type.template && !type.isPropertyAllowed(key)) throw new ValueError("Property '" + key + '" does not exist');
                    if (type.template && !type.isPropertyValueAllowed(key, value)) throw new ValueError("Property '" + key + "' must be of type " + type.getAllowedPropertyType(key));

                    // check sealed tuple
                    if (parent instanceof Tuple && !(key in parent)) throw new ValueError("Property '"+key.toString()+"' does not exist in <Tuple>", SCOPE)
                    
                    // now set the value
                    try {
                        if (value === VOID) {
                            delete parent[key]; // = void (delete)
                            if (parent instanceof Array && Number(key)+1==parent.length) Runtime.runtime_actions.trimArray(parent) // trim end
                        }
                        // set single value
                        else parent[key] = value; // actually set value
                    } catch (e) {
                        o_parent?.enableUpdatesForAll();
                        console.warn(e)
                        throw new RuntimeError("Property '"+key.toString()+"' is readonly or does not exist", SCOPE)
                    }
                }
            }
            o_parent?.enableUpdatesForAll();
        },

        assignAction(SCOPE:datex_scope, action_type:BinaryCode, parent:any, key:any, value:any, current_val = Runtime.runtime_actions.getProperty(SCOPE, parent, key)) {

            if (parent instanceof UnresolvedValue) parent = parent[DX_VALUE];

            let o_parent:Pointer = Pointer.pointerifyValue(current_val);
            if (!(o_parent instanceof Pointer)) o_parent = null;

            key = Value.collapseValue(key,true,true);

            // check read/write permission (throws an error)
            Runtime.runtime_actions.checkPointerUpdatePermission(parent, key)

            // key is * -  add for all matching keys (recursive)
            if (key === WILDCARD) {
                parent = Value.collapseValue(parent);
                let keys:Iterable<any>;
                // handle custom pseudo class
                if (JSInterface.hasPseudoClass(parent)) {
                    let _keys = JSInterface.handleKeys(parent);
                    // note: keys == NOT_EXISTING is always false since hasPseudoClass == true
                    if (_keys == INVALID || _keys == NOT_EXISTING) throw new ValueError("Value has no iterable content", SCOPE);
                    keys = _keys;
                }
                // handle other objects
                else {
                    // create list of integer keys
                    if (parent instanceof Array) {
                        keys = [];
                        const N = parent.length;
                        let i = 0n;
                        while (i < N) keys[Number(i)] = i++;
                    }
                    // list of object property keys
                    else keys = Object.keys(parent);
                    if (!(Symbol.iterator in keys)) throw new RuntimeError("Value keys are not iterable", SCOPE);
                }
                Runtime.runtime_actions.assignAction(SCOPE, action_type, Pointer.pointerifyValue(parent), new Tuple(keys), value);
                return;
            }

            // key is <Tuple> - multiple properties action (recursive)
            else if (key instanceof Tuple) {
                // TODO
                const array = key.toArray();
                // distribute values over keys
                if (value instanceof Tuple) {
                    for (let i=0; i<array.length; i++) {
                        Runtime.runtime_actions.assignAction(SCOPE, action_type, parent, array[i], value[i])
                    }
                }
                // use same value for all keys
                else {
                    for (let k of array) Runtime.runtime_actions.assignAction(SCOPE, action_type, parent, k, value)
                }
                return;
            }

            // custom += actions
            else if (action_type == BinaryCode.ADD) {
                // spread insert tuple
                if (value instanceof Tuple) {
                    if (current_val instanceof Array) {
                        for (let v of value.indexed) {
                            Runtime.runtime_actions.assignAction(SCOPE, action_type, null, null, v, current_val);
                        }
                    }
                    else DatexObject.extend(current_val, value) // link value, don't copy

                    return;
                }
            } 
            


            current_val = Value.collapseValue(current_val); // first make sure that current_val is actual value
            parent = Value.collapseValue(parent);
            value = Value.collapseValue(value);

            o_parent?.excludeEndpointFromUpdates(SCOPE.sender);

            // custom types add
            let assigned = JSInterface.handlePropertyAction(action_type, current_val, value);

            if (assigned === INVALID) {
                o_parent?.enableUpdatesForAll();
                throw new ValueError("Could not perform property operation", SCOPE);
            }

            // handle default actions for primitives, ...
            else if (assigned == NOT_EXISTING) {

                 // DatexPrimitivePointers also collapsed
                const current_val_prim = Value.collapseValue(current_val,true,true);
                const value_prim = Value.collapseValue(value,true,true); // DatexPrimitivePointers also collapsed
                try {

                    // x.current_val ?= value
                    switch (action_type) {

                        case BinaryCode.ADD: 
                            if (current_val instanceof Array && !(current_val instanceof Tuple)) current_val.push(value); // Array push (TODO array extend?)
                            else if (current_val instanceof String && typeof value_prim == "string") current_val.value += value; // primitive pointer operations
                            else if (current_val instanceof Float && typeof value_prim == "number") current_val.value += value_prim;
                            else if (current_val instanceof Int && typeof value_prim == "bigint") current_val.value += value_prim;
                            else if (current_val instanceof Float && typeof value_prim == "bigint") current_val.value += Number(value_prim);
                            else if (current_val instanceof Int && typeof value_prim == "number") throw new ValueError("Cannot apply a <Float> value to an <Int> pointer", SCOPE);
                            else if (typeof current_val == "object" && typeof value == "object") DatexObject.extend(current_val, value); // extend record
                            else if (current_val_prim instanceof Unit && value_prim instanceof Unit) Runtime.runtime_actions.setProperty(SCOPE, parent, key, new Unit(<number>current_val_prim+<number>value_prim)) // add
                            else if (typeof current_val_prim == "number" && typeof value_prim == "number") Runtime.runtime_actions.setProperty(SCOPE, parent, key, current_val_prim+value_prim) // add
                            else if ((typeof current_val_prim == "number" && typeof value_prim == "bigint") || (typeof current_val_prim == "bigint" && typeof value_prim == "number")) Runtime.runtime_actions.setProperty(SCOPE, parent, key, Number(current_val_prim)+Number(value_prim)) // add
                            else if (typeof current_val_prim == "bigint" && typeof value_prim == "bigint") Runtime.runtime_actions.setProperty(SCOPE, parent, key, current_val_prim+value_prim) // add
                            else if (typeof current_val_prim == "string" && typeof value_prim == "string") Runtime.runtime_actions.setProperty(SCOPE, parent, key, current_val_prim+value_prim) // add
                            else throw new ValueError("Failed to perform an add operation on this value", SCOPE); // add
                            break;

                        case BinaryCode.SUBTRACT:
                            if (current_val instanceof Array) Runtime.runtime_actions._removeItemFromArray(current_val, value); // Array splice
                            else if (current_val instanceof Float && typeof value_prim == "number") current_val.value -= value_prim; // primitive pointer operations
                            else if (current_val instanceof Int && typeof value_prim == "bigint") current_val.value -= value_prim;
                            else if (current_val instanceof Float && typeof value_prim == "bigint") current_val.value -= Number(value_prim);
                            else if (current_val instanceof Int && typeof value_prim == "number") throw new ValueError("Cannot apply a <Float> value to an <Int> pointer", SCOPE);
                            else if (current_val instanceof Unit && value instanceof Unit) Runtime.runtime_actions.setProperty(SCOPE, parent, key, new Unit(<number>current_val-<number>value)) // add
                            else if (typeof current_val_prim == "number" && typeof value_prim == "number") Runtime.runtime_actions.setProperty(SCOPE, parent, key, current_val_prim-value_prim) // subtract
                            else if ((typeof current_val_prim == "number" && typeof value_prim == "bigint") || (typeof current_val_prim == "bigint" && typeof value_prim == "number")) Runtime.runtime_actions.setProperty(SCOPE, parent, key, Number(current_val_prim)-Number(value_prim)) // subtract
                            else if (typeof current_val_prim == "bigint" && typeof value_prim == "bigint") Runtime.runtime_actions.setProperty(SCOPE, parent, key, current_val_prim-value_prim) // subtract
                            else throw new ValueError("Failed to perform a subtract operation on this value", SCOPE)
                            break;

                        case BinaryCode.MULTIPLY:
                            if (current_val instanceof Float && typeof value_prim == "number") current_val.value *= value_prim; // primitive pointer operations
                            else if (current_val instanceof Int && typeof value_prim == "bigint") current_val.value *= value_prim;
                            else if (current_val instanceof Float && typeof value_prim == "bigint") current_val.value *= Number(value_prim);
                            else if (current_val instanceof Int && typeof value_prim == "number") throw new ValueError("Cannot apply a <Float> value to an <Int> pointer", SCOPE);
                            else if (current_val instanceof Unit && value instanceof Unit) Runtime.runtime_actions.setProperty(SCOPE, parent, key, new Unit(<number>current_val*<number>value)) // add
                            else if (typeof current_val_prim == "number" && typeof value_prim == "number") Runtime.runtime_actions.setProperty(SCOPE, parent, key, current_val_prim*value_prim) // subtract
                            else if ((typeof current_val_prim == "number" && typeof value_prim == "bigint") || (typeof current_val_prim == "bigint" && typeof value_prim == "number")) Runtime.runtime_actions.setProperty(SCOPE, parent, key, Number(current_val_prim)*Number(value_prim)) // subtract
                            else if (typeof current_val_prim == "bigint" && typeof value_prim == "bigint") Runtime.runtime_actions.setProperty(SCOPE, parent, key, current_val_prim*value_prim) // subtract
                            else throw new ValueError("Failed to perform a subtract operation on this value", SCOPE)
                            break;

                        case BinaryCode.DIVIDE:
                            if (current_val instanceof Float && typeof value_prim == "number") current_val.value /= value_prim; // primitive pointer operations
                            else if (current_val instanceof Int && typeof value_prim == "bigint") current_val.value /= value_prim;
                            else if (current_val instanceof Float && typeof value_prim == "bigint") current_val.value /= Number(value_prim);
                            else if (current_val instanceof Int && typeof value_prim == "number") throw new ValueError("Cannot apply a <Float> value to an <Int> pointer", SCOPE);
                            else if (current_val instanceof Unit && value instanceof Unit) Runtime.runtime_actions.setProperty(SCOPE, parent, key, new Unit(<number>current_val/<number>value)) // add
                            else if (typeof current_val_prim == "number" && typeof value_prim == "number") Runtime.runtime_actions.setProperty(SCOPE, parent, key, current_val_prim/value_prim) // subtract
                            else if ((typeof current_val_prim == "number" && typeof value_prim == "bigint") || (typeof current_val_prim == "bigint" && typeof value_prim == "number")) Runtime.runtime_actions.setProperty(SCOPE, parent, key, Number(current_val_prim)/Number(value_prim)) // subtract
                            else if (typeof current_val_prim == "bigint" && typeof value_prim == "bigint") Runtime.runtime_actions.setProperty(SCOPE, parent, key, current_val_prim/value_prim) // subtract
                            else throw new ValueError("Failed to perform a subtract operation on this value", SCOPE)
                            break;

                        // set reference
                        case BinaryCode.CREATE_POINTER:

                            if (current_val instanceof Pointer) current_val.value = value_prim; // primitive pointer value update
                            else throw new ValueError("Pointer value assignment not possible on this value", SCOPE)
                            break;

                        default:
                            throw new RuntimeError("Unsupported assignment operation", SCOPE);
                    }

                } catch (e) {
                    o_parent?.enableUpdatesForAll();
                    if (e instanceof Error) throw e;
                    console.log(e);
                    throw new PermissionError("Cannot change a readonly value", SCOPE);
                }
            }
            
            o_parent?.enableUpdatesForAll();

        },
            
        _removeItemFromArray(arr:any[], value:any){
            let i = 0;
            while (i < arr.length) {
                if (arr[i] === value) arr.splice(i, 1);
                else ++i;
            }
        },


        extractScopeBlock(SCOPE:datex_scope):ArrayBuffer|false {
            
            // Compiled buffer
            /** wait for buffer */
            if (SCOPE.current_index+Uint32Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength) return false;
            /********************/

            let buffer_length = SCOPE.buffer_views.data_view.getUint32(SCOPE.current_index, true);
            SCOPE.current_index += Uint32Array.BYTES_PER_ELEMENT;

            if (buffer_length == 0) return undefined;

            /** wait for buffer */
            if (SCOPE.current_index+buffer_length > SCOPE.buffer_views.uint8.byteLength) return false;
            /********************/

            let _buffer = SCOPE.buffer_views.buffer.slice(SCOPE.current_index, SCOPE.current_index+buffer_length);
            SCOPE.current_index += buffer_length;

            return _buffer;
        },

        extractVariableName(SCOPE:datex_scope):string|number|false  {
            /** wait for buffer */
            if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return false;
            /********************/

            let length = SCOPE.buffer_views.uint8[SCOPE.current_index++];
            let name:string|number;
            if (length == 0) { // binary name (2 byte number)
                /** wait for buffer */
                if (SCOPE.current_index+Uint16Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength) return false;
                /********************/
                name = SCOPE.buffer_views.data_view.getUint16(SCOPE.current_index, true);
                SCOPE.current_index += Uint16Array.BYTES_PER_ELEMENT;
            }
            else {
                /** wait for buffer */
                if (SCOPE.current_index+length > SCOPE.buffer_views.uint8.byteLength) return false;
                /********************/
                name = Runtime.utf8_decoder.decode(SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index+length));
                SCOPE.current_index += length;
            }
            return name;
        },

        extractType(SCOPE:datex_scope, is_extended_type = false):[Type,boolean]|false|Type {
            /** wait for buffer */
            if (SCOPE.current_index+2+(is_extended_type?2:0) > SCOPE.buffer_views.uint8.byteLength) return false;
            /********************/
            let ns_length = SCOPE.buffer_views.uint8[SCOPE.current_index++];
            let name_length = SCOPE.buffer_views.uint8[SCOPE.current_index++];
            let variation_length = 0;
            let has_parameters;
            if (is_extended_type) {
                variation_length = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                has_parameters = SCOPE.buffer_views.uint8[SCOPE.current_index++] ? true : false;
            }

            /** wait for buffer */
            if (SCOPE.current_index+ns_length+name_length+variation_length > SCOPE.buffer_views.uint8.byteLength) return false;
            /********************/

            let ns = Runtime.utf8_decoder.decode(SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index += ns_length));
            let type = Runtime.utf8_decoder.decode(SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index += name_length));
            let varation:string;
            if (is_extended_type) {
                varation = Runtime.utf8_decoder.decode(SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index += variation_length));
            }

            return is_extended_type ? [Type.get(ns, type, varation), has_parameters] : Type.get(ns, type, varation);
        },

        // create a clone of the SCOPE in the current state
        forkScope(SCOPE:datex_scope): datex_scope {
            let structuredClone = globalThis.structuredClone;
            
            const forked_scope:datex_scope = {
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
                root: {...SCOPE.root},
                internal_vars: {...SCOPE.internal_vars},
                execution_permission: SCOPE.execution_permission,
                impersonation_permission: SCOPE.impersonation_permission,
                sub_scopes: [],
                meta: {...SCOPE.meta},
                remote: {...SCOPE.remote},
                buffer_views: {...SCOPE.buffer_views},
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
                })
            }
            forked_scope.inner_scope = forked_scope.sub_scopes[forked_scope.sub_scopes.length-1]

            return forked_scope;
        },


        // add float, int, person, ... to right parent in scope
        // if literal_value = true, treat types as values
        async insertToScope(SCOPE:datex_scope, el:any, literal_value = false){

            const INNER_SCOPE = SCOPE.inner_scope;
            // first make sure pointers are collapsed
            el = Value.collapseValue(el) 

            /** First handle strongly bound modifiers (template, type casts, spread operator, negation, ...)*/

            // template <> () - ignores type cast!! (TODO change?)
            if (INNER_SCOPE.template) {
                if (INNER_SCOPE.template === true) {
                    if (el instanceof Type) {
                        INNER_SCOPE.template = el;
                        return;
                    }
                    else throw new RuntimeError("Invalid template definition");
                }
                else if (INNER_SCOPE.template instanceof Type) {
                    if (typeof el == "object") {
                        INNER_SCOPE.template.setTemplate(el);
                        delete INNER_SCOPE.template;
                    }
                    else throw new RuntimeError("Invalid template definition");
              
                    return;
                }
                else throw new RuntimeError("Invalid template definition");
            }

            // get scope block vars (wait for pointer property key )
            if (INNER_SCOPE.scope_block_for && SCOPE.buffer_views.uint8[SCOPE.current_index] != BinaryCode.CHILD_GET_REF) {
                INNER_SCOPE.scope_block_vars.push(Pointer.pointerifyValue(el));
                return;
            }

            if (INNER_SCOPE.wait_dynamic_key) {
                let key = el;
                console.log("DYN>",key);
                // add key for next value
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
                    INNER_SCOPE.active_value = await Promise.all(el.indexed.map(v=>v.promise)); // TODO await non-local task
                    return;
                }
            }

            if (INNER_SCOPE.wait_hold) {
                if (el instanceof Scope) {
                    const lazy_value = new Datex.LazyValue(el);
                    INNER_SCOPE.active_value = lazy_value;
                }
                else throw new RuntimeError("Invalid hold");
                delete INNER_SCOPE.wait_hold;
                return;
            }

            // type parameters <x()> - required for type cast
            if (INNER_SCOPE.waiting_ext_type) {
                if (!(el instanceof Tuple)) el = new Tuple([el]);
                if (el.size) el = INNER_SCOPE.waiting_ext_type.getParametrized((<Tuple>el).toArray());
                else el = INNER_SCOPE.waiting_ext_type;
                INNER_SCOPE.waiting_ext_type = null;
            }

            // add to casts, if not followed by end bin code -> interpret as actual type value
            if (!literal_value && el instanceof Type && !(Runtime.END_BIN_CODES.includes(SCOPE.buffer_views.uint8[SCOPE.current_index]) || SCOPE.buffer_views.uint8[SCOPE.current_index] == BinaryCode.CHILD_GET || SCOPE.buffer_views.uint8[SCOPE.current_index] == BinaryCode.CHILD_GET_REF)) {
                if (!INNER_SCOPE.type_casts) INNER_SCOPE.type_casts = [];
                INNER_SCOPE.type_casts.push(el)
                return;
            }

            // apply all casts 
            if (INNER_SCOPE.type_casts) {
                let type:Type
                while (type = INNER_SCOPE.type_casts.pop()) el = await Runtime.castValue(type, el, INNER_SCOPE.ctx_intern??INNER_SCOPE.root, SCOPE.origin)
            }

            // negation? (~)
            if (INNER_SCOPE.negate_operator) {

                // filter
                if (el instanceof Datex.Addresses.Target || el instanceof Datex.Addresses.Filter || el instanceof Set || el instanceof Array) {
                    el = Datex.Addresses.Not.get(el);
                }
                // double not
                else if (el instanceof Datex.Addresses.Not) {
                    el = el.value;
                }

                else if (typeof el == "boolean") {
                    el = !el;
                }
                else throw(new ValueError("Cannot negate this value ("+Runtime.valueToDatexString(el)+")", SCOPE))               
                
                delete INNER_SCOPE.negate_operator;
            }


            // handle child get
            if (INNER_SCOPE.waiting_for_child == 1) {
                el = Runtime.runtime_actions.getProperty(SCOPE, INNER_SCOPE.active_value, el);
                delete INNER_SCOPE.active_value; // no longer exists
                INNER_SCOPE.waiting_for_child = 0;
                // ... continue (insert new el)
            }

            // handle child get (referenced child if pointer)
            else if (INNER_SCOPE.waiting_for_child == 2) {
                el = Runtime.runtime_actions.getReferencedProperty(INNER_SCOPE.active_value, el);
                delete INNER_SCOPE.active_value; // no longer exists
                INNER_SCOPE.waiting_for_child = 0;
                // ... continue (insert new el)
            }

            // handle child set/add/...
            else if (INNER_SCOPE.waiting_for_child_action) {
                if (!INNER_SCOPE.waiting_for_action) INNER_SCOPE.waiting_for_action = [];
                INNER_SCOPE.waiting_for_action.push([INNER_SCOPE.waiting_for_child_action, INNER_SCOPE.active_value, el]);
                delete INNER_SCOPE.active_value; // no longer exists
                delete INNER_SCOPE.waiting_for_child_action;
                return;
            }


            // child path coming afterwards?, create new subscope (if not already created => auto_exit), set active value and return
            if (!INNER_SCOPE.auto_exit && (SCOPE.buffer_views.uint8[SCOPE.current_index] == BinaryCode.CHILD_GET || SCOPE.buffer_views.uint8[SCOPE.current_index] == BinaryCode.CHILD_GET_REF)) {
                Runtime.runtime_actions.enterSubScope(SCOPE);
                SCOPE.inner_scope.active_value = el;
                SCOPE.inner_scope.auto_exit = 1; // auto exit subscope at next possible position
                return;
            }


            if (INNER_SCOPE.waiting_for_key_perm) {
                INNER_SCOPE.waiting_for_key_perm = false;
                if (el instanceof Datex.Addresses.Target) INNER_SCOPE.key_perm = new Datex.Addresses.Filter(el);
                else if (el instanceof Datex.Addresses.Filter) INNER_SCOPE.key_perm = el;
                else throw new ValueError("Invalid permission prefix must be <Filter> or <Target>")

                return;
            }


            /************************** */



            // now insert value:

            // range (before path handling)
            if (INNER_SCOPE.waiting_range) {
                // add to range
                if (INNER_SCOPE.waiting_range.length < 2) INNER_SCOPE.waiting_range.push(el)
                // is range closed?
                if (INNER_SCOPE.waiting_range.length == 2) {
                    INNER_SCOPE.active_value = $$(new RangeIterator(INNER_SCOPE.waiting_range[0], INNER_SCOPE.waiting_range[1]))// Tuple.generateRange(INNER_SCOPE.waiting_range[0], INNER_SCOPE.waiting_range[1]); // new el is the generated range <Tuple>
                    INNER_SCOPE.waiting_range = null; // range closed
                }
            }
            

            // insert
            
            // inside Array
            else if (INNER_SCOPE.active_object && (INNER_SCOPE.active_object instanceof Array)) {
                // collapse ...
                if (INNER_SCOPE.waiting_collapse) {
                    INNER_SCOPE.waiting_collapse = false;

                    if (el instanceof Iterator) INNER_SCOPE.active_object.push(...(await el.collapse()).toArray());
                    else if (el instanceof Tuple) INNER_SCOPE.active_object.push(...el.toArray());
                    else if (el instanceof Array) INNER_SCOPE.active_object.push(...el);
                    else throw new ValueError("Cannot collapse value")
                }

                // key insert (integer)
                else if ('waiting_key' in INNER_SCOPE) {
                    if (typeof INNER_SCOPE.waiting_key == "bigint") INNER_SCOPE.active_object[Number(INNER_SCOPE.waiting_key)] = el;
                    else throw new Datex.ValueError("<Array> key must be <Int>");

                    // add key permission
                    if (INNER_SCOPE.key_perm) {
                        console.log("array key permission", INNER_SCOPE.waiting_key, INNER_SCOPE.key_perm, el);
                        if (!INNER_SCOPE.active_object[DX_PERMISSIONS]) INNER_SCOPE.active_object[DX_PERMISSIONS] = {};
                        INNER_SCOPE.active_object[DX_PERMISSIONS][INNER_SCOPE.waiting_key] = INNER_SCOPE.key_perm;
                        delete INNER_SCOPE.key_perm;
                    }

                    delete INNER_SCOPE.waiting_key;
                }

                // insert normally into array
                else INNER_SCOPE.active_object.push(el)
            }
            
            // inside Tuple
            else if (INNER_SCOPE.active_object && (INNER_SCOPE.active_object instanceof Tuple)) {
                // collapse ...
                if (INNER_SCOPE.waiting_collapse) {
                    INNER_SCOPE.waiting_collapse = false;

                    if (el instanceof Iterator) INNER_SCOPE.active_object.push(...(await el.collapse()).toArray());
                    else if (el instanceof Tuple) INNER_SCOPE.active_object.spread(el);
                    else if (el instanceof Array) INNER_SCOPE.active_object.push(...el);
                    else throw new ValueError("Cannot collapse value")
                }

                // key insert
                else if ('waiting_key' in INNER_SCOPE) {
                    INNER_SCOPE.active_object.set(INNER_SCOPE.waiting_key, el);

                    // add key permission
                    if (INNER_SCOPE.key_perm) {
                        console.log("tuple key permission", INNER_SCOPE.waiting_key, INNER_SCOPE.key_perm, el);
                        if (!INNER_SCOPE.active_object[DX_PERMISSIONS]) INNER_SCOPE.active_object[DX_PERMISSIONS] = {};
                        INNER_SCOPE.active_object[DX_PERMISSIONS][INNER_SCOPE.waiting_key] = INNER_SCOPE.key_perm;
                        delete INNER_SCOPE.key_perm;
                    }

                    delete INNER_SCOPE.waiting_key;
                }

                // push
                else {
                    INNER_SCOPE.active_object.push(el);
                }

            }
            
            // inside Object / Tuple
            else if (INNER_SCOPE.active_object) {

                // collapse ...
                if (INNER_SCOPE.waiting_collapse) {
                    INNER_SCOPE.waiting_collapse = false;

                    if (el instanceof Tuple) Object.assign(INNER_SCOPE.active_object, el.toObject());
                    else if (Datex.Type.getValueDatexType(el) == Datex.Type.std.Object) Object.assign(INNER_SCOPE.active_object, el)
                    else throw new ValueError("Cannot collapse value")
                }

                // key insert
                else if ('waiting_key' in INNER_SCOPE) {
                    if (typeof INNER_SCOPE.waiting_key == "string") INNER_SCOPE.active_object[INNER_SCOPE.waiting_key] = el;
                    else throw new Datex.ValueError("<Object> key must be <String>");

                    // add key permission
                    if (INNER_SCOPE.key_perm) {
                        console.log("object key permission", INNER_SCOPE.waiting_key, INNER_SCOPE.key_perm, el);
                        if (!INNER_SCOPE.active_object[DX_PERMISSIONS]) INNER_SCOPE.active_object[DX_PERMISSIONS] = {};
                        INNER_SCOPE.active_object[DX_PERMISSIONS][INNER_SCOPE.waiting_key] = INNER_SCOPE.key_perm;
                        delete INNER_SCOPE.key_perm;
                    }

                    delete INNER_SCOPE.waiting_key;
                }

                else throw new Datex.ValueError("<Object> key cannot be void")
   
            }
            
            // jtr or jfa
            else if (INNER_SCOPE.jmp) {
                // falsish values: void, null, false, 0, 0.0
                let is_true = (el !== VOID && el !== false && el !== 0 && el !== 0n && el !== null);
                if ((INNER_SCOPE.jmp_true && is_true) || (!INNER_SCOPE.jmp_true && !is_true)) {
                    SCOPE.current_index = INNER_SCOPE.jmp;
                }
                await Runtime.runtime_actions.newSubScope(SCOPE);
            }

            /**
             * modifications (operations) on a single value (el) =>
            */


            // $$ create pointer (or just proxify if already a pointer)
            else if (INNER_SCOPE.create_pointer || INNER_SCOPE.delete_pointer) {
                if (INNER_SCOPE.create_pointer) {
                    INNER_SCOPE.create_pointer = false;
                    if (!SCOPE.impersonation_permission) throw new PermissionError("No permission to create pointers on this endpoint", SCOPE)

                    INNER_SCOPE.active_value = Value.collapseValue(Pointer.createOrGet(el))
                }
          
                // immediately delete pointer
                if (INNER_SCOPE.delete_pointer) {
                    delete INNER_SCOPE.active_value;
                    INNER_SCOPE.delete_pointer = false;
                    if (!SCOPE.impersonation_permission) throw new PermissionError("No permission to delete pointers on this endpoint", SCOPE)
                    el = Pointer.pointerifyValue(el); // try proxify
                    // try delete
                    if (el instanceof Pointer ) el.delete()
                    else throw new PermissionError("Cannot delete non-pointer", SCOPE)
                    return;
                }
            }

            // sync pointer
            else if (INNER_SCOPE.sync) {
                INNER_SCOPE.sync = false;
                SCOPE.sync = false;

                let pointer = Pointer.pointerifyValue(el);

                if (!(pointer instanceof Pointer) || pointer.is_anonymous) throw new ValueError("sync expects a pointer value", SCOPE);

                // is a sync consumer


                // sender is self, cannot subscribe to own pointers!
                if (Runtime.endpoint.equals(SCOPE.sender)) {
                    throw new PointerError("Cannot subscribe to pointer with origin self", SCOPE);
                }

                logger.success(SCOPE.sender + " subscribed to " + pointer);

                // is parent of this pointer
                if (pointer.is_origin) {
                    // not existing pointer or no access to this pointer
                    if (!pointer.value || (pointer.allowed_access && !pointer.allowed_access.test(SCOPE.sender))) throw new PointerError("Pointer does not exist", SCOPE)
                    // valid, add subscriber
                    else {
                        pointer.addSubscriber(SCOPE.sender);
                        INNER_SCOPE.active_value = SerializedValue.get(pointer.value);
                    }
                }
                // redirect to actual parent
                else {
                    throw new PermissionError("Cannot subscribe to pointer with remote origin " + pointer.origin, SCOPE)
                }
            }

            else if (INNER_SCOPE.unsubscribe) {
                INNER_SCOPE.unsubscribe = false;
                SCOPE.unsubscribe = false;

                let pointer = Pointer.pointerifyValue(el);
                logger.success(SCOPE.sender + " unsubscribed from " + pointer);
                if (pointer instanceof Pointer && !pointer.is_anonymous) {
                    // is parent of this pointer
                    if (pointer.is_origin) {
                        pointer.removeSubscriber(SCOPE.sender);
                        return;
                    }
                    // redirect to actual parent
                    else {
                        throw new PermissionError("Cannot unsubscribe from pointer with remote origin", SCOPE)
                    }
                }
                else throw new ValueError("Cannot unsubscribe from a non-pointer", SCOPE);
            }

            else if (INNER_SCOPE.get_value) {
                try {
                    INNER_SCOPE.active_value = await Datex.Runtime.cloneValue(el);// SerializedValue.get(el); // get serialized value
                }
                catch (e) {
                    console.warn(e);
                    if (e instanceof Error) e.addScopeToStack(SCOPE);
                    throw e;
                }
                INNER_SCOPE.get_value = false;
            }
            else if (INNER_SCOPE.get_type) {
                INNER_SCOPE.active_value = Type.getValueDatexType(el); // get type for value
                INNER_SCOPE.get_type = false;
            }

            else if (INNER_SCOPE.get_origin) {
                INNER_SCOPE.get_origin = false;
                let pointer = Pointer.pointerifyValue(el);
                if (pointer instanceof Pointer && !pointer.is_anonymous) {
                    INNER_SCOPE.active_value = pointer.origin;
                }
                else throw new ValueError("Cannot get origin of a non-pointer", SCOPE);
            }

            else if (INNER_SCOPE.get_subscribers) {
                INNER_SCOPE.get_subscribers = false;
                let pointer = Pointer.pointerifyValue(el);
                if (pointer instanceof Pointer && !pointer.is_anonymous) {
                    INNER_SCOPE.active_value = await pointer.getSubscribersFilter();
                }
                else throw new ValueError("Cannot get subscribers of a non-pointer", SCOPE);
            }

            // <Type> extends <ParentType>
            else if (INNER_SCOPE.wait_extends) {
                INNER_SCOPE.wait_extends = false;
                if (INNER_SCOPE.active_value instanceof Type && el instanceof Type) {
                    INNER_SCOPE.active_value = el.template && DatexObject.extends(INNER_SCOPE.active_value.template, el.template);
                }
                else if (typeof INNER_SCOPE.active_value == "object") {
                    INNER_SCOPE.active_value = DatexObject.extends(INNER_SCOPE.active_value, el);
                }
                else if ("active_value" in INNER_SCOPE && (Type.getValueDatexType(INNER_SCOPE.active_value).is_primitive || INNER_SCOPE.active_value instanceof PrimitivePointer)) throw new RuntimeError("A primitive value cannot extend a value", SCOPE);
                else if ("active_value" in INNER_SCOPE) INNER_SCOPE.active_value = false;
                else throw new RuntimeError("Invalid 'extends' command", SCOPE);
            }

            // value matches <Type>, @alias matches filter
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
                else if (!("active_value" in INNER_SCOPE)) throw new RuntimeError("Invalid 'matches' command", SCOPE);
                else throw new RuntimeError("Invalid values for 'matches' command", SCOPE);
            }

            // <Type> implements <ParentType>
            else if (INNER_SCOPE.wait_implements) {
                INNER_SCOPE.wait_implements = false;
                if (INNER_SCOPE.active_value instanceof Type && el instanceof Type) {
                    INNER_SCOPE.active_value = el.matchesType(INNER_SCOPE.active_value)
                }
                else throw new RuntimeError("'implements' must check a <Type> against a <Type>", SCOPE);
                //else if (!("active_value" in INNER_SCOPE)) throw new RuntimeError("Invalid 'implements' command", SCOPE);
            }

            // [1,2,3] has 1 
            else if (INNER_SCOPE.has_prop) {
                INNER_SCOPE.active_value = Runtime.runtime_actions.hasProperty(SCOPE, INNER_SCOPE.active_value, el);
                delete INNER_SCOPE.has_prop;
            }

            else if (INNER_SCOPE.wait_freeze) {
                INNER_SCOPE.wait_freeze = false;
                if (Type.getValueDatexType(el).is_primitive || el instanceof PrimitivePointer) throw new RuntimeError("Cannot freeze a primitive value", SCOPE);
                else INNER_SCOPE.active_value = DatexObject.freeze(el)
            }

            else if (INNER_SCOPE.wait_seal) {
                INNER_SCOPE.wait_seal = false;
                if (Type.getValueDatexType(el).is_primitive || el instanceof PrimitivePointer) throw new RuntimeError("Cannot seal a primitive value", SCOPE);
                else INNER_SCOPE.active_value = DatexObject.seal(el)
            }
            // store value in blockchain
            // else if (INNER_SCOPE.wait_store) {
            //     const transaction = new BlockchainTransaction({data:el, type:1})
            //     INNER_SCOPE.active_value = transaction;
            //     // TODO send to blockchain
            //     INNER_SCOPE.wait_store = false;
            // }

            /** 
             * handle multiple other value operations or assignments (using INNER_SCOPE.active_value)
             */

            // stream
            else if (SCOPE.inner_scope.stream_consumer) {
                el = Value.collapseValue(el, true, true); // collapse primitive values

                // pipe stream
                if (el instanceof Stream) {
                     SCOPE.inner_scope.stream_consumer.pipe(el, SCOPE)
                     INNER_SCOPE.stream_consumer = el; // set current el as new stream_reader
                     console.log("pipe << ", el)
                }

                // write next to stream
                else {
                    SCOPE.inner_scope.stream_consumer.write(el, SCOPE);
                }
            }

            // compare
            else if ("compare_type" in INNER_SCOPE) {

                let is_true = false;

                let a = Value.collapseValue(INNER_SCOPE.active_value,true); // only collapse pointer properties, keep primitive pointers
                let b = Value.collapseValue(el,true);

                
                let compared;
                // special compare -> strong EQUAL (referening same endpoint, but possibly different values)
                if (a instanceof Datex.Addresses.Endpoint && b instanceof Datex.Addresses.Endpoint && (INNER_SCOPE.compare_type == BinaryCode.EQUAL || INNER_SCOPE.compare_type == BinaryCode.NOT_EQUAL)) {
                    switch (INNER_SCOPE.compare_type) {
                        case BinaryCode.EQUAL:          is_true = a.equals(b); compared = true; break;
                        case BinaryCode.NOT_EQUAL:      is_true = !a.equals(b); compared = true; break;
                    } 
                }


                // test conditions
                if (!compared) {
                    switch (INNER_SCOPE.compare_type) {
                        // strong equal (reference, same object/value/pointer)
                        case BinaryCode.EQUAL:           is_true = a === b; break;
                        case BinaryCode.NOT_EQUAL:       is_true = a !== b; break;
                        // value equal
                        case BinaryCode.EQUAL_VALUE:     is_true = await Runtime.equalValues(a,b); break;
                        case BinaryCode.NOT_EQUAL_VALUE: is_true = ! (await Runtime.equalValues(a,b)); break;
                        // comparison based on values
                        case BinaryCode.GREATER:         is_true = a >   b; break;
                        case BinaryCode.GREATER_EQUAL:   is_true = a >=  b; break;
                        case BinaryCode.LESS:            is_true = a <   b; break;
                        case BinaryCode.LESS_EQUAL:      is_true = a <=  b; break;
                    }
                }   
                
                // reset
                delete INNER_SCOPE.compare_type;
                // new active value
                INNER_SCOPE.active_value = is_true;
            }
    
            // also handle + and - if current active value is not defined (interpret as 0)
            // +
            else if (INNER_SCOPE.operator === BinaryCode.ADD || INNER_SCOPE.operator === BinaryCode.SUBTRACT) {

                el = Value.collapseValue(el, true, true); // collapse primitive values
                let val = Value.collapseValue(INNER_SCOPE.active_value, true, true);

                // negate for subtract
                if (INNER_SCOPE.operator === BinaryCode.SUBTRACT && (typeof el == "number" || typeof el == "bigint")) el = -el;
                else if (INNER_SCOPE.operator === BinaryCode.SUBTRACT && (el instanceof Unit)) el = new Unit(-el);

                if ((val === 0 || val instanceof Unit) && el instanceof Unit) {
                    INNER_SCOPE.active_value = new Unit(<number>(val??0)+<number>el); 
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
                    throw new ValueError("Cannot perform "+(INNER_SCOPE.operator === BinaryCode.ADD ? "an add" : "a subtract")+" operation on this value", SCOPE)
                }
                delete INNER_SCOPE.operator;
            }

            // &
            else if (INNER_SCOPE.operator === BinaryCode.AND) {

                // collapse primitive values
                let val = Value.collapseValue(INNER_SCOPE.active_value, true, true);
                el = Value.collapseValue(el, true, true); 

                // val is filter
                if (val instanceof Datex.Addresses.Target || val instanceof Datex.Addresses.Filter || val instanceof Datex.Addresses.Not) {
                    if (el instanceof Datex.Addresses.Target || el instanceof Datex.Addresses.Filter || el instanceof Datex.Addresses.Not || el instanceof Set || el instanceof Array) {
                        INNER_SCOPE.active_value = new Datex.Addresses.Filter(val, el);
                    }
                    else throw new ValueError("Cannot perform a logic AND operation on this value", SCOPE)               
                }
                // el is filter
                else if (el instanceof Datex.Addresses.Target || el instanceof Datex.Addresses.Filter || el instanceof Datex.Addresses.Not) {
                    if (val instanceof Datex.Addresses.Target || val instanceof Datex.Addresses.Filter || val instanceof Datex.Addresses.Not || val instanceof Set || val instanceof Array) {
                        INNER_SCOPE.active_value = new Datex.Addresses.Filter(val, el);
                    }
                    else throw new ValueError("Cannot perform a logic AND operation on this value", SCOPE)               
                }
                // types
                else if (el instanceof Type && val instanceof Type) {
                    // let params = new Tuple();
                    // if (el.base_type == Type.std.And) params.spread(el.parameters)
                    // else params.push(el)

                    // if (val.base_type == Type.std.And) params.spread(val.parameters)
                    // else params.push(val)
                    
                    // INNER_SCOPE.active_value = Type.std.And.getParametrized(params);
                }
                // booleans
                else if (typeof val == "boolean" && typeof el == "boolean"){
                    INNER_SCOPE.active_value = val && el;
                }

                // create conjunctive (&) value by extending
                else {
                    const base_type = Datex.Type.getValueDatexType(val);

                    const base = await base_type.createDefaultValue();
                    DatexObject.extend(base, val);
                    DatexObject.extend(base, el);
                    INNER_SCOPE.active_value = base;
                }

                // else {
                //     throw new ValueError("Cannot perform a logic AND operation on this value", SCOPE)               
                // }
                delete INNER_SCOPE.operator;
                delete INNER_SCOPE.negate_operator;
            }

            // |
            else if (INNER_SCOPE.operator === BinaryCode.OR) {
                
                // collapse primitive values
                let val = Value.collapseValue(INNER_SCOPE.active_value, true, true);
                el = Value.collapseValue(el, true, true); 

                // val is filter
                if (val instanceof Datex.Addresses.Target || val instanceof Datex.Addresses.Filter || val instanceof Datex.Addresses.Not) {
                    if (el instanceof Datex.Addresses.Target || el instanceof Datex.Addresses.Filter || el instanceof Datex.Addresses.Not || el instanceof Set || el instanceof Array) {
                        INNER_SCOPE.active_value = new Datex.Addresses.Filter(new Set([val, el]));
                    }
                    else throw new ValueError("Cannot perform a logic AND operation on this value", SCOPE)               
                }
                // el is filter
                else if (el instanceof Datex.Addresses.Target || el instanceof Datex.Addresses.Filter || el instanceof Datex.Addresses.Not) {
                    if (val instanceof Datex.Addresses.Target || val instanceof Datex.Addresses.Filter || val instanceof Datex.Addresses.Not || val instanceof Set || val instanceof Array) {
                        INNER_SCOPE.active_value = new Datex.Addresses.Filter(new Set([val, el]));
                    }
                    else throw new ValueError("Cannot perform a logic AND operation on this value", SCOPE)               
                }
                // types
                else if (el instanceof Type && val instanceof Type) {
                    // let params = new Tuple();
                    // if (el.base_type == Type.std.Or) params.spread(el.parameters)
                    // else params.push(el)

                    // if (val.base_type == Type.std.Or) params.spread(val.parameters)
                    // else params.push(val)
                    
                    // INNER_SCOPE.active_value = Type.std.Or.getParametrized(params);
                }
                // booleans
                else if (typeof val == "boolean" && typeof el == "boolean"){
                    INNER_SCOPE.active_value = val || el;
                }
                else {
                    throw(new ValueError("Cannot perform a logic OR operation on this value", SCOPE))               
                }
                delete INNER_SCOPE.operator;
                delete INNER_SCOPE.negate_operator;
            }


            // *
            else if (INNER_SCOPE.operator === BinaryCode.MULTIPLY) {
                
                // collapse primitive values
                let val = Value.collapseValue(INNER_SCOPE.active_value, true, true);
                el = Value.collapseValue(el, true, true); 

                if ( (val instanceof Unit && (typeof el == "number"||typeof el == "bigint")) || (el instanceof Unit && (typeof val == "number"||typeof val == "bigint"))  ) {
                    INNER_SCOPE.active_value = new Unit(Number(val)*Number(el)); 
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
                // repeat tuples n times
                else if (val instanceof Tuple && typeof el == "bigint") {
                    if (el<0) throw new ValueError("Cannot multiply <Tuple> with negative <Int>", SCOPE)
                    INNER_SCOPE.active_value = new Tuple(new Array(Number(el)).fill(val).flat()).seal();
                }
                else if (typeof val == "bigint" && el instanceof Tuple) {
                    if (val<0) throw new ValueError("Cannot multiply <Tuple> with negative <Int>", SCOPE)
                    INNER_SCOPE.active_value = new Tuple(new Array(Number(val)).fill(el).flat()).seal();
                }
                // repeat void n times
                else if (val === VOID && typeof el == "bigint") {
                    if (el<0) throw new ValueError("Cannot multiply <Tuple> with negative <Int>", SCOPE)
                    INNER_SCOPE.active_value = new Tuple(new Array(Number(el)).fill(VOID)).seal();
                }
                else if (typeof val == "bigint" && el === VOID) {
                    console.log("multiple", val ,el)
                    if (val<0) throw new ValueError("Cannot multiply <Tuple> with negative <Int>", SCOPE)
                    INNER_SCOPE.active_value = new Tuple(new Array(Number(val)).fill(VOID)).seal();
                }
                else {
                    throw new ValueError("Cannot perform a multiply operation on this value", SCOPE)
                }
                delete INNER_SCOPE.operator;
            }

            // /
            else if (INNER_SCOPE.operator === BinaryCode.DIVIDE) {

                // collapse primitive values
                let val = Value.collapseValue(INNER_SCOPE.active_value, true, true);
                el = Value.collapseValue(el, true, true); 

                if ( (val instanceof Unit && (typeof el == "number" || typeof el == "bigint"))) {
                    INNER_SCOPE.active_value = new Unit(Number(val)/Number(el)); 
                }
                else if (val instanceof Unit && el instanceof Unit) {
                    INNER_SCOPE.active_value = Number(val)/Number(el);
                }
                else if (typeof val == "bigint" && typeof el == "bigint") {
                    if (el === 0n) throw new ValueError("Division by zero", SCOPE);
                    INNER_SCOPE.active_value /= el;
                }
                else if ((typeof val == "number" || typeof val == "bigint") && (typeof el == "number" || typeof el == "bigint")) {
                    INNER_SCOPE.active_value = Number(INNER_SCOPE.active_value);
                    INNER_SCOPE.active_value /= Number(el);
                }
                else {
                    throw new ValueError("Cannot perform a divide operation on this value", SCOPE)
                }
                delete INNER_SCOPE.operator;
            }

            // special function-like operators

            // throw error
            else if (INNER_SCOPE.operator === BinaryCode.THROW_ERROR) {
                // add SCOPE to error stack
                if (el instanceof Error) el.addScopeToStack(SCOPE);
                throw el;
            }
            
            // about xy
            else if (INNER_SCOPE.about) {
                INNER_SCOPE.active_value = Runtime.getAbout(el);
                delete INNER_SCOPE.about;
            }

            // count [1,2,3]
            else if (INNER_SCOPE.count) {
                INNER_SCOPE.active_value = Runtime.runtime_actions.countValue(el);
                delete INNER_SCOPE.count;
            }

            // url 'file://'...
            else if (INNER_SCOPE.request) {
                if (el instanceof Addresses.Target || el instanceof Addresses.Filter) {
                    if (!SCOPE.impersonation_permission && (!(el instanceof Datex.Addresses.Endpoint) || !SCOPE.sender.equals(el)|| !SCOPE.header.signed)) {
                        throw new PermissionError("No permission to execute scopes on external endpoints", SCOPE)
                    }
                    INNER_SCOPE.active_value = await datex("#default", [], el);
                }
                else if (el instanceof URL) {
                    INNER_SCOPE.active_value = await Runtime.resolveUrl(el);
                }
                // else ignore, continue with current value
                else INNER_SCOPE.active_value = el;
                delete INNER_SCOPE.request;
            }

            // handle other active value cases (no operators)
            else if ("active_value" in INNER_SCOPE) {
                let val = INNER_SCOPE.active_value;

                // handle all ValueConsumers (<Function>, <Type> TODO?, ...)
                if (val instanceof Function || val instanceof Datex.Addresses.Target /*|| val instanceof Datex.Addresses.Filter*/ || val instanceof Datex.Assertion) {
                    // insert <Tuple>el or [el], or [] if el==VOID (call without parameters)                    
                    if (val.handleApply) INNER_SCOPE.active_value = await val.handleApply(Value.collapseValue(el), SCOPE);
                    else throw new ValueError("Cannot apply values to this value", SCOPE);
                }


                else {
                    throw(new ValueError(`Cannot apply ${Runtime.valueToDatexString(el)} to ${Runtime.valueToDatexString(val)}`, SCOPE))
                } 

            }



            else {
                INNER_SCOPE.active_value = el;
            }            
            
        },

    }

    static createNewInitialScope(header?:dxb_header, variables?:{[name:string|number]:any}, internal_vars?:{[name:string|number]:any}, context?:Object, it?:any):datex_scope {

        const scope:datex_scope = {
            sid: header?.sid,
            header: header,
            sender: header?.sender,
            origin: header?.sender,
    
            current_index: 0,
            start_index: 0,

            index_offset: 0,
    
            root: this.default_static_scope ? DatexObject.extend(variables??{},this.default_static_scope) : Object.assign({},variables),
            internal_vars: internal_vars??{},

            execution_permission: header?.executable, // allow execution?
            impersonation_permission: Runtime.endpoint.equals(header?.sender), // at the moment: only allow endpoint to impersonate itself
    
            inner_scope: null, // has to be copied from sub_scopes[0]
        
            sub_scopes: [],
    
            result: VOID, // -> internal variable __result

            context: context,
            it: it,

            meta: {},
            remote: {},

            buffer_views: {}
        }

        //console.log("scope root", scope.root);
        // default meta data
        Object.defineProperty(scope.meta, 'encrypted', {value: header?.encrypted, writable: false, enumerable:true});
        Object.defineProperty(scope.meta, 'signed', {value: header?.signed, writable: false, enumerable:true});
        Object.defineProperty(scope.meta, 'sender', {value: header?.sender, writable: false, enumerable:true});
        Object.defineProperty(scope.meta, 'timestamp', {value: header?.timestamp, writable: false, enumerable:true});
        Object.defineProperty(scope.meta, 'type', {value: header?.type, writable: false, enumerable:true});

        return scope;
    }


    /** call before running a scope with new data */

    static updateScope(scope:datex_scope, datex_body_buffer:ArrayBuffer, header:dxb_header) {
        // merge new block with previous, also if cache_after_index is < current index
        if (scope.cache_previous || (typeof scope.cache_after_index == "number" && scope.current_index+scope.index_offset>=scope.cache_after_index)) {
            const new_uint8 = new Uint8Array(scope.buffer_views.buffer.byteLength + datex_body_buffer.byteLength);
            new_uint8.set(new Uint8Array(scope.buffer_views.buffer), 0);
            new_uint8.set(new Uint8Array(datex_body_buffer), scope.buffer_views.buffer.byteLength);
            scope.buffer_views.buffer = new_uint8.buffer;
        }
        // (re)set buffer if previous block(s) not cached
        else {
            scope.buffer_views.buffer    = datex_body_buffer;
            scope.index_offset += scope.current_index; // update index offset
            scope.current_index = 0; // only reset index to start of new block 
        }
        
        scope.buffer_views.uint8     = new Uint8Array(scope.buffer_views.buffer);     // default      - 1 byte
        scope.buffer_views.data_view = new DataView(scope.buffer_views.buffer);       // works with all typed arrays 

        // update/set header
        scope.header = header;

        scope.execution_permission = header?.executable // allow execution?
        scope.impersonation_permission = Runtime.endpoint.equals(header?.sender) // at the moment: only allow endpoint to impersonate itself

        // enter outer scope ?
        if (scope.sub_scopes.length == 0) {
            scope.inner_scope = {root:scope.root};
            scope.sub_scopes.push(scope.inner_scope);
            scope.inner_scope.is_outer_scope = true; // is outer scope
        }
     
        scope.cache_previous = false; // reset
    }


    /** parses a datex block, keeps track of the current scope, executes actions */
    static async run(SCOPE:datex_scope):Promise<void> {
    
        // loop through instructions
        while (true) {

            // pause scope - not necessarily end
            if (SCOPE.current_index>=SCOPE.buffer_views.uint8.byteLength) {
                return;
            }

            // auto exit subscope?
            if (SCOPE.inner_scope.auto_exit == 2 /* && DatexRuntime.END_BIN_CODES.includes(SCOPE.buffer_views.uint8[SCOPE.current_index])*/) {
                await this.runtime_actions.insertToScope(SCOPE, await this.runtime_actions.exitSubScope(SCOPE), true);
            }
            else if (SCOPE.inner_scope.auto_exit == 1 && !(SCOPE.buffer_views.uint8[SCOPE.current_index] == BinaryCode.CHILD_GET || SCOPE.buffer_views.uint8[SCOPE.current_index] == BinaryCode.CHILD_GET_REF)) {
                SCOPE.inner_scope.auto_exit = 2;
            }

            // keep track of index to jump back to if the buffer is not yet loaded up to a required position
            SCOPE.start_index = SCOPE.current_index;

            let token = SCOPE.buffer_views.uint8[SCOPE.current_index++]

            // ASSIGN_SET = 
            switch (token) {

                // end scope
                case BinaryCode.END: { 
                    SCOPE.closed = true;
                    return;
                }


                // STRING
                case BinaryCode.SHORT_STRING:
                case BinaryCode.STRING: {

                    let length: number;

                    if (token == BinaryCode.SHORT_STRING) {
                        /** wait for buffer */
                        if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        /********************/

                        length = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                    }
                    else {
                        /** wait for buffer */
                        if (SCOPE.current_index+Uint32Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        /********************/

                        length = SCOPE.buffer_views.data_view.getUint32(SCOPE.current_index, true);
                        SCOPE.current_index += Uint32Array.BYTES_PER_ELEMENT;
                    }
                  
                    
                    /** wait for buffer */
                    if (SCOPE.current_index+length > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    
                    let string = this.utf8_decoder.decode(SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index+length));
                    SCOPE.current_index += length;

                    await this.runtime_actions.insertToScope(SCOPE, string);
                    break;
                }


                // BUFFER 
                case BinaryCode.BUFFER: {  
                    /** wait for buffer */
                    if (SCOPE.current_index+Uint32Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    let buffer_length = SCOPE.buffer_views.data_view.getUint32(SCOPE.current_index, true);
                    SCOPE.current_index += Uint32Array.BYTES_PER_ELEMENT;
                    
                    /** wait for buffer */
                    if (SCOPE.current_index+buffer_length > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    let buffer = SCOPE.buffer_views.buffer.slice(SCOPE.current_index, SCOPE.current_index+buffer_length);
                    SCOPE.current_index += buffer_length;
                    // console.warn("buffer length", buffer_length, _buffer);

                    // media stream
                    
                    await this.runtime_actions.insertToScope(SCOPE, buffer);
                    break;
                }

                // CHILD_GET
                case BinaryCode.CHILD_GET: {
                    SCOPE.inner_scope.waiting_for_child = 1;
                    break;
                }

                // CHILD_GET_REF
                case BinaryCode.CHILD_GET_REF: { 
                    SCOPE.inner_scope.waiting_for_child = 2;
                    break;
                }
        
                // CHILD SET =
                case BinaryCode.CHILD_SET: { 
                    SCOPE.inner_scope.waiting_for_child_action = -1;
                    break;
                }

                // CHILD ACTION (+=, -=, ...)
                case BinaryCode.CHILD_ACTION: { 
                    /** wait for buffer */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    // set action specifier
                    SCOPE.inner_scope.waiting_for_child_action =  SCOPE.buffer_views.uint8[SCOPE.current_index++];
                    break;
                }


                // RANGE ..
                case BinaryCode.RANGE: {             
                    SCOPE.inner_scope.waiting_range = [];
                    break;
                }

                // SPREAD ...
                case BinaryCode.EXTEND: {             
                    SCOPE.inner_scope.inner_spread = true; // remember spread
                    break;
                }

                // ERROR
                case BinaryCode.THROW_ERROR: {
                    SCOPE.inner_scope.operator = BinaryCode.THROW_ERROR;
                    break;
                }

                // COMPARE
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
                                        
                // CACHE POINTS
                case BinaryCode.CACHE_POINT: {
                    SCOPE.cache_after_index = SCOPE.current_index + SCOPE.index_offset;
                    break;
                }
                case BinaryCode.CACHE_RESET: {
                    delete SCOPE.cache_after_index;
                    break;
                }

                // JMPS
                case BinaryCode.JMP: {
                    /** wait for buffer */
                    if (SCOPE.current_index+Uint32Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    let index = SCOPE.buffer_views.data_view.getUint32(SCOPE.current_index, true);
                    await Runtime.runtime_actions.newSubScope(SCOPE)
                    SCOPE.current_index = index;
                    break;
                }

                case BinaryCode.JTR: {
                    /** wait for buffer */
                    if (SCOPE.current_index+Uint32Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    let index = SCOPE.buffer_views.data_view.getUint32(SCOPE.current_index, true);
                    SCOPE.current_index += Uint32Array.BYTES_PER_ELEMENT;
                    SCOPE.inner_scope.jmp = index;
                    SCOPE.inner_scope.jmp_true = true;
                    break;
                }

                case BinaryCode.JFA: {
                    /** wait for buffer */
                    if (SCOPE.current_index+Uint32Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    let index = SCOPE.buffer_views.data_view.getUint32(SCOPE.current_index, true);
                    SCOPE.current_index += Uint32Array.BYTES_PER_ELEMENT;
                    SCOPE.inner_scope.jmp = index;
                    SCOPE.inner_scope.jmp_true = false;
                    break;
                }
                
              

                // INTERNAL_VAR  
                case BinaryCode.INTERNAL_VAR: { 
                    let name = Runtime.runtime_actions.extractVariableName(SCOPE)
                    /** wait for buffer */
                    if (name === false) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/


                    // get var 
                    else {
                        let val:any;
                        // read special internal variables
                        if (name == "result")           val = SCOPE.result;
                        else if (name == "sub_result")  val = SCOPE.inner_scope.result;
                        else if (name == "sender")      val = SCOPE.header.sender;
                        else if (name == "current")     val = Runtime.endpoint;
                        else if (name == "timestamp")   val = SCOPE.header.timestamp
                        else if (name == "encrypted")   val = SCOPE.header.encrypted
                        else if (name == "signed")      val = SCOPE.header.signed
                        else if (name == "static")      val = StaticScope.scopes;
                        else if (name == "meta")        val = SCOPE.meta;
                        else if (name == "remote")      val = SCOPE.remote;
                        else if (name == "this")        val = SCOPE.context;
                        else if (name == "it")          val = SCOPE.it;

                        // all other internal variables
                        else if (name in SCOPE.internal_vars) val = SCOPE.internal_vars[name];
                        else {
                            throw new RuntimeError("Internal variable #"+name+" does not exist", SCOPE);
                        }
                        // insert to scope
                        await this.runtime_actions.insertToScope(SCOPE, val);
                    }
                    break;
                }

                // SET_INTERNAL_VAR  
                case BinaryCode.SET_INTERNAL_VAR: { 
                    let name = Runtime.runtime_actions.extractVariableName(SCOPE)
                    /** wait for buffer */
                    if (name === false) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    if (!Runtime.readonly_internal_vars.has(name)) {
                        if (!SCOPE.inner_scope.waiting_internal_vars) SCOPE.inner_scope.waiting_internal_vars = new Set();
                        SCOPE.inner_scope.waiting_internal_vars.add([name]);
                    }
                    else {
                        throw new RuntimeError("Internal variable #"+name+" is readonly", SCOPE);
                    }
                    break;
                }

                // INTERNAL_VAR_ACTION  
                case BinaryCode.INTERNAL_VAR_ACTION: { 
                    /** wait for buffer */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    let action = SCOPE.buffer_views.uint8[SCOPE.current_index++];

                    let name = Runtime.runtime_actions.extractVariableName(SCOPE)
                    /** wait for buffer */
                    if (name === false) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    if (!Runtime.readonly_internal_vars.has(name)) {
                        if (!SCOPE.inner_scope.waiting_internal_vars) SCOPE.inner_scope.waiting_internal_vars = new Set();
                        SCOPE.inner_scope.waiting_internal_vars.add([name, action]);
                    }
                    else {
                        throw new RuntimeError("Internal variable '"+name+"' is readonly", SCOPE);
                    }
                    break;
                }


                // INTERNAL VAR shorthands
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
                    if (!SCOPE.inner_scope.waiting_internal_vars) SCOPE.inner_scope.waiting_internal_vars = new Set();
                    SCOPE.inner_scope.waiting_internal_vars.add(['it']);
                    break;
                }

                case BinaryCode.SET_VAR_RESULT: { 
                    if (!SCOPE.inner_scope.waiting_internal_vars) SCOPE.inner_scope.waiting_internal_vars = new Set();
                    SCOPE.inner_scope.waiting_internal_vars.add(['result']);
                    break;
                }
                case BinaryCode.SET_VAR_SUB_RESULT: {
                    if (!SCOPE.inner_scope.waiting_internal_vars) SCOPE.inner_scope.waiting_internal_vars = new Set();
                    SCOPE.inner_scope.waiting_internal_vars.add(['sub_result']);
                    break;
                }
                case BinaryCode.SET_VAR_ROOT: {
                    if (!SCOPE.inner_scope.waiting_internal_vars) SCOPE.inner_scope.waiting_internal_vars = new Set();
                    SCOPE.inner_scope.waiting_internal_vars.add(['root']);
                    break;
                }

                case BinaryCode.VAR_RESULT_ACTION: { 
                    /** wait for buffer */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    let action = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                    
                    if (!SCOPE.inner_scope.waiting_internal_vars) SCOPE.inner_scope.waiting_internal_vars = new Set();
                    SCOPE.inner_scope.waiting_internal_vars.add(['result', action]);
                    break;
                }
                case BinaryCode.VAR_SUB_RESULT_ACTION: {
                    /** wait for buffer */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    let action = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                    
                    if (!SCOPE.inner_scope.waiting_internal_vars) SCOPE.inner_scope.waiting_internal_vars = new Set();
                    SCOPE.inner_scope.waiting_internal_vars.add(['sub_result', action]);
                    break;
                }
                case BinaryCode.VAR_ROOT_ACTION: {
                    /** wait for buffer */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    let action = SCOPE.buffer_views.uint8[SCOPE.current_index++];

                    if (!SCOPE.inner_scope.waiting_internal_vars) SCOPE.inner_scope.waiting_internal_vars = new Set();
                    SCOPE.inner_scope.waiting_internal_vars.add(['root', action]);
                    break;
                }
                case BinaryCode.VAR_REMOTE_ACTION: {
                    /** wait for buffer */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    let action = SCOPE.buffer_views.uint8[SCOPE.current_index++];

                    if (!SCOPE.inner_scope.waiting_internal_vars) SCOPE.inner_scope.waiting_internal_vars = new Set();
                    SCOPE.inner_scope.waiting_internal_vars.add(['remote', action]);
                    break;
                }

                case BinaryCode.VAR_IT_ACTION: {
                    /** wait for buffer */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    let action = SCOPE.buffer_views.uint8[SCOPE.current_index++];

                    if (!SCOPE.inner_scope.waiting_internal_vars) SCOPE.inner_scope.waiting_internal_vars = new Set();
                    SCOPE.inner_scope.waiting_internal_vars.add(['it', action]);
                    break;
                }

                
                // VARIABLE  
                case BinaryCode.VAR: { 
                    let name = Runtime.runtime_actions.extractVariableName(SCOPE)
                    /** wait for buffer */
                    if (name === false) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    if (!SCOPE.inner_scope.root) throw new RuntimeError("Invalid #root");

                    if (name in SCOPE.inner_scope.root) {
                        await this.runtime_actions.insertToScope(SCOPE, SCOPE.inner_scope.root[name])
                    }
                    else throw new RuntimeError("Variable '"+name+"' does not exist", SCOPE);
                    break;
                }

                // ASSIGN_VAR  
                case BinaryCode.SET_VAR: { 
                    let name = Runtime.runtime_actions.extractVariableName(SCOPE)
                    /** wait for buffer */
                    if (name === false) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    if (!SCOPE.inner_scope.waiting_vars) SCOPE.inner_scope.waiting_vars = new Set();
                    SCOPE.inner_scope.waiting_vars.add([name]);
                    break;
                }

                // VAR_ACTION  
                case BinaryCode.VAR_ACTION: { 
                    /** wait for buffer */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    let action = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                    
                    let name = Runtime.runtime_actions.extractVariableName(SCOPE)
                    /** wait for buffer */
                    if (name === false) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    if (!SCOPE.inner_scope.waiting_vars) SCOPE.inner_scope.waiting_vars = new Set();
                    SCOPE.inner_scope.waiting_vars.add([name, action]);
                    break;
                }


                // LABEL  
                case BinaryCode.LABEL: { 
                    let name = Runtime.runtime_actions.extractVariableName(SCOPE)
                    /** wait for buffer */
                    if (name === false) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    const pointer = Pointer.getByLabel(name);

                    await this.runtime_actions.insertToScope(SCOPE, pointer)

                    break;
                }

                // LABEL_ACTION  
                case BinaryCode.LABEL_ACTION: { 
                    /** wait for buffer */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    let action = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                    
                    let name = Runtime.runtime_actions.extractVariableName(SCOPE)
                    /** wait for buffer */
                    if (name === false) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    // get pointer
                    const pointer = Pointer.getByLabel(name);

                    if (!SCOPE.inner_scope.waiting_ptrs) SCOPE.inner_scope.waiting_ptrs = new Set();
                    SCOPE.inner_scope.waiting_ptrs.add([pointer, action]); // assign next value to pointer;
                    break;
                }

                // SET_LABEL  
                case BinaryCode.SET_LABEL: { 
                    let name = Runtime.runtime_actions.extractVariableName(SCOPE)
                    /** wait for buffer */
                    if (name === false) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    if (!SCOPE.impersonation_permission) {
                        throw new PermissionError("No permission to create labels on this endpoint", SCOPE)
                    }

                    if (!SCOPE.inner_scope.waiting_labels) SCOPE.inner_scope.waiting_labels = new Set();
                    SCOPE.inner_scope.waiting_labels.add(name);
                    break;
                }

                // COMMAND END  
                case BinaryCode.CLOSE_AND_STORE: {  
                    // switch to new sub scope between commands
                    await this.runtime_actions.newSubScope(SCOPE); 
                    break;
                }

                // CODE_BLOCK 
                case BinaryCode.SCOPE_BLOCK: {  

                    const INNER_SCOPE = SCOPE.inner_scope;
                    
                    let buffer = this.runtime_actions.extractScopeBlock(SCOPE);
                    if (buffer === false) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    const code_block = buffer ? new Scope(INNER_SCOPE.scope_block_vars, buffer, true): null;

                    // TRANSFORM
                    if (INNER_SCOPE.scope_block_for == BinaryCode.TRANSFORM) {
                        console.log("transform",INNER_SCOPE.scope_block_vars)
                        INNER_SCOPE.scope_block_for = null;
                        await this.runtime_actions.insertToScope(
                            SCOPE,
                            Value.collapseValue(await Pointer.transformMultipleAsync(INNER_SCOPE.scope_block_vars, ()=>code_block.execute([], SCOPE.sender)))
                        )
                    }

                    // ASSERT
                    else if (INNER_SCOPE.scope_block_for == BinaryCode.ASSERT) {
                        INNER_SCOPE.scope_block_for = null;
                        const assertion = $$(new Datex.Assertion(code_block));
                        await this.runtime_actions.insertToScope(SCOPE, assertion);
                    }

                    // DO
                    else if (INNER_SCOPE.scope_block_for == BinaryCode.DO) {
                        INNER_SCOPE.scope_block_for = null;
                        const task = $$(new Datex.Task(code_block));
                        task.run(SCOPE);
                        await this.runtime_actions.insertToScope(SCOPE, task);
                    }

                    // SCOPE
                    else if (INNER_SCOPE.scope_block_for == BinaryCode.PLAIN_SCOPE) {
                        INNER_SCOPE.scope_block_for = null;
                        await this.runtime_actions.insertToScope(SCOPE, code_block);
                    }


                    // ITERATION
                    else if (INNER_SCOPE.scope_block_for == BinaryCode.ITERATION) {
                        // TODO
                        await this.runtime_actions.insertToScope(SCOPE, new IterationFunction(code_block, undefined, undefined, undefined, SCOPE.context));
                    }


                    // FUNCTION
                    else if (INNER_SCOPE.scope_block_for == BinaryCode.FUNCTION) {
                        INNER_SCOPE.scope_block_for = null;
                        
                        if (!(SCOPE.inner_scope.active_value instanceof Datex.Tuple || SCOPE.inner_scope.active_value === VOID)) {
                            console.log(SCOPE.inner_scope.active_value);
                            throw new RuntimeError("Invalid function declaration: parameters must be empty or of type <Tuple>")
                        }
                        const args = INNER_SCOPE.active_value ?? new Datex.Tuple();
                        delete INNER_SCOPE.active_value;

                        await this.runtime_actions.insertToScope(SCOPE, new Function(code_block, null, undefined, args, undefined, undefined, SCOPE.context));
                    }

                    // REMOTE
                    else if (INNER_SCOPE.scope_block_for == BinaryCode.REMOTE) {
                        INNER_SCOPE.scope_block_for = null;

                        if (!(INNER_SCOPE.active_value instanceof Datex.Addresses.Filter || INNER_SCOPE.active_value instanceof Datex.Addresses.Target)) {
                            throw new RuntimeError("Invalid remote execution declaration: target must be of type <Target> or <Filter>")
                        }
                        const remote = INNER_SCOPE.active_value;
                        delete INNER_SCOPE.active_value;

                        if (!SCOPE.impersonation_permission && (!(remote instanceof Datex.Addresses.Endpoint) || !SCOPE.sender.equals(remote)|| !SCOPE.header.signed)) {
                            throw new PermissionError("No permission to execute scopes on external endpoints", SCOPE)
                        }
               
                        // merge dxb with original dxb
                        if (INNER_SCOPE.scope_block_vars.length) {
                            // insert variables from this scope with additional dx
                            const variables_insert_code = Object.keys(INNER_SCOPE.scope_block_vars).map((_, i)=>`#${i}=?;`).join("");

                            // has to be arraybuffer (a single dxb block)
                            let var_dxb = <ArrayBuffer> await DatexCompiler.compile(variables_insert_code, INNER_SCOPE.scope_block_vars, undefined, false, false, 0, undefined, Infinity)
                        
                            var tmp = new Uint8Array(var_dxb.byteLength + buffer.byteLength);
                            tmp.set(new Uint8Array(var_dxb), 0);
                            tmp.set(new Uint8Array(buffer), var_dxb.byteLength);
                            buffer = tmp.buffer
                        }

                        let filter = remote instanceof Datex.Addresses.Filter ? remote : new Datex.Addresses.Filter(remote);
                        
                        let sid = DatexCompiler.generateSID();
                        let full_dxb = await DatexCompiler.appendHeader(buffer, 
                            true,
                            Runtime.endpoint, //sender
                            filter,  // to
                            false, // flood
                            SCOPE.remote.type ?? undefined, // type
                            SCOPE.remote.sign ?? true, // sign
                            SCOPE.remote.encrypt ?? false, // encrypt
                            undefined,
                            undefined, 
                            true,
                            sid
                        );

                        // datex out to filter
                        let res = await Runtime.datexOut(full_dxb, filter, sid, true, undefined, (scope, header, error)=>{
                            // const forked_scope = DatexRuntime.runtime_actions.forkScope(SCOPE);
                            // forked_scope.inner_scope.active_value = scope.result; // set received active value
                            // console.log("callback from " + header.sender + ":",scope.result, forked_scope);
                            // DatexRuntime.run(forked_scope);
                        });
                        // await new Promise<void>(()=>{});
                        // return;

                        await this.runtime_actions.insertToScope(SCOPE, res);
                    }

                    SCOPE.inner_scope.scope_block_vars = null;

                    break;
                }

                // NULL
                case BinaryCode.NULL: {
                    await this.runtime_actions.insertToScope(SCOPE, null);
                    break;
                }

                // VOID
                case BinaryCode.VOID: {
                    await this.runtime_actions.insertToScope(SCOPE, VOID);
                    break;
                }

                // WILDCARD
                case BinaryCode.WILDCARD: {
                    await this.runtime_actions.insertToScope(SCOPE, WILDCARD);
                    break;
                }

                // RETURN
                case BinaryCode.RETURN: {
                    SCOPE.inner_scope.return = true;
                    break;
                }

                // ABOUT
                case BinaryCode.ABOUT: {
                    SCOPE.inner_scope.about = true;
                    break;
                }

                // COUNT
                case BinaryCode.COUNT: {
                    SCOPE.inner_scope.count = true;
                    break;
                }

                // TEMPLATE
                case BinaryCode.TEMPLATE: {
                    SCOPE.inner_scope.template = true;
                    break;
                }

                // OBSERVE
                case BinaryCode.OBSERVE: {
                    SCOPE.inner_scope.observe = true;
                    break;
                }

                // TRANSFORM
                case BinaryCode.TRANSFORM: {
                    SCOPE.inner_scope.scope_block_for = BinaryCode.TRANSFORM;
                    SCOPE.inner_scope.scope_block_vars = [];
                    break;
                }

                // SCOPE
                case BinaryCode.PLAIN_SCOPE: {
                    SCOPE.inner_scope.scope_block_for = BinaryCode.PLAIN_SCOPE;
                    SCOPE.inner_scope.scope_block_vars = [];
                    break;
                }

                // DO
                case BinaryCode.DO: {
                    SCOPE.inner_scope.scope_block_for = BinaryCode.DO;
                    SCOPE.inner_scope.scope_block_vars = [];
                    break;
                }

                // ITERATION
                case BinaryCode.ITERATION: {
                    SCOPE.inner_scope.scope_block_for = BinaryCode.ITERATION;
                    SCOPE.inner_scope.scope_block_vars = [];
                    break;
                }

                // ITERATOR
                case BinaryCode.ITERATOR: {
                    SCOPE.inner_scope.wait_iterator = true;
                    break;
                }

                // ASSERT
                case BinaryCode.ASSERT: {
                    SCOPE.inner_scope.scope_block_for = BinaryCode.ASSERT;
                    SCOPE.inner_scope.scope_block_vars = [];
                    break;
                }

                // FUNCTION
                case BinaryCode.FUNCTION: {
                    SCOPE.inner_scope.scope_block_for = BinaryCode.FUNCTION;
                    SCOPE.inner_scope.scope_block_vars = [];
                    break;
                }

                // REMOTE
                case BinaryCode.REMOTE: {
                    SCOPE.inner_scope.scope_block_for = BinaryCode.REMOTE;
                    SCOPE.inner_scope.scope_block_vars = [];
                    break;
                }

                // AWAIT
                case BinaryCode.AWAIT: {
                    SCOPE.inner_scope.wait_await = true;
                    break;
                }

                // HOLD
                case BinaryCode.HOLD: {
                    SCOPE.inner_scope.wait_hold = true;
                    break;
                }

                // HAS
                case BinaryCode.HAS: {
                    SCOPE.inner_scope.has_prop = true;
                    break;
                }

                // SEAL
                case BinaryCode.SEAL: {
                    SCOPE.inner_scope.wait_seal = true;
                    break;
                }
                // FREEZE
                case BinaryCode.FREEZE: {
                    SCOPE.inner_scope.wait_freeze = true;
                    break;
                }

                // EXTENDS
                case BinaryCode.EXTENDS: {
                    SCOPE.inner_scope.wait_extends = true;
                    break;
                }

                // IMPLEMENTS
                case BinaryCode.IMPLEMENTS: {
                    SCOPE.inner_scope.wait_implements = true;
                    break;
                }


                // MATCHES
                case BinaryCode.MATCHES: {
                    SCOPE.inner_scope.wait_matches = true;
                    break;
                }

                // DEBUG
                case BinaryCode.DEBUG: {
                    SCOPE.result = SCOPE;
                    SCOPE.closed = true;
                    return;
                }

                // URL
                case BinaryCode.REQUEST: {
                    SCOPE.inner_scope.request = true;
                    break;
                }

                // URL
                case BinaryCode.URL: {
                    /** wait for buffer */
                    if (SCOPE.current_index+Uint32Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    let length = SCOPE.buffer_views.data_view.getUint32(SCOPE.current_index, true);
                    SCOPE.current_index += Uint32Array.BYTES_PER_ELEMENT;
                    
                    /** wait for buffer */
                    if (SCOPE.current_index+length > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    
                    let url = new URL(this.utf8_decoder.decode(SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index+length)));
                    SCOPE.current_index += length;

                    await this.runtime_actions.insertToScope(SCOPE, url);
                    break;
                }

                // ARRAY_START
                case BinaryCode.ARRAY_START: {
                    /** wait for buffer */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    // empty array
                    if (SCOPE.buffer_views.uint8[SCOPE.current_index] === BinaryCode.ARRAY_END) {
                        SCOPE.current_index++;
                        await this.runtime_actions.insertToScope(SCOPE, []);
                    }
                    else {
                        this.runtime_actions.enterSubScope(SCOPE); // outer array scope
                        SCOPE.inner_scope.active_object = []; // generate new array
                        SCOPE.inner_scope.active_object_new = true;
                    }
                    break;
                }

                // TUPLE_START
                case BinaryCode.TUPLE_START: {
                    /** wait for buffer */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    // empty array
                    if (SCOPE.buffer_views.uint8[SCOPE.current_index] === BinaryCode.TUPLE_END) {
                        SCOPE.current_index++;
                        await this.runtime_actions.insertToScope(SCOPE, new Tuple().seal());
                    }
                    else {
                        this.runtime_actions.enterSubScope(SCOPE); // outer array scope
                        SCOPE.inner_scope.active_object = new Tuple(); // generate new tuple
                        SCOPE.inner_scope.active_object_new = true;
                    }
                    break;
                }

                // OBJECT_START
                case BinaryCode.OBJECT_START: {
                    /** wait for buffer */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    // empty object
                    if (SCOPE.buffer_views.uint8[SCOPE.current_index] === BinaryCode.OBJECT_END) {
                        SCOPE.current_index++;
                        await this.runtime_actions.insertToScope(SCOPE, {});
                    }
                    else {
                        this.runtime_actions.enterSubScope(SCOPE); // outer object scope
                        SCOPE.inner_scope.active_object = {}; // generate new object
                        SCOPE.inner_scope.active_object_new = true;
                    }
                    break;
                }

                // // RECORD_START
                // case BinaryCode.RECORD_START: {
                //     /** wait for buffer */
                //     if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                //     /********************/
                //     // empty object
                //     if (SCOPE.buffer_views.uint8[SCOPE.current_index] === BinaryCode.RECORD_END) {
                //         SCOPE.current_index++;
                //         await this.runtime_actions.insertToScope(SCOPE, DatexObject.seal(new Record()));
                //     }
                //     else {
                //         this.runtime_actions.enterSubScope(SCOPE); // outer object scope
                //         SCOPE.inner_scope.active_object = new Record(); // generate new record
                //         SCOPE.inner_scope.active_object_new = true;
                //     }
                //     break;
                // }

                // list element with key
                case BinaryCode.ELEMENT_WITH_KEY: {
                    /** wait for buffer */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    let length = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                    let key = Runtime.utf8_decoder.decode(SCOPE.buffer_views.uint8.subarray(SCOPE.current_index, SCOPE.current_index+length));
                    SCOPE.current_index += length;

                    const key_perm = SCOPE.inner_scope.key_perm;
             
                    // insert previous value
                    if (!SCOPE.inner_scope.active_object_new) await this.runtime_actions.insertToScope(SCOPE, await this.runtime_actions.exitSubScope(SCOPE), true);
                    SCOPE.inner_scope.active_object_new = false;

                    // add key for next value
                    SCOPE.inner_scope.waiting_key = key;       
                    // add key permission
                    if (key_perm) SCOPE.inner_scope.key_perm = key_perm;

                    this.runtime_actions.enterSubScope(SCOPE);    

                 
                    break;
                }

                case BinaryCode.ELEMENT_WITH_INT_KEY: {
                    /** wait for buffer */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    let key = BigInt(SCOPE.buffer_views.data_view.getUint32(SCOPE.current_index));
                    SCOPE.current_index += Uint32Array.BYTES_PER_ELEMENT;

                    const key_perm = SCOPE.inner_scope.key_perm;
             
                    // insert previous value
                    if (!SCOPE.inner_scope.active_object_new) await this.runtime_actions.insertToScope(SCOPE, await this.runtime_actions.exitSubScope(SCOPE), true);
                    SCOPE.inner_scope.active_object_new = false;

                    // add key for next value
                    SCOPE.inner_scope.waiting_key = key;       
                    // add key permission
                    if (key_perm) SCOPE.inner_scope.key_perm = key_perm;

                    this.runtime_actions.enterSubScope(SCOPE);    

                 
                    break;
                }

                // list element with dynamic key
                case BinaryCode.ELEMENT_WITH_DYNAMIC_KEY: {
                    /** wait for buffer */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    // insert previous value
                    if (!SCOPE.inner_scope.active_object_new) await this.runtime_actions.insertToScope(SCOPE, await this.runtime_actions.exitSubScope(SCOPE), true);
                    SCOPE.inner_scope.active_object_new = false;

                    // wait for dynamic key
                    SCOPE.inner_scope.wait_dynamic_key = true;
                    break;
                }

                // key permission
                case BinaryCode.KEY_PERMISSION: {
                    SCOPE.inner_scope.waiting_for_key_perm = true;
                    break;
                }


                // keyless list element 
                case BinaryCode.ELEMENT: {
                    /** wait for buffer */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    // insert previous value
                    if (!SCOPE.inner_scope.active_object_new) await this.runtime_actions.insertToScope(SCOPE, await this.runtime_actions.exitSubScope(SCOPE), true);
                    SCOPE.inner_scope.active_object_new = false;

                    this.runtime_actions.enterSubScope(SCOPE);    

                    break;
                }
              
                // ARRAY_END, OBJECT_END, TUPLE_END, RECORD_END
                case BinaryCode.ARRAY_END:
                case BinaryCode.OBJECT_END:
                case BinaryCode.TUPLE_END: {

                    // now handle object content
                    let result = await this.runtime_actions.exitSubScope(SCOPE);
                    SCOPE.current_index--; // assume still in tuple
                    await this.runtime_actions.insertToScope(SCOPE, result, true);
                    SCOPE.current_index++;

                    let new_object = SCOPE.inner_scope.active_object; // newest tuple closed
                    await this.runtime_actions.exitSubScope(SCOPE); // outer array scope

                    // modifiy final object/array
                    if (new_object instanceof Array) Runtime.runtime_actions.trimArray(new_object);
                    // seal record/tuple
                    if (new_object instanceof Tuple) DatexObject.seal(new_object);

                    // insert
                    await this.runtime_actions.insertToScope(SCOPE, new_object);
                    break;
                }

                // STD SHORT TYPES
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

                // ADD (+)
                case BinaryCode.ADD: {
                    SCOPE.inner_scope.operator = BinaryCode.ADD;
                    break;
                }

                // SUBTRACT (-)
                case BinaryCode.SUBTRACT: {
                    SCOPE.inner_scope.operator = BinaryCode.SUBTRACT;
                    break;
                }

                // MULTIPLY (*)
                case BinaryCode.MULTIPLY: {
                    SCOPE.inner_scope.operator = BinaryCode.MULTIPLY;
                    break;
                }

                // DIVIDE (/)
                case BinaryCode.DIVIDE: {
                    SCOPE.inner_scope.operator = BinaryCode.DIVIDE;
                    break;
                }

                // AND (&)
                case BinaryCode.AND: {
                    SCOPE.inner_scope.operator = BinaryCode.AND;
                    break;
                }

                // OR (|)
                case BinaryCode.OR: {
                    SCOPE.inner_scope.operator = BinaryCode.OR;
                    break;
                }

                // NOT (~)
                case BinaryCode.NOT: {
                    SCOPE.inner_scope.negate_operator = true;
                    break;
                }

                // SUBSCOPE_START
                case BinaryCode.SUBSCOPE_START: {
                    this.runtime_actions.enterSubScope(SCOPE)
                    break;
                }
                // SUBSCOPE_END
                case BinaryCode.SUBSCOPE_END: {   
                    const res = await this.runtime_actions.exitSubScope(SCOPE);
                    await this.runtime_actions.insertToScope(SCOPE, res);
                    break;
                }
            
                // TRUE
                case BinaryCode.TRUE: {
                    await this.runtime_actions.insertToScope(SCOPE, true);
                    break;
                }

                // FALSE
                case BinaryCode.FALSE: {
                    await this.runtime_actions.insertToScope(SCOPE, false);
                    break;
                }

                // UNIT
                case BinaryCode.UNIT: {
                    let unit = new Unit(SCOPE.buffer_views.data_view.getFloat64(SCOPE.current_index, true));
                    SCOPE.current_index += Float64Array.BYTES_PER_ELEMENT;
                    await this.runtime_actions.insertToScope(SCOPE, unit);
                    break;
                }

                // INT_8
                case BinaryCode.INT_8: {
                    /** wait for buffer */
                    if (SCOPE.current_index+Int8Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    let integer:bigint|number = SCOPE.buffer_views.data_view.getInt8(SCOPE.current_index);
                    if (Runtime.OPTIONS.USE_BIGINTS) integer = BigInt(integer);
                    SCOPE.current_index += Int8Array.BYTES_PER_ELEMENT;

                    await this.runtime_actions.insertToScope(SCOPE, integer);
                    break;
                }

                // INT_16
                case BinaryCode.INT_16: {
                    /** wait for buffer */
                    if (SCOPE.current_index+Int16Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    let integer:bigint|number = SCOPE.buffer_views.data_view.getInt16(SCOPE.current_index, true);
                    if (Runtime.OPTIONS.USE_BIGINTS) integer = BigInt(integer);
                    SCOPE.current_index += Int16Array.BYTES_PER_ELEMENT;

                    await this.runtime_actions.insertToScope(SCOPE, integer);
                    break;
                }

                // INT_32
                case BinaryCode.INT_32: {
                    /** wait for buffer */
                    if (SCOPE.current_index+Int32Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    let integer:bigint|number = SCOPE.buffer_views.data_view.getInt32(SCOPE.current_index, true);
                    if (Runtime.OPTIONS.USE_BIGINTS) integer = BigInt(integer);
                    SCOPE.current_index += Int32Array.BYTES_PER_ELEMENT;

                    await this.runtime_actions.insertToScope(SCOPE, integer);
                    break;
                }

                // INT_64
                case BinaryCode.INT_64: {
                    /** wait for buffer */
                    if (SCOPE.current_index+BigInt64Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    let integer:bigint|number = SCOPE.buffer_views.data_view.getBigInt64(SCOPE.current_index, true);
                    if (!Runtime.OPTIONS.USE_BIGINTS) integer = Number(integer);
                    SCOPE.current_index += BigInt64Array.BYTES_PER_ELEMENT;

                    await this.runtime_actions.insertToScope(SCOPE, integer);
                    break;
                }
                

                // FLOAT
                case BinaryCode.FLOAT_64: {
                    /** wait for buffer */
                    if (SCOPE.current_index+Float64Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    let float = SCOPE.buffer_views.data_view.getFloat64(SCOPE.current_index, true);
                    SCOPE.current_index += Float64Array.BYTES_PER_ELEMENT;

                    await this.runtime_actions.insertToScope(SCOPE, float);
                    break;
                }

            
                // FLOAT
                case BinaryCode.FLOAT_AS_INT: {
                    /** wait for buffer */
                    if (SCOPE.current_index+Int32Array.BYTES_PER_ELEMENT > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    let float = SCOPE.buffer_views.data_view.getInt32(SCOPE.current_index, true);
                    SCOPE.current_index += Int32Array.BYTES_PER_ELEMENT;

                    await this.runtime_actions.insertToScope(SCOPE, float);
                    break;
                }

                // TYPE
                case BinaryCode.TYPE: {
                    const type = this.runtime_actions.extractType(SCOPE);
                    if (type === false) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /** wait for buffer (needed in insertToScope) */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    
                    await this.runtime_actions.insertToScope(SCOPE, type);
                    break;
                }


                // EXTENDED_TYPE
                case BinaryCode.EXTENDED_TYPE: {
                    const type_info = this.runtime_actions.extractType(SCOPE, true);
                    if (type_info === false) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /** wait for buffer (needed in insertToScope) */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    // has parameters
                    if (type_info[1]) SCOPE.inner_scope.waiting_ext_type = type_info[0];
                    // only variation, no parameters
                    else await this.runtime_actions.insertToScope(SCOPE, type_info[0]);
                    break;
                }

                // FILTER
                case BinaryCode.FILTER: {
                    /** wait for buffer */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    let targets_nr = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                    let target_list:Datex.Addresses.Endpoint[] = [];

                    for (let n=0; n<targets_nr; n++) {
                        let type = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                        const target = Runtime.runtime_actions.constructFilterElement(SCOPE, type, target_list);
                        if (target) target_list.push(target);
                        else return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    }

                    let cnf:CNF = new Datex.Addresses.AndSet();

                    // filter clauses part

                    /** wait for buffer */
                    if (SCOPE.current_index+1 > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    
                    let ands_nr = SCOPE.buffer_views.uint8[SCOPE.current_index++];

                    
                    for (let n=0; n<ands_nr; n++) {
                        let ors_nr = SCOPE.buffer_views.uint8[SCOPE.current_index++];
                        /** wait for buffer */
                        if (SCOPE.current_index+(ors_nr*Int8Array.BYTES_PER_ELEMENT) > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                        /********************/
                        let ors = new Set<Datex.Addresses.Target | Datex.Addresses.Not<Datex.Addresses.Target>>();
                        for (let m=0; m<ors_nr; m++) {
                            let index = SCOPE.buffer_views.data_view.getInt8(SCOPE.current_index++);
                            // @ts-ignore TODO old
                            ors.add(index<0 ? Datex.Addresses.Not.get(target_list[-index-1]) : target_list[index-1]);
                        }
                        cnf.add(ors);
                    }
                    
                    await this.runtime_actions.insertToScope(SCOPE, new Datex.Addresses.Filter(...cnf));
                    break;
                }


                // ENDPOINTS / ALIASES
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
                    if (f === false) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    await this.runtime_actions.insertToScope(SCOPE, f);
                    break;
                }
               
                // POINTER
                case BinaryCode.POINTER: {
                    /** wait for buffer */
                    if (SCOPE.current_index+Pointer.MAX_POINTER_ID_SIZE > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    let id = SCOPE.buffer_views.uint8.slice(SCOPE.current_index, SCOPE.current_index+=Pointer.MAX_POINTER_ID_SIZE);

                    await this.runtime_actions.insertToScope(SCOPE, await Pointer.load(id, SCOPE));
                    break;
                }


                // SET_POINTER
                case BinaryCode.SET_POINTER: {

                    /** wait for buffer */
                    if (SCOPE.current_index+Pointer.MAX_POINTER_ID_SIZE > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/

                    const id = SCOPE.buffer_views.uint8.slice(SCOPE.current_index, SCOPE.current_index+=Pointer.MAX_POINTER_ID_SIZE);
                    const pointer = await Pointer.load(id, SCOPE)

                    if (!SCOPE.inner_scope.waiting_ptrs) SCOPE.inner_scope.waiting_ptrs = new Set();
                    SCOPE.inner_scope.waiting_ptrs.add([pointer]); // assign next value to pointer;

                    // /** wait for buffer */
                    // if (SCOPE.current_index+Pointer.MAX_POINTER_ID_SIZE > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    // /********************/

                    // let id = SCOPE.buffer_views.uint8.slice(SCOPE.current_index, SCOPE.current_index+=Pointer.MAX_POINTER_ID_SIZE);

                    // if (!SCOPE.impersonation_permission) {
                    //     throw new PermissionError("No permission to create pointers on this endpoint", SCOPE)
                    // }

                    // let pointer = Pointer.create(id, <any>NOT_EXISTING, false, SCOPE.origin); // create new pointer with origin=SCOPE.origin

                    // if (!SCOPE.inner_scope.waiting_ptrs) SCOPE.inner_scope.waiting_ptrs = new Set();
                    // SCOPE.inner_scope.waiting_ptrs.add([pointer]); // assign next value to pointer;
                    break;
                }

                // // DELETE_POINTER TODO remove?
                // case BinaryCode.DELETE_POINTER: {
                //     SCOPE.inner_scope.delete_pointer = true;
                //     break;
                // }

                // SYNC
                case BinaryCode.SYNC: {
                    SCOPE.inner_scope.sync = true;
                    SCOPE.sync = true; // to know if currently waiting for subscribe anywhere in parent
                    break;
                }

                // STOP_SYNC
                case BinaryCode.STOP_SYNC: {
                    SCOPE.inner_scope.stop_sync = true;
                    break;
                }

                // SUBSCRIBE
                case BinaryCode.SUBSCRIBE: {
                    SCOPE.inner_scope.sync = true;
                    SCOPE.sync = true; // to know if currently waiting for subscribe anywhere in parent
                    break;
                }

                // UNSUBSCRIBE
                case BinaryCode.UNSUBSCRIBE: {
                    SCOPE.inner_scope.unsubscribe = true;
                    SCOPE.unsubscribe = true; // to know if currently waiting for unsubscribe anywhere in parent
                    break;
                }
                // VALUE
                case BinaryCode.VALUE: {
                    SCOPE.inner_scope.get_value = true;
                    break;
                }
                // GET_TYPE
                case BinaryCode.GET_TYPE: {
                    SCOPE.inner_scope.get_type = true;
                    break;
                }
                // ORIGIN
                case BinaryCode.ORIGIN: {
                    SCOPE.inner_scope.get_origin = true;
                    break;
                }
                // SUBSCRIBERS
                case BinaryCode.SUBSCRIBERS: {
                    SCOPE.inner_scope.get_subscribers = true;
                    break;
                }

                // POINTER_ACTION
                case BinaryCode.POINTER_ACTION: {
                    /** wait for buffer */
                    if (SCOPE.current_index+1+Pointer.MAX_POINTER_ID_SIZE > SCOPE.buffer_views.uint8.byteLength) return Runtime.runtime_actions.waitForBuffer(SCOPE);
                    /********************/
                    let action = SCOPE.buffer_views.uint8[SCOPE.current_index++];

                    let id = SCOPE.buffer_views.uint8.slice(SCOPE.current_index, SCOPE.current_index+=Pointer.MAX_POINTER_ID_SIZE);

                    // get pointer
                    let pointer = Pointer.get(id);
                    if (!pointer) throw new PointerError("Pointer does not exist", SCOPE);

                    if (!SCOPE.inner_scope.waiting_ptrs) SCOPE.inner_scope.waiting_ptrs = new Set();
                    SCOPE.inner_scope.waiting_ptrs.add([pointer, action]); // assign next value to pointer;
                    break;
                }

                // CREATE_POINTER ($ ())
                case BinaryCode.CREATE_POINTER: {
                    SCOPE.inner_scope.create_pointer = true;
                    break;
                }

                
                
                // STREAM (<<)
                case BinaryCode.STREAM: {

                    // if not already has a stream_consumer, set the active value as a stream_consumer
                    if (!SCOPE.inner_scope.stream_consumer) {
                        if (!SCOPE.inner_scope.active_value) throw new RuntimeError("Missing stream consumer", SCOPE)
                        // implements StreamConsumer
                        if (!Type.std.StreamConsumer.matches(SCOPE.inner_scope.active_value)) throw new TypeError("<StreamConsumer> expected");

                        SCOPE.inner_scope.stream_consumer = SCOPE.inner_scope.active_value;
                        delete SCOPE.inner_scope.active_value;
                    }
                  
                    break;
                }


                default: {
                    //logger.error("Invalid Binary Token at index "+SCOPE.current_index+": " + token)
                    throw new Error("Invalid Binary Token: " + token.toString(16), SCOPE);
                }

            }
                    
        }

    }
}

Logger.setDatex(Datex); // workaround to prevent circular imports


/** DatexRuntime static initializations: */
// observers (DatexRuntime.endpoint calls observer)
Observers.register(Runtime, "endpoint");

Runtime.endpoint = Datex.Addresses.LOCAL_ENDPOINT;

// @ts-ignore
if (globalThis.navigator?.userAgentData?.brands) {
    // @ts-ignore
    for (let brand of globalThis.navigator.userAgentData.brands) {
        if (!brand.brand.includes("Not;") && !brand.brand.includes("Not A;")) {
            Runtime.HOST_ENV = (brand.brand??"") + " " + (brand.version??"");
            break;
        }
    }
}
// @ts-ignore
Runtime.HOST_ENV += globalThis.navigator?.userAgentData? (' / ' + globalThis.navigator.userAgentData.platform) : ''; 

if (!Runtime.HOST_ENV) Runtime.HOST_ENV = globalThis.navigator?.platform;

globalThis.parseDatexData = Runtime.parseDatexData;
globalThis.decompile = Runtime.decompile;
globalThis.decompileBase64 = Runtime.decompileBase64;

globalThis.DatexRuntime = Runtime;
/** end DatexRuntime static initializations*/

DatexRuntimePerformance.marker("main runtime loading time", "main_runtime_loaded", "modules_loaded");



// define measurement groups
DatexRuntimePerformance.createMeasureGroup("compile time", [
    "header",
    "body"
])


globalThis.serializeImg = (img:HTMLImageElement)=> {
    return new Promise(async resolve=>{
        var blob = await fetch(img.src).then(r => r.blob())
        var fileReader = new FileReader();
        fileReader.onloadend = (e) => {
            // @ts-ignore
            let arr = (new Uint8Array(e.target.result)).subarray(0, 4);
            let header = '';
            for (let i = 0; i < arr.length; i++) {
                header += arr[i].toString(16);
            }
            // Check the file signature against known types
            let type:string;
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
                    type = 'application/zip'
                    break;
            }
            if (!type) {
                resolve(false)
                return;
            }

            // @ts-ignore
            img._type = Type.get("std", type);
            // @ts-ignore
            img._buffer = fileReader.result;
            resolve(type);
        }
        fileReader.onerror = () => resolve(false)
        fileReader.readAsArrayBuffer(blob);        
    })
}


// <Map>

Type.std.Map.setJSInterface({
    class: Map,

    serialize: value => [...value.entries()],

    empty_generator: ()=>new Map(),

    cast: value => {
        if (value instanceof Array) {
            try { // might not be an entry array ([[x,y], [z,v]])
                return new Map(value);
            }
            catch (e) {
                throw new ValueError("Failed to convert "+ Type.getValueDatexType(value) +" to "+ Type.std.Map);
            }
        }
        else if (typeof value == "object") return new Map(Object.entries(value));
        return INVALID;
    },

    create_proxy: (value:Map<any,any>, pointer:Pointer) => {

        // override methods
        Object.defineProperty(value, "set", {value:(key, value) => {
                return pointer.handleSet(key, value);
            }, writable:false, enumerable:false});

        Object.defineProperty(value, "clear", {value: () => {
                return pointer.handleClear();
            }, writable:false, enumerable:false});

        Object.defineProperty(value, "delete", {value:(el) => {
                return pointer.handleDelete(el);
            }, writable:false, enumerable:false});

        return value;
    },

    set_property_silently: (parent:Map<any,any>, key, value, pointer) => Map.prototype.set.call(parent, key, value),
    delete_property_silently: (parent:Map<any,any>, key, pointer) => Map.prototype.delete.call(parent, key),
    clear_silently: (parent:Map<any,any>, pointer) => Map.prototype.clear.call(parent),


    set_property: (parent:Map<any,any>, key, value) => parent.set(key, value),
    get_property: (parent:Map<any,any>, key) => parent.get(key),
    delete_property: (parent:Map<any,any>, key) => parent.delete(key),
    has_property: (parent:Map<any,any>, key) => parent.has(key),

    clear: (parent:Map<any,any>) => parent.clear(),

    count: (parent:Map<any,any>) => parent.size,
    keys: (parent:Map<any,any>) => [...parent.keys()],
    values: (parent:Map<any,any>) => [...parent.values()],
})


// <Set>
Type.std.Set.setJSInterface({
    class: Set,
    //detect_class: (val) => (val instanceof Set && !(val instanceof AndSet)),

    serialize: value => [...value].sort(),

    empty_generator: ()=>new Set(),

    cast: value => {
        if (value instanceof Array) return new Set(value);
        return INVALID;
    },

    create_proxy: (value:Set<any>, pointer:Pointer) => {
        // override methods
        Object.defineProperty(value, "add", {value: el => {
                return pointer.handleAdd(el);
            }, writable:false, enumerable:false});

        Object.defineProperty(value, "clear", {value: () => {
                return pointer.handleClear();
            }, writable:false, enumerable:false});

        Object.defineProperty(value, "delete", {value: el => {
                return pointer.handleRemove(el);
            }, writable:false, enumerable:false});

        return value;
    },

    property_action_silently: (type: BinaryCode, parent: any, value: any, pointer: Pointer<any>) => {
        switch (type) {
            case BinaryCode.SUBTRACT: Set.prototype.delete.call(parent, value); break;
            case BinaryCode.ADD: Set.prototype.add.call(parent, value); break;
        }
    },

    clear_silently: (parent:Map<any,any>, pointer) => Set.prototype.clear.call(parent),

    property_action: (type: BinaryCode, parent: any, value: any) => {
        switch (type) {
            case BinaryCode.SUBTRACT: parent.delete(value); break;
            case BinaryCode.ADD: parent.add(value); break;
        }
    },

    get_property: (parent:Set<any>, key) => NOT_EXISTING,
    has_property: (parent:Set<any>, key) => parent.has(key),

    clear: (parent:Set<any>) => parent.clear(),

    count: (parent:Set<any>) => parent.size,
    keys: (parent:Map<any,any>) => [...parent],
    values: (parent:Set<any>) => [...parent],
})

// override set prototype to make sure all sets are sorted at runtime when calling [...set] (TODO is that good?)
// const set_iterator = Set.prototype[Symbol.iterator];
// Set.prototype[Symbol.iterator] = function() {
//     const ordered = [...set_iterator.call(this)].sort();
//     let i = 0;
//     return <IterableIterator<any>>{
//       next: () => ({
//         done: i >= ordered.length,
//         value: ordered[i++]
//       })
//     }
// }



// <image/*>
if (globalThis.HTMLImageElement) Type.get("std:image").setJSInterface({
    class: HTMLImageElement,

    serialize: value => value._buffer,

    empty_generator: ()=>new Image(),

    cast: (value, type) => {
        console.log("cast image " + type)
        if (value instanceof ArrayBuffer) {
            let blob = new Blob([value], {type: "image/"+type.variation});
            let imageUrl = (globalThis.URL || globalThis.webkitURL).createObjectURL(blob);
            let img = <HTMLImageElement> new Image();
            // @ts-ignore
            img._buffer = value;
            // @ts-ignore
            img._type = type;
            img.src = imageUrl;
            return img;
        }
        return INVALID;
    },

    // get specific type
    get_type: value => {
        return value._type ?? Type.get("std:image")
    },

    visible_children: new Set(["src"]),

})



Type.get("std:Task").setJSInterface({
    class: Datex.Task,

    // serialize: value => new Datex.Tuple(value.finished, value.result, value.error),

    // cast: value => {
    //     if (value instanceof Datex.Tuple) {
    //         const task = new Datex.Task();
    //         task.finished = value[0];
    //         task.result = value[1];
    //         task.error = value[2];
    //         return task;
    //     }
    //     else if (typeof value == "object") {
    //         const task = new Datex.Task();
    //         task.finished = value.finished;
    //         task.result = value.result;
    //         task.error = value.error;
    //         return task;
    //     }
    //     return INVALID;
    // },
    is_normal_object: true,
    proxify_children: true,
    visible_children: new Set(["state", "result"]),
}).setReplicator(Datex.Task.prototype.replicate)

Type.get("std:Assertion").setJSInterface({
    class: Datex.Assertion,
    is_normal_object: true,
    proxify_children: true,
    visible_children: new Set(),
})

Type.get("std:Iterator").setJSInterface({
    class: Datex.Iterator,
    is_normal_object: true,
    proxify_children: true,
    visible_children: new Set(['val', 'next']),
})



Type.get("std:LazyValue").setJSInterface({
    class: Datex.LazyValue,

    is_normal_object: true,
    proxify_children: true,
    visible_children: new Set(["datex"]),
})

//DatexType.std.Filter.addVisibleChild("filter"); // only filter is exposed


/*
// <String> object
createPseudoClass({
    type: DatexType.get("std", "StringObject"),
    class: String,

    serialize: value => value[DX_PTR]?.original_value.toString() ?? value.toString(),

    empty_generator: ()=>new String(),

    cast: value => {
        if (typeof value == "string") return new String(value);
        return INVALID;
    },

    docs: ''
})
*/

}

// shortcut functions


/***** execute DATEX */
// default endpoint: DatexRuntime.endpoint
// sign per default if not local endpoint
// do not encrypt per default
export function datex(dx:TemplateStringsArray, ...args:any[]):Promise<any>
export function datex(dx:string|PrecompiledDXB, data?:any[], to?:Datex.Addresses.Target|Datex.Addresses.Filter|Datex.endpoint_name, sign?:boolean, encrypt?:boolean):Promise<any>
export function datex(dx:string|TemplateStringsArray|PrecompiledDXB, data:any[]=[], to:Datex.Addresses.Target|Datex.Addresses.Filter|Datex.endpoint_name = Datex.Runtime.endpoint, sign=to!=Datex.Runtime.endpoint, encrypt=false) {
    // template string (datex `...`)
    if (dx instanceof Array && !(dx instanceof PrecompiledDXB)) {
        dx = dx.raw.join("?");
        let data = Array.from(arguments);
        data.splice(0,1);
        return Datex.Runtime.datexOut([dx, data, {sign:false}], Datex.Runtime.endpoint);
    }
    // normal function call (datex('...', [...data]))
    else return Datex.Runtime.datexOut([dx, data, {sign, encrypt}], typeof to == "string" ? f(<Datex.endpoint_name>to) : to);
}
globalThis.datex = datex
globalThis.〱 = datex;
export const 〱 = datex;


// generate a pointer for an object and returns the proxified object or the primitive pointer
export function pointer<T>(value:Datex.CompatValue<T>): T extends object ? T : Datex.PrimitivePointer<T> {
    const pointer = Datex.Pointer.createOrGet(value);
    if (pointer instanceof Datex.PrimitivePointer) return <any> pointer;
    else return <any> pointer.value // adds pointer or returns existing pointer
}

export const $$ = pointer;

// generate primitive pointers
export function float(value:Datex.CompatValue<number|bigint|string> = 0): Datex.Float {
    if (value instanceof Datex.Value) value = value.value; // collapse
    return Datex.Pointer.create(undefined, Number(value)) // adds pointer or returns existing pointer
}
export function int(value:Datex.CompatValue<bigint|number|string> = 0n): Datex.Int {
    if (value instanceof Datex.Value) value = value.value; // collapse
    return Datex.Pointer.create(undefined, BigInt(Math.floor(Number(value)))) // adds pointer or returns existing pointer
}
export function string(string:TemplateStringsArray, ...vars:any[]):Promise<Datex.String>
export function string(value?:Datex.CompatValue<any>): Datex.String
export function string(value:Datex.CompatValue<string>|TemplateStringsArray = "", ...vars:any[]): Datex.String|Promise<Datex.String> {
    if (value instanceof Datex.Value) value = value.value; // collapse
    // template transform
    if (value instanceof Array) return datex(`transform '${value.raw.map(s=>s.replace(/\(/g, '\\(')).join("(?)")}'`, vars)
    else return <Datex.String>Datex.Pointer.create(undefined, String(value)) // adds pointer or returns existing pointer
}
export function boolean(value:Datex.CompatValue<boolean> = false): Datex.Boolean {
    if (value instanceof Datex.Value) value = value.value; // collapse
    return Datex.Pointer.create(undefined, Boolean(value)) // adds pointer or returns existing pointer
}
export function buffer(value:Datex.CompatValue<ArrayBuffer|Uint8Array|string> = new ArrayBuffer(0)): Datex.Buffer {
    if (value instanceof Datex.Value) value = value.value; // collapse
    if (typeof value == "string") value = new TextEncoder().encode(value);
    else if (value instanceof NodeBuffer) value = new Uint8Array((<typeof NodeBuffer>value).buffer, (<typeof NodeBuffer>value).byteOffset, (<typeof NodeBuffer>value).byteLength / Uint8Array.BYTES_PER_ELEMENT).buffer;
    if (value instanceof TypedArray) value = (<typeof TypedArray>value).buffer;
    return Datex.Pointer.create(undefined, <ArrayBuffer>value) // adds pointer or returns existing pointer
}

globalThis.float = float;
globalThis.int = int;
globalThis.string = string;
globalThis.boolean = boolean;
globalThis.buffer = buffer;


// generate a static pointer for an object
export function static_pointer<T>(value:Datex.CompatValue<T>, endpoint:Datex.Addresses.IdEndpoint, unique_id:number, label?:string|number): T {
    const static_id = Datex.Pointer.getStaticPointerId(endpoint, unique_id);
    const pointer = Datex.Pointer.create(static_id, value)
    if (label) pointer.addLabel(typeof label == "string" ? label.replace(/^\$/, '') : label);
    return pointer.value;
}

// similar to pointer(), but also adds a label
export function label<T>(label:string|number, value:Datex.CompatValue<T>): T {
    const pointer = Datex.Pointer.createOrGet(value);
    pointer.addLabel(typeof label == "string" ? label.replace(/^\$/, '') : label);
    return pointer.value;
}
globalThis.label = label;
globalThis.pointer = pointer;
globalThis.$$ = $$;
globalThis.static_pointer = static_pointer;


// create a infinitely persistant value stored in the DATEX Storage
let PERSISTENT_INDEX = 0;

export function eternal<T>(type:Datex.Type<T>):Promise<Datex.Storage.created_state_value<T>>
export function eternal<T>(id:string|number, type:Datex.Type<T>):Promise<Datex.Storage.created_state_value<T>>
export function eternal<T>(value_class:any_class<T>):Promise<Datex.Storage.created_state_value<T>>
export function eternal<T>(id:string|number, value_class:any_class<T>):Promise<Datex.Storage.created_state_value<T>>
export function eternal<T>(create?:()=>Promise<T>|T):Promise<Datex.Storage.created_state_value<T>>
export function eternal<T>(id:string|number, create:()=>Promise<T>|T):Promise<Datex.Storage.created_state_value<T>>
export function eternal<T>(id_or_create_or_class:string|number|((()=>Promise<T>|T)|any_class<T>|Datex.Type<T>), _create_or_class?:(()=>Promise<T>|T)|any_class<T>|Datex.Type<T>) {
    const create_or_class = (id_or_create_or_class instanceof Function || id_or_create_or_class instanceof Datex.Type) ? id_or_create_or_class : _create_or_class;

    // create unique id for eternal call (file location + type)
    const unique = ()=>{
        const type = create_or_class instanceof Datex.Type ? create_or_class : (create_or_class.prototype !== undefined ? Datex.Type.getClassDatexType(create_or_class) : null);
        const stackInfo = new Error().stack.toString().split(/\r\n|\n/)[3]?.replace(/ *at/,'').trim(); // line 3: after Error header, unique() call, eternal() call
        return (stackInfo??'*') + ':' + (type ? type.toString() : '*') + ':' + (PERSISTENT_INDEX++)
    }
    const id = (typeof id_or_create_or_class == "string" || typeof id_or_create_or_class == "number") ? id_or_create_or_class : unique();
 
    let creator:()=>Promise<T>|T;
    // is class
    if (typeof create_or_class === "function" && create_or_class.prototype !== undefined) {
        // primitive
        if (create_or_class == String || create_or_class == Number || create_or_class == Boolean)
            creator = ()=><T><unknown>create_or_class();
        // BigInt(0);
        else if (create_or_class == BigInt)
            creator = ()=><T><unknown>create_or_class(0);
        // normal
        else
            creator = ()=>new (<(new (...args: any[]) => T)>create_or_class)();
    }
    // creator function
    else if (typeof create_or_class === "function") {
        creator = <(()=>Promise<T>|T)> create_or_class;
    }
    // DATEX type
    else if (create_or_class instanceof Datex.Type) {
        creator = () => create_or_class.createDefaultValue();
    }

    if (creator == null) throw new Datex.Error("Undefined creator for eternal creation")

    return Datex.Storage.loadOrCreate(id, creator);
}
globalThis.eternal = eternal;


export function not(value:[Datex.endpoint_name]|Datex.endpoint_name) {
    let target:Datex.Addresses.Target;
    if (typeof value == "string") target = f(value);
    else if (value instanceof Array && typeof value[0] == "string") target = f(value[0]);
    return new Datex.Addresses.Filter(Datex.Addresses.Not.get(target));
}
export function person(name:[Datex.filter_target_name_person]|Datex.filter_target_name_person) {
    return Datex.Addresses.Person.get(typeof name == "string" ? name : name[0]);
}
export function institution(name:[Datex.filter_target_name_institution]|Datex.filter_target_name_institution) {
    return Datex.Addresses.Institution.get(typeof name == "string" ? name : name[0]);
}
export function bot(name:[Datex.filter_target_name_bot]|Datex.filter_target_name_bot) {
    return Datex.Addresses.Bot.get(typeof name == "string" ? name : name[0]);
}

// create any filter target from a string
export function f<T extends Datex.endpoint_name>(name:[T]|T):Datex.endpoint_by_endpoint_name<T> {
    return <any>Datex.Addresses.Target.get((typeof name == "string" ? name : name[0]));
}

// create any filter target from a string
export function ef(filter:Datex.Addresses.Target) {
    if (filter instanceof Datex.Addresses.Target) return filter.toString()
    return new Datex.Addresses.Filter(filter).toString();
}



globalThis.not = not;
globalThis.person = person;
globalThis.f = f;
globalThis.ef = ef;



export function syncedValue(parent:any|Datex.Pointer, key?:any):Datex.PointerProperty {
    return Datex.PointerProperty.get(parent, key); 
}

// usage: props(someObjectWithPointer).someProperty  -> DatexPointerProperty<typeof someProperty>
// creates an object from a pointer with all properties as DatexSynced values
// if strong_parent_bounding is on, the child properties are always DatexPointerPropertys, otherwise a Pointer or other DatexValue might be returned if the property is already a DatexValue
export function props<T extends object = object>(parent:Datex.CompatValue<T>, strong_parent_bounding = true): Datex.ObjectWithDatexValues<T> {
    let pointer:Datex.Pointer<T>;
    parent = Datex.Pointer.pointerifyValue(parent);
    if (parent instanceof Datex.PointerProperty) parent = parent.value; // collapse pointer property

    if (parent instanceof Datex.Pointer) pointer = parent;
    //else if (parent instanceof Datex.Value) pointer = parent.value;
    else pointer = <Datex.Pointer<T>>Datex.Pointer.createOrGet(parent, undefined, undefined, undefined, true);

    return <Datex.ObjectWithDatexValues<T>> new Proxy({}, {
        get: (_, key) => {
            // other DatexValues can also be returned -> check if property already a DatexValue
            if (!strong_parent_bounding) {
                const property = pointer.getProperty(key);
                if (property instanceof Datex.Value) return property;
            }
            // create a DatexPointerProperty
            return Datex.PointerProperty.get(pointer, <keyof Datex.Pointer<T>>key);
        },
        set: (_, key, value) => {
            Datex.PointerProperty.get(pointer, <keyof Datex.Pointer<T>>key).value = value;
            return true;
        }
    })
}


globalThis.props = props;

globalThis.Datex = Datex;








// Blockchain

class BlockchainTransaction {

    constructor(public transaction:{data:any, type:number} = {data:undefined, type:0}) {

    }
}



// <Block>
Datex.Type.std.Transaction.setJSInterface({
    class: BlockchainTransaction,

    serialize: (value:BlockchainTransaction) => value.transaction,

    empty_generator: ()=>new BlockchainTransaction(),

    cast: value => {
        if (value instanceof Object) return new BlockchainTransaction(value);
        return Datex.INVALID;
    }
})



// automatically sync newly added pointers if they are in the storage
Datex.Pointer.onPointerAdded(async (pointer)=>{
    if (await Datex.Storage.hasPointer(pointer)) {
        Datex.Storage.syncPointer(pointer);
    }
})

DatexRuntimePerformance.marker("pseudoclass loading time", "pseudo_classes_loaded", "main_runtime_loaded");


// create default private/public keys for DatexSec (might change when connecting to DatexCloud)
// (!! takes much too long, not necessarily needed at this point)
//await DatexCrypto.createOwnKeys()


DatexRuntimePerformance.marker("runtime initialization time", "initialized", "main_runtime_loaded");
DatexRuntimePerformance.marker("startup time", "runtime_ready", "runtime_start");
