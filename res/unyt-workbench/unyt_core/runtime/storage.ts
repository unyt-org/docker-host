import { Runtime } from "../runtime/runtime.js";
import { Decompiler } from "./decompiler.js";

import { PointerSource } from "../utils/global_types.js";
import { client_type, logger } from "../utils/global_values.js";
import { Compiler } from "../compiler/compiler.js";
import { NOT_EXISTING } from "./constants.js";
import { DecimalRef, IntegerRef, Pointer, TextRef as DatexString, BooleanRef as DatexBoolean } from "./pointers.js";
import { base64ToArrayBuffer } from "../utils/utils.js";
import { pointer } from "../datex_short.js";
import { Datex } from "../datex.js";
import { localStorage } from "./local_storage.js";

// STORAGE
type localForage = globalThis.Storage & {setItem:(key:string,value:any)=>void, getItem:(key:string)=>ArrayBuffer|string|null};


// db based storage for DATEX value caching (IndexDB in the browser)
let datex_item_storage: localForage;
let datex_pointer_storage: localForage;

/***** imports and definitions with top-level await - node.js / browser interoperability *******************************/
const site_suffix = globalThis.location?.href ?? '';

if (client_type!=="node") {
    const localforage = (await import("../lib/localforage/localforage.js")).default;
    datex_item_storage = localforage.createInstance({name: "dxitem::"+site_suffix});
    datex_pointer_storage = localforage.createInstance({name: "dxptr::"+site_suffix});
}

