/*******************************************************************************************
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗ *
 * ║  UNYT - logger                                                                       ║ *
 * ╠══════════════════════════════════════════════════════════════════════════════════════╣ *
 * ║ Console output for web or node.js                                                    ║ *
 * ║                                                                                      ║ *
 * ╠═════════════════════════════════════════╦════════════════════════════════════════════╣ *
 * ║  © 2022 unyt.org                        ║ ██████████████████████████████████████████ ║ *
 * ╚═════════════════════════════════════════╩════════════════════════════════════════════╝ *
 *******************************************************************************************/

let Datex; // to circular imports logger - Datex

// copied from datex_runtime
interface StreamSink {
    write: (chunk:ArrayBuffer|string)=>Promise<any>|any
}

const client_type = globalThis.process?.release?.name ? 'node' : 'browser'

const CONSOLE_FORMAT_DARK = {
    RED:    ["#e32948", "#d26476"],
    GREEN:  ["#1eda6d", "#81dba7"],
    CYAN:   ["#0669c1", "#3a7eba"],
    YELLOW: ["#ebb626", "#e6c877"],
    WHITE:  ["#ffffff", "#bababa"]
}

const CONSOLE_FORMAT_LIGHT = {
    RED:    ["#e32948", "#d26476"],
    GREEN:  ["#1eda6d", "#81dba7"],
    CYAN:   ["#0669c1", "#3a7eba"],
    YELLOW: ["#ebb626", "#e6c877"],
    WHITE:  ["#000000", "#222222"]
}

const CONSOLE_FORMAT_NODE = {
    RESET:      "\x1b[0m",
    BOLD:       "\x1b[1m",
    DEFAULT:    "\x1b[2m",
    UNDERSCORE: "\x1b[4m",
    REVERSE:    "\x1b[7m",
    HIDDEN:     "\x1b[8m",

    RED:        "\x1b[31m",
    GREEN:      "\x1b[32m",
    BLUE:       "\x1b[34m",
    CYAN:       "\x1b[36m",
    MAGENTA:    "\x1b[35m",
    YELLOW:     "\x1b[33m",
    BLACK:      "\x1b[30m",
    WHITE:      "\x1b[37m",

    BG_BLACK:   "\x1b[40m",
    BG_RED:     "\x1b[41m",
    BG_GREEN:   "\x1b[42m",
    BG_YELLOW:  "\x1b[43m",
    BG_BLUE:    "\x1b[44m",
    BG_MAGENTA: "\x1b[45m",
    BG_CYAN:    "\x1b[46m",
    BG_WHITE:   "\x1b[47m",
}

enum COLOR {
    RED     = "RED",
    GREEN   = "GREEN",
    BLUE    = "BLUE",
    CYAN    = "CYAN",
    MAGENTA = "MAGENTA",
    YELLOW  = "YELLOW",
    BLACK   = "BLACK",
    WHITE   = "WHITE",
}

const COLOR_INDICES = {
    RED:        0,
    GREEN:      1,
    BLUE:       2,
    YELLOW:     3,
    MAGENTA:    4,
    CYAN:       5,
    BLACK:      6,
    WHITE:      7
}

export let console_theme = globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)')?.matches ? "dark" : "light";

try {
    globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)')?.addEventListener("change", (e)=>{
        console_theme = e.matches ? "dark" : "light";
    });
} catch (e){}


let max_iterations = 10;

function depthOf(object, iterations = 0) {
    if (iterations > max_iterations) return Infinity;
    let level = 1;
    for(let key in object) {
        if (!object.hasOwnProperty(key)) continue;

        if(typeof object[key] == 'object'){
            let depth = depthOf(object[key], iterations+1) + 1;
            level = Math.max(depth, level);
        }
    }
    return level;
}


// console_log calls are emitted to listeners and stored in the database
function console_log(log_data, debug=false) {
    if(globalThis.unyt_options && !globalThis.unyt_options?.debug_mode) return;
    if (!globalThis.unyt_options?.hidden_logs) debug ? console.debug(...log_data) : console.log(...log_data);
}


// ! use log for logs that should be sent to the server
export const log = (...data)=>console_log(data);
globalThis.log = log;



export let font_family = 'font-family: "Consolas", Monaco, monospace';
let box_width = 0;//16;
export default class Logger {

    private static loggers_by_origin = new Map<string,Set<Logger>>();
    private static global_log_streams = new Set<StreamSink>();

    private readonly origin:string;
    private readonly origin_value?:any;
    private local_only:boolean = false;
    private _no_title: boolean = false;
    private box_width:number = 50;

    private out_streams = new Set<StreamSink>();

