import Logger from "../unyt_core/logger.js";
import { sync, expose, scope, property, constructor } from "../unyt_core/legacy_decorators.js";
import {spawn, ChildProcess} from 'child_process';
import { Datex } from "../unyt_core/datex_runtime.js";
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url))

const logger = new Logger("ssh relay");


@sync @scope('shell') export class RemoteShell {

    // exposed function to create a new shell session
    @expose static async newSession(): Promise<RemoteShell>{
        logger.success("new remote shell session");        
        return new RemoteShell();
    }

    @property out_stream: Datex.Stream = new Datex.Stream; // initialize out_stream here
    @property in_stream: Datex.Stream = new Datex.Stream;

    #process:ChildProcess

    @constructor async construct(){
        this.start();

        // read from in_stream -> internal_stream
        const reader = this.in_stream.getReader();
        let next:ReadableStreamDefaultReadResult<ArrayBuffer>;
        while (true) {
            next = await reader.read();
            if (next.done) return;
            this.#process?.stdin.write(new Uint8Array(next.value));
        }        
    }
 
 
    start() {

        try {
            this.#process = spawn(__dirname+'/shell.sh');

            this.#process.stdout.on('data', (data) => {
              this.out_stream.write(data);
            });
            
            this.#process.stderr.on('data', (data) => {
              this.out_stream.write(data);
            });
        } 
        catch (e) {
            logger.error("Error:", e);
        }
        
    }
}