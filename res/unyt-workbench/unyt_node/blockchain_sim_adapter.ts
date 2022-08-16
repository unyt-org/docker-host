import { DatexDatabaseAdapter } from "./datex_database_adapter.js";
import { BlockchainAdapter } from "../unyt_core/blockchain_adapter.js";

const blockchainDBAdapter = new DatexDatabaseAdapter({
    host      : "Database-RouDB",
    user      : "root",
    password  : "Esb3489uiojfmkAkAwefklovanjdfASDOI",
    port      : 3306,
    database  : "BlockchainSim"
});

// table for blockchain pointer storage
blockchainDBAdapter.setRawDATEXTable("PointerEntries", {datex_column_name:'value', datex_format:'text'});


export class BlockchainSimAdapter implements BlockchainAdapter {

	// public getEndpointPropertyValue(property:Datex.EndpointProperty):any {

	// }

	// public setEndpointPropertyValue(property:Datex.EndpointProperty, value:any):any {

	// }
}