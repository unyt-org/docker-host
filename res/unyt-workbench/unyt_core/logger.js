let Datex;
const client_type = globalThis.process?.release?.name ? 'node' : 'browser';
const CONSOLE_FORMAT_DARK = {
    RED: ["#e32948", "#d26476"],
    GREEN: ["#1eda6d", "#81dba7"],
    CYAN: ["#0669c1", "#3a7eba"],
    YELLOW: ["#ebb626", "#e6c877"],
    WHITE: ["#ffffff", "#bababa"]
};
const CONSOLE_FORMAT_LIGHT = {
    RED: ["#e32948", "#d26476"],
    GREEN: ["#1eda6d", "#81dba7"],
    CYAN: ["#0669c1", "#3a7eba"],
    YELLOW: ["#ebb626", "#e6c877"],
    WHITE: ["#000000", "#222222"]
};
const CONSOLE_FORMAT_NODE = {
    RESET: "\x1b[0m",
    BOLD: "\x1b[1m",
    DEFAULT: "\x1b[2m",
    UNDERSCORE: "\x1b[4m",
    REVERSE: "\x1b[7m",
    HIDDEN: "\x1b[8m",
    RED: "\x1b[31m",
    GREEN: "\x1b[32m",
    BLUE: "\x1b[34m",
    CYAN: "\x1b[36m",
    MAGENTA: "\x1b[35m",
    YELLOW: "\x1b[33m",
    BLACK: "\x1b[30m",
    WHITE: "\x1b[37m",
    BG_BLACK: "\x1b[40m",
    BG_RED: "\x1b[41m",
    BG_GREEN: "\x1b[42m",
    BG_YELLOW: "\x1b[43m",
    BG_BLUE: "\x1b[44m",
    BG_MAGENTA: "\x1b[45m",
    BG_CYAN: "\x1b[46m",
    BG_WHITE: "\x1b[47m",
};
var COLOR;
(function (COLOR) {
    COLOR["RED"] = "RED";
    COLOR["GREEN"] = "GREEN";
    COLOR["BLUE"] = "BLUE";
    COLOR["CYAN"] = "CYAN";
    COLOR["MAGENTA"] = "MAGENTA";
    COLOR["YELLOW"] = "YELLOW";
    COLOR["BLACK"] = "BLACK";
    COLOR["WHITE"] = "WHITE";
})(COLOR || (COLOR = {}));
const COLOR_INDICES = {
    RED: 0,
    GREEN: 1,
    BLUE: 2,
    YELLOW: 3,
    MAGENTA: 4,
    CYAN: 5,
    BLACK: 6,
    WHITE: 7
};
export let console_theme = globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)')?.matches ? "dark" : "light";
try {
    globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)')?.addEventListener("change", (e) => {
        console_theme = e.matches ? "dark" : "light";
    });
}
catch (e) { }
let max_iterations = 10;
function depthOf(object, iterations = 0) {
    if (iterations > max_iterations)
        return Infinity;
    let level = 1;
    for (let key in object) {
        if (!object.hasOwnProperty(key))
            continue;
        if (typeof object[key] == 'object') {
            let depth = depthOf(object[key], iterations + 1) + 1;
            level = Math.max(depth, level);
        }
    }
    return level;
}
function console_log(log_data, debug = false) {
    if (globalThis.unyt_options && !globalThis.unyt_options?.debug_mode)
        return;
    if (!globalThis.unyt_options?.hidden_logs)
        debug ? console.debug(...log_data) : console.log(...log_data);
}
export const log = (...data) => console_log(data);
globalThis.log = log;
export let font_family = 'font-family: "Consolas", Monaco, monospace';
let box_width = 0;
export default class Logger {
    static loggers_by_origin = new Map();
    static global_log_streams = new Set();
    origin;
    origin_value;
    local_only = false;
    _no_title = false;
    box_width = 50;
    out_streams = new Set();
    constructor(origin, local_only = false) {
        this.local_only = local_only;
        if (typeof origin == "string")
            this.origin = '[' + origin + ']';
        else {
            this.origin_value = origin;
            if (Datex)
                this.origin = '<' + (Datex.Type.getValueDatexType(origin)?.toString().replace(">", "").replace("<", "") ?? '?') + "$" + (Datex.Pointer.getByValue(origin)?.id ?? '?') + '>';
            else
                this.origin = '[' + origin?.constructor.name + '?]';
        }
        if (!Logger.loggers_by_origin.has(this.origin))
            Logger.loggers_by_origin.set(this.origin, new Set());
        Logger.loggers_by_origin.get(this.origin).add(this);
    }
    destroy() {
        Logger.loggers_by_origin.get(this.origin)?.delete(this);
    }
    log(color, messages, debug = false) {
        let text_log;
        if (client_type == "node" || this.out_streams.size || Logger.global_log_streams.size)
            text_log = this.log_terminal(color, messages);
        if (client_type == "node")
            console_log([text_log]);
        else
            console_log(this.log_web(color, messages), debug);
        for (let stream of this.out_streams)
            stream.write(text_log + "\n");
        for (let stream of Logger.global_log_streams)
            stream.write(text_log + "\n");
    }
    log_web(color, messages) {
        const color_format = console_theme == "dark" ? CONSOLE_FORMAT_DARK[color] : CONSOLE_FORMAT_LIGHT[color];
        if (globalThis.unyt_options && !globalThis.unyt_options?.debug_mode)
            return;
        let log_array = [], text = "", objects = [];
        if (!globalThis.unyt_options?.hidden_logs) {
            if (!(typeof messages[0] == "string" && messages[0].startsWith("$"))) {
                log_array = [
                    `color: ${color_format[0]};font-weight:bold;${font_family}`
                ];
                text = `%c${this.origin}`.padEnd(box_width, " ") + " ";
            }
            else {
                text = '';
                messages[0] = messages[0].substring(1);
            }
            objects = [];
            for (let message of messages) {
                if (typeof message !== "object") {
                    let _styles = [];
                    if (typeof message === "string")
                        message = message
                            .replace(/\%/g, '%%')
                            .replace(/\*\*[^*]*\*\*/g, function (x, p) {
                            _styles.push([p, [`color: ${color_format[0]};font-weight:bold;${font_family}`, `color: ${color_format[1]};${font_family}`]]);
                            return "%c" + x.replace(/\*\*/g, "") + "%c";
                        })
                            .replace(/__[^_]*__/g, function (x, p) {
                            _styles.push([p, [`color: ${color_format[0]};text-decoration:underline;${font_family}`, `color: ${color_format[1]};${font_family}`]]);
                            return "%c" + x.replace(/__/g, "") + "%c";
                        })
                            .replace(/\[\[[^[]*\]\]/g, function (x, p) {
                            _styles.push([p, [`color: white;background-color:${color_format[0]};padding:2px;${font_family}`, `color: ${color_format[1]};${font_family}`]]);
                            return "%c" + x.replace(/\[/g, '').replace(/]/g, '') + "%c";
                        });
                    _styles = _styles.sort((a, b) => a[0] > b[0] ? 1 : -1).map(a => a[1]).flat();
                    text += `%c${message} `;
                    log_array.push(`color: ${color_format[1]};${font_family}`);
                    log_array.push(..._styles);
                }
                else
                    objects.push(message);
            }
        }
        return [text, ...log_array, ...objects];
    }
    static setDatex(_Datex) {
        Datex = _Datex;
    }
    log_terminal(color, messages) {
        const color_format = CONSOLE_FORMAT_NODE[color];
        if (globalThis.unyt_options && !globalThis.unyt_options?.debug_mode)
            return;
        if (!globalThis.unyt_options?.hidden_logs) {
            for (let m = 0; m < messages.length; m++) {
                if (typeof messages[m] == "string") {
                    messages[m] = this.console_format_text(messages[m], color_format);
                }
                else if (Datex)
                    messages[m] = Datex.Runtime.valueToDatexString(messages[m], true, true);
                else
                    messages[m] = "[?]";
            }
        }
        let start_title = "";
        if (!(typeof messages[0] == "string" && messages[0].startsWith("$"))) {
            start_title = CONSOLE_FORMAT_NODE.BOLD + color_format + this.origin + " " + CONSOLE_FORMAT_NODE.RESET;
        }
        else {
            messages[0] = messages[0].substring(1);
        }
        let log_data = CONSOLE_FORMAT_NODE.RESET + (this._no_title ? '' : start_title) + this.console_bright_color(color_format) + messages.join(" ") + CONSOLE_FORMAT_NODE.RESET;
        this._no_title = false;
        return log_data;
    }
    console_format_text(text, color_format = CONSOLE_FORMAT_NODE.WHITE) {
        return text
            .replace(/\*\*[^*]*\*\*/g, (x) => {
            return CONSOLE_FORMAT_NODE.BOLD + x.replace(/\*/g, "") + CONSOLE_FORMAT_NODE.RESET + this.console_bright_color(color_format);
        })
            .replace(/\#\#[^*]*\#\#/g, (x) => {
            return CONSOLE_FORMAT_NODE.DEFAULT + x.replace(/\#/g, "") + CONSOLE_FORMAT_NODE.RESET + this.console_bright_color(color_format);
        })
            .replace(/__[^_]*__/g, (x) => {
            return CONSOLE_FORMAT_NODE.UNDERSCORE + x.replace(/_/g, "") + CONSOLE_FORMAT_NODE.RESET + this.console_bright_color(color_format);
        })
            .replace(/\[\[[^[]*\]\]/g, (x) => {
            return "\x1b[7m\x1b[40m" + x.replace(/\[/g, '').replace(/]/g, '') + CONSOLE_FORMAT_NODE.RESET + this.console_bright_color(color_format);
        });
    }
    console_text_remove_formatters(text) {
        return text
            .replace(/\*\*/g, '')
            .replace(/\#\#/g, '')
            .replace(/__/g, '')
            .replace(/\[\[/g, '')
            .replace(/\]\]/g, '');
    }
    console_bright_color(color) {
        return color.substring(0, 2) + (parseInt(color.substring(2, 4)) + 60) + color.substring(4, 5);
    }
    box(title, message) {
        this.box_width = Math.max(title.length, this.box_width);
        title = title.toString() || "";
        message = message || "";
        let message_array = message?.match(new RegExp(`.{1,${this.box_width}}`, "g"))?.map(m => m.split("\n")).flat();
        let date = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString();
        let text = "\n" + CONSOLE_FORMAT_NODE.MAGENTA + "╭─" + "".padEnd(this.box_width - date.length, "─") + this.console_bright_color(CONSOLE_FORMAT_NODE.MAGENTA) + date + CONSOLE_FORMAT_NODE.MAGENTA + "─╮\n";
        text += `${CONSOLE_FORMAT_NODE.MAGENTA}│${this.console_bright_color(CONSOLE_FORMAT_NODE.WHITE)} ${title.padEnd(this.box_width, " ")} ${CONSOLE_FORMAT_NODE.MAGENTA}│\n`;
        text += CONSOLE_FORMAT_NODE.MAGENTA + "├" + "".padEnd(this.box_width + 2, "─") + "┤\n";
        for (let m of message_array || []) {
            m = m.trim();
            let formatters_length = m.length - this.console_text_remove_formatters(m).length;
            text += `${CONSOLE_FORMAT_NODE.MAGENTA}│${CONSOLE_FORMAT_NODE.WHITE} ${this.console_format_text(m.trim().padEnd(this.box_width + formatters_length, " "))} ${CONSOLE_FORMAT_NODE.RESET + CONSOLE_FORMAT_NODE.MAGENTA}│\n`;
        }
        text += CONSOLE_FORMAT_NODE.MAGENTA + "╰" + "".padEnd(this.box_width + 2, "─") + "╯\n" + CONSOLE_FORMAT_NODE.RESET;
        console.log(text);
    }
    debug(...messages) {
        this.log(COLOR.CYAN, messages, true);
    }
    info(...messages) {
        this.log(COLOR.WHITE, messages);
    }
    warn(...messages) {
        this.log(COLOR.YELLOW, messages);
    }
    error(...messages) {
        this.log(COLOR.RED, messages);
    }
    success(...messages) {
        this.log(COLOR.GREEN, messages);
    }
    static logToStream(stream, ...filter_origins) {
        if (!filter_origins?.length) {
            this.global_log_streams.add(stream);
        }
        else {
            for (let origin of filter_origins) {
                for (let logger of this.loggers_by_origin.get(origin) ?? []) {
                    logger.out_streams.add(stream);
                }
            }
        }
        return stream;
    }
}
globalThis.logger = new Logger("main");
