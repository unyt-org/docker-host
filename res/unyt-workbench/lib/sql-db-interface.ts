import {Datex,scope, expose, sync, template, property, meta} from "../unyt_core/datex.js";

// @ts-ignore
import mysql from 'mysql';
// TODO extra db handler - docker

const logger = new Datex.Logger("sql");

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

    private static active_connections = new WeakMap<Datex.Endpoint, Map<string, SQLConnection>>();

    private static connectionOptionsToString(connection_options:connection_options) {
        return connection_options.user + "@" + connection_options.host + ":" + connection_options.port + ":" + connection_options.database + "&" + connection_options.password;
    }

    @meta(1)
    @expose static async connect(connection_options: connection_options, meta:Datex.datex_meta) {
        let c_string = this.connectionOptionsToString(connection_options);

        // already has connection?
        if (this.active_connections.get(meta.sender)?.has(c_string)) {
            logger.success("using active SQL conncection for " + meta.sender);
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

    constructor(connection_options: connection_options) {
        logger.success("creating connection:", connection_options);
        this.connection_options = connection_options;
    }

    async connect() {
        this.connection_options.typeCast = customTypeCast;
        this.client = mysql.createPool(this.connection_options);
    }

    // public methods
    @property async query(query_string:string, query_params?:any[]): Promise<any> {
        if (!this.client) await this.connect();

        // convert buffers to Node Buffers
        for (let i=0;i<query_params?.length;i++) {
            if (query_params[i] instanceof ArrayBuffer) query_params[i] = Buffer.from(query_params[i]);
            else if (query_params[i] instanceof Array) {
                for (let j=0;j<query_params[i]?.length;j++) {
                    if (query_params[i][j] instanceof ArrayBuffer) query_params[i][j] = Buffer.from(query_params[i][j]);
                }
            }
        }

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

