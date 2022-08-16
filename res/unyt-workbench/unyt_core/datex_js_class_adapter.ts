/**
 ╔══════════════════════════════════════════════════════════════════════════════════════╗
 ║  Datex JS Class Adapter (@sync classes)                                              ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  Unyt core library                                                                   ║
 ║  Visit docs.unyt.org/unyt_js for more information                                    ║
 ╠═════════════════════════════════════════╦════════════════════════════════════════════╣
 ║  © 2022  Benedikt Strehle               ║                                            ║
 ╚═════════════════════════════════════════╩════════════════════════════════════════════╝
 */

/** Imports **/

import "./lib/reflect-metadata/Reflect.js";
import {Datex} from "./datex_runtime.js";

import Logger from "./logger.js";
const logger = new Logger("datex", true);


const CONSTRUCT_OPTIONS = Symbol("CONSTRUCT_OPTIONS");

// create metadata symbol
if (!Symbol['metadata']) Symbol['metadata'] = Symbol('metadata');
export const METADATA:symbol = Symbol['metadata'];

/**
 * List of decorators
 *    
 *      @meta: mark method parameter that should contain meta data about the datex request / declare index of 'meta' parameter in method
 *      @docs: add docs to a static scope class / pseudo class
 *      
 *      @allow: define which endpoints have access to a class / method / property
 *      @to: define which on endpoints a method should be called / from which endpoint a property should be fetched
 * 
 *      @no_result: don't wait for result
 * 
 * Static:
 *      @scope(name?:string): declare a class as a static scope, or add a static scope to a static property/method
 *      @root_extension: root extends this static scope in every executed DATEX scope (all static scope members become variables)
 *      @root_variable: static scope becomes a root variable in every executed DATEX scope (scope name is variable name)
 *      
 *      @remote: get a variable from a remote static scope or call a method in a remote static scope
 *      @expose: make a method/variable in a static scope available to others
 * 
 * Sync:
 *      @sync: make a class syncable, or sync a property/method
 *      @sealed: make a sync class sealed, or seal individual properties/methods    
 *      @anonymous: force prevent creating a pointer reference for an object, always transmit serialized
 * 
 *      @constructor: called after constructor, if instance is newly generated
 *      @generator: called after @constructor, if instance is newly generated
 *      @replicator: called after @constructor, if instance is a clone
 *      @destructor: called when pointer is garbage collected, or triggers garbage collection
 */


// decorator types
export type context_kind = 'class'|'method'|'getter'|'setter'|'field'|'auto-accessor';
export type context_name = string|symbol|undefined;
export type context_meta_setter = (key:symbol, value:any) => void
export type context_meta_getter = (key:symbol ) => any


// handles all decorators
export class Decorators {

    static IS_EXPOSED    = Symbol("IS_EXPOSED");
    static IS_REMOTE     = Symbol("IS_REMOTE");

    static IS_EACH       = Symbol("IS_EACH");
    static IS_SYNC       = Symbol("IS_SYNC");
    static IS_ANONYMOUS  = Symbol("IS_ANONYMOUS");
    static IS_SEALED     = Symbol("IS_SEALED");
    static ANONYMIZE     = Symbol("ANONYMIZE");

    static PROPERTY      = Symbol("PROPERTY");
    static SERIALIZE     = Symbol("SERIALIZE");

    static ALLOW_FILTER  = Symbol("ALLOW_FILTER");
    static SEND_FILTER   = Symbol("SEND_FILTER");

    static SCOPE_NAME    = Symbol("SCOPE_NAME");

    static ROOT_EXTENSION = Symbol("ROOT_EXTENSION");
    static ROOT_VARIABLE = Symbol("ROOT_VARIABLE");

    static DOCS          = Symbol("DOCS");

    static META_INDEX    = Symbol("META_INDEX");

    static SIGN          = Symbol("SIGN");
    static ENCRYPT       = Symbol("ENCRYPT");
    static NO_RESULT     = Symbol("NO_RESULT");
    static TIMEOUT       = Symbol("TIMEOUT");
    static OBSERVER      = Symbol("OBSERVER");
    static SCHEDULER     = Symbol("SCHEDULER");

    static FORCE_TYPE    = Symbol("FORCE_TYPE");
    static FROM_TYPE     = Symbol("FROM_TYPE");


