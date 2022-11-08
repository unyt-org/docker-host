import { Datex } from "../datex.js";
import { Logger } from "../utils/logger.js";
import { BinaryCode } from "./binary_codes.js";
import { compiler_options } from "./compiler.js";

const logger = new Logger("Compiler V2");


type token = {
    c: BinaryCode, // instruction code
    v?: any, // value
    b?: ArrayBuffer // compiled binary
}

export class CompilerV2 {


    static tokenize(datex:string, data:any[], options:compiler_options):token[]{
        const tokens = [];

        while (datex.length) {
            datex = datex.replace(/^[^\S\n]+/, ''); // trim leading whitespace (not newlines)

        }


        return tokens;
    }


    // compile DATEX body, synchronous
    static compileBody(datex:string, data:any[], options:compiler_options):ArrayBuffer {
		const buffer = new ArrayBuffer(10);
        logger.info("compile: " + datex);

        return buffer;
    }


    // compile full DATEX block, body + header (async)
	static compile(datex:string, data:any[], options:compiler_options):Promise<ArrayBuffer> {
		const buffer = this.compileBody(datex, data, options);

		// add header
        return Datex.Compiler.appendHeader(
            buffer,
            options.end_of_scope,
            options.force_id ? (options.from??Datex.Runtime.endpoint).id_endpoint : options.from, //sender
            options.to, // to
            options.flood, // flood
            options.type, // type
            options.sign, 
            options.encrypt, // encrypt
            options.send_sym_encrypt_key,
            options.sym_encrypt_key, // encryption key
            options.allow_execute, // allow execute

            options.sid,
            options.return_index,
            options.inc,

            options.force_id,

            options.__routing_ttl,
            options.__routing_prio,
            options.__routing_to
        ) 

	}

}