    constructor(origin:string, local_only?:boolean) 
    constructor(for_value:any, local_only?:boolean) 
    constructor(origin:any, local_only=false) {
        this.local_only = local_only;
        
        if (typeof origin == "string") this.origin = '[' + origin + ']';
        else {
            this.origin_value = origin;
            if (Datex) this.origin = '<' + (Datex.Type.getValueDatexType(origin)?.toString().replace(">","").replace("<","")??'?') + "$" + (Datex.Pointer.getByValue(origin)?.id??'?') + '>'
            else this.origin = '[' + origin?.constructor.name + '?]';
        }

        if (!Logger.loggers_by_origin.has(this.origin)) Logger.loggers_by_origin.set(this.origin, new Set());
        Logger.loggers_by_origin.get(this.origin).add(this);
    }

    public destroy(){
        Logger.loggers_by_origin.get(this.origin)?.delete(this);
    }

    private log(color: COLOR, messages: any[], debug = false) {
        let text_log:string;
        // raw text logs required?
        if (client_type == "node" || this.out_streams.size || Logger.global_log_streams.size) text_log = this.log_terminal(color, messages);
        
        // log to console
        if (client_type == "node") console_log([text_log]);
        else console_log(this.log_web(color, messages), debug);

        // handle log streams
        for (let stream of this.out_streams) stream.write(text_log+"\n");
        for (let stream of Logger.global_log_streams) stream.write(text_log+"\n");

    }

