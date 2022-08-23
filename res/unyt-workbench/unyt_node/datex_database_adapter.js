var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _DatexDatabaseAdapter_instances, _a, _DatexDatabaseAdapter_credentials, _DatexDatabaseAdapter_sql_client, _DatexDatabaseAdapter_sql_event_watcher, _DatexDatabaseAdapter_connected, _DatexDatabaseAdapter_query, _DatexDatabaseAdapter_queryFirst, _DatexDatabaseAdapter_connect, _DatexDatabaseAdapter_getColumnDATEXType, _DatexDatabaseAdapter_updateField, _DatexDatabaseAdapter_initOptions, _DatexDatabaseAdapter_initializeDatexTypeForTable, _DatexDatabaseAdapter_watchExternalUpdates;
import mysql from 'mysql';
import MySQLEvents from '@rodrigogs/mysql-events';
import { Datex } from '../unyt_core/datex_runtime.js';
export var PropertyMappingType;
(function (PropertyMappingType) {
    PropertyMappingType[PropertyMappingType["reverse_pointer_collection_ref"] = 0] = "reverse_pointer_collection_ref";
    PropertyMappingType[PropertyMappingType["pointer_ref"] = 1] = "pointer_ref";
    PropertyMappingType[PropertyMappingType["pointer_ref_extend"] = 2] = "pointer_ref_extend";
})(PropertyMappingType || (PropertyMappingType = {}));
const mysql_datex_type_map = new Map([
    ['int', Datex.Type.std.Int],
    ['bigint', Datex.Type.std.Int],
    ['smallint', Datex.Type.std.Int],
    ['mediumint', Datex.Type.std.Int],
    ['tinyint', Datex.Type.std.Int],
    ['tiny', Datex.Type.std.Int],
    ['long', Datex.Type.std.Int],
    ['year', Datex.Type.std.Int],
    ['float', Datex.Type.std.Float],
    ['double', Datex.Type.std.Float],
    ['decimal', Datex.Type.std.Float],
    ['timestamp', Datex.Type.std.Time],
    ['date', Datex.Type.std.Time],
    ['datetime', Datex.Type.std.Time],
    ['time', Datex.Type.std.String],
    ['varchar', Datex.Type.std.String],
    ['char', Datex.Type.std.String],
    ['text', Datex.Type.std.String],
    ['tinytext', Datex.Type.std.String],
    ['mediumtext', Datex.Type.std.String],
    ['longtext', Datex.Type.std.String],
    ['enum', Datex.Type.std.String],
    ['geometry', Datex.Type.std.String],
    ['set', Datex.Type.std.Set],
    ['tinyblob', Datex.Type.std.Buffer],
    ['blob', Datex.Type.std.Buffer],
    ['mediumblob', Datex.Type.std.Buffer],
    ['longblob', Datex.Type.std.Buffer],
    ['binary', Datex.Type.std.Buffer],
    ['varbinary', Datex.Type.std.Buffer],
    ['bit', Datex.Type.std.Buffer],
    ['boolean', Datex.Type.std.Boolean],
    ['json', Datex.Type.std.Object],
]);
export class DatexDatabaseAdapter {
    constructor(credentials, use_as_pointer_source = true) {
        _DatexDatabaseAdapter_instances.add(this);
        _DatexDatabaseAdapter_credentials.set(this, void 0);
        _DatexDatabaseAdapter_sql_client.set(this, void 0);
        _DatexDatabaseAdapter_sql_event_watcher.set(this, void 0);
        _DatexDatabaseAdapter_connected.set(this, false);
        Object.defineProperty(this, "table_types", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "table_default_options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "table_raw_datex_default_options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "table_columns", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "table_primary_keys", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "table_entries_by_primary_key", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "tables_with_dx_ptr_column", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "table_pointer_ref_fields", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "tables_with_raw_datex", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        __classPrivateFieldSet(this, _DatexDatabaseAdapter_credentials, credentials, "f");
        if (use_as_pointer_source)
            Datex.Pointer.registerPointerSource(this);
    }
    async getPointer(pointer_id, pointerify) {
        for (let table of this.tables_with_dx_ptr_column) {
            const pointer_id_buffer = Buffer.from(Datex.Pointer.hex2buffer(pointer_id).buffer);
            const has_pointer = (await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_queryFirst).call(this, DatexDatabaseAdapter.QUERY.HAS_POINTER, [table, pointer_id_buffer])).COUNT;
            if (has_pointer) {
                const [pointer] = await this.getEntries(table, DatexDatabaseAdapter.QUERY.WHERE_DX_PTR_ID_IS, { sync: false }, [pointer_id_buffer]);
                return pointer;
            }
        }
    }
    async setRawDATEXTable(table_name, options) {
        if (!__classPrivateFieldGet(this, _DatexDatabaseAdapter_connected, "f"))
            await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_connect).call(this);
        if (!(await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_queryFirst).call(this, DatexDatabaseAdapter.QUERY.HAS_TABLE, [__classPrivateFieldGet(this, _DatexDatabaseAdapter_credentials, "f").database, table_name])).COUNT)
            throw Error("Table '" + table_name + "' does not exist");
        this.tables_with_raw_datex.add(table_name);
        let column_info = await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_query).call(this, DatexDatabaseAdapter.QUERY.GET_COLUMN_INFO, [__classPrivateFieldGet(this, _DatexDatabaseAdapter_credentials, "f").database, table_name]);
        let has_dx_ptr_column = false;
        let primary_key_name;
        this.table_entries_by_primary_key.set(table_name, new Map());
        const columns = [];
        this.table_columns.set(table_name, columns);
        for (let column of column_info) {
            columns.push(column.COLUMN_NAME);
            if (column.COLUMN_NAME == DatexDatabaseAdapter.DX_PTR_COLUMN) {
                has_dx_ptr_column = true;
                this.tables_with_dx_ptr_column.add(table_name);
            }
            if (column.COLUMN_KEY == 'PRI')
                this.table_primary_keys.set(table_name, primary_key_name = column.COLUMN_NAME);
        }
        if (options?.bind_pointer_ids && !has_dx_ptr_column) {
            console.log("add dx_ptr column");
            await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_query).call(this, DatexDatabaseAdapter.QUERY.ADD_DX_PTR_COLUMN, [table_name]);
            this.tables_with_dx_ptr_column.add(table_name);
        }
        if (!this.table_primary_keys.has(table_name)) {
            throw Error("DATEX pointer binding only works for tables with a primary key");
        }
        this.table_raw_datex_default_options.set(table_name, options);
    }
    async setTableTemplateClass(table_name, template_class, options = {}) {
        if (!__classPrivateFieldGet(this, _DatexDatabaseAdapter_connected, "f"))
            await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_connect).call(this);
        if (!(await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_queryFirst).call(this, DatexDatabaseAdapter.QUERY.HAS_TABLE, [__classPrivateFieldGet(this, _DatexDatabaseAdapter_credentials, "f").database, table_name])).COUNT)
            throw Error("Table '" + table_name + "' does not exist");
        const type = Datex.Type.getClassDatexType(template_class);
        this.table_default_options.set(table_name, options);
        this.table_types.set(table_name, type);
        let column_info = await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_query).call(this, DatexDatabaseAdapter.QUERY.GET_COLUMN_INFO, [__classPrivateFieldGet(this, _DatexDatabaseAdapter_credentials, "f").database, table_name]);
        let has_dx_ptr_column = false;
        let primary_key_name;
        this.table_entries_by_primary_key.set(table_name, new Map());
        const columns = [];
        this.table_columns.set(table_name, columns);
        for (let column of column_info) {
            columns.push(column.COLUMN_NAME);
            if (column.COLUMN_NAME == DatexDatabaseAdapter.DX_PTR_COLUMN) {
                has_dx_ptr_column = true;
                this.tables_with_dx_ptr_column.add(table_name);
            }
            if (column.COLUMN_KEY == 'PRI')
                this.table_primary_keys.set(table_name, primary_key_name = column.COLUMN_NAME);
        }
        if (options?.bind_pointer_ids && !has_dx_ptr_column) {
            console.log("add dx_ptr column");
            await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_query).call(this, DatexDatabaseAdapter.QUERY.ADD_DX_PTR_COLUMN, [table_name]);
            this.tables_with_dx_ptr_column.add(table_name);
        }
        if (!this.table_primary_keys.has(table_name)) {
            throw Error("DATEX pointer binding only works for tables with a primary key");
        }
        __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_initializeDatexTypeForTable).call(this, table_name, type);
        __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_initOptions).call(this, table_name, options);
    }
    async createDATEXTypeForTable(table_name, options = {}) {
        if (!__classPrivateFieldGet(this, _DatexDatabaseAdapter_connected, "f"))
            await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_connect).call(this);
        if (!(await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_queryFirst).call(this, DatexDatabaseAdapter.QUERY.HAS_TABLE, [__classPrivateFieldGet(this, _DatexDatabaseAdapter_credentials, "f").database, table_name])).COUNT)
            throw Error("Table '" + table_name + "' does not exist");
        this.table_default_options.set(table_name, options);
        let column_info = await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_query).call(this, DatexDatabaseAdapter.QUERY.GET_COLUMN_INFO, [__classPrivateFieldGet(this, _DatexDatabaseAdapter_credentials, "f").database, table_name]);
        const table_class = class {
        };
        const template = new Datex.Tuple();
        let has_dx_ptr_column = false;
        let primary_key_name;
        this.table_entries_by_primary_key.set(table_name, new Map());
        for (let column of column_info) {
            if (column.COLUMN_NAME == DatexDatabaseAdapter.DX_PTR_COLUMN) {
                has_dx_ptr_column = true;
                this.tables_with_dx_ptr_column.add(table_name);
            }
            if (column.COLUMN_KEY == 'PRI')
                this.table_primary_keys.set(table_name, primary_key_name = column.COLUMN_NAME);
            template[column.COLUMN_NAME] = __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_getColumnDATEXType).call(this, column);
        }
        if (options?.bind_pointer_ids && !has_dx_ptr_column) {
            console.log("add dx_ptr column");
            await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_query).call(this, DatexDatabaseAdapter.QUERY.ADD_DX_PTR_COLUMN, [table_name]);
            this.tables_with_dx_ptr_column.add(table_name);
        }
        if (!this.table_primary_keys.has(table_name)) {
            throw Error("DATEX pointer binding only works for tables with a primary key");
        }
        const type = Datex.Type.get(__classPrivateFieldGet(this, _DatexDatabaseAdapter_credentials, "f").database, options?.name ?? table_name)
            .setTemplate(template);
        this.table_types.set(table_name, type);
        Datex.updateJSInterfaceConfiguration(type, 'class', table_class);
        __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_initializeDatexTypeForTable).call(this, table_name, type);
        __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_initOptions).call(this, table_name, options);
        return table_class;
    }
    async storeValue(table_name, value) {
        if (!value)
            return;
        const columns = this.table_columns.get(table_name);
        if (!columns)
            return;
        const pointer = Datex.Pointer.getByValue(value);
        let data = [];
        for (let column of columns) {
            if (column == DatexDatabaseAdapter.DX_PTR_COLUMN && pointer instanceof Datex.Pointer) {
                data.push(Buffer.from(pointer.id_buffer.buffer));
                continue;
            }
            let property_set = false;
            for (let config of this.table_default_options.get(table_name)?.transform_properties) {
                console.log("===>", config, column);
                if (config.mapping_type == PropertyMappingType.pointer_ref_extend && false) {
                    console.log("EXTEDS", value[Datex.EXTENDED_OBJECTS]);
                    break;
                }
                else if (config.mapping_type == PropertyMappingType.pointer_ref && config.column == column) {
                    console.log("map ptr coliumn", column);
                    data.push(Buffer.from(Datex.Pointer.getByValue(value).id_buffer.buffer));
                    property_set = true;
                    break;
                }
            }
            if (!property_set)
                data.push(value[column]);
        }
        console.log("insert", table_name, columns, data);
        await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_query).call(this, DatexDatabaseAdapter.QUERY.INSERT_ENTRY, [table_name, columns, data]);
    }
    async getEntriesByPrimaryKeys(table_name, primary_keys, options) {
        if (!this.table_primary_keys.has(table_name))
            throw Error("Invalid table - not registered for DATEX pointer binding");
        const sync_entries = !options || options.sync !== false || (this.table_default_options.get(table_name)?.sync == false && !options?.sync);
        const table_primary_key = this.table_primary_keys.get(table_name);
        const existing_entries = this.table_entries_by_primary_key.get(table_name);
        let entries = [];
        if (sync_entries) {
            let i = 0;
            for (let key of primary_keys) {
                if (existing_entries.has(key)) {
                    entries.push(existing_entries.get(key));
                    primary_keys.splice(i, 1);
                }
                i++;
            }
        }
        if (primary_keys.length) {
            entries = [...entries, await this.getEntries(table_name, "?? IN (?)"), null, [table_primary_key, primary_keys]];
        }
        return entries;
    }
    async getEntries(table_name, where, entry_options, args = []) {
        if (!this.table_primary_keys.has(table_name))
            throw Error("Invalid table - not registered for DATEX pointer binding");
        const options = { ...this.table_default_options.get(table_name), ...entry_options };
        const sync_entries = options.sync !== false;
        const table_primary_key = this.table_primary_keys.get(table_name);
        const entries = [];
        const existing_entries = this.table_entries_by_primary_key.get(table_name);
        const has_dx_ptr_column = this.tables_with_dx_ptr_column.has(table_name);
        const pointer_ref_fields = this.table_pointer_ref_fields.get(table_name);
        let rows = has_dx_ptr_column ?
            await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_query).call(this, "SELECT *,?? FROM ?? WHERE " + where + ";", [DatexDatabaseAdapter.DX_PTR_COLUMN, table_name, ...args]) :
            await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_query).call(this, "SELECT * FROM ?? WHERE " + where + ";", [table_name, ...args]);
        for (let row of rows) {
            if (sync_entries && existing_entries.has(row[table_primary_key])) {
                entries.push(existing_entries.get(row[table_primary_key]));
                continue;
            }
            let object;
            if (this.tables_with_raw_datex.has(table_name)) {
                const raw_options = this.table_raw_datex_default_options.get(table_name);
                const value_column = row[raw_options.datex_column_name];
                console.log("value colmn", value_column);
                switch (raw_options.datex_format) {
                    case "text": object = await Datex.Runtime.parseDatexData(value_column);
                    case "base64": object = await Datex.Runtime.getValueFromBase64DXB(value_column);
                    case "binary": object = await Datex.Runtime.executeDXBLocally(value_column);
                }
            }
            else {
                const entry = {};
                for (let [k, v] of Object.entries(row)) {
                    if (pointer_ref_fields.has(k) && v) {
                        entry[k] = (await Datex.Pointer.load(Datex.Pointer.buffer2hex(new Uint8Array(v?.buffer)))).value;
                    }
                    if (pointer_ref_fields.has(k) && v) {
                        Datex.DatexObject.extend(entry, await Datex.Pointer.load(Datex.Pointer.buffer2hex(new Uint8Array(v?.buffer))));
                    }
                    else if (k != DatexDatabaseAdapter.DX_PTR_COLUMN)
                        entry[k] = v;
                }
                for (let config of options.transform_properties ?? []) {
                    if (config.mapping_type == PropertyMappingType.reverse_pointer_collection_ref) {
                        const collection = await this.getEntries(config.table, "?? = ?", {}, [config.ref_column, row[DatexDatabaseAdapter.DX_PTR_COLUMN]]);
                        console.log("col", collection, config.ref_column, row[DatexDatabaseAdapter.DX_PTR_COLUMN]);
                        entry[config.key] = config.collection_type == Datex.Type.std.Set ? new Set(collection) : collection;
                    }
                }
                object = this.table_types.get(table_name).cast(entry);
            }
            entries.push(object);
            if (sync_entries) {
                if (has_dx_ptr_column) {
                    if (row[DatexDatabaseAdapter.DX_PTR_COLUMN]) {
                        const pointer_id = new Uint8Array(row[DatexDatabaseAdapter.DX_PTR_COLUMN].buffer);
                        const existing_pointer = Datex.Pointer.get(pointer_id);
                        if (existing_pointer) {
                            if (!existing_pointer.value)
                                existing_pointer.value = object;
                            else
                                object = existing_pointer.value;
                        }
                        else {
                            console.log("generate pointer id ", pointer_id);
                            object = Datex.Pointer.create(pointer_id, object).value;
                        }
                    }
                    else {
                        const pointer = Datex.Pointer.create(null, object, false);
                        object = pointer.value;
                        console.log("new pointer id " + pointer);
                        await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_query).call(this, DatexDatabaseAdapter.QUERY.UPDATE_DX_PTR_COLUMN, [table_name, Buffer.from(pointer.id_buffer.buffer), table_primary_key, row[table_primary_key]]);
                    }
                }
                existing_entries.set(row[table_primary_key], object);
            }
        }
        return entries;
    }
}
_a = DatexDatabaseAdapter, _DatexDatabaseAdapter_credentials = new WeakMap(), _DatexDatabaseAdapter_sql_client = new WeakMap(), _DatexDatabaseAdapter_sql_event_watcher = new WeakMap(), _DatexDatabaseAdapter_connected = new WeakMap(), _DatexDatabaseAdapter_instances = new WeakSet(), _DatexDatabaseAdapter_query = function _DatexDatabaseAdapter_query(query_string, query_params) {
    return new Promise((resolve, reject) => {
        if (typeof query_string != "string") {
            console.error("invalid query:", query_string);
            throw ("invalid query");
        }
        if (!query_string)
            throw ("empty query");
        try {
            __classPrivateFieldGet(this, _DatexDatabaseAdapter_sql_client, "f").query(query_string, query_params ?? [], function (err, rows, fields) {
                if (err)
                    reject(err);
                else
                    resolve(rows);
            });
        }
        catch (e) {
            console.error("SQL error:", e);
            reject(e);
        }
    });
}, _DatexDatabaseAdapter_queryFirst = async function _DatexDatabaseAdapter_queryFirst(query_string, query_params) {
    return (await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_query).call(this, query_string, query_params))?.[0];
}, _DatexDatabaseAdapter_connect = async function _DatexDatabaseAdapter_connect() {
    const client = mysql.createConnection({ ...__classPrivateFieldGet(this, _DatexDatabaseAdapter_credentials, "f"),
        typeCast: function (field, next) {
            if (field.type === 'TINY' && field.length === 1)
                return (field.string() === '1');
            if (field.type === 'TINYINT' || field.type === 'LONG' || field.type === 'LONGLONG' || field.type === 'BIGINT' || field.type === 'SMALLINT' || field.type === 'MEDIUMINT' || field.type === 'INT' || field.type === 'YEAR') {
                const string = field.string();
                if (string != null)
                    return BigInt(string);
                return null;
            }
            if (field.type === 'SET')
                return new Set(field.string().split(","));
            if (field.type === 'JSON')
                return JSON.parse(field.string());
            else
                return next();
        }
    });
    return new Promise((resolve, reject) => {
        client.connect(async (err) => {
            if (err)
                reject(err);
            else {
                __classPrivateFieldSet(this, _DatexDatabaseAdapter_connected, true, "f");
                __classPrivateFieldSet(this, _DatexDatabaseAdapter_sql_client, client, "f");
                resolve();
            }
        });
    });
}, _DatexDatabaseAdapter_getColumnDATEXType = function _DatexDatabaseAdapter_getColumnDATEXType(column_info) {
    if (column_info.IS_NULLABLE == "YES")
        return mysql_datex_type_map.get(column_info.DATA_TYPE);
    else
        return mysql_datex_type_map.get(column_info.DATA_TYPE);
}, _DatexDatabaseAdapter_updateField = async function _DatexDatabaseAdapter_updateField(table_name, key, value, primary_key_name, primary_key) {
    console.log("update field", table_name, key, value, primary_key, this.table_pointer_ref_fields.get(table_name)?.has(key));
    if (this.table_pointer_ref_fields.get(table_name)?.has(key)) {
        value = Buffer.from(Datex.Pointer.createOrGet(value).id_buffer.buffer);
    }
    await __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_query).call(this, DatexDatabaseAdapter.QUERY.UPDATE_FIELD, [table_name, key, value, primary_key_name, primary_key]);
}, _DatexDatabaseAdapter_initOptions = function _DatexDatabaseAdapter_initOptions(table_name, options) {
    const pointer_ref_fields = new Set();
    this.table_pointer_ref_fields.set(table_name, pointer_ref_fields);
    for (let config of options.transform_properties ?? []) {
        if (config.mapping_type == PropertyMappingType.pointer_ref) {
            if (config.column == undefined)
                config.column = config.key;
            pointer_ref_fields.add(config.column);
        }
        if (config.mapping_type == PropertyMappingType.pointer_ref_extend) {
            pointer_ref_fields.add(config.column);
        }
    }
}, _DatexDatabaseAdapter_initializeDatexTypeForTable = function _DatexDatabaseAdapter_initializeDatexTypeForTable(table_name, type) {
    const primary_key_name = this.table_primary_keys.get(table_name) ?? DatexDatabaseAdapter.DX_PTR_COLUMN;
    Datex.updateJSInterfaceConfiguration(type, 'proxify_children', false);
    Datex.updateJSInterfaceConfiguration(type, 'set_property', (parent, key, value) => {
        parent[key] = value;
    });
    Datex.updateJSInterfaceConfiguration(type, 'set_property_silently', (parent, key, value, pointer) => {
        pointer.shadow_object[key] = value;
        __classPrivateFieldGet(this, _DatexDatabaseAdapter_instances, "m", _DatexDatabaseAdapter_updateField).call(this, table_name, key, value, primary_key_name, parent[primary_key_name]);
    });
    Datex.updateJSInterfaceConfiguration(type, 'get_property', (parent, key) => {
        return parent[key];
    });
}, _DatexDatabaseAdapter_watchExternalUpdates = function _DatexDatabaseAdapter_watchExternalUpdates(table_name) {
    const expression = __classPrivateFieldGet(this, _DatexDatabaseAdapter_credentials, "f").database + "." + table_name;
    console.log("watch external updates: " + expression);
    const primary_key_name = this.table_primary_keys.get(table_name);
    const existing_entries = this.table_entries_by_primary_key.get(table_name);
    const watcher = __classPrivateFieldGet(this, _DatexDatabaseAdapter_sql_event_watcher, "f").addTrigger({
        name: "UPDATE_" + expression,
        expression,
        statement: MySQLEvents.STATEMENTS.UPDATE,
        onEvent: (event) => {
            for (let row of event.affectedRows) {
                const fields = row.after;
                const primary_key = fields[primary_key_name];
                let is_bigint = false;
                if (existing_entries.has(primary_key) || (is_bigint = true && typeof primary_key == "number" && existing_entries.has(BigInt(primary_key)))) {
                    const entry = existing_entries.get(is_bigint ? BigInt(primary_key) : primary_key);
                    for (let column_name of event.affectedColumns) {
                        console.log("row changed", column_name, fields[column_name]);
                        entry[column_name] = fields[column_name];
                    }
                }
            }
        }
    });
};
Object.defineProperty(DatexDatabaseAdapter, "DX_PTR_COLUMN", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: "__dx_ptr"
});
Object.defineProperty(DatexDatabaseAdapter, "QUERY", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: {
        GET_TABLE_INFO: "SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = ? AND TABLE_NAME = ?;",
        HAS_TABLE: "SELECT COUNT(*) AS COUNT FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = ? AND TABLE_NAME = ?;",
        GET_COLUMN_INFO: "SELECT * FROM INFORMATION_SCHEMA.COLUMNS where TABLE_SCHEMA = ? and TABLE_NAME = ?;",
        GET_TABLE_FIELDS: "SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ? ORDER BY ORDINAL_POSITION;",
        GET_TABLE_FIELD_NAMES: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ? ORDER BY ORDINAL_POSITION;",
        GET_DB_FOREIGN_KEYS: "SELECT TABLE_NAME,COLUMN_NAME,CONSTRAINT_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA = ?;",
        UPDATE_FIELD: "UPDATE ?? SET ?? = ? WHERE ?? = ?;",
        ADD_DX_PTR_COLUMN: "ALTER TABLE ?? ADD COLUMN `" + _a.DX_PTR_COLUMN + "` BINARY(24) INVISIBLE PRIMARY KEY;",
        DROP_DX_PTR_COLUMN: "ALTER TABLE ?? DROP `" + _a.DX_PTR_COLUMN + "` IF EXISTS;",
        UPDATE_DX_PTR_COLUMN: "UPDATE ?? SET `" + _a.DX_PTR_COLUMN + "` = ? WHERE ?? = ?;",
        INSERT_ENTRY: "INSERT INTO ?? (??) VALUES (?)",
        HAS_POINTER: "SELECT COUNT(*) AS COUNT FROM ?? WHERE `" + _a.DX_PTR_COLUMN + "` = ?;",
        WHERE_DX_PTR_ID_IS: "`" + _a.DX_PTR_COLUMN + "` = ?"
    }
});
