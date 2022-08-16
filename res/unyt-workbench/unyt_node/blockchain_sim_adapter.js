import { DatexDatabaseAdapter } from "./datex_database_adapter.js";
const blockchainDBAdapter = new DatexDatabaseAdapter({
    host: "Database-RouDB",
    user: "root",
    password: "Esb3489uiojfmkAkAwefklovanjdfASDOI",
    port: 3306,
    database: "BlockchainSim"
});
blockchainDBAdapter.setRawDATEXTable("PointerEntries", { datex_column_name: 'value', datex_format: 'text' });
export class BlockchainSimAdapter {
}