    private log_web(color: COLOR, messages: any[]) {

        const color_format = console_theme == "dark" ? CONSOLE_FORMAT_DARK[color] : CONSOLE_FORMAT_LIGHT[color];

        // check if debug mode enabled
        if(globalThis.unyt_options && !globalThis.unyt_options?.debug_mode) return;

        let log_array = [], text = "", objects = [];

        // only render log if debug output not hidden
        if (!globalThis.unyt_options?.hidden_logs) {
            if(!(typeof messages[0] == "string" && messages[0].startsWith("$"))) {
                log_array = [
                    `color: ${color_format[0]};font-weight:bold;${font_family}` //;font-size:13px
                ];
                text = `%c${this.origin}`.padEnd(box_width, " ") + " ";
            } else {
                text = '';
                messages[0] =  messages[0].substring(1);
            }
            objects = [];
            for (let message of messages) {
                if (typeof message !== "object") {
                    let _styles = []
                    if(typeof message === "string") message = message
                        .replace(/\%/g,'%%') // SaFaRI bug, problem with console.log("%...")
                        .replace(/\*\*[^*]*\*\*/g, function(x, p){
                            _styles.push([p, [`color: ${color_format[0]};font-weight:bold;${font_family}`, `color: ${color_format[1]};${font_family}`]]);
                            return "%c" + x.replace(/\*\*/g, "") + "%c"
                        })
                        .replace(/__[^_]*__/g, function(x, p){
                            _styles.push([p, [`color: ${color_format[0]};text-decoration:underline;${font_family}`, `color: ${color_format[1]};${font_family}`]]);
                            return "%c" + x.replace(/__/g, "") + "%c"
                        })
                        .replace(/\[\[[^[]*\]\]/g, function(x, p){
                            _styles.push([p, [`color: white;background-color:${color_format[0]};padding:2px;${font_family}`, `color: ${color_format[1]};${font_family}`]]);
                            return "%c" + x.replace(/\[/g, '').replace(/]/g, '') + "%c"
                        })

                    _styles = _styles.sort((a,b)=>a[0]>b[0] ? 1 : -1).map(a=>a[1]).flat()
                    text += `%c${message} `;
                    log_array.push(`color: ${color_format[1]};${font_family}`)
                    log_array.push(..._styles)
                } else objects.push(message)
            }
        }

        return [text, ...log_array, ...objects];
    }

    // workaround for ciruclar DATEX Runtime dependencies
    public static setDatex(_Datex:any) {
        Datex = _Datex;
    }


    private log_terminal(color:COLOR, messages:any[]): string {

        const color_format = CONSOLE_FORMAT_NODE[color];

        // check if debug mode enabled
        if(globalThis.unyt_options && !globalThis.unyt_options?.debug_mode) return;

        // only render log if debug output not hidden
        if (!globalThis.unyt_options?.hidden_logs) {
            for (let m=0;m<messages.length;m++) {
                if (typeof messages[m] == "string") {
                    messages[m] = this.console_format_text(messages[m], color_format);
                }
                else if (Datex) messages[m] = Datex.Runtime.valueToDatexString(messages[m], true, true);
                else messages[m] = "[?]";
            }
        }

        let start_title = ""
        if(!(typeof messages[0] == "string" && messages[0].startsWith("$"))) {
            start_title = CONSOLE_FORMAT_NODE.BOLD + color_format + this.origin + " " + CONSOLE_FORMAT_NODE.RESET;
        } else {
            messages[0] =  messages[0].substring(1);
        }

        let log_data = CONSOLE_FORMAT_NODE.RESET + (this._no_title ? '' : start_title) + this.console_bright_color(color_format) + messages.join(" ") + CONSOLE_FORMAT_NODE.RESET;
        this._no_title = false;
        return log_data;
    }

    private console_format_text(text:string, color_format:string=CONSOLE_FORMAT_NODE.WHITE):string {
        return text
        .replace(/\*\*[^*]*\*\*/g, (x)=>{
            return CONSOLE_FORMAT_NODE.BOLD+x.replace(/\*/g, "")+CONSOLE_FORMAT_NODE.RESET+this.console_bright_color(color_format)})
        .replace(/\#\#[^*]*\#\#/g, (x)=>{
            return CONSOLE_FORMAT_NODE.DEFAULT+x.replace(/\#/g, "")+CONSOLE_FORMAT_NODE.RESET+this.console_bright_color(color_format)})
        .replace(/__[^_]*__/g, (x)=>{
            return CONSOLE_FORMAT_NODE.UNDERSCORE+x.replace(/_/g, "")+CONSOLE_FORMAT_NODE.RESET+this.console_bright_color(color_format)})
        .replace(/\[\[[^[]*\]\]/g, (x)=>{
            return "\x1b[7m\x1b[40m"+x.replace(/\[/g, '').replace(/]/g, '')+CONSOLE_FORMAT_NODE.RESET+this.console_bright_color(color_format) })
    }
    private console_text_remove_formatters(text:string):string {
        return text
        .replace(/\*\*/g, '')
        .replace(/\#\#/g, '')
        .replace(/__/g, '')
        .replace(/\[\[/g,'')
        .replace(/\]\]/g,'')
    }

    private console_bright_color(color:string): string {
        return color.substring(0, 2) + (parseInt(color.substring(2, 4))+60) + color.substring(4, 5);
    }


    public box(title?:string, message?:string) {
        this.box_width = Math.max(title.length, this.box_width);

        title = title.toString() || "";
        message = message || "";

        let message_array = message?.match(new RegExp(`.{1,${this.box_width}}`,"g"))?.map(m=>m.split("\n")).flat();

        let date = new Date().toLocaleDateString()+" "+new Date().toLocaleTimeString();
        let text =  "\n" + CONSOLE_FORMAT_NODE.MAGENTA +"╭─" +  "".padEnd(this.box_width-date.length, "─") + this.console_bright_color(CONSOLE_FORMAT_NODE.MAGENTA) + date + CONSOLE_FORMAT_NODE.MAGENTA +  "─╮\n";

        text += `${CONSOLE_FORMAT_NODE.MAGENTA}│${this.console_bright_color(CONSOLE_FORMAT_NODE.WHITE)} ${title.padEnd(this.box_width, " ")} ${CONSOLE_FORMAT_NODE.MAGENTA}│\n`;
        text += CONSOLE_FORMAT_NODE.MAGENTA + "├" + "".padEnd(this.box_width+2, "─") + "┤\n";

        for (let m of message_array || []) {
            m = m.trim();
            let formatters_length = m.length - this.console_text_remove_formatters(m).length;
            text += `${CONSOLE_FORMAT_NODE.MAGENTA}│${CONSOLE_FORMAT_NODE.WHITE} ${this.console_format_text(m.trim().padEnd(this.box_width+formatters_length, " "))} ${CONSOLE_FORMAT_NODE.RESET+CONSOLE_FORMAT_NODE.MAGENTA}│\n`
        }

        text += CONSOLE_FORMAT_NODE.MAGENTA + "╰" + "".padEnd(this.box_width+2, "─") + "╯\n" + CONSOLE_FORMAT_NODE.RESET;

        console.log(text);
    }

    public debug(...messages:any[]) {
        this.log(COLOR.CYAN, messages, true)
    }

    public info(...messages:any[]) {
        this.log(COLOR.WHITE, messages)
    }

    public warn(...messages:any[]) {
        this.log(COLOR.YELLOW, messages)
    }

    public error(...messages:any[]) {
        this.log(COLOR.RED, messages)
    }

    public success(...messages:any[]) {
        this.log(COLOR.GREEN, messages)
    }


    // Log streams

    static logToStream<S extends StreamSink>(stream:S, ...filter_origins:string[]):S {
        // global stream
        if (!filter_origins?.length) {
            this.global_log_streams.add(stream);
        }
        // stream for specific origins
        else {
            for (let origin of filter_origins) {
                for (let logger of this.loggers_by_origin.get(origin)??[]) {
                    logger.out_streams.add(stream);
                }
            }
        }
        return stream;
    }

}

globalThis.logger = new Logger("main");