    static CONSTRUCTOR   = Symbol("CONSTRUCTOR");
    static REPLICATOR    = Symbol("REPLICATOR");
    static DESTRUCTOR    = Symbol("DESTRUCTOR");

    /** @expose(allow?:filter): make a method in a static scope available to be called by others */
    static expose(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:(Datex.Addresses.Filter|Datex.Addresses.Target|Datex.Addresses.Not|string)[] = []) {
        
        // invalid decorator call
        if (kind != "method" && kind != "field") logger.error("Cannot use @expose for value '" + name.toString() +"'");
        else if (!is_static) logger.error("Cannot use @expose for non-static field '" + name.toString() +"'");

        // handle decorator
        else {
            setMetadata(Decorators.IS_EXPOSED, true)
            if (params.length) Decorators.addMetaFilter(
                (params.length == 1 && typeof params[0] == "string") ? Datex.Addresses.Filter.fromString(params[0]) : Datex.Addresses.Filter.OR(...params), 
                setMetadata, getMetadata, Decorators.ALLOW_FILTER
            )
        }
    }

    /** @scope(name?:string): declare a class as a static scope, or add a static scope to a static property/method */
    static scope(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:[string?] = []) {
        
        // invalid decorator call
        if (!is_static && kind != "class") logger.error("Cannot use @scope for non-static field '" + name.toString() +"'");

        // handle decorator
        else {
            setMetadata(Decorators.SCOPE_NAME, params[0] ?? value?.name)

            // class @scope
            if (kind == "class") staticScopeClass(value);

            // @scope for static field -> @remote + @expose
            else {
                setMetadata(Decorators.IS_REMOTE, true)
                setMetadata(Decorators.IS_EXPOSED, true)
            }
        }
    }

    /** @root_extension: root extends this static scope in every executed DATEX scope (all static scope members become variables) */
    static root_extension(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:undefined) {
        
        // invalid decorator call
        if (!is_static && kind != "class") logger.error("Cannot use @root_extension for non-static field '" + name.toString() +"'");

        // handle decorator
        else {
            setMetadata(Decorators.ROOT_EXTENSION, true)

            if (kind == "class") staticScopeClass(value);
        }
    }

    /** @root_variable: static scope becomes a root variable in every executed DATEX scope (scope name is variable name) */
    static root_variable(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:undefined) {
    
        // invalid decorator call
        if (!is_static && kind != "class") logger.error("Cannot use @root_variable for non-static field '" + name.toString() +"'");

        // handle decorator
        else {
            setMetadata(Decorators.ROOT_VARIABLE, true)

            if (kind == "class") staticScopeClass(value);
        }
    }

    /** @remote(from?:filter): get a variable from a static scope or call a function */
    static remote(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:(Datex.Addresses.Filter|Datex.Addresses.Target|Datex.Addresses.Not|string)[] = []) {
        
        // invalid decorator call
        if (kind == "class") logger.error("Cannot use @remote for a class");
        else if (!is_static) logger.error("Cannot use @remote for non-static field '" + name.toString() +"'");

        // handle decorator
        else {
            setMetadata(Decorators.IS_REMOTE, true)
            if (params.length) Decorators.addMetaFilter(
                (params.length == 1 && typeof params[0] == "string") ? Datex.Addresses.Filter.fromString(params[0]) : Datex.Addresses.Filter.OR(...params), 
                setMetadata, getMetadata, Decorators.SEND_FILTER
            )
        }
    }


    /** @docs(content:string): add docs to a static scope class / pseudo class */
    static docs(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:[string?] = []) {
    
        // invalid decorator call
        if (kind != "class") logger.error("@docs can only be used for classes");

        // handle decorator
        else {
            setMetadata(Decorators.DOCS, params[0])
        }
    }

    /** @meta(index?:number): declare index of meta parameter (before method), or inline parameter decorator */
    static meta(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:[string?] = []) {

        if (kind == "method") {
            setMetadata(Decorators.META_INDEX, params[0] ?? -1);
        } 

        // invalid decorator call
        else logger.error("@docs can only be used for methods");
    }
    

    /** @sign(sign?:boolean): sign outgoing DATEX requests (default:true) */
    static sign(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:[boolean?] = []) {
        setMetadata(Decorators.SIGN, params[0])
    }

