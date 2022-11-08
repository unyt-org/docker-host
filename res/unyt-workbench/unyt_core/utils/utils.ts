

import { ValueError } from "../datex_all.js";
//import { Storage } from "../runtime/storage.js"; TODO Storage cannot be importet here, handle file caching somehow (somewhere else)
import { baseURL, client_type, NodeBuffer } from "./global_values.js";

// fetch
// @ts-ignore
export const fetch:((input: URL | RequestInfo, init?: RequestInit) => Promise<Response>) = client_type == "browser" ? globalThis.fetch : (await import("node-fetch")).default;
// fs
// @ts-ignore
export const fs = client_type == "node" ? (await import("fs")).default : null;


// get local file content (node) or url content (browser)
export async function getFileContent(url:string, file_path?:string|URL): Promise<string>{
    // get local file
    if (file_path && fs) {
        // @ts-ignore
        return getLocalFileTextContent(file_path);
    }
    let res;
    try {
        res = (await (await fetch(url, {credentials: 'include', mode:'cors'})).text()).replaceAll("\r\n", "\n");
        //await Storage.setItem(url, res);
    } catch(e) { // network error or similar - try to get from cache
        //res = await Storage.getItem(url);
    }
    return res;
}


// get local file content (node only)
export function getLocalFileContent(file_path?:string|URL): Uint8Array {
    // @ts-ignore
    const nodeBuffer = fs.readFileSync(file_path instanceof URL ? file_path : (file_path.startsWith('/') ? new URL('file://'+file_path) : new URL(file_path, baseURL)));
    return new Uint8Array(nodeBuffer.buffer, nodeBuffer.byteOffset, nodeBuffer.byteLength / Uint8Array.BYTES_PER_ELEMENT);
}

// get local file content as string (node only)
export function getLocalFileTextContent(file_path?:string|URL): string{
    // @ts-ignore
    return new TextDecoder().decode(getLocalFileContent(file_path)).replaceAll("\r\n", "\n");
}


export function urlToPath(url:URL) {
    return url.toString().replace(/^(file|https?)\:\/\//,'');
}

// binary - base64 conversion
export const btoa:(s:string)=>string = typeof globalThis.btoa !== 'undefined' ? globalThis.btoa : (b) => NodeBuffer.from(b).toString('base64');
export const atob:(base64:string)=>string = typeof globalThis.atob !== 'undefined' ? globalThis.atob : (base64) => NodeBuffer.from(base64, 'base64').toString('binary');


/** ArrayBuffer <-> Base64 String */
export function arrayBufferToBase64(buffer:ArrayBuffer):string {
	let binary = '';
	let bytes = new Uint8Array( buffer );
	let len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += globalThis.String.fromCharCode( bytes[ i ] );
	}
	return btoa( binary );
}

export function base64ToArrayBuffer(base64:string):ArrayBuffer {
    let binary_string = atob(base64);
    let len = binary_string.length;
    let bytes = new Uint8Array( len );
    for (let i = 0; i < len; i++)        {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}



// get hex string id from buffer
export function buffer2hex(buffer:Uint8Array|ArrayBuffer, seperator?:string, pad_size_bytes?:number, x_shorthand = false):string {
    if (buffer instanceof ArrayBuffer) buffer = new Uint8Array(buffer);

    // first pad buffer
    if (pad_size_bytes) buffer = buffer.slice(0, pad_size_bytes);

    let array:string[] = Array.prototype.map.call(buffer, x => ('00' + x.toString(16).toUpperCase()).slice(-2))
    let skipped_bytes = 0;

    // collapse multiple 0s to x...
    if (x_shorthand) {
        array = array.slice(0,pad_size_bytes).reduce((previous, current) => {
            if (current == '00') {
                if (previous.endsWith('00')) {
                    skipped_bytes++;
                    return previous.slice(0, -2) + "x2"; // add to existing 00
                }
                else if (previous[previous.length-2] == 'x') {
                    const count = (parseInt(previous[previous.length-1],16)+1);
                    if (count <= 0xf) {
                        skipped_bytes++;
                        return previous.slice(0, -1) + count.toString(16).toUpperCase()  // add to existing x... max 15
                    }
                }
            }
            return previous + current;
        }).split(/(..)/g).filter(s=>!!s);
    }

    if (pad_size_bytes != undefined) array = Array.from({...array, length: pad_size_bytes-skipped_bytes}, x=>x==undefined?'00':x); // pad

    return array.join(seperator??'');
}

// get buffer from hex string id, x_shorthand: replace [x2] with [00 00], [xa] with [00] * 10
export function hex2buffer(hex:string, pad_size_bytes?:number, x_shorthand = false):Uint8Array { 
    if (!hex) return new Uint8Array(0); // empty buffer

    hex = hex.replace(/[_\- ]/g, "");
    if (hex.length%2 != 0) throw new ValueError('Invalid hexadecimal buffer: ' + hex);    
    if ((x_shorthand && hex.match(/[G-WYZ\s]/i)) || (!x_shorthand && hex.match(/[G-Z\s]/i))) throw new ValueError('Invalid hexadecimal buffer: ' + hex);       

    let array:number[];

    if (!x_shorthand) array = hex.match(/[\dA-Fa-fxX]{2}/gi).map( s => parseInt(s, 16));
    else array = hex.match(/[\dA-Fa-fxX]{2}/gi).map((s, i, a) => {
        s = s.toLowerCase();
        if (s.startsWith("x") && s[1]!="x") return Array(parseInt(s[1],16)).fill(0); // expand x...
        else if (s.includes("x")) throw new ValueError('Invalid buffer "x" shorthand: ' + hex.slice(0, 30)); 
        return parseInt(s, 16)
    }).flat(1)

    if (pad_size_bytes != undefined) return new Uint8Array({...array, length: pad_size_bytes});
    else return new Uint8Array(array);
}