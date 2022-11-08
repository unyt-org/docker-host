import { Datex, props, sync, expose, scope, property, constructor } from "../unyt_core/datex.js";
import {spawn, ChildProcess, exec} from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { rejects } from "assert";
const __dirname = dirname(fileURLToPath(import.meta.url))

const logger = new Datex.Logger("ssh relay");


@sync @scope('shell') export class RemoteShell {

    // exposed function to create a new shell session
    @expose static async newSession(): Promise<RemoteShell>{
        logger.success("new remote shell session");        
        const shell = new RemoteShell();
        await shell.start();
        return shell;
    }

    @property out_stream: Datex.Stream = new Datex.Stream; // initialize out_stream here
    @property in_stream: Datex.Stream = new Datex.Stream;

    @property width: number = 200;
    @property height: number = 100;


    #process:ChildProcess
    #device:string
    #bash_pid:number

    @constructor async construct(){
        // read from in_stream -> internal_stream
        const reader = this.in_stream.getReader();
        let next:ReadableStreamReadResult<ArrayBuffer>;
        while (true) {
            next = await reader.read();
            if (next.done) return;
            this.#process?.stdin.write(new Uint8Array(next.value));
        }
    }
 
 
    private async start() {
        try {
            this.#process = spawn(__dirname+'/shell.sh');

            this.#process.stdout.on('data', (data) => {
              this.out_stream.write(data);
            });
            
            this.#process.stderr.on('data', (data) => {
              this.out_stream.write(data);
            });

            await this.getTerminalDevice(this.#process.pid);
            this.#bash_pid = await this.getChildPID(await this.getChildPID(this.#process.pid, 'script'), 'sh'/*matches 'bash' or 'sh'*/); // get grandchild process id;
            this.#device = await this.getTerminalDevice(this.#bash_pid);
            logger.info(`Bash Process: PID=${this.#bash_pid}, DEVICE=${this.#device}`)
        }
        catch (e) {
            logger.error("Error:", e);
        }

        // observe width & height
        props(this).height.observe(()=>this.resize())
        props(this).width.observe(()=>this.resize())
    }

    private async getChildPID(pid:number, cmd:string) {
        const pid_string = await this.exec(`ps --ppid ${pid} | grep ${cmd} | awk '{print $1}'`);
        if (pid_string) return Number(pid_string)
        else throw Error("Could not get PID");
    }

    private async getTerminalDevice(pid:number){
        return (await this.exec(`lsof -X -p ${pid} | grep -o '/dev/.*' | grep -v urandom | uniq`)).split("\n")[0]
    }

    private exec(command:string) {
        return new Promise<string>((resolve, reject)=>{
            exec(command, (error, stdout)=> {
                if (error) reject(error);
                else resolve(stdout.replace(/\n$/, ''));
            })
        })
    }

    private async resize() {
        const width = this.width;
        const height = this.height;

        if (!(typeof width == "number" || typeof width == "bigint") || !(typeof height == "number" || typeof height == "bigint")) throw new Datex.ValueError("Invalid width or height")
        if (width <= 0 || height <=0) throw new Datex.ValueError("width and height must be >= 0")

        await this.exec(`stty rows ${height} cols ${width} -F ${this.#device}`);
        this.#process.kill("SIGWINCH");
        logger.info(`Resizing Terminal: ${width} x ${height}`);
    }
}