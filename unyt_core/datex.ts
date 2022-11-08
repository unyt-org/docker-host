// all Datex.*
import * as Datex from "./datex_all.js";
export {Datex};
globalThis.Datex = Datex;

// shortcut methods ($$, string, int, ...)
export * from "./datex_short.js";

// decorators
export * from "./js_adapter/legacy_decorators.js";