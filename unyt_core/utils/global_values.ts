import {Logger} from "./logger.js";
import { urlToPath } from "./utils.js";

export const TypedArray:typeof Uint8Array|typeof Uint16Array|typeof Uint32Array|typeof Int8Array|typeof Int16Array|typeof Int32Array|typeof BigInt64Array|typeof BigUint64Array|typeof Float32Array|typeof Float64Array = Object.getPrototypeOf(Uint8Array);
// node.js Buffers
// @ts-ignore
export const NodeBuffer = globalThis.Buffer || class {};

export const client_type = globalThis.process?.release?.name ? 'node' : 'browser'

export const logger = new Logger("DATEX");

// never expose those properties to DATEX (constructor, toString, ...)
export const DEFAULT_HIDDEN_OBJECT_PROPERTIES = new Set(Object.getOwnPropertyNames(Object.prototype));


const dirname = client_type == "node" ? (await import('path')).default.dirname : null;
const {lstat, readdir} = client_type == 'node' ? (await import('node:fs/promises')) : {lstat:null, readdir:null};

export async function isPathDirectory(path:string){
	if (!lstat) throw new Error("Extended file utilities are not supported");
	return (await lstat(path)).isDirectory();
}

// path of the unyt_core lib, without 'unyt_core/utils' path TODO: default fallback URL?
export const baseURL = new URL(client_type == "node" ? 'file://' + dirname((await import("url")).fileURLToPath(<import('url').URL>new URL(import.meta.url)))+'/../../' : (globalThis.document ? document.baseURI : 'https://anonymous.unyt.org'));
// path from which the script was executed (same aas baseURL in browsers)
export const cwdURL = globalThis.process ? new URL(process.cwd() + '/', 'file://') : baseURL;
