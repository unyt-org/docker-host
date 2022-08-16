/**
 ╔══════════════════════════════════════════════════════════════════════════════════════╗
 ║  DATEX Database adapter                                                              ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  Synchronizes SQL database entries with DATEX pointers                               ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  © 2022 unyt.org                        ║                                            ║
 ╚═════════════════════════════════════════╩════════════════════════════════════════════╝
*/

// @ts-ignore
import mysql from 'mysql';
// @ts-ignore
import MySQLEvents from '@rodrigogs/mysql-events';

import { Datex } from '../unyt_core/datex_runtime.js';

type db_credentials = {
    host: string
    user: string
    password:string
    port: number
    database?: string
}

type Class = (new (...args: any[]) => any); // type for a JS class

export enum PropertyMappingType {
    reverse_pointer_collection_ref, // n children references
    pointer_ref, // 1 reference to another object
    pointer_ref_extend // 1 reference to another object, extend the object
}
type transform_property_config = {
    mapping_type: PropertyMappingType,

    key?: string,  // property key of the object
    column?: string, // table column

    table?: string, // table where mapped entries come from
    ref_column?: string,  // column in this table that references the ptr_id of the parent object
    collection_type?: Datex.Type // store transactions in Array/Set/...

    generate?: ()=>{ // TODO

    }
}

type table_type_options = {
    sync?: boolean, // sync entries for this table per default (default = true)
    listen_for_external_updates?: boolean, // update synced entry objects when the database row is updated by an external party (default = true)
    bind_pointer_ids?: boolean, // add a new column to the table to store a pointer id for each row (default = false)
    name?: string, // custom name for the type

    transform_properties?: transform_property_config[]
}

type table_raw_datex_options = {
    sync?: boolean, // sync entry (default = true)
    datex_column_name: string
    datex_format?:'text'|'base64'|'binary',
    listen_for_external_updates?: boolean, // update synced entry objects when the database row is updated by an external party (default = true)
    bind_pointer_ids?: boolean, // add a new column to the table to store a pointer id for each row (default = false)
}

type table_entry_options = {
    sync?: boolean, // sync entry (default = true)
}

type mysql_data_type = 'int'|'bigint'|'smallint'|'mediumint'|'tinyint'|'tiny'|'long'|'year'|'longlong'|
                       'float'|'double'|'decimal'|
                       'timestamp'|'date'|'datetime'|
                       'time'|'varchar'|'char'|'text'|'tinytext'|'mediumtext'|'longtext'|'enum'|
                       'set'|'geometry'|
                       'tinyblob'|'blob'|'mediumblob'|'longblob'|'binary'|'varbinary'|'bit'|
                       'boolean'|'json';
type mysql_data_type_caps = `${Uppercase<mysql_data_type>}`

type mysql_type_field = {
    name: string,
    db: string,
    table: string,
    type: mysql_data_type_caps,
    length: number,
    string: ()=>string,
    buffer: ()=>Buffer,
    geometry: ()=>any
}

type mysql_column = {
    TABLE_CATALOG: string,
    TABLE_SCHEMA: string,
    TABLE_NAME: string,
    COLUMN_NAME: string,
    ORDINAL_POSITION: bigint,
    COLUMN_DEFAULT: any,
    IS_NULLABLE: 'NO'|'YES',
    DATA_TYPE: mysql_data_type,
    CHARACTER_MAXIMUM_LENGTH: bigint,
    CHARACTER_OCTET_LENGTH: bigint,
    NUMERIC_PRECISION: bigint,
    NUMERIC_SCALE: bigint,
    DATETIME_PRECISION: bigint,
    CHARACTER_SET_NAME: string,
    COLLATION_NAME: string,
    COLUMN_TYPE: mysql_data_type|`${mysql_data_type}(${number})`,
    COLUMN_KEY: 'PRI'|'',
    EXTRA: string,
    PRIVILEGES: string,
    COLUMN_COMMENT: string,
    GENERATION_EXPRESSION: string,
    SRS_ID: any
}

const mysql_datex_type_map = new Map<mysql_data_type,Datex.Type>([
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
])



export class DatexDatabaseAdapter implements Datex.PointerSource {

    #credentials: db_credentials
    #sql_client: any
    #sql_event_watcher: any


    #connected = false;