    /** @encrypt(encrpyt?:boolean): encrypt outgoing DATEX requests (default:false) */
    static encrypt(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:[boolean?] = []) {
        setMetadata(Decorators.ENCRYPT, params[0])
    }

    /** @no_result: do not wait for the result */
    static no_result(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:undefined) {
        setMetadata(Decorators.NO_RESULT, true)
    }

    /** @timeout(msecs?:number): DATEX request timeout */
    static timeout(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:[number?] = []) {
        setMetadata(Decorators.TIMEOUT, params[0])
    }

    /** @allow(allow:filter): Allowed endpoints for class/method/field */
    static allow(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:(Datex.Addresses.Filter|Datex.Addresses.Target|Datex.Addresses.Not|string)[] = []) {
        Decorators.addMetaFilter(
            (params.length == 1 && typeof params[0] == "string") ? Datex.Addresses.Filter.fromString(params[0]) : Datex.Addresses.Filter.OR(...params), 
            setMetadata, getMetadata, Decorators.ALLOW_FILTER
        )
    }

    /** @to(to:filter): Send DATEX requests to endpoints */
    static to(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:(Datex.Addresses.Filter|Datex.Addresses.Target|Datex.Addresses.Not|string)[] = []) {
        Decorators.addMetaFilter(
            (params.length == 1 && typeof params[0] == "string") ? Datex.Addresses.Filter.fromString(params[0]) : Datex.Addresses.Filter.OR(...params), 
            setMetadata, getMetadata, Decorators.SEND_FILTER
        )
    }

    /** @each: sent to all subscribers */
    static each(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:undefined) {
        
        // invalid decorator call
        if (is_static) logger.error("Cannot use @each for static field '" + name.toString() +"'");

        // handle decorator
        else {
            setMetadata(Decorators.IS_EACH, true)
        }
    }


    /** @property: add a field as a template property */
    static property(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:[string|number]) {
        if (is_static) logger.error("@property decorator cannot be used for static fields");
        else if (kind != "field" && kind != "getter" && kind != "setter" && kind != "method") logger.error("Invalid use of @property decorator");

        else {
            setMetadata(Decorators.PROPERTY, params?.[0] ?? name)
        }

    }


    /** @serialize: custom serializer for a template property */
    static serialize(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:[Function]) {
        if (is_static) logger.error("@serialize decorator cannot be used for static fields");
        else if (kind != "field" && kind != "getter" && kind != "setter" && kind != "method") logger.error("Invalid use of @serialize decorator");
        else if (!params?.[0]) logger.error("Missing serializer method on @serialize decorator");

        else {
            setMetadata(Decorators.SERIALIZE, params[0])
        }

    }


    /** @template: create DATEX Type template for a class */
    static template(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:[(string|Datex.Type)?] = []) {
        if (kind != "class") logger.error("@template can only be used as a class decorator");

        else {
            initPropertyTypeAssigner();

            const original_class = value;
            let type: Datex.Type;

            // get template type
            if (typeof params[0] == "string") type = Datex.Type.get(params[0].replace(/^\</,'').replace(/\>$/,''))
            else if (params[0] instanceof Datex.Type) type = params[0];
            else if (original_class[METADATA]?.[Decorators.FORCE_TYPE]?.constructor) type = original_class[METADATA]?.[Decorators.FORCE_TYPE]?.constructor
            else type = Datex.Type.get("ext", original_class.name);

            // return new templated class
            return createTemplateClass(original_class, type);
        }

    }

    /** @sync: sync class/property */
    static sync(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:[(string|Datex.Type)?] = []) {
        
        // invalid decorator call
        if (is_static) logger.error("Cannot use @sync for static field '" + name.toString() +"'");
        if (is_static) logger.error("Cannot use @sync for static field '" + name.toString() +"'");

        // handle decorator
        else {
            setMetadata(Decorators.IS_SYNC, true)

            // is auto sync class -> create class proxy (like in template)
            if (kind == "class") {
                initPropertyTypeAssigner();

                const original_class = value;
                let type: Datex.Type;
    
                // get template type
                if (typeof params[0] == "string") type = Datex.Type.get(params[0].replace(/^\</,'').replace(/\>$/,''))
                else if (params[0] instanceof Datex.Type) type = params[0];
                else if (original_class[METADATA]?.[Decorators.FORCE_TYPE]?.constructor) type = original_class[METADATA]?.[Decorators.FORCE_TYPE]?.constructor
                else type = Datex.Type.get("ext", original_class.name);
    
                // return new templated class
                return createTemplateClass(original_class, type);
            }
          
        }
    }

