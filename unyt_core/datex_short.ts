
// shortcut functions
import { Datex } from "./datex.js";
import { baseURL, clause, compiler_scope, datex_scope, target_clause, ValueError } from "./datex_all.js";

/***** execute DATEX */
// default endpoint: DatexRuntime.endpoint
// sign per default if not local endpoint
// do not encrypt per default
export function datex(dx:TemplateStringsArray, ...args:any[]):Promise<any>
export function datex(dx:string|Datex.PrecompiledDXB, data?:any[], to?:Datex.Target|target_clause|Datex.endpoint_name, sign?:boolean, encrypt?:boolean, context_location?:URL|string):Promise<any>
export function datex(dx:string|TemplateStringsArray|Datex.PrecompiledDXB, data:any[]=[], to:Datex.Target|target_clause|Datex.endpoint_name = Datex.Runtime.endpoint, sign=to!=Datex.Runtime.endpoint, encrypt=false, context_location?:URL|string) {
    // template string (datex `...`)
    if (dx instanceof Array && !(dx instanceof Datex.PrecompiledDXB)) {
        dx = dx.raw.join("?");
        data = Array.from(arguments);
        data.splice(0,1);
    }

    // local execution
    if (to === Datex.Runtime.endpoint) return Datex.Runtime.executeDatexLocally(dx, data, {sign, encrypt}, context_location ? new URL(context_location) : undefined); 
    // remote execution
    else return Datex.Runtime.datexOut([dx, data, {sign, encrypt, context_location: context_location ? new URL(context_location) : undefined}], typeof to == "string" ? f(<Datex.endpoint_name>to) : to);
    
}
globalThis.datex = datex
globalThis.〱 = datex;
export const 〱 = datex;


// generate a pointer for an object and returns the proxified object or the primitive pointer
export function get<T>(dx:string, context_location?:URL|string) {
    return datex('get (' + dx + ' )', undefined, undefined, undefined, undefined, context_location)
}
globalThis.get = get



// execute DATEX as continuos scope with current context location
// similar to the 'compile' command in Datex.Compiler

const context_compiler_scopes = new Map<string, compiler_scope>();
const context_runtime_scopes = new Map<string, datex_scope>();

// OTDO
export async function script(dx:TemplateStringsArray, ...args:any[]):Promise<any>
export async function script(dx:string|Datex.PrecompiledDXB, data?:any[], to?:Datex.Target|target_clause|Datex.endpoint_name, sign?:boolean, encrypt?:boolean):Promise<any>
export async function script(dx:string|TemplateStringsArray|Datex.PrecompiledDXB, data:any[]=[], to:Datex.Target|target_clause|Datex.endpoint_name = Datex.Runtime.endpoint, sign=to!=Datex.Runtime.endpoint, encrypt=false) {
    // template string (script `...`)
    if (dx instanceof Array && !(dx instanceof Datex.PrecompiledDXB)) {
        dx = dx.raw.join("?");
        data = Array.from(arguments);
        data.splice(0,1);
    }

    const context_location = baseURL;
    const context_string = context_location.toString();

    let compiler_scope:compiler_scope = context_compiler_scopes.get(context_string)
    let runtime_scope:datex_scope = context_runtime_scopes.get(context_string);


    // COMPILE:

    // create compiler scope first time
    if (!compiler_scope) {
        context_compiler_scopes.set(context_string, compiler_scope = Datex.Compiler.createCompilerScope(<string>dx, data, {}, false, false, false, undefined, Infinity))
    }
    // reset scope for next DATEX script snippet
    else {
        Datex.Compiler.resetScope(compiler_scope, <string>dx);
    }
    // compile snippet in compiler scope
    let compiled = <ArrayBuffer> await Datex.Compiler.compileLoop(compiler_scope);


    // RUN:

    // create datex scope to run
    if (!runtime_scope) {
        context_runtime_scopes.set(context_string, runtime_scope = Datex.Runtime.createNewInitialScope(undefined, undefined, undefined, undefined, context_location));
    }
    // set dxb as scope buffer
    Datex.Runtime.updateScope(runtime_scope, compiled, {sender:Datex.Runtime.endpoint, executable:true})
    
    // execute scope -> get script from path
    let value:any
    
    value = await Datex.Runtime.simpleScopeExecution(runtime_scope)

    return value;
}
globalThis.script = script