// globalThis.storage = datex_storage;
// globalThis.datex_storage = datex_item_storage;
// globalThis.datex_pointer_storage = datex_pointer_storage;


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
        if (client_type == "browser" && Storage.mode == Storage.Mode.SAVE_ON_EXIT && location == Storage.Location.DATABASE) throw new Error("Invalid DATEX Storage location: DATABASE with SAVE_ON_EXIT mode");
        // localStorage undefined (e.g. in web worker)
        if (location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE && !localStorage) throw new Error("Invalid DATEX Storage location: FILESYSTEM_OR_LOCALSTORAGE, localStorage not available");

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
                    logger.debug(`Process exit: ${code}. Saving DATEX Values in cache...`);
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

    static setItemLocalStorage(key:string, value:any, pointer?:Pointer, listen_for_pointer_changes = true):boolean {
        // also store pointer
        if (pointer) {
            let res = this.setPointer(pointer, listen_for_pointer_changes);
            if (!res) return false;
        }

        localStorage.setItem(this.item_prefix+key, Compiler.encodeValueBase64(value))
        return true;
    }

    static async setItemDB(key:string, value:any, pointer?:Pointer, listen_for_pointer_changes = true):Promise<boolean> {
        // also store pointer
        if (pointer) {
            let res = await this.setPointer(pointer, listen_for_pointer_changes);
            if (!res) return false;
        }

        // store value (might be pointer reference)
        await datex_item_storage.setItem(key, Compiler.encodeValue(value));  // value to buffer (no header)
        return true;
    }

    private static setPointer(pointer:Pointer, listen_for_changes = true):Promise<boolean>|boolean {
        if (this.location == Storage.Location.DATABASE) return this.setPointerDB(pointer, listen_for_changes);
        else if (this.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) return this.setPointerLocalStorage(pointer, listen_for_changes);
    }

    static #local_storage_active_pointers = new Set<Pointer>();
    static #local_storage_active_pointer_ids = new Set<string>();

    private static setPointerLocalStorage(pointer:Pointer, listen_for_changes = true):boolean {

        const inserted_ptrs = new Set<Pointer>();
        localStorage.setItem(this.pointer_prefix+pointer.id, Compiler.encodeValueBase64(pointer, inserted_ptrs, true, false, true));  // serialized pointer

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

        logger.debug("storing pointer in db storage: " + pointer.idString());

        const inserted_ptrs = new Set<Pointer>();
        await datex_pointer_storage.setItem(pointer.id, Compiler.encodeValue(pointer, inserted_ptrs, true, false, true));  // serialized pointer

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

        // any value change
        pointer.observe(async ()=>{
            const inserted_ptrs = new Set<Pointer>();
            datex_pointer_storage.setItem(pointer.id, Compiler.encodeValue(pointer, inserted_ptrs, true, false, true));  // serialize pointer

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


    /**
     * gets the value of a pointer from storage
     * @param pointer_id id string
     * @param pointerify creates DATEX Pointer if true, otherwise just returns the value
     * @param outer_serialized if true, the outer value type is not evaluated and only the serialized value is returned
     * @returns value from pointer storage
     */
    public static getPointer(pointer_id:string, pointerify?:boolean, bind?:any):Promise<any>|any {
        if (this.location == Storage.Location.DATABASE) return this.getPointerDB(pointer_id, pointerify, bind);
        else if (this.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) return this.getPointerLocalStorage(pointer_id, pointerify, bind);
        else return NOT_EXISTING
    }

    public static async getPointerLocalStorage(pointer_id:string, pointerify?:boolean, bind?:any) {

        let pointer:Pointer;
        if (pointerify && (pointer = Pointer.get(pointer_id))) return pointer.value; // pointer still exists in runtime

        // load from storage
        let base64 = localStorage.getItem(this.pointer_prefix+pointer_id);
        if (base64 == null) return NOT_EXISTING;

        let val = await Runtime.decodeValueBase64(base64, !!bind);

        // bind serialized val to existing value
        if (bind) {
            Datex.Type.ofValue(bind).updateValue(bind, val);
            val = bind;
        }
        
        // create pointer with saved id and value + start syncing, if pointer not already created in DATEX
        if (pointerify) {
            let pointer:Pointer;

            // if the value is a pointer with a tranform scope, copy the transform, not the value (TODO still just a workaround to preserve transforms in storage, maybe better solution?)
            if (val instanceof Pointer && val.transform_scope) {
                pointer = await Pointer.createTransformAsync(val.transform_scope.internal_vars, val.transform_scope);
            }
            // normal pointer from value
            else pointer = Pointer.create(pointer_id, val, false, Runtime.endpoint);
            
            this.#local_storage_active_pointers.add(pointer);
            if (pointer.is_js_primitive) return pointer;
            else return pointer.value;
        }

        else {
            this.#local_storage_active_pointer_ids.add(pointer_id);
            return val;
        }

    }

    public static async getPointerDB(pointer_id:string, pointerify?:boolean, bind?:any) {

        let pointer:Pointer;
        if (pointerify && (pointer = Pointer.get(pointer_id))) return pointer.value; // pointer still exists in runtime

        // load from storage
        let buffer = <ArrayBuffer><any>await datex_pointer_storage.getItem(pointer_id);
        if (buffer == null) return NOT_EXISTING;

        let val = await Runtime.decodeValue(buffer, !!bind);

        // bind serialized val to existing value
        if (bind) {
            Datex.Type.ofValue(bind).updateValue(bind, val);
            val = bind;
        }

        // create pointer with saved id and value + start syncing, if pointer not already created in DATEX
        if (pointerify) {
            let pointer: Pointer;

            // if the value is a pointer with a tranform scope, copy the transform, not the value (TODO still just a workaround to preserve transforms in storage, maybe better solution?)
            if (val instanceof Pointer && val.transform_scope) {
                console.log("init value",val);
                pointer = await Pointer.createTransformAsync(val.transform_scope.internal_vars, val.transform_scope);
            }
            // normal pointer from value
            else pointer = Pointer.create(pointer_id, val, false, Runtime.endpoint);

            this.syncPointer(pointer);
            if (pointer.is_js_primitive) return pointer;
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
            return Decompiler.decompile(buffer, true, false, true, false);
        }

        // get from local storage
        else if (Storage.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) { 
            const base64 = localStorage.getItem(this.pointer_prefix+key);
            if (base64==null) return null;
            return Decompiler.decompile(base64ToArrayBuffer(base64), true, false, true, false);
        }
    }

    static async getItemDecompiled(key:string):Promise<string> {
        // get from datex_storage
        if (Storage.location == Storage.Location.DATABASE) { 
            let buffer = <ArrayBuffer><any>await datex_item_storage.getItem(key);
            if (buffer == null) return null;
            return Decompiler.decompile(buffer, true, false, true, false);
        }

        // get from local storage
        else if (Storage.location == Storage.Location.FILESYSTEM_OR_LOCALSTORAGE) { 
            const base64 = localStorage.getItem(this.item_prefix+key);
            if (base64==null) return null;
            return Decompiler.decompile(base64ToArrayBuffer(base64), true, false, true, false);
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

}

globalThis.DatexStorage = Storage;

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
        T extends globalThis.Number ? DecimalRef :
        T extends globalThis.BigInt ? IntegerRef :
        T extends globalThis.String ? DatexString :
        T extends globalThis.Boolean ? DatexBoolean :
        T
    ) : Pointer<T>
}

Storage.mode = localStorage ? Storage.Mode.SAVE_ON_EXIT : Storage.Mode.SAVE_AUTOMATICALLY
Storage.location = localStorage ? Storage.Location.FILESYSTEM_OR_LOCALSTORAGE : Storage.Location.DATABASE


// proxy for Storage
class DatexStoragePointerSource implements PointerSource {
    getPointer(pointer_id:string, pointerify?:boolean) {
        return Storage.getPointer(pointer_id, pointerify)
    }
    syncPointer(pointer:Pointer) {
        return Storage.syncPointer(pointer)
    }
} 

// register DatexStorage as pointer source
Pointer.registerPointerSource(new DatexStoragePointerSource());