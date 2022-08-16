import Context from "./wasi_snapshot_preview1.js";
const context = new Context({});

console.log("Datex Runtime WASM Interface")

const memory = new WebAssembly.Memory({ initial: 2 });
const { instance } = await WebAssembly.instantiateStreaming(fetch('./datex_runtime.wasm'), {
  env: { memory,  console_log: function(arg){console.log("[wasm]", decode(arg)) }},
  wasi_snapshot_preview1: context.exports
});

// Encode string into memory starting at address base.
const encode = (base, string) => {
    for (let i = 0; i < string.length; i++) {
        memory[base + i] = string.charCodeAt(i);
    }

    memory[base + string.length] = 0;
};

// Decode a string from memory starting at address base.
const decode = (base) => {
    let cursor = base;
    let result = '';
    while (memory[cursor]) {
        result += String.fromCharCode(memory[cursor++]);
    }
    return result;
};

const text = 'Hello from JavaScript!';

// Read the result.
let p = 3;
encode(p, "null datex");
const res = instance.exports.compile(p);

console.log(res, decode(res))