    table_types:Map<string,Datex.Type> = new Map();
    table_default_options:Map<string,table_type_options> = new Map();
    table_raw_datex_default_options:Map<string,table_raw_datex_options> = new Map();
    table_columns:Map<string,string[]> = new Map();
    table_primary_keys:Map<string,string> = new Map();
    table_entries_by_primary_key:Map<string,Map<any,any>> = new Map();
    tables_with_dx_ptr_column:Set<string> = new Set();
    table_pointer_ref_fields:Map<string,Set<string>> = new Map();
    tables_with_raw_datex:Set<string> = new Set();

    static DX_PTR_COLUMN = "__dx_ptr"

    static QUERY = {
        GET_TABLE_INFO: "SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = ? AND TABLE_NAME = ?;",
        HAS_TABLE: "SELECT COUNT(*) AS COUNT FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = ? AND TABLE_NAME = ?;",
        GET_COLUMN_INFO: "SELECT * FROM INFORMATION_SCHEMA.COLUMNS where TABLE_SCHEMA = ? and TABLE_NAME = ?;",
        GET_TABLE_FIELDS: "SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ? ORDER BY ORDINAL_POSITION;",
        GET_TABLE_FIELD_NAMES: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ? ORDER BY ORDINAL_POSITION;",
        GET_DB_FOREIGN_KEYS: "SELECT TABLE_NAME,COLUMN_NAME,CONSTRAINT_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA = ?;",
        UPDATE_FIELD: "UPDATE ?? SET ?? = ? WHERE ?? = ?;",
        ADD_DX_PTR_COLUMN: "ALTER TABLE ?? ADD COLUMN `"+this.DX_PTR_COLUMN+"` BINARY(24) INVISIBLE PRIMARY KEY;",
        DROP_DX_PTR_COLUMN: "ALTER TABLE ?? DROP `"+this.DX_PTR_COLUMN+"` IF EXISTS;",
        UPDATE_DX_PTR_COLUMN: "UPDATE ?? SET `"+this.DX_PTR_COLUMN+"` = ? WHERE ?? = ?;",
        INSERT_ENTRY: "INSERT INTO ?? (??) VALUES (?)",
        HAS_POINTER: "SELECT COUNT(*) AS COUNT FROM ?? WHERE `"+this.DX_PTR_COLUMN+"` = ?;",
        WHERE_DX_PTR_ID_IS: "`"+this.DX_PTR_COLUMN+"` = ?"
    }

    constructor(credentials:db_credentials, use_as_pointer_source = true) {
        this.#credentials = credentials
        if (use_as_pointer_source) Datex.Pointer.registerPointerSource(this); // enable pointer loading from database
    }