    /** @sealed: sealed class/property */
    static sealed(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:undefined) {
        
        // invalid decorator call
        if (is_static) logger.error("Cannot use @sealed for static field '" + name.toString() +"'");

        // handle decorator
        else {
            setMetadata(Decorators.IS_SEALED, true)
        }
    }

    /** @anonymous: anonymous class/property */
    static anonymous(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:undefined) {
        
        // invalid decorator call
        if (is_static) logger.error("Cannot use @anonymous for static field '" + name.toString() +"'");

        // handle decorator
        else {
            setMetadata(Decorators.IS_ANONYMOUS, true)
        }
    }


    /** @observe(handler:Function): listen to value changes */
    static observe(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:[Function?] = []) {
        setMetadata(Decorators.OBSERVER, params[0])
    }



    /** @anonymize: serialize return values (no pointers), only the first layer */
    static anonymize(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:undefined) {
        
        // invalid decorator call
        if (kind == "class") logger.error("Cannot use @anonymize for classes");

        // handle decorator
        else {
            setMetadata(Decorators.ANONYMIZE, true)
        }
    }


    /** @type(type:string|DatexType)/ (namespace:name)
     * sync class with type */
    static type(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:[(string|Datex.Type)?] = []) {

        // handle decorator
        if (typeof params[0] == "string") setMetadata(Decorators.FORCE_TYPE, Datex.Type.get(params[0].replace(/^\</,'').replace(/\>$/,'')))
        else if (params[0] instanceof Datex.Type) setMetadata(Decorators.FORCE_TYPE, params[0])
    }

    /** @from(type:string|DatexType): sync class from type */
    static from(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:[(string|Datex.Type)?] = []) {
        // invalid decorator call
        if (kind !== "class") logger.error("Can use @from only for classes");

        // handle decorator
        else {
            setMetadata(Decorators.FROM_TYPE, params[0])
        }
    }

    /** @update(interval:number|scheduler:DatexUpdateScheduler): set update interval / scheduler */
    static update(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:[(number|Datex.UpdateScheduler)?] = []) {
        
        if (params[0] instanceof Datex.UpdateScheduler) setMetadata(Decorators.SCHEDULER, params[0])
        else setMetadata(Decorators.SCHEDULER, new Datex.UpdateScheduler(params[0]));
    }



    /** @constructor: called after constructor if newly generateds */
    static ["constructor"](value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:undefined) {
        
        // invalid decorator call
        if (is_static) logger.error("Cannot use @constructor for static field '" + name.toString() +"'");
        else if (kind != "method") logger.error("Cannot only use @constructor for methods");

        // handle decorator
        else {
            setMetadata(Decorators.CONSTRUCTOR, true)
        }
    }


    
    /** @replicator: called after constructor if cloned */
    static replicator(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:undefined) {
    
        // invalid decorator call
        if (is_static) logger.error("Cannot use @replicator for static field '" + name.toString() +"'");
        else if (kind != "method") logger.error("Cannot only use @replicator for methods");

        // handle decorator
        else {
            setMetadata(Decorators.REPLICATOR, true)
        }
    }
    
    /** @destructor: called after constructor if cloned */
    static destructor(value:any, name:context_name, kind:context_kind, is_static:boolean, is_private:boolean, setMetadata:context_meta_setter, getMetadata:context_meta_getter, params:undefined) {

        // invalid decorator call
        if (is_static) logger.error("Cannot use @destructor for static field '" + name.toString() +"'");
        else if (kind != "method") logger.error("Cannot only use @destructor for methods");

        // handle decorator
        else {
            setMetadata(Decorators.DESTRUCTOR, true)
        }
    }


    // handle ALLOW_FILTER for classes, methods and fields
    // adds filter
    private static addMetaFilter(new_filter:Datex.filter, setMetadata:context_meta_setter, getMetadata:context_meta_getter, filter_symbol:symbol){
        // create filter if not existing
        let filter:Datex.Addresses.Filter = getMetadata(filter_symbol)
        if (!filter) {filter = new Datex.Addresses.Filter(); setMetadata(filter_symbol, filter)}
        
        filter.appendFilter(new_filter);
    }
}

