// Blockchain

import { INVALID } from "../runtime/constants.js";
import { Type } from "./type.js";

export class BlockchainTransaction {

    constructor(public transaction:{data:any, type:number} = {data:undefined, type:0}) {

    }
}



// <Block>
Type.std.Transaction.setJSInterface({
    class: BlockchainTransaction,

    serialize: (value:BlockchainTransaction) => value.transaction,

    empty_generator: ()=>new BlockchainTransaction(),

    cast: value => {
        if (value instanceof Object) return new BlockchainTransaction(value);
        return INVALID;
    }
})

