// for classes that can have a value applied to it (e.g. DatexFunction)

import type { datex_scope } from "../utils/global_types.js";
import type { Target } from "./addressing.js";
import type { Stream } from "./stream.js"
import type { Tuple } from "./tuple.js";
import type { Type } from "./type.js";
import type { Quantity } from "./quantity.js";

// <std:ValueConsumer>
export interface ValueConsumer {
    handleApply: (value:any, SCOPE: datex_scope)=>Promise<any>|any
}

// for reading binary streams or strings (e.g. WritableStream)
// <std:StreamConsumer>
export interface StreamConsumer<T=any> {
    write: (next:T, scope?:datex_scope)=>Promise<any>|any
    pipe: (in_stream:Stream<T>, scope?:datex_scope)=>Promise<any>|any
}


/***** Type definitions */

export type primitive = number|bigint|string|boolean|null|undefined;
export type fundamental = primitive|{[key:string]:any}|Array<any>|Tuple;