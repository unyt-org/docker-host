import { ProtocolDataType } from "../compiler/protocol_types.js";
import { Runtime } from "../runtime/runtime.js";
import { Compiler } from "../compiler/compiler.js";
import { Endpoint } from "../types/addressing.js";
import { dxb_header } from "../utils/global_types.js";
import { Decompiler } from "../runtime/decompiler.js";

/** <std:Scope> */
export class Scope<T=any> {

    // injected variable names != arguments
    internal_vars:any[] = []
    // compiled dxb
    compiled: ArrayBuffer;

    // object containing all variables from a parent scope
    parent_variables:any;

    // decompiled dxb (unformatted and formatted)
    private _decompiled = "### DATEX ###";
    private _decompiled_f = "### DATEX ###";

    constructor(internal_vars:any[], compiled:ArrayBuffer, generate_decompiled=true) {
        this.internal_vars = internal_vars;
        this.compiled = compiled;
        // decompile
        if (generate_decompiled) {
            this._decompiled_f = Decompiler.decompile(this.compiled, false, true, false, false);
            this._decompiled   = Decompiler.decompile(this.compiled, false, false, true, false);
        }
    }

    // run the dxb with arguments, executed by a specific endpoint
    public async execute(executed_by:Endpoint, context?:any, it?:any):Promise<T> {
        
        // generate new header using executor scope header
        const header:dxb_header = {
            sender: executed_by,
            type: ProtocolDataType.LOCAL,
            executable: true,
            sid: Compiler.generateSID()
        }

        // create scope TODO fix internal_vars array or object (force converting to object for now)
        const scope = Runtime.createNewInitialScope(header, {...this.internal_vars}, context, it);
        // update scope buffers
        Runtime.updateScope(scope, this.compiled, header)
        // execute scope
        return Runtime.simpleScopeExecution(scope)
    }

    get decompiled():string {
        return this._decompiled;
    }
    get decompiled_formatted():string {
        return this._decompiled_f;
    }


    bodyToString(formatted=false, parentheses=true, spaces = '  '){
        return (parentheses?'(':'') + (formatted&&parentheses ? "\n":"") + (formatted ? this.decompiled_formatted?.replace(/^/gm, spaces) : this.decompiled).replace(/ *$/,'') + (parentheses?')':'')
    }

    toString(formatted=false, spaces = '  '){
        return `scope ${this.bodyToString(formatted, true, spaces)}`;
    }
}
