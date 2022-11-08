import { ValueError } from "./errors.js";
import { DatexObject } from "./object.js";

// Tuple
export class Tuple<T=any> {

    // '#' not working with proxy?
    #indexed:Array<T> = [];
    #named:Map<string,T> = new Map();

    constructor(initial_value?:T[]|Set<T>|Map<string,T>|Object){
        if (initial_value instanceof Array || initial_value instanceof Set) {
            this.#indexed.push(...initial_value);
        }
        else if (initial_value instanceof Map) {
            for (const [k,v] of initial_value) this.#named.set(k,v);
        }
        else if (typeof initial_value === "object"){
            for (let [name,value] of Object.entries(initial_value)) this.#named.set(name, value);
        }
        else if (initial_value != null) throw new ValueError("Invalid initial value for <Tuple>");
    }

    seal(){
        DatexObject.seal(this);
        return this;
    }

    get indexed(){
        return this.#indexed;
    }

    get named(){
        return this.#named;
    }

    // total size (number + string indices)
    get size(){
        return this.#named.size + this.#indexed.length;
    }

    // set value at index
    set(index:number|bigint|string, value:any) {
        if (typeof index === "number" || typeof index === "bigint") this.#indexed[Number(index)] = value;
        else if (typeof index === "string") this.#named.set(index, value);
        else throw new ValueError("<Tuple> key must be <text> or <integer>")
    }

    // get value at index
    get(index:number|bigint|string) {
        if (typeof index === "number" || typeof index === "bigint") return this.#indexed[Number(index)];
        else if (typeof index === "string") return this.#named.get(index);
        else throw new ValueError("<Tuple> key must be <text> or <integer>")
    }

    // get value at index
    has(index:number|bigint|string) {
        if (typeof index === "number" || typeof index === "bigint") return Number(index) in this.#indexed;
        else if (typeof index === "string") return this.#named.has(index);
        else throw new ValueError("<Tuple> key must be <text> or <integer>")
    }
    
    hasValue(value:any) {
        return this.#indexed.includes(value) || [...this.#named.values()].includes(value)
    }

    // return copy of internal array if only number indices
    toArray() {
        if (this.#named.size == 0) return [...this.#indexed];
        else throw new ValueError("<Tuple> has non-integer indices");
    }

    // to object
    toObject() {
        if (this.#indexed.length == 0) return Object.fromEntries(this.#named);
        else throw new ValueError("<Tuple> has integer indices");
    }

    entries(): Iterable<readonly [bigint|string, T]> {
        return this[Symbol.iterator]();
    }

    *keys(): Iterable<bigint|string> {
        for (const entry of this.#indexed.keys()) yield BigInt(entry[0]);
        for (const entry of this.#named.keys()) yield entry;
    }

    // create full copy
    clone(){
        const cloned = new Tuple(this.named);
        cloned.indexed.push(...this.indexed)
        return cloned;
    }

    // push to array
    push(...values:any[]){
        this.#indexed.push(...values);
    }


    // push and add
    spread(other:Tuple) {
        this.#indexed.push(...other.indexed);
        for (let [name,value] of other.named.entries()) this.#named.set(name, value);
    }

    *[Symbol.iterator]() {
        for (const entry of this.#indexed.entries()) yield <[bigint, T]>[BigInt(entry[0]), entry[1]];
        for (const entry of this.#named.entries()) yield entry;
    }

    // generate Tuple of start..end
    static generateRange(start:bigint|number, end:bigint|number): Tuple<bigint>{
        if (typeof start == "number") start = BigInt(start);
        if (typeof end == "number") end = BigInt(end);

        if (typeof start != "bigint" || typeof end != "bigint") throw new ValueError("Range only accepts <integer> as boundaries");
        if (end<start) throw new ValueError("Second range boundary must be greater than or equal to the first boundary");

        const N = Number(end-start), range = new Tuple<bigint>();
        let i = 0n;
        while (i < N) range[Number(i)] = start + i++;

        return range.seal();
    }
}