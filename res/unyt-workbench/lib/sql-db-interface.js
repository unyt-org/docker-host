var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { scope, expose, template, property, meta } from "../unyt_core/legacy_decorators.js";
import mysql from 'mysql';
import Logger from "../unyt_core/logger.js";
import { Datex } from "../unyt_core/datex_runtime.js";
const logger = new Logger("sql");
function customTypeCast(field, next) {
    if (field.type === 'TIMESTAMP') {
        return new Date(field.string());
    }
    else if (field.type === 'DATETIME' || field.type === 'DATE') {
        return field.string();
    }
    else {
        return next();
    }
}
let SQL = class SQL {
    static active_connections = new WeakMap();
    static connectionOptionsToString(connection_options) {
        return connection_options.user + "@" + connection_options.host + ":" + connection_options.port + ":" + connection_options.database + "&" + connection_options.password;
    }
    static async connect(connection_options, meta) {
        let c_string = this.connectionOptionsToString(connection_options);
        if (this.active_connections.get(meta.sender)?.has(c_string)) {
            logger.success("using active SQL conncection for " + meta.sender);
            return this.active_connections.get(meta.sender).get(c_string);
        }
        let con = new SQLConnection(connection_options);
        await con.connect();
        if (!this.active_connections.has(meta.sender))
            this.active_connections.set(meta.sender, new Map());
        this.active_connections.get(meta.sender).set(c_string, con);
        return con;
    }
};
__decorate([
    meta(1),
    expose,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SQL, "connect", null);
SQL = __decorate([
    scope("sql")
], SQL);
export { SQL };
let SQLConnection = class SQLConnection {
    connection_options;
    client;
    constructor(connection_options) {
        logger.success("creating connection:", connection_options);
        this.connection_options = connection_options;
    }
    async connect() {
        this.connection_options.typeCast = customTypeCast;
        this.client = mysql.createPool(this.connection_options);
    }
    async query(query_string, query_params) {
        if (!this.client)
            await this.connect();
        console.log("QUERY:", query_string, query_params);
        return new Promise((resolve, reject) => {
            if (typeof query_string != "string") {
                console.error("invalid query:", query_string);
                throw ("invalid query");
            }
            if (!query_string)
                throw ("empty query");
            try {
                this.client.query(query_string, query_params ?? [], function (err, rows, fields) {
                    if (err)
                        reject(err);
                    else
                        resolve(rows);
                });
            }
            catch (e) {
                console.error("SQL ERROR 2:", e);
            }
        });
    }
};
__decorate([
    property,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array]),
    __metadata("design:returntype", Promise)
], SQLConnection.prototype, "query", null);
SQLConnection = __decorate([
    template,
    __metadata("design:paramtypes", [Object])
], SQLConnection);