    async getPointer(pointer_id: string, pointerify?: boolean) {
        for (let table of this.tables_with_dx_ptr_column) {
            const pointer_id_buffer = Buffer.from(Datex.Pointer.hex2buffer(pointer_id).buffer);
            const has_pointer = (await this.#queryFirst<{COUNT:number}>(DatexDatabaseAdapter.QUERY.HAS_POINTER, [table,pointer_id_buffer])).COUNT;

            if (has_pointer) {
                const [pointer] = await this.getEntries(table, DatexDatabaseAdapter.QUERY.WHERE_DX_PTR_ID_IS, {sync:false}, [pointer_id_buffer])
                return pointer;
            }
        }
    }

    #query<row=object>(query_string:string, query_params?:any[]): Promise<row[]> {
        return new Promise((resolve, reject)=>{
            if (typeof query_string != "string") {console.error("invalid query:", query_string); throw("invalid query")}
            if (!query_string) throw("empty query");
            try {
                this.#sql_client.query(query_string, query_params??[], function (err, rows, fields) {
                    if (err) reject(err);
                    else resolve(rows);
                });
            } catch (e){
                console.error("SQL error:", e);
                reject(e);
            }
          
        })
    }

    async #queryFirst<row=object>(query_string:string, query_params?:any[]): Promise<row> {
        return (await this.#query<row>(query_string, query_params))?.[0]
    }

    async #connect(){
        const client = mysql.createConnection({...this.#credentials, 
            // custom type casting
            typeCast: function (field:mysql_type_field, next:Function) {
                if (field.type === 'TINY' && field.length === 1) return (field.string() === '1')
                if (field.type === 'TINYINT' || field.type === 'LONG' || field.type === 'LONGLONG' || field.type === 'BIGINT' || field.type === 'SMALLINT' || field.type === 'MEDIUMINT' || field.type === 'INT' || field.type === 'YEAR') {
                    const string = field.string();
                    if (string != null) return BigInt(string);
                    return null;
                }
                if (field.type === 'SET') return new Set(field.string().split(","));
                if (field.type === 'JSON') return JSON.parse(field.string());

                else return next();
            }
        });
        return new Promise<void>((resolve, reject)=>{
            client.connect(async err => {
                if (err) reject(err);
                else {
                    this.#connected = true;
                    this.#sql_client = client;
                    // todo reenable - error
                    // this.#sql_event_watcher = new MySQLEvents(client) 
                    // await this.#sql_event_watcher.start();
                    resolve();
                }
            });
        })
    }


    #getColumnDATEXType(column_info:mysql_column):Datex.Type {
        // TODO optional DATEX type
        if (column_info.IS_NULLABLE == "YES") return mysql_datex_type_map.get(column_info.DATA_TYPE)
        else return mysql_datex_type_map.get(column_info.DATA_TYPE)
    }

    // table with values stored as raw DATEX
    async setRawDATEXTable(table_name:string, options:table_raw_datex_options) {
        if (!this.#connected) await this.#connect();
        if (!(await this.#queryFirst<{COUNT:number}>(DatexDatabaseAdapter.QUERY.HAS_TABLE, [this.#credentials.database, table_name])).COUNT) throw Error("Table '"+table_name+"' does not exist")

        this.tables_with_raw_datex.add(table_name);

        // first get all columns
        let column_info = await this.#query<mysql_column>(DatexDatabaseAdapter.QUERY.GET_COLUMN_INFO, [this.#credentials.database, table_name]);
        let has_dx_ptr_column = false;

        let primary_key_name:string

        this.table_entries_by_primary_key.set(table_name, new Map());
        const columns = [];
        this.table_columns.set(table_name, columns);

        for (let column of column_info) {
            columns.push(column.COLUMN_NAME);
            // is the DX_PTR column
            if (column.COLUMN_NAME == DatexDatabaseAdapter.DX_PTR_COLUMN) {
                has_dx_ptr_column = true;
                this.tables_with_dx_ptr_column.add(table_name);
            }
            // other columns
            if (column.COLUMN_KEY == 'PRI') this.table_primary_keys.set(table_name, primary_key_name = column.COLUMN_NAME);
        }

        // add DX_PTR column?
        if (options?.bind_pointer_ids && !has_dx_ptr_column) {
            console.log("add dx_ptr column")
            await this.#query(DatexDatabaseAdapter.QUERY.ADD_DX_PTR_COLUMN, [table_name]);
            this.tables_with_dx_ptr_column.add(table_name)
        }

        // no primary key
        if (!this.table_primary_keys.has(table_name)) {
            throw Error("DATEX pointer binding only works for tables with a primary key")
        }

        this.table_raw_datex_default_options.set(table_name, options);
    }


    // bind a custom templated JS class to a table, entries are automatically casted
    async setTableTemplateClass(table_name:string, template_class:Class, options:table_type_options = {}) {
        if (!this.#connected) await this.#connect();
        if (!(await this.#queryFirst<{COUNT:number}>(DatexDatabaseAdapter.QUERY.HAS_TABLE, [this.#credentials.database, table_name])).COUNT) throw Error("Table '"+table_name+"' does not exist")

        const type = Datex.Type.getClassDatexType(template_class);
        this.table_default_options.set(table_name, options);

        this.table_types.set(table_name, type)

        // first get all columns
        let column_info = await this.#query<mysql_column>(DatexDatabaseAdapter.QUERY.GET_COLUMN_INFO, [this.#credentials.database, table_name]);

        let has_dx_ptr_column = false;

        let primary_key_name:string

        this.table_entries_by_primary_key.set(table_name, new Map());
        const columns = [];
        this.table_columns.set(table_name, columns);

        for (let column of column_info) {
            columns.push(column.COLUMN_NAME);
            // is the DX_PTR column
            if (column.COLUMN_NAME == DatexDatabaseAdapter.DX_PTR_COLUMN) {
                has_dx_ptr_column = true;
                this.tables_with_dx_ptr_column.add(table_name)
            }
            // other columns
            if (column.COLUMN_KEY == 'PRI') this.table_primary_keys.set(table_name, primary_key_name = column.COLUMN_NAME);
        }

        // add DX_PTR column?
        if (options?.bind_pointer_ids && !has_dx_ptr_column) {
            console.log("add dx_ptr column")
            await this.#query(DatexDatabaseAdapter.QUERY.ADD_DX_PTR_COLUMN, [table_name]);
            this.tables_with_dx_ptr_column.add(table_name)
        }

        // no primary key
        if (!this.table_primary_keys.has(table_name)) {
            throw Error("DATEX pointer binding only works for tables with a primary key")
        }

        this.#initializeDatexTypeForTable(table_name, type);
        this.#initOptions(table_name, options);

    }

    // create a new DATEX type & JS class to handle entries of a table
    async createDATEXTypeForTable(table_name: string, options:table_type_options = {}){
        if (!this.#connected) await this.#connect();
        if (!(await this.#queryFirst<{COUNT:number}>(DatexDatabaseAdapter.QUERY.HAS_TABLE, [this.#credentials.database, table_name])).COUNT) throw Error("Table '"+table_name+"' does not exist")

        this.table_default_options.set(table_name, options);

        // first get all columns
        let column_info = await this.#query<mysql_column>(DatexDatabaseAdapter.QUERY.GET_COLUMN_INFO, [this.#credentials.database, table_name]);

        // create class
        const table_class = class {};
        const template = new Datex.Record();
        let has_dx_ptr_column = false;

        let primary_key_name:string

        this.table_entries_by_primary_key.set(table_name, new Map());

        for (let column of column_info) {
            // is the DX_PTR column
            if (column.COLUMN_NAME == DatexDatabaseAdapter.DX_PTR_COLUMN) {
                has_dx_ptr_column = true;
                this.tables_with_dx_ptr_column.add(table_name)
            }
            // other columns
            if (column.COLUMN_KEY == 'PRI') this.table_primary_keys.set(table_name, primary_key_name = column.COLUMN_NAME);
            template[column.COLUMN_NAME] = this.#getColumnDATEXType(column);
        }

        // add DX_PTR column?
        if (options?.bind_pointer_ids && !has_dx_ptr_column) {
            console.log("add dx_ptr column")
            await this.#query(DatexDatabaseAdapter.QUERY.ADD_DX_PTR_COLUMN, [table_name]);
            this.tables_with_dx_ptr_column.add(table_name)
        }

        // no primary key
        if (!this.table_primary_keys.has(table_name)) {
            throw Error("DATEX pointer binding only works for tables with a primary key")
        }
 
        // create DATEX pseudo type
        const type = Datex.Type.get(this.#credentials.database, options?.name ?? table_name)
            .setTemplate(template);

        this.table_types.set(table_name, type)
    
        Datex.updateJSInterfaceConfiguration(type, 'class', table_class);
        this.#initializeDatexTypeForTable(table_name, type);
        this.#initOptions(table_name, options);

        return table_class
    }

    async storeValue(table_name:string, value:any) {
        if (!value) return;
        const columns = this.table_columns.get(table_name);
        if (!columns) return;

        const pointer = Datex.Pointer.getByValue(value);

        let data = []; 
        for (let column of columns) {
            // add __ptr
            if (column == DatexDatabaseAdapter.DX_PTR_COLUMN && pointer instanceof Datex.Pointer) {
                data.push(Buffer.from(pointer.id_buffer.buffer));
                continue;
            }

            let property_set = false;
            // add extended pointers
            for (let config of this.table_default_options.get(table_name)?.transform_properties) {
                console.log("===>",config, column);
                if (config.mapping_type == PropertyMappingType.pointer_ref_extend && false) {
                    console.log("EXTEDS",value[Datex.EXTENDED_OBJECTS]);
                    break;
                }
                else if (config.mapping_type == PropertyMappingType.pointer_ref && config.column == column) {
                    console.log("map ptr coliumn", column)
                    data.push(Buffer.from(Datex.Pointer.getByValue(value).id_buffer.buffer));
                    property_set = true;
                    break;
                }
            }
            
            // add normal value
            if (!property_set) data.push(value[column]);
        }

        console.log("insert", table_name, columns, data);

        await this.#query(DatexDatabaseAdapter.QUERY.INSERT_ENTRY, [table_name,columns,data]);
    }

    async #updateField (table_name:string, key:string, value:any, primary_key_name:string, primary_key:any) {
        console.log("update field", table_name, key, value, primary_key, this.table_pointer_ref_fields.get(table_name)?.has(key));

        // get pointer id for ref fields
        if (this.table_pointer_ref_fields.get(table_name)?.has(key)) {
            value = Buffer.from(Datex.Pointer.createOrGet(value).id_buffer.buffer);
        }

        await this.#query(DatexDatabaseAdapter.QUERY.UPDATE_FIELD, [table_name,key,value,primary_key_name,primary_key]);
    }

    #initOptions(table_name:string, options:table_type_options){
        const pointer_ref_fields = new Set<string>()
        this.table_pointer_ref_fields.set(table_name, pointer_ref_fields);

        for (let config of options.transform_properties??[]) {
            if (config.mapping_type == PropertyMappingType.pointer_ref) {
                if (config.column == undefined) config.column = config.key;
                pointer_ref_fields.add(config.column);
            }
            if (config.mapping_type == PropertyMappingType.pointer_ref_extend) {
                pointer_ref_fields.add(config.column);
            }
        }
    }

    #initializeDatexTypeForTable(table_name:string, type:Datex.Type)  {
        
        const primary_key_name = this.table_primary_keys.get(table_name) ?? DatexDatabaseAdapter.DX_PTR_COLUMN;

    
        Datex.updateJSInterfaceConfiguration(type, 'proxify_children', false);
        
        Datex.updateJSInterfaceConfiguration(type, 'set_property', (parent, key, value) => {
            parent[key] = value;
        });

        Datex.updateJSInterfaceConfiguration(type, 'set_property_silently', (parent, key, value, pointer) => { // called indirectly when set_property called
            pointer.shadow_object[key] = value;
            this.#updateField(table_name, key, value, primary_key_name, parent[primary_key_name]) // update in DB table
        });

        Datex.updateJSInterfaceConfiguration(type, 'get_property', (parent, key) => {
            return parent[key]
        });

        // // listen for table updates
        // if (!options || options.listen_for_external_updates !== false) {
        //     this.#watchExternalUpdates(table_name)
        // }

    }


    #watchExternalUpdates(table_name: string){
        const expression = this.#credentials.database+"."+table_name;
        console.log("watch external updates: " + expression)
        
        const primary_key_name = this.table_primary_keys.get(table_name);
        const existing_entries = this.table_entries_by_primary_key.get(table_name);

        // row updated
        const watcher = this.#sql_event_watcher.addTrigger({
            name: "UPDATE_" + expression,
            expression,
            statement: MySQLEvents.STATEMENTS.UPDATE,
            onEvent: (event) => {
                for (let row of event.affectedRows) {
                    const fields = row.after;
                    const primary_key = fields[primary_key_name];
                    let is_bigint = false;

                    // entry is loaded as DATEX pointer
                    if (existing_entries.has(primary_key) || (is_bigint = true && typeof primary_key == "number" && existing_entries.has(BigInt(primary_key)))) {
                        const entry = existing_entries.get(is_bigint ? BigInt(primary_key) : primary_key);
                        for (let column_name of event.affectedColumns) {
                            console.log("row changed", column_name, fields[column_name])
                            entry[column_name] = fields[column_name];   
                        }
                    }
                }
            
            }
        });
    }

    // select entries with primary keys from table
    async getEntriesByPrimaryKeys(table_name:string, primary_keys:any[], options?:table_entry_options):Promise<any[]>{
        if (!this.table_primary_keys.has(table_name)) throw Error("Invalid table - not registered for DATEX pointer binding");
        
        const sync_entries = !options || options.sync !== false || (this.table_default_options.get(table_name)?.sync==false && !options?.sync);
        const table_primary_key = this.table_primary_keys.get(table_name);
        const existing_entries = this.table_entries_by_primary_key.get(table_name);

        let entries = [];

        // already created pointers for primary keys?
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
        
        // query required for not yet loaded rows?
        if (primary_keys.length) {
            entries = [...entries, await this.getEntries(table_name, "?? IN (?)"), null, [table_primary_key, primary_keys]];
        }
    
        return entries;
    }

    // select from table with custom where condition, convert entries to DATEX values
    async getEntries(table_name:string, where:string, entry_options?:table_entry_options, args:any[] = []):Promise<any[]>{
        if (!this.table_primary_keys.has(table_name)) throw Error("Invalid table - not registered for DATEX pointer binding");

        const options = {...this.table_default_options.get(table_name), ... entry_options};

        const sync_entries = options.sync !== false;

        const table_primary_key = this.table_primary_keys.get(table_name);
        const entries = [];
        const existing_entries = this.table_entries_by_primary_key.get(table_name);
        const has_dx_ptr_column = this.tables_with_dx_ptr_column.has(table_name);
        

        const pointer_ref_fields =  this.table_pointer_ref_fields.get(table_name);

        let rows = has_dx_ptr_column ? 
            await this.#query("SELECT *,?? FROM ?? WHERE "+where+";", [DatexDatabaseAdapter.DX_PTR_COLUMN, table_name, ...args]) :
            await this.#query("SELECT * FROM ?? WHERE "+where+";", [table_name, ...args]);

        //console.log("=>rwos",rows);
        
        for (let row of rows) {
            // already loaded
            if (sync_entries && existing_entries.has(row[table_primary_key])) {
                entries.push(existing_entries.get(row[table_primary_key]));
                continue;
            }

            let object:any;

            // is raw DATEX value table
            if (this.tables_with_raw_datex.has(table_name)) {
                const raw_options = this.table_raw_datex_default_options.get(table_name);
                const value_column = row[raw_options.datex_column_name];
                console.log("value colmn", value_column);
                switch (raw_options.datex_format) {
                    case "text": object = await Datex.Runtime.parseDatexData(value_column)
                    case "base64": object = await Datex.Runtime.getValueFromBase64DXB(value_column)
                    case "binary": object = await Datex.Runtime.executeDXBLocally(value_column)
                }
            }

            // is normal table entry -> DATEX value mapping
            else {
                const entry = {};
                for (let [k,v] of Object.entries(row)) {
                    if (pointer_ref_fields.has(k) && v) {
                        entry[k] = (await Datex.Pointer.load(Datex.Pointer.buffer2hex(new Uint8Array(v?.buffer)))).value;
                    }
                    if (pointer_ref_fields.has(k) && v) {
                        Datex.DatexObject.extend(entry, await Datex.Pointer.load(Datex.Pointer.buffer2hex(new Uint8Array(v?.buffer))));
                    }
                    else if (k!=DatexDatabaseAdapter.DX_PTR_COLUMN) entry[k] = v;
                }

                // additional properties

                for (let config of options.transform_properties??[]) {
                    if (config.mapping_type == PropertyMappingType.reverse_pointer_collection_ref) {
                        const collection = await this.getEntries(config.table, "?? = ?", {}, [config.ref_column, row[DatexDatabaseAdapter.DX_PTR_COLUMN]])
                        console.log("col",collection,config.ref_column, row[DatexDatabaseAdapter.DX_PTR_COLUMN]);
                        entry[config.key] = config.collection_type == Datex.Type.std.Set ? new Set(collection) : collection
                    }
                } 

                object = this.table_types.get(table_name).cast(entry);
            }


            entries.push(object)

            // sync object
            if (sync_entries) {
                    
                if (has_dx_ptr_column) {
                    // already has a pointer id
                    if (row[DatexDatabaseAdapter.DX_PTR_COLUMN]) {
                        const pointer_id = new Uint8Array(row[DatexDatabaseAdapter.DX_PTR_COLUMN].buffer);

                        const existing_pointer = Datex.Pointer.get(pointer_id);

                        // pointer already exists
                        if (existing_pointer) {
                            if (!existing_pointer.value) existing_pointer.value = object;
                            else object = existing_pointer.value
                        }
                        // create new pointer with id
                        else {
                            console.log("generate pointer id ", pointer_id);
                            object = Datex.Pointer.create(pointer_id, object).value;
                        }
                    }

                    // add new pointer id
                    else {
                        const pointer = Datex.Pointer.create(null, object, false)
                        object = pointer.value;
                        console.log("new pointer id " + pointer);
                        // save in table
                        await this.#query(DatexDatabaseAdapter.QUERY.UPDATE_DX_PTR_COLUMN, [table_name, Buffer.from(pointer.id_buffer.buffer), table_primary_key, row[table_primary_key]])
                    }
                }

                // save to existing entries map
                existing_entries.set(row[table_primary_key], object);
            }

        }

        return entries;
    }


}