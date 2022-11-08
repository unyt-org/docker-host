import init, {init_runtime, compile, decompile} from "./datex/pkg/datex.js"
import {Datex} from "../datex.js"
import "../../uix/uix.js"
import {Terminal} from "../../uix/uix_std/terminal/main.js"

await init()
init_runtime()

const datex = `
42 + 44 - 10 / 100 * 5 ^ 12.23;
true or false;
12.34;
\`c00ffeee4411\`;
infinity;
-infinity;
nan;
[1,2,3,4];
true false null void;
"abc\ndef";
"esac\\\\ped:\\"blab\\"";
val y = "Hello World";`


// compile
let _compiled = compile(datex);
console.log(_compiled);
let compiled = <ArrayBuffer> await Datex.Compiler.compile(datex, [], {sign:false}, false)

// decompile
let decompiled = decompile(new Uint8Array(compiled), true, true);

// output
console.log(compiled, decompiled)
const in_stream = new Datex.Stream<string>();
in_stream.write(decompiled)
new Terminal({in:in_stream, border_radius:0}).anchor()