globalThis.Decorators = Decorators;

const initialized_static_scope_classes = new Map<Function,Datex.StaticScope>();

function staticScopeClass(original_class:Function) {

    // already initialized
    if (initialized_static_scope_classes.has(original_class)) {
        // is root variable static scope? -> add scope as root variable after scope was initialized with @scope
        if (original_class[METADATA]?.[Decorators.ROOT_VARIABLE]?.constructor) {
            const static_scope = initialized_static_scope_classes.get(original_class);
            Datex.Runtime.addRootVariable(static_scope.name, static_scope);
        }
        // is root extension static scope? -> add scope as root extension after scope was initialized with @scope
        if (original_class[METADATA]?.[Decorators.ROOT_EXTENSION]?.constructor) {
            const static_scope = initialized_static_scope_classes.get(original_class);
            Datex.Runtime.addRootExtension(static_scope);
        }
        return;
    }
    let static_properties = Object.getOwnPropertyNames(original_class)

    const metadata = original_class[METADATA];
    if (!metadata) return;

    let dynamic_filter = new Datex.Addresses.Filter(); // can be updated

    const static_scope_name = typeof metadata[Decorators.SCOPE_NAME]?.constructor == 'string' ? metadata[Decorators.SCOPE_NAME]?.constructor : original_class.name;
    let static_scope:Datex.StaticScope;

    // add builtin methods
    
    Object.defineProperty(original_class, 'to', {
        value: function(...filters:Datex.filter[]){
            dynamic_filter.set(...filters);
            return this;
        },
        configurable: false,
        enumerable: false,
        writable: false
    });
    /*
    target.list = async function (...filters:ft[]|[Datex.filter]) {
        if (!DATEX_CLASS_ENDPOINTS.has(this)) return false;
        DATEX_CLASS_ENDPOINTS.get(this).dynamic_filter.appenddatex_filter(...filters)
        return (await DATEX_CLASS_ENDPOINTS.get(this).__sendHandler("::list"))?.data || new Set();
    }
    target.on_result = function(call: (data:datex_res, meta:{station_id:number, station_bundle:number[]})=>any){
        if (!DATEX_CLASS_ENDPOINTS.has(this)) return this;
        DATEX_CLASS_ENDPOINTS.get(this).current_dynamic_callback = call;
        return this;
    }
    target.no_result = function() {
        if (!DATEX_CLASS_ENDPOINTS.has(this)) return this;
        DATEX_CLASS_ENDPOINTS.get(this).current_no_result = true;
        return this;
    }

    target.ping = async function(...filters:ft[]|[Datex.filter]){
        if (!DATEX_CLASS_ENDPOINTS.has(this)) return false;
        return new Promise(resolve=>{
            DATEX_CLASS_ENDPOINTS.get(this).dynamic_filter.appenddatex_filter(...filters)
            let pings = {}
            let start_time = new Date().getTime();
            DATEX_CLASS_ENDPOINTS.get(this).current_dynamic_callback = (data, meta) => {
                pings[meta.station_id] = (new Date().getTime() - start_time) + "ms";
                if (Object.keys(pings).length == meta.station_bundle.length) resolve(pings);
            }
            setTimeout(()=>resolve(pings), 10000);
            DATEX_CLASS_ENDPOINTS.get(this).__sendHandler("::ping")
        })
    }

    target.self = function(){
        if (!DATEX_CLASS_ENDPOINTS.has(this)) return false;
        DATEX_CLASS_ENDPOINTS.get(this).dynamic_self = true;
    }
    target.encrypt =  function(encrypt=true){
        if(DATEX_CLASS_ENDPOINTS.has(this)) DATEX_CLASS_ENDPOINTS.get(this).current_encrypt = encrypt;
        return this;
    }
    */
    const class_send_filter = metadata[Decorators.SEND_FILTER]?.constructor
    const class_allow_filter = metadata[Decorators.ALLOW_FILTER]?.constructor
    
    for (let name of static_properties) {

        const current_value = original_class[name];
        
        // expose
        const exposed_public = metadata[Decorators.IS_EXPOSED]?.public;
        const exposed_private = metadata[Decorators.IS_EXPOSED]?.private;
        if ((exposed_public?.hasOwnProperty(name) && exposed_public[name]) || (exposed_private?.hasOwnProperty(name) && exposed_private[name])) {
            
            if (!static_scope) static_scope = Datex.StaticScope.get(static_scope_name)

            // function
            if (typeof current_value == "function")  {
                // set allowed endpoints for this method
                //static_scope.setAllowedEndpointsForProperty(name, this.method_a_filters.get(name))

                let meta_index = getMetaParamIndex(original_class, name);
                let params = getMethodParams(original_class, name, meta_index);
        
                let dx_function = Datex.Pointer.proxifyValue(
                    new Datex.Function(current_value, params, null, meta_index, original_class, null), true, undefined, false, true) ; // generate <Function>

                static_scope.setVariable(name, dx_function); // add <Function> to static scope
            }

            // field
            else {
                // set static value (datexified)
                let setProxifiedValue = (val:any) => static_scope.setVariable(name, Datex.Pointer.proxifyValue(val, true, undefined, false, true));
                setProxifiedValue(current_value);

                /*** handle new value assignments to this property: **/

                // similar to addObjProxy in DatexRuntime / DatexPointer
                const property_descriptor = Object.getOwnPropertyDescriptor(original_class, name);

                // add original getters/setters to static_scope if they exist
                if (property_descriptor?.set || property_descriptor?.get) {
                    Object.defineProperty(static_scope, name, {
                        set: val => { 
                            property_descriptor.set?.call(original_class,val);
                        },
                        get: () => { 
                            return property_descriptor.get?.call(original_class);
                        }
                    });
                }

                // new getter + setter
                Object.defineProperty(original_class, name, {
                    get:()=>static_scope.getVariable(name),
                    set:(val)=>setProxifiedValue(val)
                });
            }
        }

        // remote
        const remote_public = metadata[Decorators.IS_REMOTE]?.public;
        const remote_private = metadata[Decorators.IS_REMOTE]?.private;
        const timeout_public = metadata[Decorators.TIMEOUT]?.public;
        const timeout_private = metadata[Decorators.TIMEOUT]?.private;

        if ((remote_public?.hasOwnProperty(name) && remote_public[name]) || (remote_private?.hasOwnProperty(name) && remote_private[name])) {
            
            const timeout = timeout_public?.[name]??timeout_private?.[name];

            // function
            if (typeof current_value == "function")  {       
                let options = {filter:class_send_filter, sign:true, scope_name:static_scope_name, dynamic_filter:dynamic_filter, timeout};
                let proxy_fn = Datex.getProxyFunction(name, options);
                Object.defineProperty(original_class, name, {value:proxy_fn})
            }

            // field
            else {
                let options = {filter:class_send_filter, sign:true, scope_name:static_scope_name, dynamic_filter:dynamic_filter, timeout};
                let proxy_fn = Datex.getProxyStaticValue(name, options);
                Object.defineProperty(original_class, name, {
                    get: proxy_fn // set proxy function for getting static value
                });
            }
        }

    }

    // is root extension static scope?
    if (static_scope && metadata[Decorators.ROOT_EXTENSION]?.constructor ) {
        Datex.Runtime.addRootExtension(static_scope);
    }

    // is root variable static scope?
    if (static_scope && metadata[Decorators.ROOT_VARIABLE]?.constructor) {
        Datex.Runtime.addRootVariable(static_scope.name, static_scope);
    }

    // each methods
    
    //const each_private = original_class.prototype[METADATA]?.[Decorators.IS_EACH]?.private;
    const each_public  = original_class.prototype[METADATA]?.[Decorators.IS_EACH]?.public;

    let each_scope: any;
    
    for (let [name, is_each] of Object.entries(each_public??{})) {
        if (!is_each) continue;

        if (!static_scope) static_scope = Datex.StaticScope.get(static_scope_name)

        // add _e to current static scope
        if (!each_scope) {
            each_scope = {};
            static_scope.setVariable("_e", each_scope); // add <Function> to static scope
        }

        let method:Function = original_class.prototype[name];
        let type = Datex.Type.getClassDatexType(original_class);

        if (typeof method != "function") throw new Datex.Error("@each can only be used with functions")
 


        /****** expose _e */
        let meta_index = getMetaParamIndex(original_class.prototype, name);
        if (typeof meta_index == "number") meta_index ++; // shift meta_index (insert 'this' before)
        let params = getMethodParams(original_class.prototype, name, meta_index);
        
        let proxy_method = function(_this:any, ...args:any[]) {
            if (!(_this instanceof original_class)) {
                console.warn(_this, args);
                throw new Datex.ValueError("Invalid argument 'this': type should be " + type)
            }
            return method.call(_this, ...args)
        };
        // add '<type> this' as first argument
        //params?.unshift([type, "this"])

        let dx_function = Datex.Pointer.proxifyValue(
            new Datex.Function(proxy_method, params, null, meta_index, original_class, null), true, undefined, false, true) ; // generate <Function>

        each_scope[name] = dx_function // add <Function> to static scope

    }


    // finally seal the static scope
    if (static_scope) {
        Datex.DatexObject.seal(static_scope);
        initialized_static_scope_classes.set(original_class, static_scope);
    }
}



