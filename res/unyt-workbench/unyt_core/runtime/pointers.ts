import { Endpoint, endpoints, IdEndpoint, Target, target_clause } from "../types/addressing.js";
import { PointerError, RuntimeError, ValueError } from "../types/errors.js";
import { Compiler, PrecompiledDXB } from "../compiler/compiler.js";
import { DX_PTR, DX_VALUE, INVALID, NOT_EXISTING, SET_PROXY, SHADOW_OBJECT, VOID } from "./constants.js";
import { Runtime, UnresolvedValue } from "./runtime.js";
import { DEFAULT_HIDDEN_OBJECT_PROPERTIES, logger, NodeBuffer, TypedArray } from "../utils/global_values.js";
import { compile_info, datex_scope, PointerSource } from "../utils/global_types.js";
import { Type } from "../types/type.js";
import { BinaryCode } from "../compiler/binary_codes.js";
import { JSInterface } from "./js_interface.js";
import { Stream } from "../types/stream.js";
import { Tuple } from "../types/tuple.js";
import { primitive } from "../types/abstract_types.js";
import { Function as DatexFunction } from "../types/function.js";
import { Quantity } from "../types/quantity.js";
import { buffer2hex, hex2buffer } from "../utils/utils.js";
import { Conjunction, Disjunction } from "../types/logic.js";
import { ProtocolDataType } from "../compiler/protocol_types.js";
import { Scope } from "../types/scope.js";
import { Time } from "../types/time.js";




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
        this.#value = Value.collapseValue(value, true, true);
        this.triggerValueInitEvent()
    }

    
    protected triggerValueInitEvent(){
        const value = this.value;
        for (let o of this.#observers??[]) {
            o(value, VOID, Value.UPDATE_TYPE.INIT);
        }
        for (let [object, observers] of this.#observers_bound_objects??[]) {
            for (let o of observers??[]) {
                o.call(object, value, VOID, Value.UPDATE_TYPE.INIT);
            }
        }
    }

    /**
     * returns a value that can be referenced in JS
     */
    get js_value():T extends object ? T : this {
        return <any>this;
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
        return this.value?.toString() ?? '';
    }

    toJSON(){
        return this.value;
    }

    valueOf(){
        return this.value;
    }

    // utility functions

    static collapseValue<V = any, P1 extends boolean = false, P2 extends boolean = false>(value:CompatValue<V>, collapse_pointer_properties?:P1, collapse_primitive_pointers?:P2): 
    V extends primitive ? 
        (P2 extends true ? V :Value<V>) :   // primitive either collapsed or Pointer returned
    (V extends PointerProperty ?
        (P1 extends true ? V :PointerProperty<V>) :  // PointerProperty either collapsed or PointerProperty returned
        V  // otherwise pointer is always collapsed
        )
    {
        // don't collapse js primitive pointers per default
        if (collapse_primitive_pointers == undefined) collapse_primitive_pointers = <any>false;
        if (collapse_pointer_properties == undefined) collapse_pointer_properties = <any>false;

        if (value instanceof Value && (collapse_primitive_pointers || !(value instanceof Pointer && value.is_js_primitive)) && (collapse_pointer_properties || !(value instanceof PointerProperty))) {
            return value.value
        }
        else return <any>value;
    }

    // // create a new DatexValue from a DatexCompatValue that is updated based on a transform function
    // static transform<OUT, V = any>(value:CompatValue<V>, transform:(v:V)=>CompatValue<OUT>):Value<OUT> {
    //     const initialValue = transform(Value.collapseValue(value, true, true)); // transform current value
    //     if (initialValue === VOID) throw new ValueError("initial tranform value cannot be void");
    //     const dx_value = Pointer.create(undefined, initialValue);
    //     if (value instanceof Value) value.observe(()=>{
    //         const newValue = transform(value.value);
    //         if (newValue !== VOID) dx_value.value = newValue;
    //     }); // transform updates
    //     return dx_value;
    // }
    // static transformMultiple<OUT>(values:CompatValue<any>[], transform:(...values:CompatValue<any>[])=>CompatValue<OUT>):Value<OUT> {
    //     const initialValue = transform(...values.map(v=>Value.collapseValue(v, true, true))); // transform current value
    //     if (initialValue === VOID) throw new ValueError("initial tranform value cannot be void");
    //     const dx_value = Pointer.create(undefined, initialValue);
    //     for (let value of values) {
    //         if (value instanceof Value) value.observe(()=>{
    //             const newValue = transform(...values.map(v=>Value.collapseValue(v, true, true)));
    //             if (newValue !== VOID) dx_value.value = newValue;
    //         }) // transform updates
    //     }
    //     return dx_value;
    // }

   

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
// same as Partial<T>, but with CompatValues
export type CompatPartial<T> = { [P in keyof T]?: CompatValue<T[P]>; }

