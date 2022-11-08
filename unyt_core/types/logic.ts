
// parent class for &,| value compositions (logical formulas)
// CNF

import { Class } from "../utils/global_types.js";
import { Runtime } from "../runtime/runtime.js";
import { RuntimeError } from "./errors.js";

export type literal<T> = T|Negation<T>; // x, ~x
type cnf_disjunction<T> = Disjunction<literal<T>>|literal<T>; // x, x|y, x|~y, ...
export type cnf<T> = Conjunction<cnf_disjunction<T>>; // (x|y) & (z) & ...

export type clause<T> = literal<T>|Logical<clause<T>>


export interface LogicalComparator<T> {
	logicalMatch(value:T, against:T): boolean
}

// parent class for and, or, not
export class Logical<T> extends Set<T> {

	constructor(values?: T[]|[T]) {
		// ignore 'undefined' values
		super(values.filter(v=>v!==undefined))
	}


	// create new conjunction
	and(value:T):Conjunction<clause<T>> {
		return new Conjunction<clause<T>>(this, value);
	}

	// create new disjunction
	or(value:T):Disjunction<clause<T>> {
		return new Disjunction<clause<T>>(this, value);
	}

	// create new negation
	not():Negation<clause<T>>|T {
		if (this instanceof Negation) return [...this][0]; // double negation
		else return new Negation<clause<T>>(this);
	}


	override toString(){
		return Runtime.valueToDatexString(this);
	}

	// value clause matches against other clause
    public static matches<T>(value:clause<T>, against:clause<T>, atomic_class:Class<T>&LogicalComparator<T>) {

		if (typeof atomic_class != "function" || !atomic_class.logicalMatch) throw new RuntimeError("Invalid atomic class for match check");

        // or (all parts must match)
        if (value instanceof Disjunction) {
			//  TODO:empty disjunction == any?
			if (value.size == 0) return true;

            for (let p of value) {
                if (!(this.matches(p, against, atomic_class))) return false; 
            }
            return true;
        }
        // and (any part must match)
        if (value instanceof Conjunction) {
			//  TODO:empty disjunction == any?
			if (value.size == 0) return true;
			
            for (let p of value) {
                if (this.matches(p, against, atomic_class)) return true;
            }
            return false;
        }
        // not
        if (value instanceof Negation) {
            return !this.matches(value.not(), against, atomic_class)
        }
        
		// default
		return this.matchesSingle(value, against, atomic_class);
        
    }

    private static matchesSingle<T>(atomic_value:T, against: clause<T>, atomic_class:Class<T>&LogicalComparator<T>) {

		// wrong atomic type for atomic_value at runtime
		if (atomic_class && !(atomic_value instanceof atomic_class)) throw new RuntimeError("Invalid match check: atomic value has wrong type");

        // or
        if (against instanceof Disjunction) {
			//  TODO:empty disjunction == any?
			if (against.size == 0) return true;
            for (let t of against) {
                if (this.matchesSingle(atomic_value, t, atomic_class)) return true; // any type matches
            }
            return false;
        }
        // and
        if (against instanceof Conjunction) {
            for (let t of against) {
                if (!this.matchesSingle(atomic_value, t, atomic_class)) return false; // any type does not match
            }
            return true;
        }
        // not
        if (against instanceof Negation) {
            return !this.matchesSingle(atomic_value, against.not(), atomic_class)
        }

		// wrong atomic type at runtime
		// guard for: against is T
		if (!(against instanceof atomic_class)) throw new RuntimeError("Invalid match check: atomic value has wrong type");

		// match
		return atomic_class.logicalMatch(atomic_value, <T>against);
    }


	// collapse clause to list
	public static collapse<T>(value:clause<T>, atomic_class:Class<T>&LogicalComparator<T>): Disjunction<T> {
		const list = new Disjunction<T>();

		this.addToCollapseList(value, atomic_class, list);

		return list;
	}

	private static addToCollapseList<T>(value:clause<T>, atomic_class:Class<T>&LogicalComparator<T>, list:Disjunction<T>) {

		if (typeof atomic_class != "function" || !atomic_class.logicalMatch) throw new RuntimeError("Invalid atomic class for logical collapse");

        // or: add every value
        if (value instanceof Disjunction) {
            for (let p of value) {
				if (!this.addToCollapseList(p, atomic_class, list)) return false; // recursive and possible early cancel
            }
            return true;
        }
        // and
        if (value instanceof Conjunction) {
            for (let p of value) {
				// TODO: calculate intersection
				// and contradiction
                if (!this.matches(p, list, atomic_class)) {
					list.clear();
					return false; 
				}
				// add
				if (!this.addToCollapseList(p, atomic_class, list)) return false; // recursive and possible early cancel
            }
            return true;
        }
        // not
        if (value instanceof Negation) {
            return false // TODO:
        }
        
		// default
		if (!(value instanceof atomic_class)) throw new RuntimeError("logical collapse: atomic value has wrong type");

		list.add(<T>value);

		return true;
	}
}

// ~value
export class Negation<T> extends Logical<T> {
	// only a single value
	constructor(value:T) {
		super([value]);
	}

}

// logical connective (& or |)
export abstract class Connective<T> extends Logical<T> {
	constructor(...values:T[]|[T]) {
		super(values);
	}
}

// x & y
export class Conjunction<T> extends Connective<T> {

	// change internally
	appendAnd(value:T) {
		this.add(value);
	}
	
}

// x | y
export class Disjunction<T> extends Connective<T> {

	// change internally
	appendOr(value:T) {
		this.add(value);
	}

}