// generate a instance of a JS class / DATEX Type by casting
export function instance<T>(fromClass:{new(...params:any[]):T}, properties?:Datex.CompatPartial<T>): T
export function instance<T>(fromType:Datex.Type<T>, properties?:Datex.CompatPartial<T>): T
export function instance<T>(fromClassOrType:{new(...params:any[]):T}|Datex.Type<T>, properties?:Datex.CompatPartial<T>): T {
    if (fromClassOrType instanceof Datex.Type) return fromClassOrType.cast(properties);
    else return Datex.Type.getClassDatexType(fromClassOrType).cast(properties)
}
globalThis.instance = instance;


// generate a pointer for an object and returns the proxified object or the primitive pointer
export function pointer<T>(value:Datex.CompatValue<T>): T extends object ? T : Datex.Pointer<T> {
    return <any> Datex.Pointer.createOrGet(value).js_value;
}

export const $$ = pointer;

// generate primitive pointers
export function decimal(value:Datex.CompatValue<number|bigint|string> = 0): Datex.DecimalRef {
    if (value instanceof Datex.Value) value = value.value; // collapse
    return Datex.Pointer.create(undefined, Number(value)) // adds pointer or returns existing pointer
}
export function integer(value:Datex.CompatValue<bigint|number|string> = 0n): Datex.IntegerRef {
    if (value instanceof Datex.Value) value = value.value; // collapse
    return Datex.Pointer.create(undefined, BigInt(Math.floor(Number(value)))) // adds pointer or returns existing pointer
}
export function text(string:TemplateStringsArray, ...vars:any[]):Promise<Datex.TextRef>
export function text(value?:Datex.CompatValue<any>): Datex.TextRef
export function text(value:Datex.CompatValue<string>|TemplateStringsArray = "", ...vars:any[]): Datex.TextRef|Promise<Datex.TextRef> {
    if (value instanceof Datex.Value) value = value.value; // collapse
    // template transform
    if (value instanceof Array) {
        return datex(`always '${value.raw.map(s=>s.replace(/\(/g, '\\(').replace(/\'/g, "\\'")).join("(?)")}'`, vars)
    }
    else return <Datex.TextRef>Datex.Pointer.create(undefined, String(value)) // adds pointer or returns existing pointer
}
export function boolean(value:Datex.CompatValue<boolean> = false): Datex.BooleanRef {
    if (value instanceof Datex.Value) value = value.value; // collapse
    return Datex.Pointer.create(undefined, Boolean(value)) // adds pointer or returns existing pointer
}


// get string transform matching the current Runtime.ENV language
export function local_text(local_map: { [lang: string]: string; }) {
    return Datex.Runtime.getLocalString(local_map)
}

globalThis.decimal = decimal;
globalThis.integer = integer;
globalThis.text = text;
globalThis.boolean = boolean;
globalThis.local_text = local_text;


export function transform<T,V extends readonly [Datex.CompatValue<any>]| readonly Datex.CompatValue<any>[]>(observe_values:V, transform:(...values:Datex.CollapsedDatexArray<V>)=>Datex.CompatValue<T>, persistent_datex_transform?:string) {
    return Datex.Value.collapseValue(Datex.Pointer.createTransform(observe_values, transform, persistent_datex_transform));
}
export async function transformAsync<T,V extends readonly [Datex.CompatValue<any>]| readonly Datex.CompatValue<any>[]>(observe_values:V, transform:(...values:Datex.CollapsedDatexArray<V>)=>Promise<Datex.CompatValue<T>>, persistent_datex_transform?:string) {
    return Datex.Value.collapseValue(await Datex.Pointer.createTransformAsync(observe_values, transform, persistent_datex_transform));
}
globalThis.transform = transform;
globalThis.transformAsync = transformAsync;


// same as datex `always ...`
export async function always(script:TemplateStringsArray, ...vars:any[]):Promise<Datex.Pointer|any> {
    return Datex.Value.collapseValue(await datex(`always (${script.raw.join("?")})`, vars))
}
globalThis.always = always;

