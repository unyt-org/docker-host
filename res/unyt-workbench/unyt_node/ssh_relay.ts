import Logger from "../unyt_core/logger.js";
import { sync, expose, scope, property } from "../unyt_core/legacy_decorators.js";

const logger = new Logger("ssh relay");
// @ts-ignore
import SSH2Client from 'ssh2';
import { Datex } from "../unyt_core/datex_runtime.js";

@scope('ssh') export class SSHRelayServer {

    @expose static async connect(host:string, port:number, username:string, passsword?:string, private_key?:string): Promise<SSHConnection>{
        logger.success("connecting to " + host + ":" + port);        
        let connection = new SSHConnection(host, port, username, passsword, private_key)
        await connection.connect()
        return connection;
    }

}

@sync class SSHConnection {

    @property host:string
    @property port:number
    @property username:string

    @property out_stream: Datex.Stream = new Datex.Stream(); // initialize out_stream here
    @property in_stream: Datex.Stream = new Datex.Stream()


    constructor(host:string, port:number, username:string, passsword?:string, private_key?:string){
        this.host = host;
        this.port = port;
        this.username = username;
        this.passsword = passsword;
        this.private_key = private_key;

        this.pipeInStream()
    }


    passsword?:string
    private_key?:string

    internal_stream;

    // read from in_stream -> internal_stream
    async pipeInStream() {
        const reader = this.in_stream.getReader();
        let next:ReadableStreamDefaultReadResult<ArrayBuffer>;
        while (true) {
            next = await reader.read();
            if (next.done) return;
            this.internal_stream?.write(new Uint8Array(next.value));
        }
    }

    /*write (data:string) {
        logger.success("writing: ", data);
        this.internal_stream.write(data);
    }*/

  
    async connect() {
        const conn = new SSH2Client();

        return new Promise<void>((resolve, reject) => {
            conn
                .on('error', (e) => {
                    reject(e);
                })
                .on('ready', () => {
                    conn.shell({cols:500, rows:45, term: 'xterm-256color'}, {}, (err, stream) => {
                        if (err) reject(err);
                        else resolve();
                        this.internal_stream = stream;

                        stream           
                            .on('close', () => {
                                logger.error('Stream connection closed.')
                                conn.end();
                            })
                            
                            .on('data', async (data) => {
                                let array_buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.length);
                                this.out_stream.write(array_buffer);
                            })
                        
                            .stderr.on('data', async (data) => {
                                let array_buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.length);
                                this.out_stream.write(array_buffer);
                            });
        
                    });
                }).connect({
                    host: this.host,
                    port: this.port,
                    username: this.username,
                    password: this.passsword,
                    privateKey: this.private_key
                });
        })
    }
}