const templated_classes = new Map<Function, Function>() // original class, templated class

export function createTemplateClass(original_class:{ new(...args: any[]): any; }, type:Datex.Type, sync = true){

    if (templated_classes.has(original_class)) return templated_classes.get(original_class);

    original_class[Datex.DX_TYPE] = type;

    // set JS interface
    type.setJSInterface({
        class: original_class,
        proxify_children: true, // proxify children per default
        is_normal_object: true, // handle like a normal object
    });

    // set constructor, replicator, destructor
    const constructor_name = Object.keys(original_class.prototype[METADATA]?.[Decorators.CONSTRUCTOR]?.public??{})[0]
    const replicator_name = Object.keys(original_class.prototype[METADATA]?.[Decorators.REPLICATOR]?.public??{})[0]
    const destructor_name = Object.keys(original_class.prototype[METADATA]?.[Decorators.DESTRUCTOR]?.public??{})[0]

    if (constructor_name) type.setConstructor(original_class.prototype[constructor_name]);
    if (replicator_name) type.setReplicator(original_class.prototype[replicator_name]);
    if (destructor_name) type.setDestructor(original_class.prototype[destructor_name]);

    // set template
    const property_types = original_class.prototype[METADATA]?.[Decorators.FORCE_TYPE]?.public;
    const allow_filters = original_class.prototype[METADATA]?.[Decorators.ALLOW_FILTER]?.public;

    const template = {};
    template[Datex.DX_PERMISSIONS] = {}

    // extend prototype template?
    let prototype = original_class;
    // iterate up until Object.protoype reached
    while ((prototype = Object.getPrototypeOf(prototype)) != Object.prototype) {
        if ((prototype[Datex.DX_TYPE])?.template) {
            Datex.DatexObject.extend(template, prototype[Datex.DX_TYPE].template);
            break;
        }
    }

    // iterate over all properties TODO different dx_name?
    for (let [name, dx_name] of Object.entries(original_class.prototype[METADATA]?.[Decorators.PROPERTY]?.public??{})) {
        template[name] = property_types?.[name] ?? Datex.Type.std.Any; // add type
        if (allow_filters?.[name]) template[Datex.DX_PERMISSIONS][name] = allow_filters[name]; // add filter
    }

    type.setTemplate(template)


    // has static scope methods?
    staticScopeClass(original_class);

    // create shadow class extending the actual class
    const sync_auto_cast_class = proxyClass(original_class, type, original_class[METADATA]?.[Decorators.IS_SYNC]?.constructor ?? sync)
    
    // only for debugging / dev console TODO remove
    globalThis[sync_auto_cast_class.name] = sync_auto_cast_class;

    templated_classes.set(original_class, sync_auto_cast_class);

    return sync_auto_cast_class;
}