// generate a static pointer for an object
export function static_pointer<T>(value:Datex.CompatValue<T>, endpoint:Datex.IdEndpoint, unique_id:number, label?:string|number): T {
    const static_id = Datex.Pointer.getStaticPointerId(endpoint, unique_id);
    const pointer = Datex.Pointer.create(static_id, value)
    if (label) pointer.addLabel(typeof label == "string" ? label.replace(/^\$/, '') : label);
    return pointer.value;
}

// similar to pointer(), but also adds a label
export function label<T>(label:string|number, value:Datex.CompatValue<T>): T {
    const pointer = Datex.Pointer.createOrGet(value);
    if (pointer instanceof Datex.Pointer) pointer.addLabel(typeof label == "string" ? label.replace(/^\$/, '') : label);
    else throw new ValueError("Cannot add label to value, value is not a pointer");
    return pointer.value;
}
globalThis.label = label;
globalThis.pointer = pointer;
globalThis.$$ = $$;
globalThis.static_pointer = static_pointer;


// create a infinitely persistant value stored in the DATEX Datex.Storage
let PERSISTENT_INDEX = 0;

export function eternal<T>(type:Datex.Type<T>):Promise<Datex.Storage.created_state_value<T>>
export function eternal<T>(id:string|number, type:Datex.Type<T>):Promise<Datex.Storage.created_state_value<T>>
export function eternal<T>(value_class:Datex.any_class<T>):Promise<Datex.Storage.created_state_value<T>>
export function eternal<T>(id:string|number, value_class:Datex.any_class<T>):Promise<Datex.Storage.created_state_value<T>>
export function eternal<T>(create?:()=>Promise<T>|T):Promise<Datex.Storage.created_state_value<T>>
export function eternal<T>(id:string|number, create:()=>Promise<T>|T):Promise<Datex.Storage.created_state_value<T>>
export function eternal<T>(id_or_create_or_class:string|number|((()=>Promise<T>|T)|Datex.any_class<T>|Datex.Type<T>), _create_or_class?:(()=>Promise<T>|T)|Datex.any_class<T>|Datex.Type<T>) {
    const create_or_class = (id_or_create_or_class instanceof Function || id_or_create_or_class instanceof Datex.Type) ? id_or_create_or_class : _create_or_class;

    // create unique id for eternal call (file location + type)
    const unique = ()=>{
        const type = create_or_class instanceof Datex.Type ? create_or_class : (create_or_class?.prototype !== undefined ? Datex.Type.getClassDatexType(<any>create_or_class) : null);
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


// export function not(value:[Datex.endpoint_name]|Datex.endpoint_name) {
//     let target:Datex.Target;
//     if (typeof value == "string") target = f(value);
//     else if (value instanceof Array && typeof value[0] == "string") target = f(value[0]);
//     return new target_clause(Datex.Not.get(target));
// }
// export function person(name:[target_clause_target_name_person]|target_clause_target_name_person) {
//     return Datex.Person.get(typeof name == "string" ? name : name[0]);
// }
// export function institution(name:[target_clause_target_name_institution]|target_clause_target_name_institution) {
//     return Datex.Institution.get(typeof name == "string" ? name : name[0]);
// }
// export function bot(name:[target_clause_target_name_bot]|target_clause_target_name_bot) {
//     return Datex.Bot.get(typeof name == "string" ? name : name[0]);
// }

// // create any filter Datex.Target from a string
// export function ef(filter:Datex.Target) {
//     if (filter instanceof Datex.Target) return filter.toString()
//     return new target_clause(filter).toString();
// }

// create any filter Datex.Target from a string
export function f<T extends Datex.endpoint_name>(name:[T]|T):Datex.endpoint_by_endpoint_name<T> {
    return <any>Datex.Target.get((typeof name == "string" ? name : name[0]));
}





// globalThis.not = not;
// globalThis.person = person;
// globalThis.ef = ef;

globalThis.f = f;



export function syncedValue(parent:any|Datex.Pointer, key?:any):Datex.PointerProperty {
    return Datex.PointerProperty.get(parent, key); 
}

// usage: props(someObjectWithPointer).someProperty  -> DatexPointerProperty<typeof someProperty>
// creates an object from a pointer with all properties as DatexSynced values
// if strong_parent_bounding is on, the child properties are always DatexPointerPropertys, otherwise a Datex.Pointer or other DatexValue might be returned if the property is already a DatexValue
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