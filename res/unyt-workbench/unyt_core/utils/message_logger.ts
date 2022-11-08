import { Runtime } from "../runtime/runtime.js";
import { IOHandler } from "../runtime/io_handler.js";
import { ProtocolDataType } from "../compiler/protocol_types.js";
import { Logical } from "../types/logic.js";
import { Decompiler } from "../runtime/decompiler.js";
import { Logger } from "./logger.js";



export class MessageLogger {
	

	static logger:Logger

	static enable(){

		if (!this.logger) this.logger = new Logger("DATEX Message");

        IOHandler.onDatexReceived((header, dxb)=>{
            // ignore incoming requests from own endpoint to own endpoint
            let receivers = header.routing?.receivers;
            if (header.sender == Runtime.endpoint && (receivers instanceof Logical && receivers?.size == 1 && receivers.has(Runtime.endpoint)) && header.type != ProtocolDataType.RESPONSE && header.type != ProtocolDataType.DEBUGGER) return;

			console.log(`\nDATEX <- ${header.sender} | ${Decompiler.decompile(dxb)}`)
        });

        IOHandler.onDatexSent((header, dxb)=>{
            // ignore outgoing responses from own endpoint to own endpoint
            let receivers = header.routing?.receivers;
            if (header.sender == Runtime.endpoint && (receivers instanceof Logical && receivers?.size == 1 && receivers.has(Runtime.endpoint)) && header.type != ProtocolDataType.RESPONSE && header.type != ProtocolDataType.DEBUGGER) return;

			console.log(`\nDATEX -> ${receivers} | ${Decompiler.decompile(dxb)}`)
        });

	}

}