// export type ObjectWithDatexValues<T> = {[K in keyof T]: T[K] extends CompatValue<infer TT> ? (Value<TT>&TT) : (Value<T[K]>&T[K])}; // proxy object generated by props() function
//export type ObjectWithDatexValues<T> = {[K in keyof T]: T[K] extends CompatValue<infer TT> ? (TT extends primitive ? Value<TT> : TT) : (T[K] extends primitive ? Value<T[K]> : T[K])}; // proxy object generated by props() function
export type ObjectWithDatexValues<T> = {[K in keyof T]: T[K] extends CompatValue<infer TT> ? (Value<TT>) : (Value<T[K]>)}; // proxy object generated by props() function
export type CollapsedDatexObject<T> = {[K in keyof T]?: T[K] extends CompatValue<infer TT> ? TT : T[K]} & Array<any>; // datex value properties are collapsed
export type CollapsedDatexArray<T extends Record<number,any>> = CollapsedDatexObject<T> & Array<any>; // proxy object generated by props() function


// send datex updates from pointers only at specific times / intervals
// either create new DatexUpdateScheduler(update_interval) or manually call trigger() to trigger an update for all pointers
export class UpdateScheduler {

    updates_per_receiver: Map<target_clause, Map<Pointer, Map<string|symbol,[string|PrecompiledDXB, any[],boolean]>>> = new Map();
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
                Runtime.datexOut([datex, data, {end_of_scope:false, type:ProtocolDataType.UPDATE}], receiver, undefined, false, undefined, undefined, false, undefined, this.datex_timeout);
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
    addUpdate(pointer:Pointer, identifier:string, datex:string|PrecompiledDXB, data:any[], receiver:target_clause, collapse_first_inserted = false) {
        if (!this.updates_per_receiver.has(receiver)) this.updates_per_receiver.set(receiver, new Map());
        let ptr_map = this.updates_per_receiver.get(receiver);
        if (!ptr_map.has(pointer)) ptr_map.set(pointer, new Map())
        ptr_map.get(pointer).set((!this.intermediate_updates_pointers.has(pointer) && identifier) ? identifier : Symbol(), [datex, data, collapse_first_inserted]);
    }
}

