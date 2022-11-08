// only "interface" for all DATEX objects, has special hidden properties (symbols) and static methods for object extending

import { DX_TYPE, EXTENDED_OBJECTS, INHERITED_PROPERTIES, SET_PROXY, SHADOW_OBJECT } from "../runtime/constants.js";
import { ValueError } from "./errors.js";
import { Tuple } from "./tuple.js";
import { type_clause } from "./type.js";


export type CompatObject<T> = Tuple<T>|Record<string|number, T>


// base class for all Datex object based types (Record, custom typed values)
export abstract class DatexObject {

    private [DX_TYPE]: type_clause

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
                    console.warn("Cannot create new getter/setter for extendable object key: " + key);
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


    // compat methods for object/tuples
    public static entries(value:Object|Tuple) {
        if (value instanceof Tuple) return value.entries();
        else return Object.entries(value)
    }

    public static keys(value:Object|Tuple) {
        if (value instanceof Tuple) return value.keys();
        else return Object.keys(value)
    }

    public static set(parent:Object|Tuple, key:string|number,value:any) {
        if (parent instanceof Tuple) return parent.set(key, value);
        else return parent[key] = value;
    }

    public static get(parent:Object|Tuple, key:string|number) {
        if (parent instanceof Tuple) return parent.get(key);
        else return parent[key];
    }



    // DATEX meta data
    public static setType(value:Object, type:type_clause) {
        value[DX_TYPE] = type;
    }


    // get / set methods
    // get<K extends keyof T>(key:K):T[K] {return (<T><unknown>this)[key];}
    // set<K extends keyof T, V extends T[K]>(key:K, value:V) {(<T><unknown>this)[key] = value;}
    // has<K extends keyof T>(key:K) {return this.hasOwnProperty(key);}
}