// TODO each
// if (is_each) {

//     // call _e 

//     const static_scope_name = original_class[METADATA]?.[Decorators.SCOPE_NAME]?.constructor ?? original_class.name
//     let filter:DatexFilter; // contains all endpoints that have the pointer

//     Object.defineProperty(instance, p, {value: async function(...args:any[]) {
//         if (!filter) {
//             let ptr = DatexPointer.getByValue(this);
//             if (!(ptr instanceof DatexPointer)) throw new DatexError("called @each method on non-pointer");
//             filter = DatexFilter.OR(await ptr.getSubscribersFilter(), ptr.origin);
//         }
//         console.log("all endpoints filter: " + filter);
      
//         return DatexRuntime.datexOut([`--static.${static_scope_name}._e.${p} ?`, [new DatexTuple(this, ...args)], {to:filter, sign:true}], filter);
//     }})
// }


// Reflect metadata / decorator metadata, get parameters & types if available
function getMethodParams(target:Function, method_name:string, meta_param_index?:number):Datex.Record<Datex.Type>{
    let record = new Datex.Record();
    let method_params:any[] = Reflect.getMetadata && Reflect.getMetadata("design:paramtypes", target, method_name);

    // get parmeters names from function body string
    const function_body:string = target[method_name]?.toString();
    const args_strings = function_body?.match(/^[^(]*\((.*)\)/)?.[1]?.split(",");
    if (args_strings) {
        for (let i=0;i<args_strings.length;i++) args_strings[i] = args_strings[i].trim().split(/[ =]/)[0];
    }

    if (method_params) {
        let names = args_strings ?? 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let i = 0;
        for (let param of method_params) {
            if (meta_param_index != null && meta_param_index == i) {i++; continue} // skip meta param index
            record[names[i++]] = Datex.Type.getClassDatexType(param);
        }
    }

    return record;
}
function getMetaParamIndex(target:Function, method_name:string):number {
    return target[METADATA]?.[Decorators.META_INDEX]?.public?.[method_name] ??
        (Reflect.getMetadata && Reflect.getMetadata("unyt:meta", target, method_name));
}


let _assigner_init = false;
function initPropertyTypeAssigner(){
    if (_assigner_init) return;
    _assigner_init = true;
    // TODO just a workaround, handle PropertyTypeAssigner different (currently nodejs error!! DatexPointer not yet defined)
    Datex.Pointer.setPropertyTypeAssigner(<any>{getMethodMetaParamIndex:getMetaParamIndex, getMethodParams:getMethodParams})
}
//DatexPointer.setPropertyTypeAssigner(<any>{getMethodMetaParamIndex:getMetaParamIndex, getMethodParams:getMethodParams})


/** @meta: mark meta parameter in a datex method with @meta */
export function meta(target: Object, propertyKey: string | symbol, parameterIndex: number) {
    Reflect.defineMetadata(
        "unyt:meta",
        parameterIndex,
        target,
        propertyKey
    );
}


// new version for implemented feature functions / attributes: call datex_advanced() on the class (ideally usa as a decorator, currently not supported by ts)

interface DatexClass<T extends Object = any> {

    // special functions
    on_result: (call: (data:any, meta:{station_id:number, station_bundle:number[]})=>any) => dc<T>;
    list: (..._:Datex.filter[]|[Datex.filter]) => Promise<Set<number>>;
    ping: (..._:Datex.filter[]|[Datex.filter]) => Promise<number>;
    options: (options:any)=>T;

    // decorator equivalents
    to: (..._:Datex.filter[]|[Datex.filter]|[string]) => dc<T>;
    no_result: () => dc<T>;

    // @sync objects
    is_origin?: boolean;
    origin_id?: number;
    room_id?: number;
}

type dc<T> = DatexClass<T> & T;

export function datex_advanced<T>(_class:T) {
    return <dc<T>> _class;
}



// extend a given class to create a auto-sync a class which autmatically creates synced objects (does not create a DATEX pseudo type configuration)
// if no type is provided, <ext:ClassName> is created as type by default
export function proxyClass<T extends { new(...args: any[]): any;}>(original_class:T, type?:Datex.Type, auto_sync = true):DatexClass&T {
                
    type = type ?? Datex.Type.get("ext", original_class.name);
    
    // add Proxy trap for construct
    const new_class = new Proxy(original_class, {
        construct(target: T, args: any[], newTarget:Function) {
            // cast from type
            if (new_class == newTarget) {
                // cast and immediately create pointer if auto_sync
                return type.cast(new Datex.Tuple(...args), undefined, undefined, auto_sync);
            }
            // just return new instance
            else return Reflect.construct(target, args, newTarget);
        },
        getPrototypeOf(target) {
            return original_class
        }
    });

    // custom class methods
    // -> MyClass.options(...).new(...);
    Object.defineProperty(new_class, 'options', {value: function(options:{properties:any}){
        original_class[CONSTRUCT_OPTIONS] = options;
        return new_class;
    }});

    Object.defineProperty(new_class, 'new', {value: function(...args:any[]){
        return new new_class(...args);
    }});

    return new_class;
}