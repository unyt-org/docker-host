import {meta} from "../unyt_core/datex_js_class_adapter.js";
import {scope, expose, sync, template, property} from "../unyt_core/legacy_decorators.js";

// @ts-ignore
import mysql from 'mysql';
import Logger from "../unyt_core/logger.js";
import { Datex } from "../unyt_core/datex_runtime.js";
// TODO extra db handler - docker

const logger = new Logger("sql");

export type tree_entry = {path:string, children?:tree_entry[], type?:string, linked?:string}

type connection_options = { host: string, user: string, password: string, database:string, port:number, typeCast?:Function};
type query_result = {
    rows: object[],
    fields: field_info[],
    options: {sorted_by_column?:string, desc?:boolean};
}

type field_info = {
    CHARACTER_MAXIMUM_LENGTH: number,
    CHARACTER_OCTET_LENGTH: number,
    CHARACTER_SET_NAME: string,
    COLLATION_NAME: string,
    COLUMN_COMMENT: string,
    COLUMN_DEFAULT: any,
    COLUMN_KEY: string,
    COLUMN_NAME: string,
    COLUMN_TYPE: string,
    DATA_TYPE: string,
    DATETIME_PRECISION: any,
    EXTRA: string,
    GENERATION_EXPRESSION: string,
    IS_NULLABLE: string,
    NUMERIC_PRECISION: any,
    NUMERIC_SCALE: any,
    ORDINAL_POSITION: number,
    PRIVILEGES: string,
    TABLE_CATALOG: string,
    TABLE_NAME: string,
    TABLE_SCHEMA: string,
};

type connection = {
    station_id: number,
    client:any,
    host: string
}

function customTypeCast(field, next) {
    // if (field.type === 'TINY' && field.length === 1) {
    //     return (field.string() === '1'); // 1 = true, 0 = false
    // }
    if (field.type === 'TIMESTAMP') {
        return new Date(field.string());
    }
    else if (field.type === 'DATETIME' || field.type === 'DATE' ) {
        return field.string();
    }
    else {
        return next();
    }
}

// db handler version 2
@scope("sql") export abstract class SQL {

    private static active_connections = new Map<Datex.Addresses.Endpoint, Map<string, SQLConnection>>();

    private static connectionOptionsToString(connection_options:connection_options) {
        return connection_options.user + "@" + connection_options.host + ":" + connection_options.port + ":" + connection_options.database + "&" + connection_options.password;
    }

    @expose static async connect(connection_options: connection_options, @meta meta) {
        let c_string = this.connectionOptionsToString(connection_options);

        // already has connection? 
        if (this.active_connections.get(meta.sender)?.has(c_string)) {
            logger.success("using active SQL conncection");
            return this.active_connections.get(meta.sender).get(c_string);
        }

        // create new
        let con = new SQLConnection(connection_options);
        await con.connect();

        // save as active connection
        if (!this.active_connections.has(meta.sender)) this.active_connections.set(meta.sender, new Map());
        this.active_connections.get(meta.sender).set(c_string, con);
        return con;
    }

}


@template class SQLConnection {

    connection_options:connection_options
    client:any
    @property connected = false

    constructor(connection_options: connection_options) {
        logger.success("creating connection:", connection_options);
        this.connection_options = connection_options;
    }

    async connect() {
        return new Promise<void>((resolve, reject)=>{
            this.connection_options.typeCast = customTypeCast;
            this.client = mysql.createConnection(this.connection_options);

            this.client.on("error", (e)=>{
                logger.error(e);
                if (e.code = "PROTOCOL_CONNECTION_LOST") this.connected = false;
            });

            this.client.connect( err => {
                if (err) reject(err);
                else {
                    this.connected = true;
                    resolve();
                }
            });
        })
    }

    // public methods
    @property async query(query_string:string, query_params?:any[]): Promise<any> {
        if (!this.client || !this.connected) await this.connect();

        console.log("QUERY:", query_string, query_params);
        return new Promise((resolve, reject)=>{
            if (typeof query_string != "string") {console.error("invalid query:", query_string); throw("invalid query")}
            if (!query_string) throw("empty query");
            try {
                this.client.query(query_string, query_params??[], function (err, rows, fields) {
                    if (err) reject(err);
                    else resolve(rows);
                });
            } catch (e){
                console.error("SQL ERROR 2:", e);
            }
          
        })
    }
}