export type pointer_type = number;



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

        const timestamp = Math.round((new Date().getTime() - Compiler.BIG_BANG_TIME)/1000);

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

    static getStaticPointerId(endpoint:IdEndpoint, unique_id:number): Uint8Array {
        let id = new Uint8Array(this.STATIC_POINTER_SIZE);
        let id_view = new DataView(id.buffer)

        id.set(endpoint.getStaticPointerPrefix());
        id_view.setUint32(13, unique_id);

        return id;
    }

    static ANONYMOUS_ID = new Uint8Array(/*24*/1) // is anonymous pointer

    // returns true if the value has a pointer or is a Datex.Value
    public static isReference(value:any) {
        return (value instanceof Value || this.pointer_value_map.has(value));
    }

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

    public static labelExists(label:string|number):boolean {
        return this.pointer_label_map.has(label)
    }

    // get pointer by id, only returns pointer if pointer already exists
    static get(id:Uint8Array|string):Pointer {
        return this.pointers.get(Pointer.normalizePointerId(id))
    }

    static #pointer_sources = new Set<readonly [source:PointerSource, priority:number]>();
    public static registerPointerSource(source: PointerSource, priority = 0) {
        // sort by prio
        const sorted = [...this.#pointer_sources, [source, priority] as const].sort((a,b)=>b[1]-a[1]);
        this.#pointer_sources.clear();
        sorted.forEach((s)=>this.#pointer_sources.add(s));
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

        //logger.debug("loading pointer: " + pointer.idString() +  " origin = " + pointer.origin)
        // not allowed: anonymous pointer
        if (pointer.is_anonymous) {
            loading_pointers?.delete(id_string);
            throw new PointerError("The anonymous pointer has no value", SCOPE)
        }

        // get value if pointer value not yet loaded
        if (!pointer.#loaded) {
            // first try loading from storage
            let stored:any = NOT_EXISTING;
            let source:PointerSource;
            let priority:number;
            for ([source,priority] of this.#pointer_sources) {
                stored = await source.getPointer(pointer.id, !SCOPE);
                if (stored != NOT_EXISTING) break;
            }

            if (stored!=NOT_EXISTING) {
                // if the value is a pointer with a tranform scope, copy the transform, not the value (TODO still just a workaround to preserve transforms in storage, maybe better solution?)
                if (stored instanceof Pointer && stored.transform_scope) {
                    await pointer.transformAsync(stored.transform_scope.internal_vars, stored.transform_scope);
                }
                // set normal value
                else pointer = pointer.setValue(stored);

                // now sync if source (pointer storage) can sync pointer
                if (source?.syncPointer) source.syncPointer(pointer);

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
                throw new PointerError("Pointer $"+id_string+" has no assigned value", SCOPE)
            }
        }

        loading_pointers?.delete(id_string);

        return pointer;

    }

    // create/get DatexPointer for value if possible (not primitive) and return value
    static proxifyValue<T,C extends CompatValue<T> = CompatValue<T>>(value:C, sealed = false, allowed_access?:target_clause, anonymous = false, persistant= false): C|T {
        if ((value instanceof Pointer && value.is_js_primitive) || value instanceof PointerProperty) return <any>value; // return by reference
        else if (value instanceof Value) return value.value; // return by value
        const type = Type.ofValue(value)
        const collapsed_value = <T> Value.collapseValue(value,true,true)
        // don' create pointer for this value, return original value
        if (type.is_primitive) {
            return <any>collapsed_value;
        }

        // create or get pointer
        else return <any>Pointer.createOrGet(collapsed_value, sealed, allowed_access, anonymous, persistant).value;
    } 

    // create a new pointer or return the existing pointer/pointer property for this value
    static createOrGet<T>(value:CompatValue<T>, sealed = false, allowed_access?:target_clause, anonymous = false, persistant= false):Pointer<T>{
        if (value instanceof Pointer) return value; // return pointer by reference
        //if (value instanceof PointerProperty) return value; // return pointerproperty TODO: handle pointer properties?

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
    

    // create a new pointer with a transform value
    static createTransform<T,V extends readonly [CompatValue<any>]| readonly CompatValue<any>[]>(observe_values:V, transform:(...values:CollapsedDatexArray<V>)=>CompatValue<T>, persistent_datex_transform?:string):Pointer<T> {
        const pointer = <Pointer<T>> Pointer.create(undefined, NOT_EXISTING); 
        pointer.transform(observe_values, transform, persistent_datex_transform);
        return pointer;
    }

    static async createTransformAsync<T,V extends readonly [CompatValue<any>]| readonly CompatValue<any>[]>(observe_values:V, transform:(...values:CollapsedDatexArray<V>)=>Promise<CompatValue<T>>, persistent_datex_transform?:string):Promise<Pointer<T>>
    static async createTransformAsync<T,V extends readonly [CompatValue<any>]| readonly CompatValue<any>[]>(observe_values:V, transform:Scope):Promise<Pointer<T>>
    static async createTransformAsync<T,V extends readonly [CompatValue<any>]| readonly CompatValue<any>[]>(observe_values:V, transform:((...values:CollapsedDatexArray<V>)=>Promise<CompatValue<T>>)|Scope, persistent_datex_transform?:string):Promise<Pointer<T>>{
        const pointer = <Pointer<T>> Pointer.create(undefined, NOT_EXISTING); 
        await pointer.transformAsync(observe_values, transform, persistent_datex_transform);
        return pointer;
    }

    // only creates the same pointer once => unique pointers
    // throws error if pointer is already allocated or pointer value is primitive
    static create<T>(id?:string|Uint8Array, value:CompatValue<T>|typeof NOT_EXISTING=NOT_EXISTING, sealed = false, origin?:Endpoint, persistant=false, anonymous = false, is_placeholder = false, allowed_access?:target_clause, timeout?:number):Pointer<T> {
        let p:Pointer<T>;

        // DatexValue: DatexPointer or DatexPointerProperty not valid as object, get the actual value instead
        value = <T|typeof NOT_EXISTING> Value.collapseValue(value,true,true)

        // is js primitive value
        if (Object(value) !== value && typeof value !== "symbol") {
            
            if (value instanceof TypedArray || value instanceof NodeBuffer) value = <T>Runtime.serializeValue(value); // convert to ArrayBuffer

            // id already in use
            if (typeof id != "symbol" && id && (p = <Pointer<T>> this.pointers.get(this.normalizePointerId(id)))) {
                if (p.is_js_primitive) {
                    if (value!=NOT_EXISTING) p.value = value; // update value of this pointer
                    if (origin) p.origin = origin; // override origin
                }
                else {
                    throw new PointerError("Cannot assign a native primitive value to a initialized non-primitive pointer");
                }
            }
            else {
                let pp:any;

                switch (typeof value) {
                    case "string": pp = TextRef; break;
                    case "number": pp = DecimalRef; break;
                    case "bigint": pp = IntegerRef; break;
                    case "boolean": pp = BooleanRef; break;
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
            if (value!=NOT_EXISTING) p.value = <any>value; // set value of this pointer, if not yet set
            if (origin) p.origin = origin; // override origin
            return p;
        }

        // create a completely new pointer
        else {
            let pp:any = Pointer;

            if (value instanceof Type) pp = TypeRef;
            else if (value instanceof URL) pp = URLRef;
            else if (value instanceof Endpoint) pp = EndpointRef;

            return new (<typeof Pointer>pp)<T>(id, <any>value, sealed, origin, persistant, anonymous, is_placeholder, allowed_access, timeout)
        }
    }

    public static normalizePointerId(id:string|Uint8Array):string {
        // correct size depending on pointer id type
        if (id instanceof Uint8Array) {
            if (id[0] == Pointer.POINTER_TYPE.STATIC) return buffer2hex(id,null,Pointer.STATIC_POINTER_SIZE, true) 
            else return buffer2hex(id,null,Pointer.MAX_POINTER_ID_SIZE, true)
        }
        else {
            return id // TODO also normalize string?
        }
    }


    /**
     *  Pointer Garbage collection
     *  handles no longer needed pointers
     */

    private static garbage_registry = new FinalizationRegistry<string>(pointer_name => {
        if (!Pointer.pointers.has(pointer_name)) return;
    
        // clean up after garbage collection:

        let pointer = Pointer.pointers.get(pointer_name);

        logger.info("garbage collected " + pointer.idString());

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

        pointer.#garbage_collected = true;
        pointer.#loaded = false;
    });


    // custom datex pointer array splice function
    private static arraySplice(start?: number, deleteCount?: number, ...items: any[]):any[] {
        // is clear?
        if (start == 0 && deleteCount == this.length && items.length == 0) {
            this[DX_PTR]?.handleClear();
            return [];
        }
        if (deleteCount == undefined) deleteCount = this.length; // default deleteCount: all
        if (deleteCount && deleteCount < 0) deleteCount = 0;
        return this[DX_PTR]?.handleSplice(start, deleteCount, items);
    }
    

    /** END STATIC */



    protected constructor(id?:Uint8Array|string, value:T=<any>NOT_EXISTING, sealed:boolean = false, origin?:Endpoint, persistant = false/*TODO handle persistant?*/, anonymous = false, is_placeholder = false, allowed_access?:target_clause, timeout?:number) {
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
            this.origin = <IdEndpoint> Target.get(this.#id_buffer.slice(1,13), null, this.#id_buffer.slice(13,21), null, BinaryCode.ENDPOINT);
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
        delete globalThis[this.idString()];

        // call remove listeners
        if (!this.is_anonymous) for (let l of Pointer.pointer_remove_listeners) l(this);
        // unsubscribe from pointer if remote origin
        if (!this.is_origin && this.origin) this.unsubscribeFromPointerUpdates();
    }
    

    #original_value: T extends object ? WeakRef<T> : void //  weak ref to original value (not proxyfied)
    #shadow_object: WeakRef<object>|T // object to make changes and get values from without triggering DATEX updates
    #type:Type // type of the value

    #loaded = false

    get value_initialized() {return this.#loaded}

    #is_placeholder = false
    #is_js_primitive = false;

    #is_persistent: boolean // indicates if this pointer can get garbage collected
    #is_anonymous: boolean // pointer should never be sent via datex as reference, always serialize the value
    
    #pointer_type:pointer_type // pointer type (full id, static, ...)

    // id as hex string and ArrayBuffer
    #id:string
    #id_buffer:Uint8Array
    #origin: Endpoint
    #is_origin = true;
    #subscribed: boolean

    //readonly:boolean = false; // can the value ever be changed?
    sealed:boolean = false; // can the value be changed from the client side? (otherwise, it can only be changed via DATEX calls)
    #scheduleder: UpdateScheduler = null  // has fixed update_interval

    #allowed_access: target_clause // who has access to this pointer?, undefined = all

    #garbage_collectable = false;
    #garbage_collected = false;

    #labels = new Set<string|number>();
   
    get garbage_collectable () {return this.#garbage_collectable} // indicates if pointer can be garbage collected
    get garbage_collected () {return this.#garbage_collected} // indicates if pointer can be garbage collected
    get allowed_access(){return this.#allowed_access}
    get is_placeholder(){return this.#is_placeholder}
    get id_buffer(){return this.#id_buffer}
    get is_origin(){return this.#is_origin}
    get is_js_primitive(){return this.#is_js_primitive} // true if js primitive (number, boolean, ...) or 'single instance' class (Type, Endpoint) that cannot be directly addressed by reference
    get is_anonymous(){return this.#is_anonymous}
    get origin(){return this.#origin}
    get is_persistant() { return this.#is_persistent;}
    get labels(){return this.#labels}
    get pointer_type(){return this.#pointer_type}


    set origin(origin:Endpoint){
        this.#origin = origin
        this.#is_origin = !!Runtime.endpoint?.equals(this.#origin);
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

    public async subscribeForPointerUpdates(override_endpoint?:Endpoint):Promise<Pointer> {
        if (this.#subscribed) {
            logger.info("already subscribed to " + this.idString());
            return;
        }
        

        const endpoint = override_endpoint ?? this.origin;

        logger.info("subscribing to " + this.idString() + ", origin = " + endpoint);

        try {
            let result = await Runtime.datexOut(['#sender <== ?', [this]], endpoint) 
            //console.log("result", result)
            this.#subscribed = true;
            let pointer_value = result;

            // // set function receiver
            // if (pointer_value instanceof Function) {
            //     pointer_value.setRemoteEndpoint(endpoint);
            // }
            this.origin = endpoint;

            if (!this.#loaded) return this.setValue(pointer_value); // set value
            else return this;
        }
        // probably not the right origin
        catch (e) {
            logger.error(`${e}`)
            // find origin and subscribe
            try {
                let origin:Endpoint = await Runtime.datexOut(['origin ?', [this]], endpoint) 
                if (origin instanceof Endpoint) return this.subscribeForPointerUpdates(origin);
                else throw new Error("Cannot find origin for pointer " + this);
            }  catch (e) {
                logger.error(`${e}`)
            }
        }
    
    }

    public unsubscribeFromPointerUpdates() {
        if (!this.#subscribed) return; // already unsubscribed
        let endpoint = this.origin;
        logger.info("unsubscribing from " + this + " ("+endpoint+")");
        Runtime.datexOut(['#sender </= ?', [this]], endpoint);
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
            try {this.#id_buffer = hex2buffer(id, Pointer.MAX_POINTER_ID_SIZE, true);}
            catch (e) {throw new SyntaxError('Invalid pointer id: $' + id.slice(0, 48));}
            this.#id = Pointer.normalizePointerId(id)
        }
        else if (id instanceof Uint8Array) {
            this.#id_buffer = id;
            this.#id = Pointer.normalizePointerId(id)
        }
        else this.#id = Pointer.normalizePointerId(id)

        // get pointer type
        this.#pointer_type = this.#id_buffer[0];

        // set global
        if (!this.is_anonymous) Object.defineProperty(globalThis, this.idString(), {get:()=>this.value, set:(value)=>this.value=value, configurable:true})

        // add to pointer list
        if (!this.is_anonymous) Pointer.pointers.set(this.#id, this); 
    }

    // set value, might return new pointer if placeholder pointer existed or converted to primitive pointer
    setValue<TT>(v:T extends typeof NOT_EXISTING ? TT : T):Pointer<T extends typeof NOT_EXISTING ? TT : T> {
        // primitive value and not yet initialized-> new pointer
        if (!this.value_initialized && (Object(v) !== v || v instanceof ArrayBuffer)) {
            Pointer.pointers.delete(this.id); // force remove previous non-primitive pointer (assume it has not yet been used)
            return <any>Pointer.create(this.id, v, this.sealed, this.origin, this.is_persistant, this.is_anonymous, false, this.allowed_access, this.datex_timeout)
        }
        //placeholder replacement
        if (Pointer.pointer_value_map.has(v)) {
            if (this.#loaded) {throw new PointerError("Cannot assign a new value to an already initialized pointer")}
            let existing_pointer = Pointer.pointer_value_map.get(v);
            existing_pointer.unPlaceholder(this.id) // no longer placeholder, this pointer gets 'overriden' by existing_pointer
            return existing_pointer;
        }
        else {
            this.value = <any>v;
            return <any>this;
        }
    }


    override set value(v:CompatValue<T>) {
        if (this.#loaded) this.updateValue(v);
        else this.initializeValue(v);
    }

    override get value():T {
        if (this.#garbage_collected) throw new PointerError("Pointer was garbage collected");
        else if (!this.#loaded) throw new PointerError("Cannot get value of uninitialized pointer")
        // return either the #value directly or deref if neeeded
        return super.value instanceof WeakRef ? super.value.deref() : super.value;
    }


    /**
     * returns a value that can be referenced in JS
     * if it has a primitive value, the pointer itself is returned
     */
    override get js_value():T extends object ? T : this {
        return <any> (this.is_js_primitive ? this : this.value)
    }

    /**
     * Sets the initial value of the pointer
     * @param v initial value
     */
    protected initializeValue(v:CompatValue<T>) {

        const val = Value.collapseValue(v,true,true);

        // Save reference to original
        this.#type = Type.ofValue(val);

        // init proxy value for non-JS-primitives value (also treat non-uix HTML Elements as primitives)
        if (Object(val) === val && !this.#type.is_js_pseudo_primitive && !(this.#type == Type.std.Object && globalThis.Element && val instanceof globalThis.Element)) {

            this.#original_value = this.#shadow_object = <any> new WeakRef(<any>val);

            // add reference to this DatexPointer to the value
            if (!this.is_anonymous) {
                try {val[DX_PTR] = this;
                } catch(e) {}
            }

            if (this.sealed) this.visible_children = new Set(Object.keys(val)); // get current keys and don't allow any other children
            else if (this.type.visible_children) this.visible_children = this.type.visible_children; // use visible_children from type

            // save original value in map to find the right pointer for this value in the future
            Pointer.pointer_value_map.set(val, this);
            // create proxy
            let value = this.addObjProxy((val instanceof UnresolvedValue) ? val[DX_VALUE] : val); 

            this.#loaded = true; // this.value exists (must be set to true before the super.value getter is called)

            if (val instanceof UnresolvedValue) {
                this.#shadow_object = new WeakRef(val[DX_VALUE]) // original value, update here
                val[DX_VALUE] = value; // override DX_VALUE with proxified value
                super.value = <any> val;
            } 
            else super.value = <any> value;


            // creates weakref & adds garbage collection listener
            this.updateGarbageCollection(); 

            // proxify children, if not anonymous
            if (this.type.proxify_children) this.objProxifyChildren();

            // save proxy + original value in map to find the right pointer for this value in the future
            Pointer.pointer_value_map.set(value, this);

            // pointer for value listeners?
            if (Pointer.pointer_for_value_created_listeners.has(val)) {
                for (let l of Pointer.pointer_for_value_created_listeners.get(val)) l(this);
            }

            // seal original value
            if (this.sealed) Object.seal(this.original_value);
        }

        // init value for JS-primitives value 
        else {
            this.#is_js_primitive = true;
            this.#loaded = true;
            super.value = val;  // this.value exists
        }
       
    
        this.afterFirstValueSet();
    }

    /**
     * Overrides the current value of the pointer (only if the value has the correct type)
     * @param v new value
     */
    protected updateValue(v:CompatValue<T>) {
        const val = Value.collapseValue(v,true,true);

        const newType = Type.ofValue(val);
        if (!Type.matchesType(newType, this.type)) throw new ValueError("Invalid value type for pointer: " + newType + " - must be " + this.type);

        // set primitive value, reference not required
        if (this.is_js_primitive) {
            super.value = val;
        }
        else {
            this.type.updateValue(this.value, val);
            this.triggerValueInitEvent(); // super.value setter is not call, trigger value INIT seperately
        }

        // propagate updates via datex
        if (this.origin && !this.is_origin) {
            if (!this.#exclude_origin_from_updates) this.handleDatexUpdate(null, '#0=?;? = #0', [this.value, this], this.origin, true)
        }
        else if (this.is_origin && this.subscribers.size) {
            logger.debug("forwarding update to subscribers ?", this.#update_endpoints);
            this.handleDatexUpdate(null, '#0=?;? = #0', [this.value, this], this.#update_endpoints, true)
        }

        // pointer value change listeners
        for (let l of Pointer.pointer_value_change_listeners) l(this);
    }

    protected afterFirstValueSet(){
        // custom timeout from type?
        if (this.type.timeout!=undefined && this.datex_timeout==undefined) this.datex_timeout = this.type.timeout
        // set global variable (direct reference does not allow garbage collector to remove the value)
        if (this.id && !this.is_anonymous) Object.defineProperty(globalThis, this.idString(), {get:()=>this.value, set:(value)=>this.value=value,configurable:true})
        setTimeout(()=>{for (let l of Pointer.pointer_add_listeners) l(this)},0);
        Object.freeze(this);
    }


    #transform_scope:Scope;
    get transform_scope() {return this.#transform_scope}


    /**
     * transform observed values to update pointer value (using a transform function or DATEX transform scope)
     * @param values values to be observed (should be same as internal_vars in scope)
     * @param transform DATEX Scope or JS function
     * @param persistent_datex_transform  JUST A WORKAROUND - if transform is a JS function, a DATEX Script can be provided to be stored as a transform method
     */
    protected async transformAsync(values:readonly CompatValue<any>[], transform:((...values:CompatValue<any>[])=>Promise<CompatValue<T>>)|Scope, persistent_datex_transform?:string) {
        
        const transformMethod = transform instanceof Function ? transform : ()=>transform.execute(Runtime.endpoint);

        if (transform instanceof Scope) this.#transform_scope = transform; // store transform scope
        else if (persistent_datex_transform) await this.setDatexTransform(persistent_datex_transform) // TODO: only workaround

        const initialValue = await (values.length==1 ? transformMethod(Value.collapseValue(values[0], true, true)) : transformMethod(...values.map(v=>Value.collapseValue(v, true, true)))); // transform current value
        if (initialValue === VOID) throw new ValueError("initial tranform value cannot be void");
        this.value = initialValue;
        
        // transform updates
        for (let value of values) {
            if (value instanceof Value) value.observe(async ()=>{
                const newValue = await (values.length==1 ? transformMethod(Value.collapseValue(values[0], true, true)) : transformMethod(...values.map(v=>Value.collapseValue(v, true, true)))); // update value
                if (newValue !== VOID) this.value = newValue;
            });
        }
    }

    protected transform(values:readonly CompatValue<any>[], transformMethod:((...values:CompatValue<any>[])=>CompatValue<T>), persistent_datex_transform?:string) {     
        const initialValue = values.length==1 ? transformMethod(Value.collapseValue(values[0], true, true)) : transformMethod(...values.map(v=>Value.collapseValue(v, true, true))); // transform current value
        if (initialValue === VOID) throw new ValueError("initial tranform value cannot be void");
        this.value = initialValue;
        
        if (persistent_datex_transform) this.setDatexTransform(persistent_datex_transform) // TODO: only workaround

        // transform updates
        for (let value of values) {
            if (value instanceof Value) value.observe(()=>{
                const newValue = values.length==1 ? transformMethod(Value.collapseValue(values[0], true, true)) : transformMethod(...values.map(v=>Value.collapseValue(v, true, true))); // update value
                if (newValue !== VOID) this.value = newValue;
            });
        }
    }

    protected observeForTransform() {
        // TODO:
    }


    // TODO: JUST A WORKAROUND - if transform is a JS function, a DATEX Script can be provided to be stored as a transform method
    async setDatexTransform(datex_transform?:string) {
        this.#transform_scope = (await Runtime.executeDatexLocally(datex_transform)).transform_scope;
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


    // only exists for non-js-primitive values
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

    public subscribers = new Disjunction<Endpoint>()

    public addSubscriber(subscriber: Endpoint) {
        if (this.subscribers.has(subscriber)) {
            logger.warn(subscriber.toString() + " re-subscribed to " + this.idString());
            //return;
        }
        this.subscribers.add(subscriber);
        if (this.subscribers.size == 1) this.updateGarbageCollection() // first subscriber
        if (this.streaming.length) setTimeout(()=>this.startStreamOutForEndpoint(subscriber), 1000); // TODO do without timeout?
    }

    public removeSubscriber(subscriber: Endpoint) {
        this.subscribers.delete(subscriber);
        if (this.subscribers.size == 0) this.updateGarbageCollection() // no subscribers left
    }
    


    // updates are from datex (external) and should not be distributed again or local update -> should be distributed to subscribers
    #update_endpoints = this.subscribers; // endpoint to update

    #exclude_origin_from_updates:boolean;
    public excludeEndpointFromUpdates(endpoint:Endpoint) {
        // TODO origin equals id also for remote endpoints!
        if (this.origin.equals(endpoint)) this.#exclude_origin_from_updates = true;
        else {
            this.#update_endpoints = new Disjunction(...this.subscribers);
            this.#update_endpoints.delete(endpoint);
        }
    }
    public enableUpdatesForAll() {
        this.#exclude_origin_from_updates = false;
        this.#update_endpoints = this.subscribers;
    }
    get update_endpoints() {
        return this.#update_endpoints;
    }


    // TODO merge with Datex.Runtime.runtime_actions.getKeys
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
        
        // special native function -> <Function> conversion;
        if (typeof child == "function" && !(child instanceof DatexFunction)) {
            child = DatexFunction.createFromJSFunction(child, this, name);
        }

        // create/get pointer, same permission filter
        return Pointer.proxifyValue(child, false, this.allowed_access, this.anonymous_properties?.has(name))
    }

    /** proxify the child elements of a proxified value */
    private objProxifyChildren() {

        const value = this.value;
        for (let name of this.visible_children ?? Object.keys(value)) {
            // only proxify non-primitive values
            const type = Type.ofValue(value[name])
            if (!type.is_primitive) {
                // custom timeout for remote proxy function
                if (value[name] instanceof DatexFunction && this.type?.children_timeouts?.has(name)) {
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

        // custom proxy
        let res = JSInterface.createProxy(obj, this, this.type);
        if (res != INVALID && res != NOT_EXISTING) return res; // proxy created successfully

        if (obj instanceof Stream || obj instanceof DatexFunction) { // no proxy needed?!
            return obj;
        }


        if (obj instanceof Quantity || obj instanceof Time || obj instanceof Type || obj instanceof URL  || obj instanceof Target) {
            return obj;
        }

        // special native function -> <Function> conversion
        if (typeof obj == "function" && !(obj instanceof DatexFunction)) return <T>DatexFunction.createFromJSFunction(<(...params: any[]) => any>obj);

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
        if (((obj instanceof DatexFunction) || typeof obj == "object") && obj != null) {

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
            throw new ValueError("Property '" + key + "' does not exist")
        }

        // JS number -> bigint conversion
        if (typeof value == "number" && this.type.getAllowedPropertyType(key).root_type == Type.std.integer) value = BigInt(value);

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
        else if (this.is_origin && this.#update_endpoints.size) {
            this.handleDatexUpdate(key, Runtime.PRECOMPILED_DXB.SET_PROPERTY, [this, key, value], this.#update_endpoints)
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

        if (this.shadow_object instanceof Array) index = this.shadow_object.push(value); // Array push
        // try set on custom pseudo class
        else {
            try {
                this.type.handleActionAdd(obj, value, true);
            } catch (e) {
                 throw new ValueError("Cannot add values to this value");
            }
        }
        

        // propagate updates via datex
        if (this.origin && !this.is_origin) {
            if (!this.#exclude_origin_from_updates) this.handleDatexUpdate(null, '? += ?', [this, value], this.origin)
        }
        else if (this.is_origin && this.#update_endpoints.size) {
            this.handleDatexUpdate(null, '? += ?', [this, value], this.#update_endpoints)
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
        else if (this.is_origin && this.#update_endpoints.size) {
            logger.info("streaming to subscribers " + this.#update_endpoints);
            this.handleDatexUpdate(null, '? << ?'/*DatexRuntime.PRECOMPILED_DXB.STREAM*/, [this, obj], this.#update_endpoints)
        }
    }

    // TODO better way than streaming individually to every new subscriber?
    startStreamOutForEndpoint(endpoint:Endpoint) {
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
        else if (this.is_origin && this.#update_endpoints.size) {
            this.handleDatexUpdate(null, Runtime.PRECOMPILED_DXB.CLEAR_WILDCARD, [this], this.#update_endpoints)
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
        else if (this.is_origin && this.#update_endpoints.size) {
            if (!replace?.length) this.handleDatexUpdate(null, '#0 = ?0; #1 = count #0;#0.(?1..?2) = void;#0.(?1..#1) = #0.(?3..#1);', [this, start, end, start+size], this.#update_endpoints) // no insert
            else  this.handleDatexUpdate(null, '#0=?0;#0.(?4..?1) = void; #0.(?2..((count #0) + ?3)) = #0.(?4..(count #0));#0.(?4..?5) = ?6;', [this, end, start-size+replace_length, replace_length, start, start+replace_length, replace], this.#update_endpoints) // insert
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
            throw new ValueError("Property '" + key + "' does not exist")
        }

        // inform observers before delete
        this.callObservers(this.getProperty(key), key, Value.UPDATE_TYPE.BEFORE_DELETE)

        let res = JSInterface.handleDeletePropertySilently(obj, key, this, this.type);
        if (res == INVALID || res == NOT_EXISTING)  delete this.shadow_object[key]; // normal object

        // propagate updates via datex
        
        if ((res == INVALID || res == NOT_EXISTING) && this.shadow_object instanceof Array) key = BigInt(key); // change to <Int> for DATEX if <Array>

        if (this.origin && !this.is_origin) {
            if (!this.#exclude_origin_from_updates) this.handleDatexUpdate(null, '?.? = void', [this, key], this.origin)
        }
        else if (this.is_origin && this.#update_endpoints.size) {
            this.handleDatexUpdate(null, '?.? = void', [this, key], this.#update_endpoints)
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

   
        // try set on custom pseudo class
        try {
            this.type.handleActionSubtract(obj, value, true);
        } catch (e) {
            throw new ValueError("Cannot subtract values from this value");
        }
        

        // propagate updates via datex
        if (this.origin && !this.is_origin) {
            if (!this.#exclude_origin_from_updates) this.handleDatexUpdate(null, '? -= ?', [this, value], this.origin)
        }
        else if (this.is_origin && this.#update_endpoints.size) {
            logger.info("forwarding delete to subscribers " + this.#update_endpoints);
            this.handleDatexUpdate(null, '? -= ?', [this, value], this.#update_endpoints)
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
    handleDatexUpdate(identifier:string, datex:string|PrecompiledDXB, data:any[], receiver:endpoints, collapse_first_inserted = false){

        // let schedulter handle updates (cannot throw errors)
        if (this.#scheduleder) {
            this.#scheduleder.addUpdate(this, identifier, datex, data, receiver, collapse_first_inserted);
        }

        // directly send update
        else {
            try {
                Runtime.datexOut([datex, data, {collapse_first_inserted, type:ProtocolDataType.UPDATE}], receiver, undefined, false, undefined, undefined, false, undefined, this.datex_timeout);
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


    idString(){
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
        REMOVE,
        BEFORE_DELETE
    }
}

globalThis["p"] = Pointer.pointers;
globalThis["DatexPointer"] = Pointer;


// js primitives
export class TextRef<T extends string = string> extends Pointer<T> {}
export class IntegerRef extends Pointer<bigint> {}
export class DecimalRef extends Pointer<number> {}
export class BooleanRef extends Pointer<boolean> {}

// pseudo primitives
export class TypeRef extends Pointer<Type> {}
export class EndpointRef extends Pointer<Endpoint> {}
export class URLRef extends Pointer<URL> {}




/** proxy function (for remote calls) */

export function getProxyFunction(method_name:string, params:{filter:target_clause, dynamic_filter?: target_clause, sign?:boolean, scope_name?:string, timeout?:number}):(...args:any[])=>Promise<any> {
    return function(...args:any[]) {
        let filter = params.dynamic_filter ? new Conjunction(params.filter, params.dynamic_filter) : params.filter;

        let params_proto = Object.getPrototypeOf(params);
        if (params_proto!==Object.prototype) params_proto.dynamic_filter = undefined; // reset, no longer needed for call

        let compile_info:compile_info = [`#public.${params.scope_name}.${method_name} ?`, [new Tuple(args)], {to:filter, sign:params.sign}];
        return Runtime.datexOut(compile_info, filter, undefined, true, undefined, undefined, false, undefined, params.timeout);
    }
}


export function getProxyStaticValue(name:string, params:{filter?:target_clause, dynamic_filter?: target_clause, sign?:boolean, scope_name?:string, timeout?:number}):(...args:any[])=>Promise<any> {
    return function() {
        let filter = params.dynamic_filter ? new Conjunction(params.filter, params.dynamic_filter) : params.filter;

        let params_proto = Object.getPrototypeOf(params);
        if (params_proto!==Object.prototype) params_proto.dynamic_filter = undefined; // reset, no longer needed for call

        let compile_info:compile_info = [`#public.${params.scope_name}.${name}`, [], {to:filter, sign:params.sign}];
        return Runtime.datexOut(compile_info, filter, undefined, true, undefined, undefined, false, undefined, params.timeout);
    }
}
