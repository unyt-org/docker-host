import "./lib/reflect-metadata/Reflect.js";
import { Datex } from "./datex_runtime.js";
import Logger from "./logger.js";
const logger = new Logger("datex", true);
const CONSTRUCT_OPTIONS = Symbol("CONSTRUCT_OPTIONS");
if (!Symbol['metadata'])
    Symbol['metadata'] = Symbol('metadata');
export const METADATA = Symbol['metadata'];
export class Decorators {
    static expose(value, name, kind, is_static, is_private, setMetadata, getMetadata, params = []) {
        if (kind != "method" && kind != "field")
            logger.error("Cannot use @expose for value '" + name.toString() + "'");
        else if (!is_static)
            logger.error("Cannot use @expose for non-static field '" + name.toString() + "'");
        else {
            setMetadata(Decorators.IS_EXPOSED, true);
            if (params.length)
                Decorators.addMetaFilter((params.length == 1 && typeof params[0] == "string") ? Datex.Addresses.Filter.fromString(params[0]) : Datex.Addresses.Filter.OR(...params), setMetadata, getMetadata, Decorators.ALLOW_FILTER);
        }
    }
    static scope(value, name, kind, is_static, is_private, setMetadata, getMetadata, params = []) {
        if (!is_static && kind != "class")
            logger.error("Cannot use @scope for non-static field '" + name.toString() + "'");
        else {
            setMetadata(Decorators.SCOPE_NAME, params[0] ?? value?.name);
            if (kind == "class")
                staticScopeClass(value);
            else {
                setMetadata(Decorators.IS_REMOTE, true);
                setMetadata(Decorators.IS_EXPOSED, true);
            }
        }
    }
    static root_extension(value, name, kind, is_static, is_private, setMetadata, getMetadata, params) {
        if (!is_static && kind != "class")
            logger.error("Cannot use @root_extension for non-static field '" + name.toString() + "'");
        else {
            setMetadata(Decorators.ROOT_EXTENSION, true);
            if (kind == "class")
                staticScopeClass(value);
        }
    }
    static root_variable(value, name, kind, is_static, is_private, setMetadata, getMetadata, params) {
        if (!is_static && kind != "class")
            logger.error("Cannot use @root_variable for non-static field '" + name.toString() + "'");
        else {
            setMetadata(Decorators.ROOT_VARIABLE, true);
            if (kind == "class")
                staticScopeClass(value);
        }
    }
    static remote(value, name, kind, is_static, is_private, setMetadata, getMetadata, params = []) {
        if (kind == "class")
            logger.error("Cannot use @remote for a class");
        else if (!is_static)
            logger.error("Cannot use @remote for non-static field '" + name.toString() + "'");
        else {
            setMetadata(Decorators.IS_REMOTE, true);
            if (params.length)
                Decorators.addMetaFilter((params.length == 1 && typeof params[0] == "string") ? Datex.Addresses.Filter.fromString(params[0]) : Datex.Addresses.Filter.OR(...params), setMetadata, getMetadata, Decorators.SEND_FILTER);
        }
    }
    static docs(value, name, kind, is_static, is_private, setMetadata, getMetadata, params = []) {
        if (kind != "class")
            logger.error("@docs can only be used for classes");
        else {
            setMetadata(Decorators.DOCS, params[0]);
        }
    }
    static meta(value, name, kind, is_static, is_private, setMetadata, getMetadata, params = []) {
        if (kind == "method") {
            setMetadata(Decorators.META_INDEX, params[0] ?? -1);
        }
        else
            logger.error("@docs can only be used for methods");
    }
    static sign(value, name, kind, is_static, is_private, setMetadata, getMetadata, params = []) {
        setMetadata(Decorators.SIGN, params[0]);
    }
    static encrypt(value, name, kind, is_static, is_private, setMetadata, getMetadata, params = []) {
        setMetadata(Decorators.ENCRYPT, params[0]);
    }
    static no_result(value, name, kind, is_static, is_private, setMetadata, getMetadata, params) {
        setMetadata(Decorators.NO_RESULT, true);
    }
    static timeout(value, name, kind, is_static, is_private, setMetadata, getMetadata, params = []) {
        setMetadata(Decorators.TIMEOUT, params[0]);
    }
    static allow(value, name, kind, is_static, is_private, setMetadata, getMetadata, params = []) {
        Decorators.addMetaFilter((params.length == 1 && typeof params[0] == "string") ? Datex.Addresses.Filter.fromString(params[0]) : Datex.Addresses.Filter.OR(...params), setMetadata, getMetadata, Decorators.ALLOW_FILTER);
    }
    static to(value, name, kind, is_static, is_private, setMetadata, getMetadata, params = []) {
        Decorators.addMetaFilter((params.length == 1 && typeof params[0] == "string") ? Datex.Addresses.Filter.fromString(params[0]) : Datex.Addresses.Filter.OR(...params), setMetadata, getMetadata, Decorators.SEND_FILTER);
    }
    static each(value, name, kind, is_static, is_private, setMetadata, getMetadata, params) {
        if (is_static)
            logger.error("Cannot use @each for static field '" + name.toString() + "'");
        else {
            setMetadata(Decorators.IS_EACH, true);
        }
    }
    static property(value, name, kind, is_static, is_private, setMetadata, getMetadata, params) {
        if (is_static)
            logger.error("@property decorator cannot be used for static fields");
        else if (kind != "field" && kind != "getter" && kind != "setter" && kind != "method")
            logger.error("Invalid use of @property decorator");
        else {
            setMetadata(Decorators.PROPERTY, params?.[0] ?? name);
        }
    }
    static serialize(value, name, kind, is_static, is_private, setMetadata, getMetadata, params) {
        if (is_static)
            logger.error("@serialize decorator cannot be used for static fields");
        else if (kind != "field" && kind != "getter" && kind != "setter" && kind != "method")
            logger.error("Invalid use of @serialize decorator");
        else if (!params?.[0])
            logger.error("Missing serializer method on @serialize decorator");
        else {
            setMetadata(Decorators.SERIALIZE, params[0]);
        }
    }
    static template(value, name, kind, is_static, is_private, setMetadata, getMetadata, params = []) {
        if (kind != "class")
            logger.error("@template can only be used as a class decorator");
        else {
            initPropertyTypeAssigner();
            const original_class = value;
            let type;
            if (typeof params[0] == "string")
                type = Datex.Type.get(params[0].replace(/^\</, '').replace(/\>$/, ''));
            else if (params[0] instanceof Datex.Type)
                type = params[0];
            else if (original_class[METADATA]?.[Decorators.FORCE_TYPE]?.constructor)
                type = original_class[METADATA]?.[Decorators.FORCE_TYPE]?.constructor;
            else
                type = Datex.Type.get("ext", original_class.name);
            return createTemplateClass(original_class, type);
        }
    }
    static sync(value, name, kind, is_static, is_private, setMetadata, getMetadata, params = []) {
        if (is_static)
            logger.error("Cannot use @sync for static field '" + name.toString() + "'");
        if (is_static)
            logger.error("Cannot use @sync for static field '" + name.toString() + "'");
        else {
            setMetadata(Decorators.IS_SYNC, true);
            if (kind == "class") {
                initPropertyTypeAssigner();
                const original_class = value;
                let type;
                if (typeof params[0] == "string")
                    type = Datex.Type.get(params[0].replace(/^\</, '').replace(/\>$/, ''));
                else if (params[0] instanceof Datex.Type)
                    type = params[0];
                else if (original_class[METADATA]?.[Decorators.FORCE_TYPE]?.constructor)
                    type = original_class[METADATA]?.[Decorators.FORCE_TYPE]?.constructor;
                else
                    type = Datex.Type.get("ext", original_class.name);
                return createTemplateClass(original_class, type);
            }
        }
    }
    static sealed(value, name, kind, is_static, is_private, setMetadata, getMetadata, params) {
        if (is_static)
            logger.error("Cannot use @sealed for static field '" + name.toString() + "'");
        else {
            setMetadata(Decorators.IS_SEALED, true);
        }
    }
    static anonymous(value, name, kind, is_static, is_private, setMetadata, getMetadata, params) {
        if (is_static)
            logger.error("Cannot use @anonymous for static field '" + name.toString() + "'");
        else {
            setMetadata(Decorators.IS_ANONYMOUS, true);
        }
    }
    static observe(value, name, kind, is_static, is_private, setMetadata, getMetadata, params = []) {
        setMetadata(Decorators.OBSERVER, params[0]);
    }
    static anonymize(value, name, kind, is_static, is_private, setMetadata, getMetadata, params) {
        if (kind == "class")
            logger.error("Cannot use @anonymize for classes");
        else {
            setMetadata(Decorators.ANONYMIZE, true);
        }
    }
    static type(value, name, kind, is_static, is_private, setMetadata, getMetadata, params = []) {
        if (typeof params[0] == "string")
            setMetadata(Decorators.FORCE_TYPE, Datex.Type.get(params[0].replace(/^\</, '').replace(/\>$/, '')));
        else if (params[0] instanceof Datex.Type)
            setMetadata(Decorators.FORCE_TYPE, params[0]);
    }
    static from(value, name, kind, is_static, is_private, setMetadata, getMetadata, params = []) {
        if (kind !== "class")
            logger.error("Can use @from only for classes");
        else {
            setMetadata(Decorators.FROM_TYPE, params[0]);
        }
    }
    static update(value, name, kind, is_static, is_private, setMetadata, getMetadata, params = []) {
        if (params[0] instanceof Datex.UpdateScheduler)
            setMetadata(Decorators.SCHEDULER, params[0]);
        else
            setMetadata(Decorators.SCHEDULER, new Datex.UpdateScheduler(params[0]));
    }
    static ["constructor"](value, name, kind, is_static, is_private, setMetadata, getMetadata, params) {
        if (is_static)
            logger.error("Cannot use @constructor for static field '" + name.toString() + "'");
        else if (kind != "method")
            logger.error("Cannot only use @constructor for methods");
        else {
            setMetadata(Decorators.CONSTRUCTOR, true);
        }
    }
    static replicator(value, name, kind, is_static, is_private, setMetadata, getMetadata, params) {
        if (is_static)
            logger.error("Cannot use @replicator for static field '" + name.toString() + "'");
        else if (kind != "method")
            logger.error("Cannot only use @replicator for methods");
        else {
            setMetadata(Decorators.REPLICATOR, true);
        }
    }
    static destructor(value, name, kind, is_static, is_private, setMetadata, getMetadata, params) {
        if (is_static)
            logger.error("Cannot use @destructor for static field '" + name.toString() + "'");
        else if (kind != "method")
            logger.error("Cannot only use @destructor for methods");
        else {
            setMetadata(Decorators.DESTRUCTOR, true);
        }
    }
    static addMetaFilter(new_filter, setMetadata, getMetadata, filter_symbol) {
        let filter = getMetadata(filter_symbol);
        if (!filter) {
            filter = new Datex.Addresses.Filter();
            setMetadata(filter_symbol, filter);
        }
        filter.appendFilter(new_filter);
    }
}
Object.defineProperty(Decorators, "IS_EXPOSED", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("IS_EXPOSED")
});
Object.defineProperty(Decorators, "IS_REMOTE", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("IS_REMOTE")
});
Object.defineProperty(Decorators, "IS_EACH", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("IS_EACH")
});
Object.defineProperty(Decorators, "IS_SYNC", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("IS_SYNC")
});
Object.defineProperty(Decorators, "IS_ANONYMOUS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("IS_ANONYMOUS")
});
Object.defineProperty(Decorators, "IS_SEALED", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("IS_SEALED")
});
Object.defineProperty(Decorators, "ANONYMIZE", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("ANONYMIZE")
});
Object.defineProperty(Decorators, "PROPERTY", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("PROPERTY")
});
Object.defineProperty(Decorators, "SERIALIZE", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("SERIALIZE")
});
Object.defineProperty(Decorators, "ALLOW_FILTER", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("ALLOW_FILTER")
});
Object.defineProperty(Decorators, "SEND_FILTER", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("SEND_FILTER")
});
Object.defineProperty(Decorators, "SCOPE_NAME", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("SCOPE_NAME")
});
Object.defineProperty(Decorators, "ROOT_EXTENSION", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("ROOT_EXTENSION")
});
Object.defineProperty(Decorators, "ROOT_VARIABLE", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("ROOT_VARIABLE")
});
Object.defineProperty(Decorators, "DOCS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("DOCS")
});
Object.defineProperty(Decorators, "META_INDEX", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("META_INDEX")
});
Object.defineProperty(Decorators, "SIGN", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("SIGN")
});
Object.defineProperty(Decorators, "ENCRYPT", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("ENCRYPT")
});
Object.defineProperty(Decorators, "NO_RESULT", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("NO_RESULT")
});
Object.defineProperty(Decorators, "TIMEOUT", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("TIMEOUT")
});
Object.defineProperty(Decorators, "OBSERVER", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("OBSERVER")
});
Object.defineProperty(Decorators, "SCHEDULER", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("SCHEDULER")
});
Object.defineProperty(Decorators, "FORCE_TYPE", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("FORCE_TYPE")
});
Object.defineProperty(Decorators, "FROM_TYPE", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("FROM_TYPE")
});
Object.defineProperty(Decorators, "CONSTRUCTOR", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("CONSTRUCTOR")
});
Object.defineProperty(Decorators, "REPLICATOR", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("REPLICATOR")
});
Object.defineProperty(Decorators, "DESTRUCTOR", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Symbol("DESTRUCTOR")
});
globalThis.Decorators = Decorators;
const initialized_static_scope_classes = new Map();
function staticScopeClass(original_class) {
    if (initialized_static_scope_classes.has(original_class)) {
        if (original_class[METADATA]?.[Decorators.ROOT_VARIABLE]?.constructor) {
            const static_scope = initialized_static_scope_classes.get(original_class);
            Datex.Runtime.addRootVariable(static_scope.name, static_scope);
        }
        if (original_class[METADATA]?.[Decorators.ROOT_EXTENSION]?.constructor) {
            const static_scope = initialized_static_scope_classes.get(original_class);
            Datex.Runtime.addRootExtension(static_scope);
        }
        return;
    }
    let static_properties = Object.getOwnPropertyNames(original_class);
    const metadata = original_class[METADATA];
    if (!metadata)
        return;
    let dynamic_filter = new Datex.Addresses.Filter();
    const static_scope_name = typeof metadata[Decorators.SCOPE_NAME]?.constructor == 'string' ? metadata[Decorators.SCOPE_NAME]?.constructor : original_class.name;
    let static_scope;
    Object.defineProperty(original_class, 'to', {
        value: function (...filters) {
            dynamic_filter.set(...filters);
            return this;
        },
        configurable: false,
        enumerable: false,
        writable: false
    });
    const class_send_filter = metadata[Decorators.SEND_FILTER]?.constructor;
    const class_allow_filter = metadata[Decorators.ALLOW_FILTER]?.constructor;
    for (let name of static_properties) {
        const current_value = original_class[name];
        const exposed_public = metadata[Decorators.IS_EXPOSED]?.public;
        const exposed_private = metadata[Decorators.IS_EXPOSED]?.private;
        if ((exposed_public?.hasOwnProperty(name) && exposed_public[name]) || (exposed_private?.hasOwnProperty(name) && exposed_private[name])) {
            if (!static_scope)
                static_scope = Datex.StaticScope.get(static_scope_name);
            if (typeof current_value == "function") {
                let meta_index = getMetaParamIndex(original_class, name);
                let params = getMethodParams(original_class, name, meta_index);
                let dx_function = Datex.Pointer.proxifyValue(new Datex.Function(null, current_value, Datex.Runtime.endpoint, params, null, meta_index, original_class, null), true, undefined, false, true);
                static_scope.setVariable(name, dx_function);
            }
            else {
                let setProxifiedValue = (val) => static_scope.setVariable(name, Datex.Pointer.proxifyValue(val, true, undefined, false, true));
                setProxifiedValue(current_value);
                const property_descriptor = Object.getOwnPropertyDescriptor(original_class, name);
                if (property_descriptor?.set || property_descriptor?.get) {
                    Object.defineProperty(static_scope, name, {
                        set: val => {
                            property_descriptor.set?.call(original_class, val);
                        },
                        get: () => {
                            return property_descriptor.get?.call(original_class);
                        }
                    });
                }
                Object.defineProperty(original_class, name, {
                    get: () => static_scope.getVariable(name),
                    set: (val) => setProxifiedValue(val)
                });
            }
        }
        const remote_public = metadata[Decorators.IS_REMOTE]?.public;
        const remote_private = metadata[Decorators.IS_REMOTE]?.private;
        const timeout_public = metadata[Decorators.TIMEOUT]?.public;
        const timeout_private = metadata[Decorators.TIMEOUT]?.private;
        if ((remote_public?.hasOwnProperty(name) && remote_public[name]) || (remote_private?.hasOwnProperty(name) && remote_private[name])) {
            const timeout = timeout_public?.[name] ?? timeout_private?.[name];
            if (typeof current_value == "function") {
                let options = { filter: class_send_filter, sign: true, scope_name: static_scope_name, dynamic_filter: dynamic_filter, timeout };
                let proxy_fn = Datex.getProxyFunction(name, options);
                Object.defineProperty(original_class, name, { value: proxy_fn });
            }
            else {
                let options = { filter: class_send_filter, sign: true, scope_name: static_scope_name, dynamic_filter: dynamic_filter, timeout };
                let proxy_fn = Datex.getProxyStaticValue(name, options);
                Object.defineProperty(original_class, name, {
                    get: proxy_fn
                });
            }
        }
    }
    if (static_scope && metadata[Decorators.ROOT_EXTENSION]?.constructor) {
        Datex.Runtime.addRootExtension(static_scope);
    }
    if (static_scope && metadata[Decorators.ROOT_VARIABLE]?.constructor) {
        Datex.Runtime.addRootVariable(static_scope.name, static_scope);
    }
    const each_public = original_class.prototype[METADATA]?.[Decorators.IS_EACH]?.public;
    let each_scope;
    for (let [name, is_each] of Object.entries(each_public ?? {})) {
        if (!is_each)
            continue;
        if (!static_scope)
            static_scope = Datex.StaticScope.get(static_scope_name);
        if (!each_scope) {
            each_scope = {};
            static_scope.setVariable("_e", each_scope);
        }
        let method = original_class.prototype[name];
        let type = Datex.Type.getClassDatexType(original_class);
        if (typeof method != "function")
            throw new Datex.Error("@each can only be used with functions");
        let meta_index = getMetaParamIndex(original_class.prototype, name);
        if (typeof meta_index == "number")
            meta_index++;
        let params = getMethodParams(original_class.prototype, name, meta_index);
        let proxy_method = function (_this, ...args) {
            if (!(_this instanceof original_class)) {
                console.warn(_this, args);
                throw new Datex.ValueError("Invalid argument 'this': type should be " + type);
            }
            return method.call(_this, ...args);
        };
        let dx_function = Datex.Pointer.proxifyValue(new Datex.Function(null, proxy_method, Datex.Runtime.endpoint, params, null, meta_index, original_class, null), true, undefined, false, true);
        each_scope[name] = dx_function;
    }
    if (static_scope) {
        Datex.DatexObject.seal(static_scope);
        initialized_static_scope_classes.set(original_class, static_scope);
    }
}
const templated_classes = new Map();
export function createTemplateClass(original_class, type, sync = true) {
    if (templated_classes.has(original_class))
        return templated_classes.get(original_class);
    original_class[Datex.DX_TYPE] = type;
    type.setJSInterface({
        class: original_class,
        proxify_children: true,
        is_normal_object: true,
    });
    const constructor_name = Object.keys(original_class.prototype[METADATA]?.[Decorators.CONSTRUCTOR]?.public ?? {})[0];
    const replicator_name = Object.keys(original_class.prototype[METADATA]?.[Decorators.REPLICATOR]?.public ?? {})[0];
    const destructor_name = Object.keys(original_class.prototype[METADATA]?.[Decorators.DESTRUCTOR]?.public ?? {})[0];
    if (constructor_name)
        type.setConstructor(original_class.prototype[constructor_name]);
    if (replicator_name)
        type.setReplicator(original_class.prototype[replicator_name]);
    if (destructor_name)
        type.setDestructor(original_class.prototype[destructor_name]);
    const property_types = original_class.prototype[METADATA]?.[Decorators.FORCE_TYPE]?.public;
    const allow_filters = original_class.prototype[METADATA]?.[Decorators.ALLOW_FILTER]?.public;
    const template = {};
    template[Datex.DX_PERMISSIONS] = {};
    let prototype = original_class;
    while ((prototype = Object.getPrototypeOf(prototype)) != Object.prototype) {
        if ((prototype[Datex.DX_TYPE])?.template) {
            Datex.DatexObject.extend(template, prototype[Datex.DX_TYPE].template);
            break;
        }
    }
    for (let [name, dx_name] of Object.entries(original_class.prototype[METADATA]?.[Decorators.PROPERTY]?.public ?? {})) {
        template[name] = property_types?.[name] ?? Datex.Type.std.Any;
        if (allow_filters?.[name])
            template[Datex.DX_PERMISSIONS][name] = allow_filters[name];
    }
    type.setTemplate(template);
    staticScopeClass(original_class);
    const sync_auto_cast_class = proxyClass(original_class, type, original_class[METADATA]?.[Decorators.IS_SYNC]?.constructor ?? sync);
    globalThis[sync_auto_cast_class.name] = sync_auto_cast_class;
    templated_classes.set(original_class, sync_auto_cast_class);
    return sync_auto_cast_class;
}
function getMethodParams(target, method_name, meta_param_index) {
    let tuple = new Datex.Tuple();
    let method_params = Reflect.getMetadata && Reflect.getMetadata("design:paramtypes", target, method_name);
    const function_body = target[method_name]?.toString();
    const args_strings = function_body?.match(/^[^(]*\((.*)\)/)?.[1]?.split(",");
    if (args_strings) {
        for (let i = 0; i < args_strings.length; i++)
            args_strings[i] = args_strings[i].trim().split(/[ =]/)[0];
    }
    if (method_params) {
        let names = args_strings ?? 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let i = 0;
        for (let param of method_params) {
            if (meta_param_index != null && meta_param_index == i) {
                i++;
                continue;
            }
            tuple.set(names[i++], Datex.Type.getClassDatexType(param));
        }
    }
    return tuple;
}
function getMetaParamIndex(target, method_name) {
    return target[METADATA]?.[Decorators.META_INDEX]?.public?.[method_name] ??
        (Reflect.getMetadata && Reflect.getMetadata("unyt:meta", target, method_name));
}
let _assigner_init = false;
function initPropertyTypeAssigner() {
    if (_assigner_init)
        return;
    _assigner_init = true;
    Datex.Pointer.setPropertyTypeAssigner({ getMethodMetaParamIndex: getMetaParamIndex, getMethodParams: getMethodParams });
}
export function meta(target, propertyKey, parameterIndex) {
    Reflect.defineMetadata("unyt:meta", parameterIndex, target, propertyKey);
}
export function datex_advanced(_class) {
    return _class;
}
export function proxyClass(original_class, type, auto_sync = true) {
    type = type ?? Datex.Type.get("ext", original_class.name);
    const new_class = new Proxy(original_class, {
        construct(target, args, newTarget) {
            if (new_class == newTarget) {
                return type.cast(new Datex.Tuple(args), undefined, undefined, auto_sync);
            }
            else
                return Reflect.construct(target, args, newTarget);
        },
        getPrototypeOf(target) {
            return original_class;
        }
    });
    Object.defineProperty(new_class, 'options', { value: function (options) {
            original_class[CONSTRUCT_OPTIONS] = options;
            return new_class;
        } });
    Object.defineProperty(new_class, 'new', { value: function (...args) {
            return new new_class(...args);
        } });
    return new_class;
}
