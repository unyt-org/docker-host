import { Runtime } from "../runtime/runtime.js";
import { Type } from "../types/type.js";
import { Endpoint } from "../types/addressing.js";
import { Scope } from "./scope.js";


export class Maybe<T>  {

    #datex: Scope<T>
    #sender: Endpoint

    #promise:Promise<T>

    constructor(datex:Scope<T>, sender:Endpoint) {
        this.#datex = datex;
        this.#sender = sender;
    }

    value():Promise<T> {
        if (!this.#promise) {
            this.#promise = new Promise(async (resolve, reject)=>{
                try {
                    const res = await this.#datex.execute(this.#sender??Runtime.endpoint);
                    resolve(res);
                }
                catch (e) {
                    reject(e);
                }
            })
        }
        return this.#promise;
    }

}

// only temporary, remove
Type.get("std:__Maybe").setJSInterface({
    class: Maybe,

    is_normal_object: true,
    proxify_children: true,
    visible_children: new Set(["value"]),
})