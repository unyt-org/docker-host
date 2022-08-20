import Logger from "./logger.js";
let logger = new Logger("datex compiler");
import { Datex, ReadableStream, arrayBufferToBase64, DatexRuntimePerformance } from "./datex_runtime.js";
export var BinaryCode;
(function (BinaryCode) {
    BinaryCode[BinaryCode["END"] = 0] = "END";
    BinaryCode[BinaryCode["STD_TYPE_STRING"] = 16] = "STD_TYPE_STRING";
    BinaryCode[BinaryCode["STD_TYPE_INT"] = 17] = "STD_TYPE_INT";
    BinaryCode[BinaryCode["STD_TYPE_FLOAT"] = 18] = "STD_TYPE_FLOAT";
    BinaryCode[BinaryCode["STD_TYPE_BOOLEAN"] = 19] = "STD_TYPE_BOOLEAN";
    BinaryCode[BinaryCode["STD_TYPE_NULL"] = 20] = "STD_TYPE_NULL";
    BinaryCode[BinaryCode["STD_TYPE_VOID"] = 21] = "STD_TYPE_VOID";
    BinaryCode[BinaryCode["STD_TYPE_BUFFER"] = 22] = "STD_TYPE_BUFFER";
    BinaryCode[BinaryCode["STD_TYPE_CODE_BLOCK"] = 23] = "STD_TYPE_CODE_BLOCK";
    BinaryCode[BinaryCode["STD_TYPE_UNIT"] = 24] = "STD_TYPE_UNIT";
    BinaryCode[BinaryCode["STD_TYPE_FILTER"] = 25] = "STD_TYPE_FILTER";
    BinaryCode[BinaryCode["STD_TYPE_ARRAY"] = 26] = "STD_TYPE_ARRAY";
    BinaryCode[BinaryCode["STD_TYPE_OBJECT"] = 27] = "STD_TYPE_OBJECT";
    BinaryCode[BinaryCode["STD_TYPE_SET"] = 28] = "STD_TYPE_SET";
    BinaryCode[BinaryCode["STD_TYPE_MAP"] = 29] = "STD_TYPE_MAP";
    BinaryCode[BinaryCode["STD_TYPE_TUPLE"] = 30] = "STD_TYPE_TUPLE";
    BinaryCode[BinaryCode["STD_TYPE_RECORD"] = 31] = "STD_TYPE_RECORD";
    BinaryCode[BinaryCode["STD_TYPE_FUNCTION"] = 32] = "STD_TYPE_FUNCTION";
    BinaryCode[BinaryCode["STD_TYPE_STREAM"] = 33] = "STD_TYPE_STREAM";
    BinaryCode[BinaryCode["STD_TYPE_ANY"] = 34] = "STD_TYPE_ANY";
    BinaryCode[BinaryCode["STD_TYPE_ASSERTION"] = 35] = "STD_TYPE_ASSERTION";
    BinaryCode[BinaryCode["STD_TYPE_TASK"] = 36] = "STD_TYPE_TASK";
    BinaryCode[BinaryCode["STD_TYPE_ITERATOR"] = 37] = "STD_TYPE_ITERATOR";
    BinaryCode[BinaryCode["VAR_RESULT"] = 48] = "VAR_RESULT";
    BinaryCode[BinaryCode["SET_VAR_RESULT"] = 49] = "SET_VAR_RESULT";
    BinaryCode[BinaryCode["VAR_RESULT_ACTION"] = 50] = "VAR_RESULT_ACTION";
    BinaryCode[BinaryCode["VAR_SUB_RESULT"] = 51] = "VAR_SUB_RESULT";
    BinaryCode[BinaryCode["SET_VAR_SUB_RESULT"] = 52] = "SET_VAR_SUB_RESULT";
    BinaryCode[BinaryCode["VAR_SUB_RESULT_ACTION"] = 53] = "VAR_SUB_RESULT_ACTION";
    BinaryCode[BinaryCode["VAR_ROOT"] = 54] = "VAR_ROOT";
    BinaryCode[BinaryCode["SET_VAR_ROOT"] = 55] = "SET_VAR_ROOT";
    BinaryCode[BinaryCode["VAR_ROOT_ACTION"] = 56] = "VAR_ROOT_ACTION";
    BinaryCode[BinaryCode["VAR_ORIGIN"] = 57] = "VAR_ORIGIN";
    BinaryCode[BinaryCode["SET_VAR_ORIGIN"] = 58] = "SET_VAR_ORIGIN";
    BinaryCode[BinaryCode["VAR_ORIGIN_ACTION"] = 59] = "VAR_ORIGIN_ACTION";
    BinaryCode[BinaryCode["VAR_SENDER"] = 60] = "VAR_SENDER";
    BinaryCode[BinaryCode["VAR_CURRENT"] = 61] = "VAR_CURRENT";
    BinaryCode[BinaryCode["VAR_ENCRYPTED"] = 62] = "VAR_ENCRYPTED";
    BinaryCode[BinaryCode["VAR_SIGNED"] = 63] = "VAR_SIGNED";
    BinaryCode[BinaryCode["VAR_TIMESTAMP"] = 64] = "VAR_TIMESTAMP";
    BinaryCode[BinaryCode["VAR_META"] = 65] = "VAR_META";
    BinaryCode[BinaryCode["VAR_STATIC"] = 66] = "VAR_STATIC";
    BinaryCode[BinaryCode["VAR_THIS"] = 67] = "VAR_THIS";
    BinaryCode[BinaryCode["VAR_IT"] = 71] = "VAR_IT";
    BinaryCode[BinaryCode["SET_VAR_IT"] = 72] = "SET_VAR_IT";
    BinaryCode[BinaryCode["VAR_IT_ACTION"] = 73] = "VAR_IT_ACTION";
    BinaryCode[BinaryCode["VAR_ITER"] = 74] = "VAR_ITER";
    BinaryCode[BinaryCode["SET_VAR_ITER"] = 75] = "SET_VAR_ITER";
    BinaryCode[BinaryCode["VAR_ITER_ACTION"] = 76] = "VAR_ITER_ACTION";
    BinaryCode[BinaryCode["VAR_REMOTE"] = 68] = "VAR_REMOTE";
    BinaryCode[BinaryCode["SET_VAR_REMOTE"] = 69] = "SET_VAR_REMOTE";
    BinaryCode[BinaryCode["VAR_REMOTE_ACTION"] = 70] = "VAR_REMOTE_ACTION";
    BinaryCode[BinaryCode["CACHE_POINT"] = 80] = "CACHE_POINT";
    BinaryCode[BinaryCode["CACHE_RESET"] = 81] = "CACHE_RESET";
    BinaryCode[BinaryCode["URL"] = 82] = "URL";
    BinaryCode[BinaryCode["REQUEST"] = 88] = "REQUEST";
    BinaryCode[BinaryCode["TEMPLATE"] = 83] = "TEMPLATE";
    BinaryCode[BinaryCode["EXTENDS"] = 84] = "EXTENDS";
    BinaryCode[BinaryCode["IMPLEMENTS"] = 85] = "IMPLEMENTS";
    BinaryCode[BinaryCode["MATCHES"] = 86] = "MATCHES";
    BinaryCode[BinaryCode["DEBUG"] = 87] = "DEBUG";
    BinaryCode[BinaryCode["CLOSE_AND_STORE"] = 160] = "CLOSE_AND_STORE";
    BinaryCode[BinaryCode["SUBSCOPE_START"] = 161] = "SUBSCOPE_START";
    BinaryCode[BinaryCode["SUBSCOPE_END"] = 162] = "SUBSCOPE_END";
    BinaryCode[BinaryCode["RETURN"] = 164] = "RETURN";
    BinaryCode[BinaryCode["JMP"] = 165] = "JMP";
    BinaryCode[BinaryCode["JTR"] = 166] = "JTR";
    BinaryCode[BinaryCode["JFA"] = 102] = "JFA";
    BinaryCode[BinaryCode["EQUAL_VALUE"] = 167] = "EQUAL_VALUE";
    BinaryCode[BinaryCode["NOT_EQUAL_VALUE"] = 168] = "NOT_EQUAL_VALUE";
    BinaryCode[BinaryCode["EQUAL"] = 163] = "EQUAL";
    BinaryCode[BinaryCode["NOT_EQUAL"] = 223] = "NOT_EQUAL";
    BinaryCode[BinaryCode["GREATER"] = 169] = "GREATER";
    BinaryCode[BinaryCode["LESS"] = 170] = "LESS";
    BinaryCode[BinaryCode["GREATER_EQUAL"] = 171] = "GREATER_EQUAL";
    BinaryCode[BinaryCode["LESS_EQUAL"] = 172] = "LESS_EQUAL";
    BinaryCode[BinaryCode["COUNT"] = 173] = "COUNT";
    BinaryCode[BinaryCode["ABOUT"] = 174] = "ABOUT";
    BinaryCode[BinaryCode["WILDCARD"] = 175] = "WILDCARD";
    BinaryCode[BinaryCode["VAR"] = 176] = "VAR";
    BinaryCode[BinaryCode["SET_VAR"] = 177] = "SET_VAR";
    BinaryCode[BinaryCode["VAR_ACTION"] = 178] = "VAR_ACTION";
    BinaryCode[BinaryCode["INTERNAL_VAR"] = 179] = "INTERNAL_VAR";
    BinaryCode[BinaryCode["SET_INTERNAL_VAR"] = 180] = "SET_INTERNAL_VAR";
    BinaryCode[BinaryCode["INTERNAL_VAR_ACTION"] = 181] = "INTERNAL_VAR_ACTION";
    BinaryCode[BinaryCode["POINTER"] = 182] = "POINTER";
    BinaryCode[BinaryCode["SET_POINTER"] = 183] = "SET_POINTER";
    BinaryCode[BinaryCode["POINTER_ACTION"] = 184] = "POINTER_ACTION";
    BinaryCode[BinaryCode["CREATE_POINTER"] = 185] = "CREATE_POINTER";
    BinaryCode[BinaryCode["DELETE_POINTER"] = 186] = "DELETE_POINTER";
    BinaryCode[BinaryCode["SUBSCRIBE"] = 187] = "SUBSCRIBE";
    BinaryCode[BinaryCode["UNSUBSCRIBE"] = 188] = "UNSUBSCRIBE";
    BinaryCode[BinaryCode["VALUE"] = 189] = "VALUE";
    BinaryCode[BinaryCode["ORIGIN"] = 190] = "ORIGIN";
    BinaryCode[BinaryCode["SUBSCRIBERS"] = 191] = "SUBSCRIBERS";
    BinaryCode[BinaryCode["TRANSFORM"] = 103] = "TRANSFORM";
    BinaryCode[BinaryCode["OBSERVE"] = 104] = "OBSERVE";
    BinaryCode[BinaryCode["DO"] = 105] = "DO";
    BinaryCode[BinaryCode["AWAIT"] = 112] = "AWAIT";
    BinaryCode[BinaryCode["HOLD"] = 113] = "HOLD";
    BinaryCode[BinaryCode["FUNCTION"] = 114] = "FUNCTION";
    BinaryCode[BinaryCode["ASSERT"] = 89] = "ASSERT";
    BinaryCode[BinaryCode["ITERATOR"] = 90] = "ITERATOR";
    BinaryCode[BinaryCode["ITERATION"] = 91] = "ITERATION";
    BinaryCode[BinaryCode["STRING"] = 192] = "STRING";
    BinaryCode[BinaryCode["INT_8"] = 193] = "INT_8";
    BinaryCode[BinaryCode["INT_16"] = 194] = "INT_16";
    BinaryCode[BinaryCode["INT_32"] = 195] = "INT_32";
    BinaryCode[BinaryCode["INT_64"] = 196] = "INT_64";
    BinaryCode[BinaryCode["FLOAT_64"] = 197] = "FLOAT_64";
    BinaryCode[BinaryCode["TRUE"] = 198] = "TRUE";
    BinaryCode[BinaryCode["FALSE"] = 199] = "FALSE";
    BinaryCode[BinaryCode["NULL"] = 200] = "NULL";
    BinaryCode[BinaryCode["VOID"] = 201] = "VOID";
    BinaryCode[BinaryCode["BUFFER"] = 202] = "BUFFER";
    BinaryCode[BinaryCode["SCOPE_BLOCK"] = 203] = "SCOPE_BLOCK";
    BinaryCode[BinaryCode["UNIT"] = 204] = "UNIT";
    BinaryCode[BinaryCode["FLOAT_AS_INT"] = 205] = "FLOAT_AS_INT";
    BinaryCode[BinaryCode["SHORT_STRING"] = 206] = "SHORT_STRING";
    BinaryCode[BinaryCode["PERSON_ALIAS"] = 208] = "PERSON_ALIAS";
    BinaryCode[BinaryCode["PERSON_ALIAS_WILDCARD"] = 209] = "PERSON_ALIAS_WILDCARD";
    BinaryCode[BinaryCode["INSTITUTION_ALIAS"] = 210] = "INSTITUTION_ALIAS";
    BinaryCode[BinaryCode["INSTITUTION_ALIAS_WILDCARD"] = 211] = "INSTITUTION_ALIAS_WILDCARD";
    BinaryCode[BinaryCode["BOT"] = 212] = "BOT";
    BinaryCode[BinaryCode["BOT_WILDCARD"] = 213] = "BOT_WILDCARD";
    BinaryCode[BinaryCode["LABEL"] = 218] = "LABEL";
    BinaryCode[BinaryCode["SET_LABEL"] = 219] = "SET_LABEL";
    BinaryCode[BinaryCode["LABEL_ACTION"] = 220] = "LABEL_ACTION";
    BinaryCode[BinaryCode["ENDPOINT"] = 214] = "ENDPOINT";
    BinaryCode[BinaryCode["ENDPOINT_WILDCARD"] = 215] = "ENDPOINT_WILDCARD";
    BinaryCode[BinaryCode["FILTER"] = 222] = "FILTER";
    BinaryCode[BinaryCode["SYNC"] = 216] = "SYNC";
    BinaryCode[BinaryCode["STOP_SYNC"] = 217] = "STOP_SYNC";
    BinaryCode[BinaryCode["FREEZE"] = 96] = "FREEZE";
    BinaryCode[BinaryCode["SEAL"] = 97] = "SEAL";
    BinaryCode[BinaryCode["HAS"] = 98] = "HAS";
    BinaryCode[BinaryCode["KEYS"] = 99] = "KEYS";
    BinaryCode[BinaryCode["ARRAY_START"] = 224] = "ARRAY_START";
    BinaryCode[BinaryCode["ARRAY_END"] = 225] = "ARRAY_END";
    BinaryCode[BinaryCode["OBJECT_START"] = 226] = "OBJECT_START";
    BinaryCode[BinaryCode["OBJECT_END"] = 227] = "OBJECT_END";
    BinaryCode[BinaryCode["TUPLE_START"] = 228] = "TUPLE_START";
    BinaryCode[BinaryCode["TUPLE_END"] = 229] = "TUPLE_END";
    BinaryCode[BinaryCode["RECORD_START"] = 230] = "RECORD_START";
    BinaryCode[BinaryCode["RECORD_END"] = 231] = "RECORD_END";
    BinaryCode[BinaryCode["ELEMENT_WITH_KEY"] = 232] = "ELEMENT_WITH_KEY";
    BinaryCode[BinaryCode["KEY_PERMISSION"] = 247] = "KEY_PERMISSION";
    BinaryCode[BinaryCode["ELEMENT"] = 233] = "ELEMENT";
    BinaryCode[BinaryCode["AND"] = 234] = "AND";
    BinaryCode[BinaryCode["OR"] = 235] = "OR";
    BinaryCode[BinaryCode["NOT"] = 236] = "NOT";
    BinaryCode[BinaryCode["STREAM"] = 237] = "STREAM";
    BinaryCode[BinaryCode["STOP_STREAM"] = 221] = "STOP_STREAM";
    BinaryCode[BinaryCode["CHILD_GET"] = 240] = "CHILD_GET";
    BinaryCode[BinaryCode["CHILD_GET_REF"] = 239] = "CHILD_GET_REF";
    BinaryCode[BinaryCode["CHILD_SET"] = 241] = "CHILD_SET";
    BinaryCode[BinaryCode["CHILD_ACTION"] = 242] = "CHILD_ACTION";
    BinaryCode[BinaryCode["THROW_ERROR"] = 244] = "THROW_ERROR";
    BinaryCode[BinaryCode["GET_TYPE"] = 245] = "GET_TYPE";
    BinaryCode[BinaryCode["REMOTE"] = 246] = "REMOTE";
    BinaryCode[BinaryCode["ADD"] = 248] = "ADD";
    BinaryCode[BinaryCode["SUBTRACT"] = 250] = "SUBTRACT";
    BinaryCode[BinaryCode["MULTIPLY"] = 251] = "MULTIPLY";
    BinaryCode[BinaryCode["DIVIDE"] = 252] = "DIVIDE";
    BinaryCode[BinaryCode["RANGE"] = 253] = "RANGE";
    BinaryCode[BinaryCode["EXTEND"] = 254] = "EXTEND";
    BinaryCode[BinaryCode["TYPE"] = 255] = "TYPE";
    BinaryCode[BinaryCode["EXTENDED_TYPE"] = 238] = "EXTENDED_TYPE";
})(BinaryCode || (BinaryCode = {}));
var ACTION_TYPE;
(function (ACTION_TYPE) {
    ACTION_TYPE[ACTION_TYPE["GET"] = 0] = "GET";
    ACTION_TYPE[ACTION_TYPE["SET"] = 1] = "SET";
    ACTION_TYPE[ACTION_TYPE["OTHER"] = 2] = "OTHER";
})(ACTION_TYPE || (ACTION_TYPE = {}));
export const Regex = {
    CLOSE_AND_STORE: /^(;\s*)+/,
    VARIABLE: /^(\\)?()([A-Za-zÀ-ž_][A-Za-z0-9À-ž_]*)(\s*[+-/*$&|]?=(?![=>/]))?/,
    INTERNAL_VAR: /^()(#)([A-Za-z0-9À-ž_]+)(\s*[+-/*$&|]?=(?![=>/]))?/,
    LABELED_POINTER: /^(\\)?(\$)([A-Za-z0-9À-ž_]{1,25})(\s*[+-/*$&|]?=(?![=>/]))?/,
    HEX_VARIABLE: /^[A-Fa-f0-9_]*$/,
    JUMP: /^(jmp|jtr|jfa) +([A-Za-z_]\w*)?/,
    JUMP_LBL: /^lbl *([A-Za-z_]\w*)?/,
    ERROR: /^\!(\w|\.)+/,
    URL: /^[a-zA-Z0-9_]+:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/,
    SUBSCOPE_START: /^\(/,
    SUBSCOPE_END: /^\)/,
    SYNC: /^\<\=\=/,
    STOP_SYNC: /^\<\/\=/,
    ADD: /^\+/,
    SUBTRACT: /^\-/,
    MULTIPLY: /^\*/,
    DIVIDE: /^\//,
    ASSIGN_SET: /^\=/,
    ASSIGN_POINTER_VALUE: /^\$\=/,
    ASSIGN_ADD: /^\+\=/,
    ASSIGN_MUTIPLY: /^\*\=/,
    ASSIGN_DIVIDE: /^\/\=/,
    ASSIGN_SUB: /^\-\=/,
    ASSIGN_AND: /^\&\=/,
    ASSIGN_OR: /^\|\=/,
    THROW_ERROR: /^\!/,
    EQUAL_VALUE: /^\=\=/,
    NOT_EQUAL_VALUE: /^\~\=/,
    EQUAL: /^\=\=\=/,
    NOT_EQUAL: /^\~\=\=/,
    GREATER: /^\>/,
    GREATER_EQUAL: /^\>\=/,
    LESS: /^\</,
    LESS_EQUAL: /^\<\=/,
    STRING_OR_ESCAPED_KEY: /^("(?:(?:.|\n)*?[^\\])??(?:(?:\\\\)+)?"|'(?:(?:.|\n)*?[^\\])??(?:(?:\\\\)+)?')( *\:(?!:))?/,
    INT: /^(-|\+)?(\d_?)+\b(?!\.\d)/,
    HEX: /^0x[0-9a-fA-F]+/,
    UNIT: /^((-|\+)?((\d_?)*\.)?(\d_?)+)u/,
    TSTRING_START: /^'(?:(?:[^\\']|)\\(?:\\\\)*'|(?:\\)*[^'\\])*?(?:[^'\\(](\\\\)*|(\\\\)*)\(/,
    TSTRING_B_CLOSE: /^\)(?:(?:[^\\']|)\\(?:\\\\)*'|(?:\\)*[^'\\])*?(?:[^'\\(](\\\\)*|(\\\\)*)\(/,
    TSTRING_END: /^\)(?:(?:[^\\']|)\\(?:\\\\)*'|(?:\\)*[^'\\])*?(?:[^'\\(](\\\\)*|(\\\\)*)'/,
    FLOAT: /^((-|\+)?((\d_?)*\.)?(\d_?)*((E|e)(-|\+)?(\d_?)+)|(-|\+)?(\d_?)+\.(\d_?)+)/,
    INFINITY: /^(-|\+)?infinity\b/,
    NAN: /^nan\b/,
    BOOLEAN: /^(true|false)\b/,
    USE: /^use\b/,
    RANGE: /^\.\./,
    SPREAD: /^\.\.\./,
    NULL: /^null\b/,
    VOID: /^void\b/,
    QUASI_VOID: /^\(\s*\)/,
    BROADCAST_ENDPOINT: /^\@(\*)((\.([A-Za-z0-9À-ž-_]{1,32}|\*))*)(\/(\*|[A-Za-z0-9À-ž-_]{1,8}))?/,
    ENDPOINT: /^\@\@([A-Fa-f0-9_-]{2,26})((\.([A-Za-z0-9À-ž-_]{1,32}|\*))*)(\/(\*|[A-Za-z0-9À-ž-_]{1,8}))?/,
    PERSON_ALIAS: /^\@([A-Za-z0-9À-ž-_]{1,32})((\.([A-Za-z0-9À-ž-_]{1,32}|\*))*)(\/(\*|[A-Za-z0-9À-ž-_]{1,8}))?/,
    INSTITUTION_ALIAS: /^\@\+([A-Za-z0-9À-ž-_]{1,32})((\.([A-Za-z0-9À-ž-_]{1,32}|\*))*)(\/(\*|[A-Za-z0-9À-ž-_]{1,8}))?/,
    BOT: /^\*\+?[A-Za-zÀ-ž_][A-Za-z0-9À-ž-_]{0,17}(\/(\*|[A-Za-z0-9À-ž-_]{1,8}))?/,
    ANY_INSTITUTION: /^\+\+/,
    _ANY_FILTER_TARGET: /^\@\+?[A-Za-z0-9À-ž-_]{1,32}(\:[A-Za-z0-9À-ž-_]{1,32})*(\/(\*|[A-Za-z0-9À-ž-_]{1,8}))?|\@\@[A-Fa-f0-9_-]{2,53}(\/(\*|[A-Za-z0-9À-ž-_]{1,8}))?$/,
    KEY: /^[A-Za-z0-9À-ž_]+?\s*:(?!:)/,
    PROPERTY: /^[A-Za-zÀ-ž_][A-Za-z0-9À-ž_]*/,
    EMPTY_ARRAY: /^\[\s*]/,
    EMPTY_OBJECT: /^\{\s*}/,
    ARRAY_START: /^\[/,
    ARRAY_END: /^\]/,
    AND: /^\&/,
    OR: /^\|/,
    NOT: /^\~/,
    WILDCARD: /^\*(?!\+?[A-Za-zÀ-ž_])/,
    CODE_BLOCK_START: /^\( *((?:(?:(<(([^:>]*?):)?(.*?)> *)?[A-Za-z_][A-Za-z0-9À-ž_]*|with *\((?:[A-Za-z_][A-Za-z0-9À-ž_]*,? *)*\)) *,? *)*)\) *=> *(\(?)/,
    CODE_BLOCK_START_SINGLE_ARG: /^((?:(?:with *)?[A-Za-z_][A-Za-z0-9À-ž_]*)|with *\((?:[A-Za-z_][A-Za-z0-9À-ž_]*,? *)*\)) *=> *(\(?)/,
    REMOTE_CALL: /^(?:\:\: *)\s*(\()?/,
    FREEZE: /^freeze\b/,
    SEAL: /^seal\b/,
    HAS: /^has\b/,
    KEYS: /^keys\b/,
    ITERATE: /^iterate\b/,
    ITERATOR: /^iterator\b/,
    ITERATION: /^iteration\b/,
    DELETE: /^delete\b/,
    SUBSCRIBE: /^subscribe\b/,
    UNSUBSCRIBE: /^unsubscribe\b/,
    VALUE: /^value\b/,
    GET_TYPE: /^type\b/,
    ORIGIN: /^origin\b/,
    SUBSCRIBERS: /^subscribers\b/,
    TEMPLATE: /^template\b/,
    EXTENDS: /^extends\b/,
    IMPLEMENTS: /^implements\b/,
    MATCHES: /^matches\b/,
    DEBUG: /^debug\b/,
    OBSERVE: /^observe\b/,
    TRANSFORM: /^transform\b\s*(\()?/,
    HOLD: /^hold\b\s*(\()?/,
    DO: /^do\b\s*(\()?/,
    AWAIT: /^await\b/,
    FUNCTION: /^function\b/,
    ASSERT: /^assert\b\s*(\()?/,
    SKIP: /^skip\b\s*(\()?/,
    LEAVE: /^leave\b\s*(\()?/,
    CONSTRUCTOR_METHOD: /^constructor|destructor|replicator|creator\b/,
    OBJECT_START: /^\{/,
    OBJECT_END: /^\}/,
    BUFFER: /^\`([A-Fa-f0-9_]*)\`/,
    COMMENT: /^(# .*|###(.|\n)*?###)/,
    COMMA: /^,/,
    PATH_SEPERATOR: /^\./,
    PATH_REF_SEPERATOR: /^\-\>/,
    END: /^end\b/,
    ABOUT: /^about\b/,
    COUNT: /^count\b/,
    REQUEST: /^request\b/,
    RETURN: /^return\b/,
    WHILE: /^while\b/,
    ELSE: /^else\b/,
    ELSE_IF: /^(else\b)?\s*if\b/,
    FUN: /^fun\b/,
    TYPE: /^<(?:(\w+?):)?([A-Za-z0-9À-ž_+-]+?)(\/[A-Za-z0-9À-ž_+-]*)*?(>|\()/,
    STRING_PROPERTY: /^\s*([A-Za-z_][A-Za-z0-9À-ž_]*)/,
    POINTER: /^\$((?:[A-Fa-f0-9]{2}|[xX]([A-Fa-f0-9])){1,26})(\s*[+-/*$&|]?=(?![=>/]))?/,
    CREATE_POINTER: /^\$\$/,
    STREAM: /^\<\</,
    STOP_STREAM: /^\<\//,
    INSERT: /^\?(\d*)/,
    ESCAPE_SEQUENCE: /\\(.)/g,
    ESCAPE_BACKSPACE: /\\b/g,
    ESCAPE_FORM_FEED: /\\f/g,
    ESCAPE_LINE_FEED: /\\n/g,
    ESCAPE_CARRIAGE_RETURN: /\\r/g,
    ESCAPE_HORIZONTAL_TAB: /\\t/g,
    ESCAPE_VERTICAL_TAB: /\\v/g,
    ESCAPE_UNICODE: /\\u(.{0,4})/g,
    ESCAPE_HEX: /\\x(.{0,2})/g,
    ESCAPE_OCTAL: /\\([0]*[0-3][0-9][0-9]|[0-9]?[0-9])/g,
    HEX_STRING: /^[A-Fa-f0-9]+$/
};
export var DatexProtocolDataType;
(function (DatexProtocolDataType) {
    DatexProtocolDataType[DatexProtocolDataType["REQUEST"] = 0] = "REQUEST";
    DatexProtocolDataType[DatexProtocolDataType["RESPONSE"] = 1] = "RESPONSE";
    DatexProtocolDataType[DatexProtocolDataType["DATA"] = 2] = "DATA";
    DatexProtocolDataType[DatexProtocolDataType["BC_TRNSCT"] = 3] = "BC_TRNSCT";
    DatexProtocolDataType[DatexProtocolDataType["LOCAL_REQ"] = 4] = "LOCAL_REQ";
    DatexProtocolDataType[DatexProtocolDataType["HELLO"] = 6] = "HELLO";
})(DatexProtocolDataType || (DatexProtocolDataType = {}));
globalThis.DatexProtocolDataType = DatexProtocolDataType;
export const DatexProtocolDataTypesMap = [
    "REQUEST", "RESPONSE", "DATA", "BC_TRNSCT", "LOCAL_REQ", "-", "HELLO"
];
const utf8_decoder = new TextDecoder();
export class DatexCompiler {
    static VERSION_NUMBER = 1;
    static SIGN_DEFAULT = true;
    static BIG_BANG_TIME = new Date(2022, 0, 22, 0, 0, 0, 0).getTime();
    static MAX_INT_32 = 2147483647;
    static MIN_INT_32 = -2147483648;
    static MAX_INT_8 = 127;
    static MIN_INT_8 = -128;
    static MAX_INT_16 = 32767;
    static MIN_INT_16 = -32768;
    static MAX_UINT_16 = 65535;
    static signature_size = 96;
    static _buffer_block_size = 64;
    static utf8_encoder = new TextEncoder();
    static combineBuffers(buffer1, buffer2) {
        var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
        tmp.set(new Uint8Array(buffer1), 0);
        tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
        return tmp.buffer;
    }
    static sid_return_indices = new Map();
    static sid_incs = new Map();
    static sid_incs_remote = new Map();
    static MAX_SID = 4294967295;
    static MAX_BLOCK = 65535;
    static MAX_DXB_BLOCK_SIZE = DatexCompiler.MAX_UINT_16;
    static generateSID() {
        let sid;
        do {
            sid = Math.round(Math.random() * this.MAX_SID);
        } while (this.sid_return_indices.has(sid));
        this.sid_return_indices.set(sid, 0);
        this.sid_incs.set(sid, 0);
        return sid;
    }
    static removeSID(sid) {
        this.sid_return_indices.delete(sid);
        this.sid_incs.delete(sid);
    }
    static getNextReturnIndexForSID(sid) {
        if (!this.sid_return_indices.has(sid)) {
            this.sid_return_indices.set(sid, 0);
            this.sid_incs.set(sid, 0);
        }
        let c = this.sid_return_indices.get(sid);
        if (c > this.MAX_BLOCK)
            c = 0;
        this.sid_return_indices.set(sid, c + 1);
        return c;
    }
    static getBlockInc(sid) {
        if (!this.sid_return_indices.has(sid)) {
            this.sid_return_indices.set(sid, 0);
            this.sid_incs.set(sid, 0);
        }
        let c = this.sid_incs.get(sid);
        if (c > this.MAX_BLOCK)
            c = 0;
        this.sid_incs.set(sid, c + 1);
        return c;
    }
    static getBlockIncForRemoteSID(sid, remote_endpoint, reset_inc = false) {
        if (!(remote_endpoint instanceof Datex.Addresses.Target))
            throw new Datex.CompilerError("Can only send datex responses to endpoint targets");
        if (!this.sid_incs_remote.has(remote_endpoint))
            this.sid_incs_remote.set(remote_endpoint, new Map());
        let sid_incs = this.sid_incs_remote.get(remote_endpoint);
        if (!sid_incs.has(sid)) {
            if (reset_inc)
                return 0;
            sid_incs.set(sid, 0);
        }
        let c = sid_incs.get(sid);
        if (c > this.MAX_BLOCK)
            c = 0;
        sid_incs.set(sid, c + 1);
        if (reset_inc)
            sid_incs.set(sid, 0);
        return c;
    }
    static convertNumbersToByte(bit_distribution, ...nrs) {
        if (bit_distribution.reduce((a, b) => a + b) > 8)
            throw Error("Bit size bigger than 8 bits");
        let binary = "";
        for (let s = bit_distribution.length - 1; s >= 0; s--) {
            let size = bit_distribution[s];
            let nr = Number(nrs[s]) || 0;
            if (nr > 2 ** size - 1)
                throw Error("Number " + nr + " is bigger than " + size + "  bits");
            binary = (nr?.toString(2) || '').padStart(size, '0') + binary;
        }
        return parseInt(binary, 2);
    }
    static setHeaderTTL(dx_block, ttl) {
        let uint8 = new Uint8Array(dx_block);
        uint8[4] = ttl;
        return uint8.buffer;
    }
    static extractHeaderSender(dx_block, last_byte, _appspace_byte = true, _start = 8) {
        let header_uint8 = new Uint8Array(dx_block);
        let i = _start;
        let sender_type = header_uint8[i++];
        if (sender_type != 0) {
            let instance;
            let name_length = header_uint8[i++];
            let subspace_number = header_uint8[i++];
            let instance_length = header_uint8[i++];
            let has_appspace = false;
            if (_appspace_byte)
                has_appspace = !!header_uint8[i++];
            if (instance_length == 0)
                throw new Datex.RuntimeError("Invalid sender");
            else if (instance_length == 255)
                instance_length = 0;
            let name_binary = header_uint8.subarray(i, i += name_length);
            let name = (sender_type == BinaryCode.ENDPOINT || sender_type == BinaryCode.ENDPOINT_WILDCARD) ? name_binary : utf8_decoder.decode(name_binary);
            let subspaces = [];
            for (let n = 0; n < subspace_number; n++) {
                let length = header_uint8[i++];
                if (length == 0) {
                    throw new Datex.RuntimeError("Invalid sender");
                }
                else {
                    let subspace_name = utf8_decoder.decode(header_uint8.subarray(i, i += length));
                    subspaces.push(subspace_name);
                }
            }
            if (!instance)
                instance = utf8_decoder.decode(header_uint8.subarray(i, i += instance_length));
            if (last_byte)
                last_byte[0] = i;
            let appspace = has_appspace ? this.extractHeaderSender(dx_block, last_byte, false, i) : null;
            return Datex.Addresses.Target.get(name, subspaces, instance, appspace, sender_type);
        }
        if (last_byte)
            last_byte[0] = i;
        return null;
    }
    static extractHeaderReceiverDataList(dx_block, start_byte) {
        let header_uint8 = new Uint8Array(dx_block);
        let i = start_byte;
        let targets_map = new Map();
        let targets_nr = header_uint8[i++];
        let target_list = [];
        for (let n = 0; n < targets_nr; n++) {
            let type = header_uint8[i++];
            if (type == BinaryCode.POINTER) {
            }
            else {
                let name_length = header_uint8[i++];
                let subspace_number = header_uint8[i++];
                let instance_length = header_uint8[i++];
                let name_binary = header_uint8.subarray(i, i += name_length);
                let name = type == BinaryCode.ENDPOINT ? name_binary : utf8_decoder.decode(name_binary);
                let subspaces = [];
                for (let n = 0; n < subspace_number; n++) {
                    let length = header_uint8[i++];
                    let subspace_name = utf8_decoder.decode(header_uint8.subarray(i, i += length));
                    subspaces.push(subspace_name);
                }
                let instance = utf8_decoder.decode(header_uint8.subarray(i, i += instance_length));
                const target = Datex.Addresses.Target.get(name, subspaces, instance, null, type);
                target_list.push(target);
                let has_key = header_uint8[i++];
                if (has_key) {
                    targets_map.set(target, header_uint8.slice(i, i + 512));
                    i += 512;
                }
            }
        }
        return targets_map;
    }
    static updateHeaderReceiver(dx_block, to) {
        let last_byte = [0];
        let sender = DatexCompiler.extractHeaderSender(dx_block, last_byte);
        let keys = DatexCompiler.extractHeaderReceiverDataList(dx_block, last_byte[0] + 2);
        let receiver_buffer = DatexCompiler.filterToDXB(to instanceof Datex.Addresses.Target ? new Datex.Addresses.Filter(to) : to, keys, true);
        if (!receiver_buffer) {
            logger.error("could not get receiver buffer");
            return;
        }
        let receiver_start_index = last_byte[0];
        let routing_header_size = receiver_start_index + Uint16Array.BYTES_PER_ELEMENT + new DataView(dx_block).getUint16(receiver_start_index, true);
        let uint8 = new Uint8Array(dx_block);
        let routing_part = uint8.slice(0, receiver_start_index);
        let main_part = uint8.slice(routing_header_size);
        let total_header_size = receiver_start_index + Uint16Array.BYTES_PER_ELEMENT + receiver_buffer.byteLength;
        let total_size = total_header_size + main_part.byteLength;
        let new_dx_block = new ArrayBuffer(total_size);
        let data_view = new DataView(new_dx_block);
        uint8 = new Uint8Array(new_dx_block);
        uint8.set(routing_part);
        uint8.set(main_part, total_header_size);
        data_view.setUint16(receiver_start_index, receiver_buffer.byteLength, true);
        uint8.set(new Uint8Array(receiver_buffer), receiver_start_index + Uint16Array.BYTES_PER_ELEMENT);
        return new_dx_block;
    }
    static DEFAULT_TTL = 64;
    static device_types = {
        "default": 0,
        "mobile": 1,
        "network": 2,
        "embedded": 3,
        "virtual": 4
    };
    static async getScopeBlockSize(SCOPE) {
        if (SCOPE.full_dxb_size)
            return SCOPE.full_dxb_size;
        const [receiver_buffer, sender_buffer, pre_header_size, signed_header_size, full_dxb_size] = await this.generateScopeBlockMetaInfo(SCOPE.options.to, SCOPE.options.from, SCOPE.options.sign, SCOPE.options.encrypt, SCOPE.options.flood, SCOPE.options.send_sym_encrypt_key, SCOPE.options.sym_encrypt_key, SCOPE.buffer.byteLength, SCOPE.options.force_id);
        SCOPE.receiver_buffer = receiver_buffer;
        SCOPE.sender_buffer = sender_buffer;
        SCOPE.pre_header_size = pre_header_size;
        SCOPE.signed_header_size = signed_header_size;
        SCOPE.full_dxb_size = full_dxb_size;
        return SCOPE.full_dxb_size;
    }
    static async generateScopeBlockMetaInfo(to, from = Datex.Runtime.endpoint, sign = DatexCompiler.SIGN_DEFAULT, encrypt = false, flood = false, send_sym_encrypt_key = true, sym_encrypt_key, dxb_block_length, force_id = false) {
        let receiver_buffer;
        if (!flood && to) {
            let endpoint_key_map = new Map();
            if (send_sym_encrypt_key && sym_encrypt_key) {
                for (let endpoint of (to instanceof Datex.Addresses.Target ? (to instanceof Datex.Addresses.Endpoint ? [to] : []) : to.getPositiveEndpoints())) {
                    endpoint_key_map.set(endpoint, await Datex.Crypto.encryptSymmetricKeyForEndpoint(sym_encrypt_key, endpoint));
                }
            }
            receiver_buffer = DatexCompiler.filterToDXB(to instanceof Datex.Addresses.Target ? new Datex.Addresses.Filter(to) : to, endpoint_key_map, true);
        }
        if (force_id && from)
            from = from.id_endpoint;
        const sender_buffer = from ? this.endpointToDXB(from) : new ArrayBuffer(1);
        const pre_header_size = 10 + sender_buffer.byteLength + (receiver_buffer?.byteLength ?? 0) + (sign ? Datex.Crypto.SIGN_BUFFER_SIZE : 0);
        const signed_header_size = 18 + (encrypt ? Datex.Crypto.IV_BUFFER_SIZE : 0);
        const full_dxb_size = pre_header_size + signed_header_size + dxb_block_length;
        return [receiver_buffer, sender_buffer, pre_header_size, signed_header_size, full_dxb_size];
    }
    static async appendHeader(dx_block = new ArrayBuffer(0), end_of_scope = true, from = Datex.Runtime.endpoint, to, flood = false, type = DatexProtocolDataType.REQUEST, sign = DatexCompiler.SIGN_DEFAULT, encrypt = false, send_sym_encrypt_key = true, sym_encrypt_key, allow_execute = type == DatexProtocolDataType.REQUEST || type == DatexProtocolDataType.LOCAL_REQ, sid = type == DatexProtocolDataType.RESPONSE ? -1 : (type == DatexProtocolDataType.DATA ? 0 : this.generateSID()), return_index = 0, block_inc = type == DatexProtocolDataType.RESPONSE ? this.getBlockIncForRemoteSID(sid, to, end_of_scope) : this.getBlockInc(sid), force_id = false, __routing_ttl = DatexCompiler.DEFAULT_TTL, __routing_prio = 0, __routing_to, receiver_buffer, sender_buffer, pre_header_size, signed_header_size, full_dxb_size) {
        const compile_measure = DatexRuntimePerformance.startMeasure("compile time", "header");
        if (sid == -1)
            throw new Datex.CompilerError("Cannot generate a new SID for a RESPONSE");
        if (full_dxb_size == undefined) {
            [receiver_buffer, sender_buffer, pre_header_size, signed_header_size, full_dxb_size] = await this.generateScopeBlockMetaInfo(to, from, sign, encrypt, flood, send_sym_encrypt_key, sym_encrypt_key, dx_block.byteLength, force_id);
        }
        let device_type = this.device_types.mobile;
        let iv;
        if (encrypt) {
            if (!sym_encrypt_key)
                throw new Datex.CompilerError("No symmetric encryption key provided");
            [dx_block, iv] = await Datex.Crypto.encryptSymmetric(dx_block, sym_encrypt_key);
        }
        let pre_header = new ArrayBuffer(pre_header_size);
        let pre_header_data_view = new DataView(pre_header);
        let pre_header_uint8 = new Uint8Array(pre_header);
        let header = new ArrayBuffer(signed_header_size);
        let header_data_view = new DataView(header);
        let header_uint8 = new Uint8Array(header);
        let i = 0;
        pre_header_uint8[i++] = 0x01;
        pre_header_uint8[i++] = 0x64;
        pre_header_uint8[i++] = this.VERSION_NUMBER;
        i += 2;
        pre_header_uint8[i++] = __routing_ttl;
        pre_header_uint8[i++] = __routing_prio;
        pre_header_uint8[i++] = sign && !encrypt ? 1 : (sign && encrypt ? 2 : (!sign && encrypt ? 3 : 0));
        pre_header_uint8.set(new Uint8Array(sender_buffer), i);
        i += sender_buffer.byteLength;
        if (!flood && to) {
            pre_header_data_view.setUint16(i, receiver_buffer.byteLength, true);
            i += Uint16Array.BYTES_PER_ELEMENT;
            pre_header_uint8.set(new Uint8Array(receiver_buffer), i);
            i += receiver_buffer.byteLength;
        }
        else if (flood) {
            pre_header_data_view.setUint16(i, DatexCompiler.MAX_UINT_16, true);
            i += Uint16Array.BYTES_PER_ELEMENT;
        }
        else {
            pre_header_data_view.setUint16(i, 0, true);
            i += Uint16Array.BYTES_PER_ELEMENT;
        }
        const signature_index = i;
        i = 0;
        header_data_view.setUint32(i, sid, true);
        i += Uint32Array.BYTES_PER_ELEMENT;
        header_data_view.setUint16(i, return_index, true);
        i += Uint16Array.BYTES_PER_ELEMENT;
        header_data_view.setUint16(i, block_inc, true);
        i += Uint16Array.BYTES_PER_ELEMENT;
        header_uint8[i++] = type;
        header_uint8[i++] = this.convertNumbersToByte([1, 1, 1, 5], encrypt, allow_execute, end_of_scope, device_type);
        header_data_view.setBigUint64(i, BigInt(Date.now() - this.BIG_BANG_TIME), true);
        i += BigUint64Array.BYTES_PER_ELEMENT;
        if (encrypt && iv) {
            header_uint8.set(iv, i);
            i += iv.byteLength;
        }
        let header_and_body = this.combineBuffers(header, dx_block);
        if (sign)
            pre_header_uint8.set(new Uint8Array(await Datex.Crypto.sign(header_and_body)), signature_index);
        const block_size = pre_header.byteLength + header_and_body.byteLength;
        if (block_size > this.MAX_DXB_BLOCK_SIZE) {
            pre_header_data_view.setUint16(3, 0, true);
            logger.warn("DXB block size exceeds maximum size of " + this.MAX_DXB_BLOCK_SIZE + " bytes");
        }
        else
            pre_header_data_view.setUint16(3, block_size, true);
        const buffer = this.combineBuffers(pre_header, header_and_body);
        if (DatexRuntimePerformance.enabled)
            DatexRuntimePerformance.endMeasure(compile_measure);
        return buffer;
    }
    static endpointToDXB(target) {
        let target_buffer = new ArrayBuffer(50);
        let target_uint8 = new Uint8Array(target_buffer);
        let i = 0;
        function handleRequiredBufferSize(size_in_bytes) {
            if (size_in_bytes >= target_buffer.byteLength - 1) {
                let new_size = (target_buffer.byteLength ?? 0) + Math.ceil((size_in_bytes - target_buffer.byteLength) / 8) * 8;
                let old_uint8 = target_uint8;
                target_buffer = new ArrayBuffer(new_size);
                target_uint8 = new Uint8Array(target_buffer);
                target_uint8.set(old_uint8);
            }
        }
        let name_bin = (target instanceof Datex.Addresses.IdEndpoint) ? target.binary : this.utf8_encoder.encode(target.name);
        let instance_bin = this.utf8_encoder.encode(target.instance);
        target_uint8[i++] = target.type;
        target_uint8[i++] = name_bin.byteLength;
        target_uint8[i++] = target.subspaces.length;
        target_uint8[i++] = instance_bin.byteLength == 0 ? 255 : instance_bin.byteLength;
        target_uint8[i++] = target.appspace ? 1 : 0;
        target_uint8.set(name_bin, i);
        i += name_bin.byteLength;
        for (let subspace of target.subspaces ?? []) {
            let subspace_bin = DatexCompiler.utf8_encoder.encode(subspace);
            handleRequiredBufferSize(i + 1 + subspace_bin.byteLength);
            target_uint8[i++] = subspace_bin.length;
            target_uint8.set(subspace_bin, i);
            i += subspace_bin.byteLength;
        }
        handleRequiredBufferSize(instance_bin.length);
        target_uint8.set(instance_bin, i);
        i += instance_bin.byteLength;
        target_buffer = target_buffer.slice(0, i);
        if (target.appspace) {
            target_buffer = this.combineBuffers(target_buffer, this.endpointToDXB(target.appspace));
        }
        return target_buffer;
    }
    static filterToDXB(filter, keys_map, extended_keys = false) {
        const encrypted_key_size = 512;
        let cnf = filter.calculateNormalForm(false);
        if (cnf instanceof Datex.Pointer)
            cnf = new Datex.Addresses.AndSet([cnf]);
        let filter_buffer_size = 1 + cnf.size;
        for (let and of cnf) {
            filter_buffer_size += (and instanceof Set ? and.size : 1);
        }
        let filter_buffer = new ArrayBuffer(filter_buffer_size);
        let filter_uint8 = new Uint8Array(filter_buffer);
        let filter_int8 = new Int8Array(filter_buffer);
        let targets = [];
        let index_target_map = new Map();
        let target_index = 1;
        let i = 0;
        filter_uint8[i++] = cnf.size;
        for (let and of cnf) {
            filter_uint8[i++] = (and instanceof Set ? and.size : 1);
            for (let or of (and instanceof Set ? and.values() : [and])) {
                let is_pointer = or instanceof Datex.Pointer;
                let or_positive = (or instanceof Datex.Addresses.Not ? or.value : or);
                if (!is_pointer && or_positive.appspace && !index_target_map.has(or_positive.appspace)) {
                    index_target_map.set(or_positive.appspace, targets.length);
                    targets[targets.length] = or_positive.appspace;
                }
                if (index_target_map.has(or_positive)) {
                    target_index = index_target_map.get(or_positive);
                }
                else {
                    target_index = targets.length;
                    index_target_map.set(or_positive, target_index);
                    targets[target_index] = or_positive;
                }
                filter_int8[i++] = or instanceof Datex.Addresses.Not ? -(target_index + 1) : (target_index + 1);
            }
        }
        let target_buffer = new ArrayBuffer(1 + targets.length * 20);
        let target_uint8 = new Uint8Array(target_buffer);
        i = 0;
        function handleRequiredBufferSize(size_in_bytes) {
            if (size_in_bytes >= target_buffer.byteLength - 1) {
                let new_size = (target_buffer.byteLength ?? 0) + Math.ceil((size_in_bytes - target_buffer.byteLength) / 8) * 8;
                let old_uint8 = target_uint8;
                target_buffer = new ArrayBuffer(new_size);
                target_uint8 = new Uint8Array(target_buffer);
                target_uint8.set(old_uint8);
            }
        }
        target_uint8[i++] = targets.length;
        for (let _target of targets) {
            const target = (_target instanceof Datex.Addresses.WildcardTarget) ? _target.target : _target;
            if (target instanceof Datex.Pointer) {
                console.log("filter has pointer: " + target + " = " + target.value);
                target_uint8[i++] = BinaryCode.POINTER;
                if (target.id_buffer.byteLength > Datex.Pointer.MAX_POINTER_ID_SIZE)
                    throw new Datex.CompilerError("Pointer ID size must not exceed " + Datex.Pointer.MAX_POINTER_ID_SIZE + " bytes");
                handleRequiredBufferSize(i + Datex.Pointer.MAX_POINTER_ID_SIZE);
                target_uint8.set(target.id_buffer, i);
                i += Datex.Pointer.MAX_POINTER_ID_SIZE;
            }
            else {
                let key = (target instanceof Datex.Addresses.Endpoint) ? keys_map?.get(target) : null;
                let name_bin = (target instanceof Datex.Addresses.IdEndpoint) ? target.binary : this.utf8_encoder.encode(target.name);
                let instance_bin = this.utf8_encoder.encode(target.instance);
                handleRequiredBufferSize(i + 4 + name_bin.length);
                target_uint8[i++] = target.type;
                target_uint8[i++] = name_bin.byteLength;
                target_uint8[i++] = target.subspaces.length;
                target_uint8[i++] = instance_bin.byteLength;
                target_uint8.set(name_bin, i);
                i += name_bin.byteLength;
                for (let subspace of target.subspaces ?? []) {
                    let subspace_bin = DatexCompiler.utf8_encoder.encode(subspace);
                    handleRequiredBufferSize(i + 1 + subspace_bin.byteLength);
                    target_uint8[i++] = subspace_bin.length;
                    target_uint8.set(subspace_bin, i);
                    i += subspace_bin.byteLength;
                }
                handleRequiredBufferSize(i + instance_bin.length + 1 + (key ? encrypted_key_size + 1 : 0));
                target_uint8.set(instance_bin, i);
                i += instance_bin.byteLength;
                target_uint8[i++] = target.appspace ? index_target_map.get(target.appspace) : 0;
                if (extended_keys) {
                    target_uint8[i++] = key ? 1 : 0;
                    if (key) {
                        target_uint8.set(new Uint8Array(key), i);
                        i += key.byteLength;
                    }
                }
            }
        }
        target_buffer = target_buffer.slice(0, i);
        filter_buffer = this.combineBuffers(target_buffer, filter_buffer);
        return filter_buffer;
    }
    static builder = {
        resizeBuffer: (add_bytes = DatexCompiler._buffer_block_size, SCOPE) => {
            let new_size = (SCOPE.buffer?.byteLength ?? 0) + add_bytes;
            let old_uint8 = SCOPE.uint8;
            SCOPE.buffer = new ArrayBuffer(new_size);
            SCOPE.uint8 = new Uint8Array(SCOPE.buffer);
            SCOPE.data_view = new DataView(SCOPE.buffer);
            if (old_uint8)
                SCOPE.uint8.set(old_uint8);
        },
        handleRequiredBufferSize: (size_in_bytes, SCOPE) => {
            if (size_in_bytes >= SCOPE.buffer.byteLength - 1)
                DatexCompiler.builder.resizeBuffer(Math.max(DatexCompiler._buffer_block_size, Math.ceil((size_in_bytes - SCOPE.buffer.byteLength) / 8) * 8), SCOPE);
        },
        getAssignAction: (assign_string) => {
            let action_type = ACTION_TYPE.GET;
            let action_specifier;
            if (assign_string) {
                assign_string = assign_string.replace(/ /g, '');
                if (assign_string == "=")
                    action_type = ACTION_TYPE.SET;
                else if (assign_string == "+=") {
                    action_type = ACTION_TYPE.OTHER;
                    action_specifier = BinaryCode.ADD;
                }
                else if (assign_string == "-=") {
                    action_type = ACTION_TYPE.OTHER;
                    action_specifier = BinaryCode.SUBTRACT;
                }
                else if (assign_string == "*=") {
                    action_type = ACTION_TYPE.OTHER;
                    action_specifier = BinaryCode.MULTIPLY;
                }
                else if (assign_string == "/=") {
                    action_type = ACTION_TYPE.OTHER;
                    action_specifier = BinaryCode.DIVIDE;
                }
                else if (assign_string == "&=") {
                    action_type = ACTION_TYPE.OTHER;
                    action_specifier = BinaryCode.AND;
                }
                else if (assign_string == "|=") {
                    action_type = ACTION_TYPE.OTHER;
                    action_specifier = BinaryCode.OR;
                }
                else if (assign_string == "$=") {
                    action_type = ACTION_TYPE.OTHER;
                    action_specifier = BinaryCode.CREATE_POINTER;
                }
            }
            return [action_type, action_specifier];
        },
        valueIndex: (SCOPE) => {
            if (SCOPE.inner_scope.path_info_index != -1 && SCOPE.inner_scope.path_info_index === SCOPE.b_index - 1)
                return;
            if ('value_count' in SCOPE.inner_scope)
                SCOPE.inner_scope.value_count--;
            SCOPE.inner_scope.last_value_index = SCOPE.b_index;
            if (SCOPE.inner_scope.first_value_index === undefined)
                SCOPE.inner_scope.first_value_index = SCOPE.b_index;
        },
        commaIndex: (index, SCOPE) => {
            if (!SCOPE.inner_scope.comma_indices)
                SCOPE.inner_scope.comma_indices = [];
            SCOPE.inner_scope.comma_indices.push(index);
        },
        assignmentEndIndex: (SCOPE, index) => {
            SCOPE.assignment_end_indices.add(index ?? SCOPE.b_index);
        },
        getDynamicIndex: (index, SCOPE) => {
            const dyn_index = [index];
            SCOPE.dynamic_indices.push(dyn_index);
            return dyn_index;
        },
        shiftDynamicIndices: (SCOPE, shift, after) => {
            for (let i of SCOPE.dynamic_indices) {
                if (i[0] > after)
                    i[0] += shift;
            }
            for (let [i] of SCOPE.jmp_indices) {
                if (i > after) {
                    const jmp_to = SCOPE.data_view.getUint32(i, true);
                    if (jmp_to > after)
                        SCOPE.data_view.setUint32(i, jmp_to + shift, true);
                }
            }
            let new_end_indices = new Set();
            for (let i of SCOPE.assignment_end_indices) {
                new_end_indices.add(i > after ? i + shift : i);
            }
            SCOPE.assignment_end_indices = new_end_indices;
            if (SCOPE.b_index > after)
                SCOPE.b_index += shift;
            if (SCOPE.inner_scope.last_value_index > after)
                SCOPE.inner_scope.last_value_index += shift;
            if (SCOPE.inner_scope.first_value_index > after)
                SCOPE.inner_scope.first_value_index += shift;
        },
        insertByteAtIndex: (byte, index, SCOPE) => {
            if (index instanceof Array)
                index = index[0];
            if (index == SCOPE.b_index) {
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = byte;
                return;
            }
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.uint8.copyWithin(index + 1, index);
            SCOPE.uint8[index++] = byte;
            DatexCompiler.builder.shiftDynamicIndices(SCOPE, 1, index - 2);
        },
        createInternalVariableAtIndex: (index, SCOPE, val) => {
            if (SCOPE.internal_vars.has((val)))
                return SCOPE.internal_vars.get(val);
            if (SCOPE.internal_primitive_vars.has((val)))
                return SCOPE.internal_primitive_vars.get(val);
            if (index instanceof Array)
                index = index[0];
            let var_number = SCOPE.internal_var_index++;
            const add_scope_global = !SCOPE.assignment_end_indices.has(index);
            const gap = Uint16Array.BYTES_PER_ELEMENT + 2 + (add_scope_global ? 1 : 0);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + gap, SCOPE);
            SCOPE.uint8.copyWithin(index + gap, index);
            DatexCompiler.builder.shiftDynamicIndices(SCOPE, gap, index);
            if (add_scope_global)
                SCOPE.uint8[index++] = BinaryCode.SET_VAR_SUB_RESULT;
            DatexCompiler.builder.insertVariable(SCOPE, var_number, ACTION_TYPE.SET, undefined, BinaryCode.INTERNAL_VAR, index);
            if (typeof val == "object" || typeof val == "function")
                SCOPE.internal_vars.set(val, var_number);
            else
                SCOPE.internal_primitive_vars.set(val, var_number);
            return var_number;
        },
        insertExtractedVariable: (SCOPE, base_type, v_name) => {
            let index;
            let insert_new = false;
            if (SCOPE.extract_var_indices.get(base_type).has(v_name)) {
                index = SCOPE.extract_var_indices.get(base_type).get(v_name);
            }
            else {
                index = SCOPE.extract_var_index++;
                SCOPE.extract_var_indices.get(base_type).set(v_name, index);
                insert_new = true;
            }
            DatexCompiler.builder.insertVariable(SCOPE, index, ACTION_TYPE.GET, undefined, BinaryCode.INTERNAL_VAR);
            return insert_new;
        },
        insertVariable: (SCOPE, v, action_type = ACTION_TYPE.GET, action_specifier, base_type = BinaryCode.VAR, index = SCOPE.b_index) => {
            let is_b_index = index == SCOPE.b_index;
            if (is_b_index)
                DatexCompiler.builder.handleRequiredBufferSize(index, SCOPE);
            SCOPE.uint8[index++] = base_type + action_type;
            if (action_specifier != undefined) {
                if (is_b_index)
                    DatexCompiler.builder.handleRequiredBufferSize(index, SCOPE);
                SCOPE.uint8[index++] = action_specifier;
            }
            if (v != undefined) {
                let v_name_bin;
                const is_number = typeof v == "number";
                if (!is_number) {
                    v_name_bin = this.utf8_encoder.encode(v);
                    if (is_b_index)
                        DatexCompiler.builder.handleRequiredBufferSize(index + v_name_bin.byteLength + 1, SCOPE);
                }
                else {
                    if (is_b_index)
                        DatexCompiler.builder.handleRequiredBufferSize(index + Uint16Array.BYTES_PER_ELEMENT + 1, SCOPE);
                }
                SCOPE.uint8[index++] = is_number ? 0 : v_name_bin.byteLength;
                if (is_number) {
                    if (v > 65535) {
                        throw new Datex.CompilerError("Invalid variable id: " + v + " (too big)");
                    }
                    SCOPE.data_view.setUint16(index, v, true);
                    index += Uint16Array.BYTES_PER_ELEMENT;
                }
                else {
                    SCOPE.uint8.set(v_name_bin, index);
                    index += v_name_bin.byteLength;
                }
            }
            if (action_type != ACTION_TYPE.GET)
                DatexCompiler.builder.assignmentEndIndex(SCOPE, index);
            if (is_b_index)
                SCOPE.b_index = index;
        },
        handleStream: (stream, SCOPE) => {
            SCOPE.streaming = stream.getReader();
        },
        addJmp: (SCOPE, type, to_index) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1 + Uint32Array.BYTES_PER_ELEMENT, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = type;
            if (to_index != undefined)
                SCOPE.data_view.setUint32(SCOPE.b_index, to_index, true);
            SCOPE.jmp_indices.push(DatexCompiler.builder.getDynamicIndex(SCOPE.b_index, SCOPE));
            SCOPE.b_index += Uint32Array.BYTES_PER_ELEMENT;
        },
        addString: (s, SCOPE) => {
            DatexCompiler.builder.valueIndex(SCOPE);
            let str_bin = DatexCompiler.utf8_encoder.encode(s);
            let short_string = str_bin.byteLength < 256;
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + str_bin.byteLength + (short_string ? 1 : Uint32Array.BYTES_PER_ELEMENT) + 1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = short_string ? BinaryCode.SHORT_STRING : BinaryCode.STRING;
            if (short_string) {
                SCOPE.uint8[SCOPE.b_index++] = str_bin.byteLength;
            }
            else {
                SCOPE.data_view.setUint32(SCOPE.b_index, str_bin.byteLength, true);
                SCOPE.b_index += Uint32Array.BYTES_PER_ELEMENT;
            }
            SCOPE.uint8.set(str_bin, SCOPE.b_index);
            SCOPE.b_index += str_bin.byteLength;
        },
        addUrl: (url_string, SCOPE) => {
            DatexCompiler.builder.valueIndex(SCOPE);
            let str_bin = DatexCompiler.utf8_encoder.encode(url_string);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + str_bin.byteLength + (Uint32Array.BYTES_PER_ELEMENT) + 1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.URL;
            SCOPE.data_view.setUint32(SCOPE.b_index, str_bin.byteLength, true);
            SCOPE.b_index += Uint32Array.BYTES_PER_ELEMENT;
            SCOPE.uint8.set(str_bin, SCOPE.b_index);
            SCOPE.b_index += str_bin.byteLength;
        },
        addBoolean: (b, SCOPE) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = b ? BinaryCode.TRUE : BinaryCode.FALSE;
        },
        addInt: (i, SCOPE) => {
            if (i <= DatexCompiler.MAX_INT_8 && i >= DatexCompiler.MIN_INT_8)
                return DatexCompiler.builder.addInt8(i, SCOPE);
            if (i <= DatexCompiler.MAX_INT_16 && i >= DatexCompiler.MIN_INT_16)
                return DatexCompiler.builder.addInt16(i, SCOPE);
            if (i <= DatexCompiler.MAX_INT_32 && i >= DatexCompiler.MIN_INT_32)
                return DatexCompiler.builder.addInt32(i, SCOPE);
            else
                return DatexCompiler.builder.addInt64(i, SCOPE);
        },
        addInt8: (i, SCOPE) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + Int8Array.BYTES_PER_ELEMENT + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.INT_8;
            SCOPE.data_view.setInt8(SCOPE.b_index, Number(i));
            SCOPE.b_index += Int8Array.BYTES_PER_ELEMENT;
        },
        addInt16: (i, SCOPE) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + Int16Array.BYTES_PER_ELEMENT + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.INT_16;
            SCOPE.data_view.setInt16(SCOPE.b_index, Number(i), true);
            SCOPE.b_index += Int16Array.BYTES_PER_ELEMENT;
        },
        addInt32: (i, SCOPE) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + Int32Array.BYTES_PER_ELEMENT + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.INT_32;
            SCOPE.data_view.setInt32(SCOPE.b_index, Number(i), true);
            SCOPE.b_index += Int32Array.BYTES_PER_ELEMENT;
        },
        addInt64: (i, SCOPE) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + BigInt64Array.BYTES_PER_ELEMENT + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.INT_64;
            SCOPE.data_view.setBigInt64(SCOPE.b_index, BigInt(i), true);
            SCOPE.b_index += BigInt64Array.BYTES_PER_ELEMENT;
        },
        addUnit: (u, SCOPE) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + Float64Array.BYTES_PER_ELEMENT + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.UNIT;
            SCOPE.data_view.setFloat64(SCOPE.b_index, u, true);
            SCOPE.b_index += Float64Array.BYTES_PER_ELEMENT;
        },
        addFloat64: (f, SCOPE) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + Float64Array.BYTES_PER_ELEMENT + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.FLOAT_64;
            SCOPE.data_view.setFloat64(SCOPE.b_index, f, true);
            SCOPE.b_index += Float64Array.BYTES_PER_ELEMENT;
        },
        addFloatAsInt: (f, SCOPE) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + Int32Array.BYTES_PER_ELEMENT + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.FLOAT_AS_INT;
            SCOPE.data_view.setInt32(SCOPE.b_index, f, true);
            SCOPE.b_index += Int32Array.BYTES_PER_ELEMENT;
        },
        tryPlusOrMinus: (SCOPE) => {
            if (SCOPE.datex[0] == "+") {
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ADD;
                SCOPE.datex = SCOPE.datex.slice(1);
            }
            else if (SCOPE.datex[0] == "-" && SCOPE.datex[1] != ">") {
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBTRACT;
                SCOPE.datex = SCOPE.datex.slice(1);
            }
        },
        addFloat: (f, SCOPE) => {
            if (Number.isInteger(f) && !Object.is(f, -0) && f <= DatexCompiler.MAX_INT_32 && f >= DatexCompiler.MIN_INT_32)
                return DatexCompiler.builder.addFloatAsInt(f, SCOPE);
            else
                return DatexCompiler.builder.addFloat64(f, SCOPE);
        },
        addScopeBlock: async (type, brackets, insert_parent_scope_vars_default, SCOPE) => {
            let return_data = { datex: SCOPE.datex };
            let compiled = await this.compile(return_data, SCOPE.data, {}, false, true, insert_parent_scope_vars_default, undefined, Infinity, brackets ? 1 : 2, SCOPE.current_data_index);
            SCOPE.datex = return_data.datex;
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1 + compiled.byteLength, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = type;
            SCOPE.uint8.set(new Uint8Array(compiled), SCOPE.b_index);
            SCOPE.b_index += compiled.byteLength;
        },
        addKey: (k, SCOPE) => {
            let key_bin = DatexCompiler.utf8_encoder.encode(k);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + key_bin.byteLength + 1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ELEMENT_WITH_KEY;
            SCOPE.uint8[SCOPE.b_index++] = key_bin.byteLength;
            SCOPE.uint8.set(key_bin, SCOPE.b_index);
            SCOPE.b_index += key_bin.byteLength;
        },
        addNull: (SCOPE) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.NULL;
        },
        addVoid: (SCOPE) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.VOID;
        },
        addFilter: (filter, SCOPE) => {
            let buffer = DatexCompiler.filterToDXB(filter);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1 + buffer.byteLength, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.FILTER;
            SCOPE.uint8.set(new Uint8Array(buffer), SCOPE.b_index);
            SCOPE.b_index += buffer.byteLength;
        },
        addFilterTargetFromParts: (type, name, subspaces, instance, appspace, SCOPE) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 4, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            const type_index = SCOPE.b_index;
            SCOPE.uint8[SCOPE.b_index++] = instance == "*" ? type + 1 : type;
            let name_bin = (name instanceof Uint8Array) ? name : DatexCompiler.utf8_encoder.encode(name);
            let instance_bin = DatexCompiler.utf8_encoder.encode(instance);
            SCOPE.uint8[SCOPE.b_index++] = name_bin.byteLength;
            SCOPE.uint8[SCOPE.b_index++] = subspaces?.length ?? 0;
            SCOPE.uint8[SCOPE.b_index++] = instance ? (instance == "*" ? 0 : instance_bin.byteLength) : 255;
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + name_bin.byteLength, SCOPE);
            SCOPE.uint8.set(name_bin, SCOPE.b_index);
            SCOPE.b_index += name_bin.byteLength;
            for (let subspace of subspaces ?? []) {
                if (subspace == "*") {
                    SCOPE.uint8[SCOPE.b_index++] = 0;
                    SCOPE.uint8[type_index] = type + 1;
                }
                else {
                    let subspace_bin = DatexCompiler.utf8_encoder.encode(subspace);
                    DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + subspace_bin.byteLength, SCOPE);
                    SCOPE.uint8[SCOPE.b_index++] = subspace_bin.byteLength;
                    SCOPE.uint8.set(subspace_bin, SCOPE.b_index);
                    SCOPE.b_index += subspace_bin.byteLength;
                }
            }
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + instance_bin.byteLength, SCOPE);
            if (instance != "*") {
                SCOPE.uint8.set(instance_bin, SCOPE.b_index);
                SCOPE.b_index += instance_bin.byteLength;
            }
            if (appspace)
                DatexCompiler.builder.addFilterTarget(appspace, SCOPE);
        },
        addPersonByNameAndChannel: (name, subspaces, instance, appspace, SCOPE) => {
            DatexCompiler.builder.addFilterTargetFromParts(BinaryCode.PERSON_ALIAS, name, subspaces, instance, appspace, SCOPE);
        },
        addBotByNameAndChannel: (name, subspaces, instance, appspace, SCOPE) => {
            DatexCompiler.builder.addFilterTargetFromParts(BinaryCode.BOT, name, subspaces, instance, appspace, SCOPE);
        },
        addInstitutionByNameAndChannel: (name, subspaces, instance, appspace, SCOPE) => {
            DatexCompiler.builder.addFilterTargetFromParts(BinaryCode.INSTITUTION_ALIAS, name, subspaces, instance, appspace, SCOPE);
        },
        addIdEndpointByIdAndChannel: (id, subspaces, instance, appspace, SCOPE) => {
            DatexCompiler.builder.addFilterTargetFromParts(BinaryCode.ENDPOINT, id, subspaces, instance, appspace, SCOPE);
        },
        addBuffer: (buffer, SCOPE) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1 + Uint32Array.BYTES_PER_ELEMENT + buffer.byteLength, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.BUFFER;
            SCOPE.data_view.setUint32(SCOPE.b_index, buffer.byteLength, true);
            SCOPE.b_index += Uint32Array.BYTES_PER_ELEMENT;
            SCOPE.uint8.set(buffer, SCOPE.b_index);
            SCOPE.b_index += buffer.byteLength;
        },
        addFilterTarget: (el, SCOPE) => {
            if (el instanceof Datex.Addresses.Institution)
                DatexCompiler.builder.addInstitutionByNameAndChannel(el.name, el.subspaces, el.instance, el.appspace, SCOPE);
            else if (el instanceof Datex.Addresses.Person)
                DatexCompiler.builder.addPersonByNameAndChannel(el.name, el.subspaces, el.instance, el.appspace, SCOPE);
            else if (el instanceof Datex.Addresses.Bot)
                DatexCompiler.builder.addBotByNameAndChannel(el.name, el.subspaces, el.instance, el.appspace, SCOPE);
            else if (el instanceof Datex.Addresses.IdEndpoint)
                DatexCompiler.builder.addIdEndpointByIdAndChannel(el.binary, el.subspaces, el.instance, el.appspace, SCOPE);
        },
        addTypeByNamespaceAndNameWithParams: async (SCOPE, namespace, name, variation, parameters) => {
            DatexCompiler.builder.addTypeByNamespaceAndName(SCOPE, namespace, name, variation, !!parameters);
            if (parameters instanceof Datex.Tuple) {
                DatexCompiler.builder.addArray(parameters, SCOPE);
            }
            else if (parameters)
                throw new Datex.CompilerError("Invalid type parameters");
        },
        addTypeByNamespaceAndName: (SCOPE, namespace, name, variation, parameters = false) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            const is_extended_type = !!(variation || parameters);
            if ((namespace == "std" || !namespace) && !is_extended_type) {
                switch (name) {
                    case "String":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_STRING;
                        return;
                    case "Int":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_INT;
                        return;
                    case "Float":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_FLOAT;
                        return;
                    case "Boolean":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_BOOLEAN;
                        return;
                    case "Null":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_NULL;
                        return;
                    case "Void":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_VOID;
                        return;
                    case "Buffer":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_BUFFER;
                        return;
                    case "Datex":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_CODE_BLOCK;
                        return;
                    case "Datex.Unit":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_UNIT;
                        return;
                    case "Filter":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_FILTER;
                        return;
                    case "Array":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_ARRAY;
                        return;
                    case "Object":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_OBJECT;
                        return;
                    case "Set":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_SET;
                        return;
                    case "Map":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_MAP;
                        return;
                    case "Tuple":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_TUPLE;
                        return;
                    case "Function":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_FUNCTION;
                        return;
                    case "Stream":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_STREAM;
                        return;
                    case "Any":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_ANY;
                        return;
                    case "Task":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_TASK;
                        return;
                    case "Assertion":
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_ASSERTION;
                        return;
                }
            }
            let name_bin = DatexCompiler.utf8_encoder.encode(name);
            let ns_bin = DatexCompiler.utf8_encoder.encode(namespace);
            let variation_bin = variation && DatexCompiler.utf8_encoder.encode(variation);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + name_bin.byteLength + ns_bin.byteLength + 2 + (is_extended_type ? 2 : 0), SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = is_extended_type ? BinaryCode.EXTENDED_TYPE : BinaryCode.TYPE;
            SCOPE.uint8[SCOPE.b_index++] = ns_bin.byteLength;
            SCOPE.uint8[SCOPE.b_index++] = name_bin.byteLength;
            if (is_extended_type) {
                SCOPE.uint8[SCOPE.b_index++] = variation_bin ? variation_bin.byteLength : 0;
                SCOPE.uint8[SCOPE.b_index++] = parameters ? 1 : 0;
            }
            SCOPE.uint8.set(ns_bin, SCOPE.b_index);
            SCOPE.b_index += ns_bin.byteLength;
            SCOPE.uint8.set(name_bin, SCOPE.b_index);
            SCOPE.b_index += name_bin.byteLength;
            if (variation) {
                SCOPE.uint8.set(variation_bin, SCOPE.b_index);
                SCOPE.b_index += variation_bin.byteLength;
            }
        },
        addPointerBodyByID: (id, SCOPE) => {
            let id_bin = id instanceof Uint8Array ? id : Datex.Pointer.hex2buffer(id, Datex.Pointer.MAX_POINTER_ID_SIZE, true);
            if (id_bin.byteLength > Datex.Pointer.MAX_POINTER_ID_SIZE) {
                throw new Datex.CompilerError("Pointer ID size must not exceed " + Datex.Pointer.MAX_POINTER_ID_SIZE + " bytes");
            }
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + Datex.Pointer.MAX_POINTER_ID_SIZE, SCOPE);
            SCOPE.uint8.set(id_bin, SCOPE.b_index);
            SCOPE.b_index += Datex.Pointer.MAX_POINTER_ID_SIZE;
        },
        addPointerByID: (SCOPE, id, action_type = ACTION_TYPE.GET, action_specifier) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.POINTER + action_type;
            if (action_specifier != undefined) {
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = action_specifier;
            }
            DatexCompiler.builder.addPointerBodyByID(id, SCOPE);
        },
        addPointer: (p, SCOPE, action_type = ACTION_TYPE.GET, action_specifier) => {
            if (SCOPE.insert_parent_scope_vars_default == 3 && action_type == ACTION_TYPE.GET) {
                const insert_new = DatexCompiler.builder.insertExtractedVariable(SCOPE, BinaryCode.POINTER, Datex.Pointer.buffer2hex(p.id_buffer));
                if (insert_new)
                    DatexCompiler.builder.addPointerByID(SCOPE.extract_var_scope, p.id_buffer, action_type, action_specifier);
            }
            else
                DatexCompiler.builder.addPointerByID(SCOPE, p.id_buffer, action_type, action_specifier);
        },
        addArray: (a, SCOPE, is_root = true, parents = new Set(), unassigned_children = [], start_index = [0]) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = a instanceof Datex.Tuple ? BinaryCode.TUPLE_START : BinaryCode.ARRAY_START;
            let trimmed_length = Datex.Runtime.runtime_actions.getTrimmedArrayLength(a);
            let parent_var;
            for (let i = 0; i < trimmed_length; i++) {
                let val = a[i];
                if (SCOPE.inserted_values.has(val) && parents.has(val)) {
                    parent_var = parent_var ?? DatexCompiler.builder.createInternalVariableAtIndex(start_index, SCOPE, a);
                    let value_index = SCOPE.inserted_values.get(val);
                    let existing_val_var = val == a ? parent_var : DatexCompiler.builder.createInternalVariableAtIndex(value_index, SCOPE, val);
                    unassigned_children.push([parent_var, BigInt(i), existing_val_var]);
                    val = Datex.VOID;
                }
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ELEMENT;
                DatexCompiler.builder.insert(val, SCOPE, false, new Set(parents), unassigned_children);
            }
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = a instanceof Datex.Tuple ? BinaryCode.TUPLE_END : BinaryCode.ARRAY_END;
            if (is_root && unassigned_children.length)
                DatexCompiler.builder.addChildrenAssignments(unassigned_children, SCOPE, start_index);
        },
        addObject: (o, SCOPE, is_root = true, parents = new Set(), unassigned_children = [], start_index = [0]) => {
            let entries = Object.entries(o);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = o instanceof Datex.Record ? BinaryCode.RECORD_START : BinaryCode.OBJECT_START;
            let parent_var;
            let ext_props;
            if (o[Datex.EXTENDED_OBJECTS]) {
                if (o[Datex.INHERITED_PROPERTIES])
                    ext_props = o[Datex.INHERITED_PROPERTIES];
                for (let ext of o[Datex.EXTENDED_OBJECTS] || []) {
                    DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ELEMENT;
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.EXTEND;
                    DatexCompiler.builder.insert(ext, SCOPE, false, new Set(parents), unassigned_children);
                }
            }
            for (let i = 0; i < entries.length; i++) {
                let [key, val] = entries[i];
                if (ext_props?.has(key))
                    continue;
                if (SCOPE.inserted_values.has(val) && parents.has(val)) {
                    parent_var = parent_var ?? DatexCompiler.builder.createInternalVariableAtIndex(start_index, SCOPE, o);
                    let value_index = SCOPE.inserted_values.get(val);
                    let existing_val_var = val == o ? parent_var : DatexCompiler.builder.createInternalVariableAtIndex(value_index, SCOPE, val);
                    unassigned_children.push([parent_var, key, existing_val_var]);
                }
                else {
                    DatexCompiler.builder.addKey(key, SCOPE);
                    DatexCompiler.builder.insert(val, SCOPE, false, new Set(parents), unassigned_children);
                }
            }
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = o instanceof Datex.Record ? BinaryCode.RECORD_END : BinaryCode.OBJECT_END;
            if (is_root && unassigned_children.length)
                DatexCompiler.builder.addChildrenAssignments(unassigned_children, SCOPE, start_index);
        },
        addChildrenAssignments: (unassigned_children, SCOPE, root_start_index) => {
            DatexCompiler.builder.insertByteAtIndex(BinaryCode.SUBSCOPE_START, root_start_index, SCOPE);
            for (let assignment of unassigned_children) {
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CLOSE_AND_STORE;
                DatexCompiler.builder.insertVariable(SCOPE, assignment[0], ACTION_TYPE.GET, undefined, BinaryCode.INTERNAL_VAR);
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CHILD_SET;
                DatexCompiler.builder.insert(assignment[1], SCOPE, true, undefined, undefined, false);
                DatexCompiler.builder.insertVariable(SCOPE, assignment[2], ACTION_TYPE.GET, undefined, BinaryCode.INTERNAL_VAR);
            }
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_END;
        },
        check_perm_prefix: (SCOPE) => {
            const start_index = (SCOPE.inner_scope.comma_indices ? SCOPE.inner_scope.comma_indices[SCOPE.inner_scope.comma_indices.length - 1] : SCOPE.inner_scope.start_index) + 1;
            const permission_prefix = (SCOPE.b_index - start_index) != 0 && SCOPE.uint8[SCOPE.b_index - 1] != BinaryCode.CLOSE_AND_STORE;
            if (permission_prefix) {
                if (SCOPE.uint8[start_index - 1] == BinaryCode.ELEMENT)
                    SCOPE.uint8[start_index - 1] = BinaryCode.KEY_PERMISSION;
                else
                    DatexCompiler.builder.insertByteAtIndex(BinaryCode.KEY_PERMISSION, start_index, SCOPE);
            }
            return permission_prefix;
        },
        detect_record: (SCOPE) => {
            if (SCOPE.inner_scope.parent_type == undefined || SCOPE.inner_scope.parent_type == BinaryCode.SUBSCOPE_START) {
                if (SCOPE.inner_scope.parent_type == BinaryCode.SUBSCOPE_START && !SCOPE.inner_scope.has_ce) {
                    DatexCompiler.builder.change_inner_scope_parent_type(SCOPE, BinaryCode.RECORD_START);
                }
                else {
                    DatexCompiler.builder.enter_subscope(SCOPE, BinaryCode.RECORD_START);
                    SCOPE.inner_scope.auto_close_scope = BinaryCode.RECORD_END;
                }
            }
        },
        enter_subscope: (SCOPE, type = BinaryCode.SUBSCOPE_START, start_index) => {
            const parent_scope = SCOPE.subscopes[SCOPE.subscopes.length - 1];
            parent_scope.last_value_index = SCOPE.b_index;
            if (parent_scope.first_value_index == undefined)
                parent_scope.first_value_index = SCOPE.b_index;
            if ('value_count' in parent_scope)
                parent_scope.value_count--;
            if (type !== null) {
                if (start_index == undefined) {
                    DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
                    SCOPE.uint8[SCOPE.b_index++] = type;
                }
                else {
                    DatexCompiler.builder.insertByteAtIndex(type, start_index, SCOPE);
                }
            }
            SCOPE.inner_scope = {
                last_value_index: -1,
                start_index: start_index != undefined ? start_index : SCOPE.b_index - 1,
                wait_for_add: false,
                in_template_string: false,
                path_info_index: -1,
                parent_type: type,
                loop_start: parent_scope.loop_start
            };
            SCOPE.subscopes.push(SCOPE.inner_scope);
        },
        exit_subscope: (SCOPE, type = BinaryCode.SUBSCOPE_END) => {
            while (SCOPE.inner_scope.auto_close_scope != undefined) {
                const type = SCOPE.inner_scope.auto_close_scope;
                delete SCOPE.inner_scope.auto_close_scope;
                DatexCompiler.builder.exit_subscope(SCOPE, type);
            }
            if (type == BinaryCode.SUBSCOPE_END && SCOPE._code_block_type == 1 && SCOPE.subscopes.length == 1) {
                SCOPE.end = true;
                return true;
            }
            if (SCOPE.inner_scope.parent_type == BinaryCode.TUPLE_START && type == BinaryCode.SUBSCOPE_END)
                type = BinaryCode.TUPLE_END;
            if (SCOPE.inner_scope.parent_type == BinaryCode.RECORD_START && type == BinaryCode.SUBSCOPE_END)
                type = BinaryCode.RECORD_END;
            if (SCOPE.inner_scope.parent_type == BinaryCode.OBJECT_START && type != BinaryCode.OBJECT_END)
                throw new Datex.SyntaxError("Missing closing object bracket");
            if (SCOPE.inner_scope.parent_type == BinaryCode.ARRAY_START && type != BinaryCode.ARRAY_END)
                throw new Datex.SyntaxError("Missing closing array bracket");
            if (SCOPE.inner_scope.parent_type == BinaryCode.SUBSCOPE_START && type != BinaryCode.SUBSCOPE_END)
                throw new Datex.SyntaxError("Missing closing bracket");
            if (SCOPE.subscopes.length == 1) {
                if (type == BinaryCode.OBJECT_END)
                    throw new Datex.SyntaxError("Invalid closing object bracket");
                if (type == BinaryCode.ARRAY_END)
                    throw new Datex.SyntaxError("Invalid closing array bracket");
                if (type == BinaryCode.SUBSCOPE_END)
                    throw new Datex.SyntaxError("Invalid closing bracket");
            }
            if (type !== null) {
                if (SCOPE.inner_scope.comma_indices?.length && type !== BinaryCode.SUBSCOPE_END) {
                    let comma_index;
                    while ((comma_index = SCOPE.inner_scope.comma_indices.pop()) == SCOPE.b_index - 1)
                        SCOPE.b_index--;
                }
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = type;
            }
            SCOPE.subscopes.pop();
            SCOPE.inner_scope = SCOPE.subscopes[SCOPE.subscopes.length - 1];
        },
        change_inner_scope_parent_type: (SCOPE, type = BinaryCode.TUPLE_START) => {
            SCOPE.inner_scope.parent_type = type;
            SCOPE.uint8[SCOPE.inner_scope.start_index] = type;
        },
        unescape_string: (str) => str
            .replace(Regex.ESCAPE_BACKSPACE, '\b')
            .replace(Regex.ESCAPE_LINE_FEED, '\n')
            .replace(Regex.ESCAPE_FORM_FEED, '\f')
            .replace(Regex.ESCAPE_CARRIAGE_RETURN, '\r')
            .replace(Regex.ESCAPE_HORIZONTAL_TAB, '\t')
            .replace(Regex.ESCAPE_VERTICAL_TAB, '\v')
            .replace(Regex.ESCAPE_OCTAL, (_, x) => {
            let code = parseInt(x, 8);
            if (code >= 256)
                return x;
            return String.fromCharCode(code);
        })
            .replace(Regex.ESCAPE_UNICODE, (_, x) => {
            let code = parseInt(x, 16);
            if (isNaN(code) || x.length != 4 || !x.match(Regex.HEX_STRING))
                throw new Datex.SyntaxError("Invalid Unicode escape sequence");
            return String.fromCharCode(code);
        })
            .replace(Regex.ESCAPE_HEX, (_, x) => {
            let code = parseInt(x, 16);
            if (isNaN(code) || x.length != 2 || !x.match(Regex.HEX_STRING))
                throw new Datex.SyntaxError("Invalid hexadecimal escape sequence");
            return String.fromCharCode(code);
        })
            .replace(Regex.ESCAPE_SEQUENCE, '$1'),
        serializeValue: (v, SCOPE) => {
            if (SCOPE.serialized_values.has(v))
                return SCOPE.serialized_values.get(v);
            else {
                let s = Datex.Runtime.serializeValue(v);
                SCOPE.serialized_values.set(v, s);
                return s;
            }
        },
        insert: (value, SCOPE, is_root = true, parents, unassigned_children, add_insert_index = true) => {
            if (add_insert_index && SCOPE.inserted_values?.has(value)) {
                let value_index = SCOPE.inserted_values.get(value);
                let existing_val_var = DatexCompiler.builder.createInternalVariableAtIndex(value_index, SCOPE, value);
                DatexCompiler.builder.insertVariable(SCOPE, existing_val_var, ACTION_TYPE.GET, undefined, BinaryCode.INTERNAL_VAR);
                return;
            }
            if ((value instanceof Datex.Stream || value instanceof ReadableStream) && SCOPE.uint8[SCOPE.b_index - 1] == BinaryCode.STREAM)
                return DatexCompiler.builder.handleStream(value, SCOPE);
            let start_index = DatexCompiler.builder.getDynamicIndex(SCOPE.b_index, SCOPE);
            if (value !== Datex.VOID &&
                value !== null &&
                typeof value != "boolean" &&
                !((typeof value == "bigint" || typeof value == "number") && value <= DatexCompiler.MAX_INT_32 && value >= DatexCompiler.MIN_INT_32)) {
                SCOPE.inserted_values.set(value, start_index);
            }
            let type;
            let original_value = value;
            if (value instanceof Function && !(value instanceof Datex.Function))
                value = Datex.Pointer.proxifyValue(new Datex.Function(value, null, SCOPE.options.to));
            if (value instanceof Error && !(value instanceof Datex.Error)) {
                value = new Datex.Error(value.message, [[Datex.Runtime.endpoint, "[native] " + value.name]]);
            }
            if (value instanceof Datex.SerializedValue) {
                [type, value] = value.getSerialized();
                if (type?.is_complex && type != Datex.Type.std.Function)
                    DatexCompiler.builder.addTypeByNamespaceAndNameWithParams(SCOPE, type.namespace, type.name, type.variation, type.parameters);
            }
            else {
                value = Datex.Pointer.pointerifyValue(value);
                const no_proxify = value instanceof Datex.Value && ((value instanceof Datex.Pointer && value.is_anonymous) || SCOPE.options.collapse_pointers || SCOPE.options.collapse_first_inserted);
                if (no_proxify) {
                    if (SCOPE.options.collapse_pointers && !SCOPE.options.no_create_pointers)
                        SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CREATE_POINTER;
                    value = value.value;
                    if (SCOPE.options.collapse_first_inserted)
                        SCOPE.options.collapse_first_inserted = false;
                }
                if (!(value instanceof Datex.Pointer)) {
                    type = Datex.Type.getValueDatexType(value);
                    if (!type)
                        throw new Datex.ValueError("Cannot get type for value " + value);
                    if (type?.is_complex && type != Datex.Type.std.Function) {
                        DatexCompiler.builder.addTypeByNamespaceAndNameWithParams(SCOPE, type.namespace, type.name, type.variation, type.parameters);
                        value = DatexCompiler.builder.serializeValue(value, SCOPE);
                    }
                    else if (type?.serializable_not_complex) {
                        value = DatexCompiler.builder.serializeValue(value, SCOPE);
                    }
                    if (!no_proxify)
                        value = Datex.Pointer.pointerifyValue(value);
                }
            }
            if (value instanceof Datex.Unit)
                return DatexCompiler.builder.addUnit(value, SCOPE);
            if (value === Datex.VOID)
                return DatexCompiler.builder.addVoid(SCOPE);
            if (value === null)
                return DatexCompiler.builder.addNull(SCOPE);
            if (typeof value == 'bigint')
                return DatexCompiler.builder.addInt(value, SCOPE);
            if (typeof value == 'number')
                return DatexCompiler.builder.addFloat(value, SCOPE);
            if (typeof value == "string")
                return DatexCompiler.builder.addString(value, SCOPE);
            if (typeof value == "boolean")
                return DatexCompiler.builder.addBoolean(value, SCOPE);
            if (value instanceof URL)
                return DatexCompiler.builder.addUrl(value.href, SCOPE);
            if (value instanceof Datex.PointerProperty) {
                DatexCompiler.builder.addPointer(value.pointer, SCOPE);
                let _SCOPE = (SCOPE.insert_parent_scope_vars_default >= 2) ? SCOPE.extract_var_scope : SCOPE;
                DatexCompiler.builder.handleRequiredBufferSize(_SCOPE.b_index, _SCOPE);
                _SCOPE.inner_scope.path_info_index = _SCOPE.b_index++;
                _SCOPE.uint8[_SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_GET_REF;
                DatexCompiler.builder.insert(value.key, _SCOPE);
                return;
            }
            if (value instanceof Datex.Pointer) {
                if (SCOPE.inner_scope.path_info_index == -1) {
                    let m;
                    let action_type = ACTION_TYPE.GET;
                    let action_specifier = undefined;
                    SCOPE.datex = SCOPE.datex?.replace(/^[^\S\n]+/, "");
                    if ((m = SCOPE.datex?.match(Regex.ASSIGN_SET)) && SCOPE.datex[1] != "=") {
                        SCOPE.datex = SCOPE.datex.substring(m[0].length);
                        action_type = ACTION_TYPE.SET;
                    }
                    else if (m = SCOPE.datex?.match(Regex.ASSIGN_ADD)) {
                        SCOPE.datex = SCOPE.datex.substring(m[0].length);
                        action_type = ACTION_TYPE.OTHER;
                        action_specifier = BinaryCode.ADD;
                    }
                    else if (m = SCOPE.datex?.match(Regex.ASSIGN_SUB)) {
                        SCOPE.datex = SCOPE.datex.substring(m[0].length);
                        action_type = ACTION_TYPE.OTHER;
                        action_specifier = BinaryCode.SUBTRACT;
                    }
                    else if (m = SCOPE.datex?.match(Regex.ASSIGN_MUTIPLY)) {
                        SCOPE.datex = SCOPE.datex.substring(m[0].length);
                        action_type = ACTION_TYPE.OTHER;
                        action_specifier = BinaryCode.MULTIPLY;
                    }
                    else if (m = SCOPE.datex?.match(Regex.ASSIGN_DIVIDE)) {
                        SCOPE.datex = SCOPE.datex.substring(m[0].length);
                        action_type = ACTION_TYPE.OTHER;
                        action_specifier = BinaryCode.DIVIDE;
                    }
                    else if (m = SCOPE.datex?.match(Regex.ASSIGN_AND)) {
                        SCOPE.datex = SCOPE.datex.substring(m[0].length);
                        action_type = ACTION_TYPE.OTHER;
                        action_specifier = BinaryCode.AND;
                    }
                    else if (m = SCOPE.datex?.match(Regex.ASSIGN_OR)) {
                        SCOPE.datex = SCOPE.datex.substring(m[0].length);
                        action_type = ACTION_TYPE.OTHER;
                        action_specifier = BinaryCode.OR;
                    }
                    else if (m = SCOPE.datex?.match(Regex.ASSIGN_POINTER_VALUE)) {
                        SCOPE.datex = SCOPE.datex.substring(m[0].length);
                        action_type = ACTION_TYPE.OTHER;
                        action_specifier = BinaryCode.CREATE_POINTER;
                    }
                    else {
                        if (SCOPE.options.inserted_ptrs)
                            SCOPE.options.inserted_ptrs.add(value);
                    }
                    return DatexCompiler.builder.addPointer(value, SCOPE, action_type, action_specifier);
                }
                else {
                    if (SCOPE.options.inserted_ptrs)
                        SCOPE.options.inserted_ptrs.add(value);
                    return DatexCompiler.builder.addPointer(value, SCOPE);
                }
            }
            if (value instanceof Datex.Addresses.WildcardTarget)
                return DatexCompiler.builder.addFilterTarget(value.target, SCOPE);
            if (value instanceof Datex.Addresses.Endpoint)
                return DatexCompiler.builder.addFilterTarget(value, SCOPE);
            if (value instanceof Datex.Addresses.Filter)
                return DatexCompiler.builder.addFilter(value, SCOPE);
            if (value instanceof Datex.Type) {
                DatexCompiler.builder.addTypeByNamespaceAndNameWithParams(SCOPE, value.namespace, value.name, value.variation, value.parameters);
                if (value.parameters)
                    DatexCompiler.builder.insert(value.parameters, SCOPE);
                return;
            }
            if (value instanceof Uint8Array)
                return DatexCompiler.builder.addBuffer(value, SCOPE);
            if (value instanceof ArrayBuffer)
                return DatexCompiler.builder.addBuffer(new Uint8Array(value), SCOPE);
            if (value instanceof Datex.Function) {
                DatexCompiler.builder.insert(value.params, SCOPE);
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.FUNCTION;
                for (let variable of value.datex?.internal_vars ?? []) {
                    DatexCompiler.builder.insert(variable, SCOPE);
                }
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1 + Uint32Array.BYTES_PER_ELEMENT + (value.datex?.compiled?.byteLength ?? 0), SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SCOPE_BLOCK;
                SCOPE.data_view.setUint32(SCOPE.b_index, value.datex?.compiled?.byteLength ?? 0, true);
                SCOPE.b_index += Uint32Array.BYTES_PER_ELEMENT;
                if (value.datex?.compiled) {
                    SCOPE.uint8.set(new Uint8Array(value.datex.compiled), SCOPE.b_index);
                    SCOPE.b_index += value.datex.compiled.byteLength;
                }
                return;
            }
            if (value instanceof Array) {
                if (!parents)
                    parents = new Set();
                parents.add(original_value);
                return DatexCompiler.builder.addArray(value, SCOPE, is_root, parents, unassigned_children, start_index);
            }
            if (typeof value == "object") {
                if (!parents)
                    parents = new Set();
                parents.add(original_value);
                return DatexCompiler.builder.addObject(value, SCOPE, is_root, parents, unassigned_children, start_index);
            }
            if (typeof value == "symbol") {
                return DatexCompiler.builder.addVoid(SCOPE);
            }
            else {
                console.error("Unsupported native value", value);
                throw new Datex.ValueError("Failed to compile an unsupported native type");
            }
        }
    };
    static async parseNextExpression(SCOPE) {
        let m;
        let last_command_end = SCOPE.last_command_end;
        SCOPE.datex = SCOPE.datex.replace(/^[^\S\n]+/, "");
        SCOPE.last_command_end = false;
        let isEffectiveValue = false;
        if (!SCOPE.datex) {
            SCOPE.end = true;
            SCOPE.last_command_end = last_command_end;
        }
        else if (m = SCOPE.datex.match(Regex.URL)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.addUrl(m[0], SCOPE);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.INSERT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            if (SCOPE.current_data_index == undefined)
                SCOPE.current_data_index = 0;
            const d_index = m[1] ? parseInt(m[1]) : SCOPE.current_data_index++;
            if (SCOPE.precompiled) {
                if (SCOPE.b_index - (SCOPE.last_precompiled ?? 0) != 0)
                    SCOPE.precompiled.appendBufferPlaceholder(SCOPE.last_precompiled ?? 0, SCOPE.b_index);
                SCOPE.precompiled.appendDataIndex(d_index);
                SCOPE.last_precompiled = SCOPE.b_index;
                return;
            }
            else {
                let d = SCOPE.data?.[d_index];
                DatexCompiler.builder.insert(d, SCOPE);
            }
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.KEY)) {
            if (SCOPE.inner_scope.parent_type == BinaryCode.ARRAY_START)
                throw new Datex.SyntaxError("Invalid key in <Array>");
            if (SCOPE.inner_scope.parent_type == BinaryCode.TUPLE_START)
                DatexCompiler.builder.change_inner_scope_parent_type(SCOPE, BinaryCode.RECORD_START);
            if (SCOPE.inner_scope.auto_close_scope == BinaryCode.TUPLE_END)
                SCOPE.inner_scope.auto_close_scope = BinaryCode.RECORD_END;
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            let key = m[0].substring(0, m[0].length - 1).trim();
            const permission_prefix = DatexCompiler.builder.check_perm_prefix(SCOPE);
            if (!permission_prefix && SCOPE.inner_scope.first_element_pos != undefined)
                SCOPE.b_index = SCOPE.inner_scope.first_element_pos;
            DatexCompiler.builder.detect_record(SCOPE);
            DatexCompiler.builder.addKey(key, SCOPE);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.END)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.END;
        }
        else if (m = SCOPE.datex.match(Regex.REQUEST)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.REQUEST;
        }
        else if (m = SCOPE.datex.match(Regex.COUNT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.COUNT;
        }
        else if (m = SCOPE.datex.match(Regex.ABOUT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ABOUT;
        }
        else if (m = SCOPE.datex.match(Regex.RETURN)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.RETURN;
        }
        else if (m = SCOPE.datex.match(Regex.ITERATION)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ITERATION;
        }
        else if (m = SCOPE.datex.match(Regex.ITERATOR)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ITERATOR;
        }
        else if (m = SCOPE.datex.match(Regex.SKIP)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            if (!('loop_start' in SCOPE.inner_scope))
                throw new Datex.CompilerError("Invalid 'skip' command");
            DatexCompiler.builder.addJmp(SCOPE, BinaryCode.JMP, SCOPE.inner_scope.loop_start);
            DatexCompiler.builder.valueIndex(SCOPE);
        }
        else if (m = SCOPE.datex.match(Regex.ITERATE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            SCOPE.inner_scope.iterate = 0;
            SCOPE.inner_scope.value_count = 1;
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_START;
            DatexCompiler.builder.insertVariable(SCOPE, 'iter', ACTION_TYPE.SET, undefined, BinaryCode.INTERNAL_VAR);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ITERATOR;
        }
        else if (m = SCOPE.datex.match(Regex.WHILE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            SCOPE.inner_scope.while = SCOPE.b_index + 1;
            SCOPE.inner_scope.loop_start = SCOPE.b_index + 1;
            SCOPE.inner_scope.value_count = 1;
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_START;
            DatexCompiler.builder.addJmp(SCOPE, BinaryCode.JFA);
        }
        else if (m = SCOPE.datex.match(Regex.ELSE_IF)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            if (m[1]) {
                if (!SCOPE.inner_scope.if_end_indices?.length)
                    throw new Datex.CompilerError("Invalid else-if statement - no preceding if statement");
                SCOPE.b_index--;
            }
            else {
                DatexCompiler.builder.valueIndex(SCOPE);
            }
            SCOPE.inner_scope.value_count = 2;
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1 + Uint32Array.BYTES_PER_ELEMENT, SCOPE);
            if (!m[1])
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_START;
            SCOPE.inner_scope.if = SCOPE.b_index;
            DatexCompiler.builder.addJmp(SCOPE, BinaryCode.JFA);
        }
        else if (m = SCOPE.datex.match(Regex.ELSE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            if (!SCOPE.inner_scope.if_end_indices?.length)
                throw new Datex.CompilerError("Invalid else statement - no preceding if statement");
            SCOPE.b_index--;
            SCOPE.inner_scope.else = true;
            SCOPE.inner_scope.value_count = 1;
        }
        else if (m = SCOPE.datex.match(Regex.FUN)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_FUNCTION;
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(/^\n/)) {
            SCOPE.current_line_nr++;
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            SCOPE.last_command_end = last_command_end;
        }
        else if (m = SCOPE.datex.match(Regex.COMMENT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            SCOPE.current_line_nr += m[0].split(/\r\n|\r|\n/).length - 1;
            SCOPE.last_command_end = last_command_end;
        }
        else if (m = SCOPE.datex.match(Regex.VOID)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.addVoid(SCOPE);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.REMOTE_CALL)) {
            if (SCOPE._code_block_type == 2 && SCOPE.subscopes.length == 1) {
                SCOPE.end = true;
                if (last_command_end)
                    SCOPE.last_command_end = true;
                return;
            }
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            await DatexCompiler.builder.addScopeBlock(BinaryCode.REMOTE, !!m[1], 0, SCOPE);
        }
        else if (m = SCOPE.datex.match(Regex.TRANSFORM)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            await DatexCompiler.builder.addScopeBlock(BinaryCode.TRANSFORM, !!m[1], 3, SCOPE);
        }
        else if (m = SCOPE.datex.match(Regex.QUASI_VOID)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.addVoid(SCOPE);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.SUBSCOPE_START)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.enter_subscope(SCOPE);
        }
        else if (m = SCOPE.datex.match(Regex.SYNC)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SYNC;
        }
        else if (m = SCOPE.datex.match(Regex.STOP_SYNC)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STOP_SYNC;
        }
        else if (m = SCOPE.datex.match(Regex.STREAM)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STREAM;
        }
        else if (m = SCOPE.datex.match(Regex.STOP_STREAM)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STOP_STREAM;
        }
        else if (m = SCOPE.datex.match(Regex.TYPE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            if (m[4] == "(") {
                SCOPE.datex = "(" + SCOPE.datex;
                SCOPE.inner_scope.param_type_close = true;
                DatexCompiler.builder.addTypeByNamespaceAndName(SCOPE, m[1], m[2], m[3]?.slice(1), true);
            }
            else
                DatexCompiler.builder.addTypeByNamespaceAndName(SCOPE, m[1], m[2], m[3]?.slice(1));
        }
        else if (m = SCOPE.datex.match(Regex.EQUAL)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.EQUAL;
        }
        else if (m = SCOPE.datex.match(Regex.NOT_EQUAL)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.NOT_EQUAL;
        }
        else if (m = SCOPE.datex.match(Regex.EQUAL_VALUE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.EQUAL_VALUE;
        }
        else if (m = SCOPE.datex.match(Regex.NOT_EQUAL_VALUE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.NOT_EQUAL_VALUE;
        }
        else if (m = SCOPE.datex.match(Regex.GREATER_EQUAL)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.GREATER_EQUAL;
        }
        else if (m = SCOPE.datex.match(Regex.LESS_EQUAL)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.LESS_EQUAL;
        }
        else if (m = SCOPE.datex.match(Regex.GREATER)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            if (SCOPE.inner_scope.param_type_close) {
                SCOPE.inner_scope.param_type_close = false;
            }
            else {
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.GREATER;
            }
        }
        else if (m = SCOPE.datex.match(Regex.LESS)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.LESS;
        }
        else if (m = SCOPE.datex.match(Regex.THROW_ERROR)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.THROW_ERROR;
        }
        else if (m = SCOPE.datex.match(Regex.SPREAD)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.EXTEND;
        }
        else if (m = SCOPE.datex.match(Regex.RANGE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.insertByteAtIndex(BinaryCode.RANGE, SCOPE.inner_scope.last_value_index, SCOPE);
        }
        else if (m = SCOPE.datex.match(Regex.PATH_SEPERATOR)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.inner_scope.path_info_index = SCOPE.b_index++;
            SCOPE.uint8[SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_GET;
            if (m = SCOPE.datex.match(Regex.WILDCARD)) {
                SCOPE.datex = SCOPE.datex.substring(m[0].length);
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.WILDCARD;
                isEffectiveValue = true;
            }
            else if (m = SCOPE.datex.match(Regex.PROPERTY)) {
                SCOPE.datex = SCOPE.datex.substring(m[0].length);
                DatexCompiler.builder.addString(m[0], SCOPE);
                isEffectiveValue = true;
            }
        }
        else if (m = SCOPE.datex.match(Regex.PATH_REF_SEPERATOR)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            const wildcard = SCOPE.datex.match(Regex.WILDCARD);
            let _SCOPE = (SCOPE.insert_parent_scope_vars_default >= 2 && !wildcard) ? SCOPE.extract_var_scope : SCOPE;
            DatexCompiler.builder.handleRequiredBufferSize(_SCOPE.b_index, _SCOPE);
            _SCOPE.inner_scope.path_info_index = _SCOPE.b_index++;
            _SCOPE.uint8[_SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_GET_REF;
            if (wildcard) {
                SCOPE.datex = SCOPE.datex.substring(wildcard[0].length);
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.WILDCARD;
            }
            else if (m = SCOPE.datex.match(Regex.PROPERTY)) {
                SCOPE.datex = SCOPE.datex.substring(m[0].length);
                DatexCompiler.builder.addString(m[0], _SCOPE);
            }
        }
        else if (m = SCOPE.datex.match(Regex.JUMP)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            let jmp_label = m[2];
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 5, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            let jmp_to;
            let type = m[1] == "jmp" ? BinaryCode.JMP : (m[1] == "jtr" ? BinaryCode.JTR : BinaryCode.JFA);
            if (Object.keys(SCOPE.jmp_label_indices).includes(jmp_label)) {
                SCOPE.used_lbls.push(jmp_label);
                jmp_to = SCOPE.jmp_label_indices[jmp_label][0];
            }
            else {
                if (!SCOPE.indices_waiting_for_jmp_lbl[jmp_label])
                    SCOPE.indices_waiting_for_jmp_lbl[jmp_label] = [];
                SCOPE.indices_waiting_for_jmp_lbl[jmp_label].push(DatexCompiler.builder.getDynamicIndex(SCOPE.b_index + 1, SCOPE));
            }
            DatexCompiler.builder.addJmp(SCOPE, type, jmp_to);
        }
        else if (m = SCOPE.datex.match(Regex.JUMP_LBL)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            let jmp_label = m[1];
            SCOPE.jmp_label_indices[jmp_label] = DatexCompiler.builder.getDynamicIndex(SCOPE.b_index, SCOPE);
            if (SCOPE.used_lbls.includes(jmp_label))
                throw new Datex.CompilerError("Multiple use of label: " + jmp_label);
            if (SCOPE.indices_waiting_for_jmp_lbl[jmp_label]) {
                for (let [i] of SCOPE.indices_waiting_for_jmp_lbl[jmp_label]) {
                    SCOPE.data_view.setUint32(i, SCOPE.b_index, true);
                }
                delete SCOPE.indices_waiting_for_jmp_lbl[jmp_label];
                SCOPE.used_lbls.push(jmp_label);
            }
            if (SCOPE.last_cache_point == undefined) {
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
                SCOPE.last_cache_point = SCOPE.b_index;
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CACHE_POINT;
            }
        }
        else if (m = SCOPE.datex.match(Regex.USE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 2, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.VAR_ROOT_ACTION;
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ADD;
            DatexCompiler.builder.enter_subscope(SCOPE, BinaryCode.SUBSCOPE_START);
            SCOPE.inner_scope.auto_close_scope = BinaryCode.SUBSCOPE_END;
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 6, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SET_VAR_ROOT;
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.VAR_STATIC;
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CLOSE_AND_STORE;
        }
        else if (m = SCOPE.datex.match(Regex.BOOLEAN)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.addBoolean(m[0] == "true" ? true : false, SCOPE);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.NULL)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.addNull(SCOPE);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.EMPTY_ARRAY)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 2, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_ARRAY;
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.VOID;
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.EMPTY_OBJECT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 2, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_OBJECT;
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.VOID;
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.ARRAY_START)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.enter_subscope(SCOPE, BinaryCode.ARRAY_START);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.inner_scope.first_element_pos = SCOPE.b_index;
            DatexCompiler.builder.commaIndex(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ELEMENT;
        }
        else if (m = SCOPE.datex.match(Regex.ARRAY_END)) {
            if (SCOPE._code_block_type == 2 && SCOPE.subscopes.length == 1) {
                SCOPE.end = true;
                if (last_command_end)
                    SCOPE.last_command_end = true;
                return;
            }
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.exit_subscope(SCOPE, BinaryCode.ARRAY_END);
            isEffectiveValue = true;
        }
        else if (!SCOPE.inner_scope.in_template_string && (m = SCOPE.datex.match(Regex.TSTRING_START))) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            const escaped_string = m[0].substring(1, m[0].length - 1);
            SCOPE.current_line_nr += escaped_string.split(/\r\n|\r|\n/).length - 1;
            let str = DatexCompiler.builder.unescape_string(escaped_string);
            SCOPE.inner_scope.in_template_string = true;
            DatexCompiler.builder.enter_subscope(SCOPE);
            if (str.length) {
                DatexCompiler.builder.addString(str, SCOPE);
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ADD;
            }
            DatexCompiler.builder.addTypeByNamespaceAndName(SCOPE, "std", "String");
            DatexCompiler.builder.enter_subscope(SCOPE);
        }
        else if (SCOPE.subscopes[SCOPE.subscopes.length - 3]?.in_template_string && (m = SCOPE.datex.match(Regex.TSTRING_B_CLOSE))) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            const escaped_string = m[0].substring(1, m[0].length - 1);
            SCOPE.current_line_nr += escaped_string.split(/\r\n|\r|\n/).length - 1;
            let str = DatexCompiler.builder.unescape_string(escaped_string);
            DatexCompiler.builder.exit_subscope(SCOPE);
            if (str.length) {
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ADD;
                DatexCompiler.builder.addString(str, SCOPE);
            }
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ADD;
            DatexCompiler.builder.addTypeByNamespaceAndName(SCOPE, "std", "String");
            DatexCompiler.builder.enter_subscope(SCOPE);
        }
        else if (SCOPE.subscopes[SCOPE.subscopes.length - 3]?.in_template_string && (m = SCOPE.datex.match(Regex.TSTRING_END))) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            const escaped_string = m[0].substring(1, m[0].length - 1);
            SCOPE.current_line_nr += escaped_string.split(/\r\n|\r|\n/).length - 1;
            let str = DatexCompiler.builder.unescape_string(escaped_string);
            DatexCompiler.builder.exit_subscope(SCOPE);
            if (str.length) {
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ADD;
                DatexCompiler.builder.addString(str, SCOPE);
            }
            DatexCompiler.builder.exit_subscope(SCOPE);
            SCOPE.inner_scope.in_template_string = false;
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.OBJECT_START)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.enter_subscope(SCOPE, BinaryCode.OBJECT_START);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.inner_scope.first_element_pos = SCOPE.b_index;
            DatexCompiler.builder.commaIndex(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ELEMENT;
        }
        else if (m = SCOPE.datex.match(Regex.OBJECT_END)) {
            if (SCOPE._code_block_type == 2 && SCOPE.subscopes.length == 1) {
                SCOPE.end = true;
                if (last_command_end)
                    SCOPE.last_command_end = true;
                return;
            }
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.exit_subscope(SCOPE, BinaryCode.OBJECT_END);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.COMMA)) {
            if (SCOPE._code_block_type == 2 && SCOPE.subscopes.length == 1) {
                SCOPE.end = true;
                if (last_command_end)
                    SCOPE.last_command_end = true;
                return;
            }
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            if (SCOPE.inner_scope.parent_type == undefined || SCOPE.inner_scope.parent_type == BinaryCode.SUBSCOPE_START) {
                if (SCOPE.inner_scope.parent_type == BinaryCode.SUBSCOPE_START && SCOPE.inner_scope.start_index == SCOPE.inner_scope.first_value_index - 1) {
                    DatexCompiler.builder.change_inner_scope_parent_type(SCOPE, BinaryCode.TUPLE_START);
                    DatexCompiler.builder.commaIndex(SCOPE.inner_scope.start_index + 1, SCOPE);
                    DatexCompiler.builder.insertByteAtIndex(BinaryCode.ELEMENT, SCOPE.inner_scope.start_index + 1, SCOPE);
                }
                else {
                    console.log("comma", SCOPE.inner_scope.ce_index, SCOPE.inner_scope.first_value_index);
                    const index = Math.max(SCOPE.inner_scope.ce_index ?? 0, SCOPE.inner_scope.first_value_index);
                    if (index === -1)
                        throw new Datex.SyntaxError("Invalid leading comma");
                    DatexCompiler.builder.commaIndex(index, SCOPE);
                    DatexCompiler.builder.insertByteAtIndex(BinaryCode.ELEMENT, index, SCOPE);
                    DatexCompiler.builder.enter_subscope(SCOPE, BinaryCode.TUPLE_START, index);
                    SCOPE.inner_scope.auto_close_scope = BinaryCode.TUPLE_END;
                }
            }
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.inner_scope.first_element_pos = SCOPE.b_index;
            DatexCompiler.builder.commaIndex(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ELEMENT;
        }
        else if (m = SCOPE.datex.match(Regex.BUFFER)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            let content = m[1];
            let buffer;
            try {
                buffer = Datex.Pointer.hex2buffer(content, null, true);
            }
            catch (e) {
                throw new Datex.ValueError("Invalid <Buffer> format (base 16)");
            }
            DatexCompiler.builder.addBuffer(buffer, SCOPE);
            isEffectiveValue = true;
        }
        else if ((m = SCOPE.datex.match(Regex.CLOSE_AND_STORE)) !== null) {
            if (SCOPE._code_block_type == 2) {
                SCOPE.end = true;
                if (last_command_end)
                    SCOPE.last_command_end = true;
                return;
            }
            SCOPE.current_line_nr += m[0].split(/\r\n|\r|\n/).length - 1;
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            while (SCOPE.inner_scope.auto_close_scope != undefined) {
                const type = SCOPE.inner_scope.auto_close_scope;
                delete SCOPE.inner_scope.auto_close_scope;
                DatexCompiler.builder.exit_subscope(SCOPE, type);
            }
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CLOSE_AND_STORE;
            SCOPE.inner_scope.has_ce = true;
            SCOPE.inner_scope.ce_index = SCOPE.b_index;
            SCOPE.last_command_end = true;
        }
        else if (m = SCOPE.datex.match(Regex.INFINITY)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.addFloat(m[1]?.[0] == '-' ? -Infinity : +Infinity, SCOPE);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.NAN)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.addFloat(NaN, SCOPE);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.PERSON_ALIAS)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            const subspace_string = m[2].substring(1);
            let subspaces = subspace_string ? subspace_string.split(":") : null;
            DatexCompiler.builder.addPersonByNameAndChannel(m[1], subspaces, m[6], null, SCOPE);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.BOT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            let all = m[0].substring(1);
            let name_channel = all.split("/");
            DatexCompiler.builder.addBotByNameAndChannel(name_channel[0], null, name_channel[1], null, SCOPE);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.INSTITUTION_ALIAS)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            const subspace_string = m[2].substring(1);
            let subspaces = subspace_string ? subspace_string.split(":") : null;
            DatexCompiler.builder.addInstitutionByNameAndChannel(m[1], subspaces, m[6], null, SCOPE);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.ENDPOINT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            const subspace_string = m[2].substring(1);
            let subspaces = subspace_string ? subspace_string.split(":") : null;
            DatexCompiler.builder.addIdEndpointByIdAndChannel(Datex.Pointer.hex2buffer(m[1].replace(/[_-]/g, "")), subspaces, m[6], null, SCOPE);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.BROADCAST_ENDPOINT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            const subspace_string = m[2].substring(1);
            let subspaces = subspace_string ? subspace_string.split(":") : null;
            DatexCompiler.builder.addIdEndpointByIdAndChannel(Datex.Addresses.BROADCAST.binary, subspaces, m[6], null, SCOPE);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.STRING_OR_ESCAPED_KEY)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            const escaped_string = m[1].substring(1, m[1].length - 1);
            SCOPE.current_line_nr += escaped_string.split(/\r\n|\r|\n/).length - 1;
            let string_or_key = DatexCompiler.builder.unescape_string(escaped_string);
            if (m[2]) {
                if (SCOPE.inner_scope.parent_type == BinaryCode.ARRAY_START)
                    throw new Datex.SyntaxError("Invalid key in <Array>");
                if (SCOPE.inner_scope.parent_type == BinaryCode.TUPLE_START)
                    DatexCompiler.builder.change_inner_scope_parent_type(SCOPE, BinaryCode.RECORD_START);
                if (SCOPE.inner_scope.auto_close_scope == BinaryCode.TUPLE_END)
                    SCOPE.inner_scope.auto_close_scope = BinaryCode.RECORD_END;
                const permission_prefix = DatexCompiler.builder.check_perm_prefix(SCOPE);
                if (!permission_prefix && SCOPE.inner_scope.first_element_pos != undefined)
                    SCOPE.b_index = SCOPE.inner_scope.first_element_pos;
                DatexCompiler.builder.detect_record(SCOPE);
                DatexCompiler.builder.addKey(string_or_key, SCOPE);
            }
            else
                DatexCompiler.builder.addString(string_or_key, SCOPE);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.SUBSCOPE_END)) {
            if (SCOPE._code_block_type == 2 && SCOPE.subscopes.length == 1) {
                SCOPE.end = true;
                if (last_command_end)
                    SCOPE.last_command_end = true;
                return;
            }
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            let end = DatexCompiler.builder.exit_subscope(SCOPE);
            if (end && last_command_end)
                SCOPE.last_command_end = true;
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.FREEZE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.FREEZE;
        }
        else if (m = SCOPE.datex.match(Regex.SEAL)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SEAL;
        }
        else if (m = SCOPE.datex.match(Regex.HAS)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.HAS;
        }
        else if (m = SCOPE.datex.match(Regex.KEYS)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.KEYS;
        }
        else if (m = SCOPE.datex.match(Regex.DELETE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.DELETE_POINTER;
        }
        else if (m = SCOPE.datex.match(Regex.SUBSCRIBE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCRIBE;
        }
        else if (m = SCOPE.datex.match(Regex.UNSUBSCRIBE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.UNSUBSCRIBE;
        }
        else if (m = SCOPE.datex.match(Regex.VALUE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.VALUE;
        }
        else if (m = SCOPE.datex.match(Regex.GET_TYPE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.GET_TYPE;
        }
        else if (m = SCOPE.datex.match(Regex.ORIGIN)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ORIGIN;
        }
        else if (m = SCOPE.datex.match(Regex.SUBSCRIBERS)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCRIBERS;
        }
        else if (m = SCOPE.datex.match(Regex.TEMPLATE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.TEMPLATE;
        }
        else if (m = SCOPE.datex.match(Regex.EXTENDS)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.EXTENDS;
        }
        else if (m = SCOPE.datex.match(Regex.IMPLEMENTS)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.IMPLEMENTS;
        }
        else if (m = SCOPE.datex.match(Regex.MATCHES)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.MATCHES;
        }
        else if (m = SCOPE.datex.match(Regex.DEBUG)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.DEBUG;
        }
        else if (m = SCOPE.datex.match(Regex.CONSTRUCTOR_METHOD)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            console.log("constructor", m[0]);
        }
        else if (m = SCOPE.datex.match(Regex.OBSERVE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.OBSERVE;
        }
        else if (m = SCOPE.datex.match(Regex.FUNCTION)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            SCOPE.inner_scope.function = SCOPE.b_index;
        }
        else if (m = SCOPE.datex.match(Regex.DO)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            await DatexCompiler.builder.addScopeBlock(BinaryCode.DO, !!m[1], 1, SCOPE);
        }
        else if (m = SCOPE.datex.match(Regex.ASSERT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            await DatexCompiler.builder.addScopeBlock(BinaryCode.ASSERT, !!m[1], 1, SCOPE);
        }
        else if (m = SCOPE.datex.match(Regex.HOLD)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            await DatexCompiler.builder.addScopeBlock(BinaryCode.HOLD, !!m[1], 1, SCOPE);
        }
        else if (m = SCOPE.datex.match(Regex.AWAIT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.AWAIT;
        }
        else if (m = SCOPE.datex.match(Regex.POINTER)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            let [action_type, action_specifier] = DatexCompiler.builder.getAssignAction(m[2]);
            const id = m[1].replace(/_/g, "");
            if (SCOPE.insert_parent_scope_vars_default == 3 && action_type == ACTION_TYPE.GET) {
                const insert_new = DatexCompiler.builder.insertExtractedVariable(SCOPE, BinaryCode.POINTER, id);
                if (insert_new)
                    DatexCompiler.builder.addPointerByID(SCOPE.extract_var_scope, id, action_type, action_specifier);
            }
            else
                DatexCompiler.builder.addPointerByID(SCOPE, id, action_type, action_specifier);
            isEffectiveValue = true;
        }
        else if ((m = SCOPE.datex.match(Regex.INTERNAL_VAR)) || (m = SCOPE.datex.match(Regex.VARIABLE)) || (m = SCOPE.datex.match(Regex.LABELED_POINTER))) {
            const scope_extract = !!m[1];
            let v_name = m[3];
            const is_internal = m[2] == "#";
            const is_label = m[2] == "$";
            const is_hex = v_name.match(Regex.HEX_VARIABLE) && (is_internal || is_label || v_name.startsWith("_"));
            let base_type = is_internal ? BinaryCode.INTERNAL_VAR : (is_label ? BinaryCode.LABEL : BinaryCode.VAR);
            const is_property = false;
            if (is_property)
                SCOPE.datex = SCOPE.datex.substring(m[1].length + m[2].length + m[3].length);
            else
                SCOPE.datex = SCOPE.datex.substring(m[0].length);
            let [action_type, action_specifier] = is_property ? [ACTION_TYPE.GET] : DatexCompiler.builder.getAssignAction(m[4]);
            if (is_hex)
                v_name = parseInt(v_name.replace(/[-_]/g, ''), 16) || 0;
            if (v_name == 'with')
                throw new Datex.CompilerError("Invalid variable name: with");
            else if (v_name == 'use')
                throw new Datex.CompilerError("Invalid variable name: use");
            if (action_type == ACTION_TYPE.GET)
                DatexCompiler.builder.valueIndex(SCOPE);
            if (is_internal) {
                if (v_name == "result") {
                    base_type = BinaryCode.VAR_RESULT;
                    v_name = undefined;
                }
                else if (v_name == "sub_result") {
                    base_type = BinaryCode.VAR_SUB_RESULT;
                    v_name = undefined;
                }
                else if (v_name == "root") {
                    base_type = BinaryCode.VAR_ROOT;
                    v_name = undefined;
                }
                else if (v_name == "origin") {
                    base_type = BinaryCode.VAR_ORIGIN;
                    v_name = undefined;
                }
                else if (v_name == "remote") {
                    base_type = BinaryCode.VAR_REMOTE;
                    v_name = undefined;
                }
                else if (v_name == "it") {
                    base_type = BinaryCode.VAR_IT;
                    v_name = undefined;
                }
                else if (v_name == "iter") {
                    base_type = BinaryCode.VAR_ITER;
                    v_name = undefined;
                }
                else if (v_name == "sender") {
                    if (action_type != ACTION_TYPE.GET)
                        throw new Datex.CompilerError("Invalid action on internal variable #sender");
                    base_type = BinaryCode.VAR_SENDER;
                    v_name = undefined;
                }
                else if (v_name == "current") {
                    if (action_type != ACTION_TYPE.GET)
                        throw new Datex.CompilerError("Invalid action on internal variable #current");
                    base_type = BinaryCode.VAR_CURRENT;
                    v_name = undefined;
                }
                else if (v_name == "timestamp") {
                    if (action_type != ACTION_TYPE.GET)
                        throw new Datex.CompilerError("Invalid action on internal variable #timestamp");
                    base_type = BinaryCode.VAR_TIMESTAMP;
                    v_name = undefined;
                }
                else if (v_name == "encrypted") {
                    if (action_type != ACTION_TYPE.GET)
                        throw new Datex.CompilerError("Invalid action on internal variable #encrypted");
                    base_type = BinaryCode.VAR_ENCRYPTED;
                    v_name = undefined;
                }
                else if (v_name == "signed") {
                    if (action_type != ACTION_TYPE.GET)
                        throw new Datex.CompilerError("Invalid action on internal variable #signed");
                    base_type = BinaryCode.VAR_SIGNED;
                    v_name = undefined;
                }
                else if (v_name == "meta") {
                    if (action_type != ACTION_TYPE.GET)
                        throw new Datex.CompilerError("Invalid action on internal variable #meta");
                    base_type = BinaryCode.VAR_META;
                    v_name = undefined;
                }
                else if (v_name == "static") {
                    if (action_type != ACTION_TYPE.GET)
                        throw new Datex.CompilerError("Invalid action on internal variable #static");
                    base_type = BinaryCode.VAR_STATIC;
                    v_name = undefined;
                }
                else if (v_name == "this") {
                    if (action_type != ACTION_TYPE.GET)
                        throw new Datex.CompilerError("Invalid action on internal variable #this");
                    base_type = BinaryCode.VAR_THIS;
                    v_name = undefined;
                }
            }
            if (action_type == ACTION_TYPE.GET && (scope_extract || (SCOPE.insert_parent_scope_vars_default >= 1 && base_type == BinaryCode.VAR) || (SCOPE.insert_parent_scope_vars_default >= 2 && base_type == BinaryCode.LABEL))) {
                const insert_new = DatexCompiler.builder.insertExtractedVariable(SCOPE, base_type, v_name);
                if (insert_new)
                    DatexCompiler.builder.insertVariable(SCOPE.extract_var_scope, v_name, action_type, action_specifier, base_type);
            }
            else
                DatexCompiler.builder.insertVariable(SCOPE, v_name, action_type, action_specifier, base_type);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.CREATE_POINTER)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CREATE_POINTER;
        }
        else if (m = SCOPE.datex.match(Regex.UNIT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.addUnit(parseFloat(m[1].replace(/[_ ]/g, "")), SCOPE);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.FLOAT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.addFloat(parseFloat(m[0].replace(/[_ ]/g, "")), SCOPE);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.INT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.addInt(parseInt(m[0].replace(/[_ ]/g, "")), SCOPE);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.HEX)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.addInt(parseInt(m[0]), SCOPE);
            isEffectiveValue = true;
        }
        else if (m = SCOPE.datex.match(Regex.ASSIGN_SET)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            if (SCOPE.inner_scope.path_info_index == -1)
                throw new Datex.CompilerError("Invalid assignment");
            else
                SCOPE.uint8[SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_SET;
        }
        else if (m = SCOPE.datex.match(Regex.ASSIGN_ADD)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            if (SCOPE.inner_scope.path_info_index == -1)
                throw new Datex.CompilerError("Invalid assignment");
            else {
                SCOPE.uint8[SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_ACTION;
                DatexCompiler.builder.insertByteAtIndex(BinaryCode.ADD, SCOPE.inner_scope.path_info_index + 1, SCOPE);
            }
        }
        else if (m = SCOPE.datex.match(Regex.ASSIGN_SUB)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            if (SCOPE.inner_scope.path_info_index == -1)
                throw new Datex.CompilerError("Invalid assignment");
            else {
                SCOPE.uint8[SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_ACTION;
                DatexCompiler.builder.insertByteAtIndex(BinaryCode.SUBTRACT, SCOPE.inner_scope.path_info_index + 1, SCOPE);
            }
        }
        else if (m = SCOPE.datex.match(Regex.ASSIGN_MUTIPLY)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            if (SCOPE.inner_scope.path_info_index == -1)
                throw new Datex.CompilerError("Invalid assignment");
            else {
                SCOPE.uint8[SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_ACTION;
                DatexCompiler.builder.insertByteAtIndex(BinaryCode.MULTIPLY, SCOPE.inner_scope.path_info_index + 1, SCOPE);
            }
        }
        else if (m = SCOPE.datex.match(Regex.ASSIGN_DIVIDE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            if (SCOPE.inner_scope.path_info_index == -1)
                throw new Datex.CompilerError("Invalid assignment");
            else {
                SCOPE.uint8[SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_ACTION;
                DatexCompiler.builder.insertByteAtIndex(BinaryCode.DIVIDE, SCOPE.inner_scope.path_info_index + 1, SCOPE);
            }
        }
        else if (m = SCOPE.datex.match(Regex.ASSIGN_AND)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            if (SCOPE.inner_scope.path_info_index == -1)
                throw new Datex.CompilerError("Invalid assignment");
            else {
                SCOPE.uint8[SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_ACTION;
                DatexCompiler.builder.insertByteAtIndex(BinaryCode.AND, SCOPE.inner_scope.path_info_index + 1, SCOPE);
            }
        }
        else if (m = SCOPE.datex.match(Regex.ASSIGN_OR)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            if (SCOPE.inner_scope.path_info_index == -1)
                throw new Datex.CompilerError("Invalid assignment");
            else {
                SCOPE.uint8[SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_ACTION;
                DatexCompiler.builder.insertByteAtIndex(BinaryCode.OR, SCOPE.inner_scope.path_info_index + 1, SCOPE);
            }
        }
        else if (m = SCOPE.datex.match(Regex.ASSIGN_POINTER_VALUE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            if (SCOPE.inner_scope.path_info_index == -1)
                throw new Datex.CompilerError("Invalid assignment");
            else {
                SCOPE.uint8[SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_ACTION;
                DatexCompiler.builder.insertByteAtIndex(BinaryCode.CREATE_POINTER, SCOPE.inner_scope.path_info_index + 1, SCOPE);
            }
        }
        else if (m = SCOPE.datex.match(Regex.ADD)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ADD;
        }
        else if (m = SCOPE.datex.match(Regex.SUBTRACT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBTRACT;
        }
        else if (m = SCOPE.datex.match(Regex.MULTIPLY)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.MULTIPLY;
        }
        else if (m = SCOPE.datex.match(Regex.DIVIDE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.DIVIDE;
        }
        else if (m = SCOPE.datex.match(Regex.OR)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.OR;
        }
        else if (m = SCOPE.datex.match(Regex.AND)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.AND;
        }
        else if (m = SCOPE.datex.match(Regex.NOT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.NOT;
        }
        else {
            throw new Datex.SyntaxError("Invalid token on line " + SCOPE.current_line_nr + " near '" + SCOPE.datex.split("\n")[0] + "'");
        }
        if (isEffectiveValue)
            DatexCompiler.builder.tryPlusOrMinus(SCOPE);
        if (!SCOPE.inner_scope?.value_count) {
            let end_index;
            if ('iterate' in SCOPE.inner_scope) {
                if (SCOPE.inner_scope.iterate == 0) {
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CLOSE_AND_STORE;
                    SCOPE.inner_scope.loop_start = SCOPE.b_index;
                    SCOPE.inner_scope.jfa_index = SCOPE.b_index + 1;
                    DatexCompiler.builder.addJmp(SCOPE, BinaryCode.JFA);
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_START;
                    DatexCompiler.builder.insertVariable(SCOPE, 'iter', ACTION_TYPE.GET, undefined, BinaryCode.INTERNAL_VAR);
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CHILD_GET;
                    DatexCompiler.builder.addString('next', SCOPE);
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.VOID;
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_END;
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CLOSE_AND_STORE;
                    DatexCompiler.builder.insertVariable(SCOPE, 'it', ACTION_TYPE.SET, undefined, BinaryCode.INTERNAL_VAR);
                    DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index + 1, SCOPE);
                    DatexCompiler.builder.insertVariable(SCOPE, 'iter', ACTION_TYPE.GET, undefined, BinaryCode.INTERNAL_VAR);
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CHILD_GET;
                    DatexCompiler.builder.addString('val', SCOPE);
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CLOSE_AND_STORE;
                    SCOPE.inner_scope.iterate = 1;
                    SCOPE.inner_scope.value_count = 1;
                }
                else {
                    DatexCompiler.builder.addJmp(SCOPE, BinaryCode.JMP, SCOPE.inner_scope.loop_start);
                    SCOPE.data_view.setUint32(SCOPE.inner_scope.jfa_index, SCOPE.b_index, true);
                    DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_END;
                    delete SCOPE.inner_scope.loop_start;
                    delete SCOPE.inner_scope.iterate;
                }
            }
            else if ('while' in SCOPE.inner_scope) {
                DatexCompiler.builder.addJmp(SCOPE, BinaryCode.JMP, SCOPE.inner_scope.loop_start);
                SCOPE.data_view.setUint32(SCOPE.inner_scope.loop_start + 1, SCOPE.b_index, true);
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_END;
                delete SCOPE.inner_scope.loop_start;
                delete SCOPE.inner_scope.while;
            }
            else if ('if' in SCOPE.inner_scope) {
                if (!SCOPE.inner_scope.if_end_indices)
                    SCOPE.inner_scope.if_end_indices = [];
                SCOPE.inner_scope.if_end_indices.push(SCOPE.b_index + 1);
                DatexCompiler.builder.addJmp(SCOPE, BinaryCode.JMP);
                SCOPE.data_view.setUint32(SCOPE.inner_scope.if + 1, SCOPE.b_index, true);
                end_index = SCOPE.b_index;
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_END;
            }
            if ('else' in SCOPE.inner_scope || 'if' in SCOPE.inner_scope) {
                end_index = end_index ?? SCOPE.b_index;
                for (let index of SCOPE.inner_scope.if_end_indices ?? []) {
                    SCOPE.data_view.setUint32(index, end_index, true);
                }
                if ('else' in SCOPE.inner_scope) {
                    delete SCOPE.inner_scope.if_end_indices;
                    delete SCOPE.inner_scope.else;
                    DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_END;
                }
                else
                    delete SCOPE.inner_scope.if;
            }
            delete SCOPE.inner_scope.value_count;
        }
        if (SCOPE.inner_scope.function != null && SCOPE.b_index != SCOPE.inner_scope.function) {
            let has_brackets = false;
            SCOPE.datex = SCOPE.datex.replace(/^[^\S\n]+/, "");
            if (SCOPE.datex[0] == "(") {
                has_brackets = true;
                SCOPE.datex = SCOPE.datex.slice(1);
            }
            await DatexCompiler.builder.addScopeBlock(BinaryCode.FUNCTION, has_brackets, 0, SCOPE);
            SCOPE.inner_scope.function = null;
        }
    }
    static async createBlockFromScope(SCOPE) {
        return SCOPE.add_header ? await this.appendHeader(SCOPE.buffer, SCOPE.options.end_of_scope, SCOPE.options.from, SCOPE.options.to, SCOPE.options.flood, SCOPE.options.type, SCOPE.options.sign, SCOPE.options.encrypt, SCOPE.options.send_sym_encrypt_key, SCOPE.options.sym_encrypt_key, SCOPE.options.allow_execute, SCOPE.options.sid, SCOPE.options.return_index, SCOPE.options.inc, SCOPE.options.force_id, SCOPE.options.__routing_ttl, SCOPE.options.__routing_prio, SCOPE.options.__routing_to, SCOPE.receiver_buffer, SCOPE.sender_buffer, SCOPE.pre_header_size, SCOPE.signed_header_size, SCOPE.full_dxb_size) : SCOPE.buffer;
    }
    static async compileLoop(SCOPE) {
        const body_compile_measure = DatexRuntimePerformance.enabled ? DatexRuntimePerformance.startMeasure("compile time", "body") : undefined;
        if (!SCOPE.datex)
            SCOPE.datex = ";";
        for (let i = 0; i < 500000; i++) {
            await this.parseNextExpression(SCOPE);
            if (SCOPE.streaming) {
                const _end_of_scope = SCOPE.options.end_of_scope;
                SCOPE.buffer = SCOPE.buffer.slice(0, SCOPE.b_index);
                return new ReadableStream({
                    async start(controller) {
                        SCOPE.options.end_of_scope = false;
                        controller.enqueue(await DatexCompiler.createBlockFromScope(SCOPE));
                        let reader = SCOPE.streaming;
                        let next, value;
                        while (true) {
                            next = await reader.read();
                            if (next.done)
                                break;
                            value = next.value;
                            if (value instanceof ArrayBuffer) {
                                SCOPE.buffer = new ArrayBuffer(value.byteLength + 1 + Uint32Array.BYTES_PER_ELEMENT);
                                SCOPE.uint8 = new Uint8Array(SCOPE.buffer);
                                SCOPE.data_view = new DataView(SCOPE.buffer);
                                SCOPE.uint8[0] = BinaryCode.BUFFER;
                                SCOPE.data_view.setUint32(1, value.byteLength, true);
                                SCOPE.uint8.set(new Uint8Array(value), 1 + Uint32Array.BYTES_PER_ELEMENT);
                            }
                            else
                                SCOPE.buffer = DatexCompiler.compileValue(value, {}, false);
                            controller.enqueue(await DatexCompiler.createBlockFromScope(SCOPE));
                        }
                        SCOPE.b_index = 0;
                        SCOPE.buffer = new ArrayBuffer(400);
                        SCOPE.uint8 = new Uint8Array(SCOPE.buffer);
                        SCOPE.data_view = new DataView(SCOPE.buffer);
                        SCOPE.options.end_of_scope = _end_of_scope;
                        SCOPE.streaming = null;
                        let res = await DatexCompiler.compileLoop(SCOPE);
                        if (res instanceof ArrayBuffer) {
                            if (SCOPE.options.end_of_scope)
                                controller.enqueue(new ArrayBuffer(0));
                            controller.enqueue(res);
                        }
                        else {
                            const reader = res.getReader();
                            let next;
                            while (true) {
                                next = await reader.read();
                                if (next.done)
                                    break;
                                controller.enqueue(next.value);
                            }
                        }
                        controller.close();
                    }
                });
            }
            if (SCOPE.end || !SCOPE.datex) {
                for (let scope of SCOPE.subscopes) {
                    if (scope.parent_type == BinaryCode.OBJECT_START)
                        throw new Datex.SyntaxError("Missing closing object bracket");
                    if (scope.parent_type == BinaryCode.ARRAY_START)
                        throw new Datex.SyntaxError("Missing closing array bracket");
                    if (scope.parent_type == BinaryCode.SUBSCOPE_START)
                        throw new Datex.SyntaxError("Missing closing bracket");
                }
                if (Object.keys(SCOPE.indices_waiting_for_jmp_lbl).length) {
                    throw new Datex.CompilerError("Jump to non-existing lbl: " + Object.keys(SCOPE.indices_waiting_for_jmp_lbl));
                }
                if (SCOPE.return_data)
                    SCOPE.return_data.datex = SCOPE.datex;
                if (SCOPE.options.end_of_scope !== false && !SCOPE.last_command_end) {
                    while (SCOPE.inner_scope?.auto_close_scope != undefined) {
                        const type = SCOPE.inner_scope.auto_close_scope;
                        delete SCOPE.inner_scope.auto_close_scope;
                        DatexCompiler.builder.exit_subscope(SCOPE, type);
                    }
                    DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CLOSE_AND_STORE;
                }
                ;
                SCOPE.buffer = SCOPE.buffer.slice(0, SCOPE.b_index);
                if (SCOPE.extract_var_scope) {
                    SCOPE.extract_var_scope.uint8[SCOPE.extract_var_scope.b_index++] = BinaryCode.SCOPE_BLOCK;
                    SCOPE.extract_var_scope.data_view.setUint32(SCOPE.extract_var_scope.b_index, SCOPE.buffer.byteLength, true);
                    SCOPE.extract_var_scope.b_index += Uint32Array.BYTES_PER_ELEMENT;
                    SCOPE.extract_var_scope.buffer = SCOPE.extract_var_scope.buffer.slice(0, SCOPE.extract_var_scope.b_index);
                    SCOPE.buffer = DatexCompiler.combineBuffers(SCOPE.extract_var_scope.buffer, SCOPE.buffer);
                }
                if (SCOPE.precompiled) {
                    SCOPE.precompiled.appendBufferPlaceholder(SCOPE.last_precompiled ?? 0, SCOPE.b_index);
                    SCOPE.precompiled.autoInsertBuffer(SCOPE.buffer);
                }
                if (SCOPE.add_header && (await this.getScopeBlockSize(SCOPE) >= SCOPE.max_block_size ?? DatexCompiler.MAX_DXB_BLOCK_SIZE)) {
                    const original_buffer = SCOPE.buffer;
                    const total_header_size = SCOPE.pre_header_size + SCOPE.signed_header_size;
                    const max_body_size = SCOPE.max_block_size - total_header_size;
                    console.log("block too big (" + await this.getScopeBlockSize(SCOPE) + " bytes), splitting into parts with body size " + max_body_size);
                    let split_index = 0;
                    return new ReadableStream({
                        async start(controller) {
                            let last_block = false;
                            while (!last_block) {
                                SCOPE.buffer = original_buffer.slice(split_index, split_index + max_body_size);
                                split_index += max_body_size;
                                SCOPE.full_dxb_size = total_header_size + SCOPE.buffer.byteLength;
                                last_block = split_index >= original_buffer.byteLength;
                                SCOPE.options.end_of_scope = last_block;
                                const block = await DatexCompiler.createBlockFromScope(SCOPE);
                                if (last_block)
                                    controller.enqueue(new ArrayBuffer(0));
                                controller.enqueue(block);
                            }
                            controller.close();
                        }
                    });
                }
                else {
                    if (DatexRuntimePerformance.enabled)
                        DatexRuntimePerformance.endMeasure(body_compile_measure);
                    return DatexCompiler.createBlockFromScope(SCOPE);
                }
            }
        }
        throw new Datex.SyntaxError("DATEX Script to big to compile");
    }
    static valueToBase64DXB(value, inserted_ptrs) {
        let dxb = DatexCompiler.compileValue(value, { inserted_ptrs });
        return arrayBufferToBase64(dxb);
    }
    static async datexScriptToBase64DXB(dx, type = DatexProtocolDataType.DATA, data = []) {
        let dxb = await DatexCompiler.compile(dx, data, { sign: false, encrypt: false, type });
        return arrayBufferToBase64(dxb);
    }
    static async datexScriptToDXBFile(dx, file_name, type = DatexProtocolDataType.DATA, data = [], collapse_pointers = false) {
        let dxb = await DatexCompiler.compile(dx, data, { sign: false, encrypt: false, type, collapse_pointers });
        let file = new Blob([dxb], { type: "application/datex" });
        if (file_name != null) {
            const a = document.createElement("a"), url = URL.createObjectURL(file);
            a.href = url;
            a.download = (file_name ?? "unknown") + ".dxb";
            document.body.appendChild(a);
            a.click();
        }
        return file;
    }
    static async datexScriptToDataURL(dx, type = DatexProtocolDataType.DATA) {
        let dxb = await DatexCompiler.compile(dx, [], { sign: false, encrypt: false, type });
        let blob = new Blob([dxb], { type: "text/dxb" });
        return new Promise(resolve => {
            var a = new FileReader();
            a.onload = function (e) { resolve(e.target.result); };
            a.readAsDataURL(blob);
        });
    }
    static async datexScriptToObjectURL(dx, type = DatexProtocolDataType.DATA) {
        let dxb = await DatexCompiler.compile(dx, [], { sign: false, encrypt: false, type });
        let blob = new Blob([dxb], { type: "text/dxb" });
        return URL.createObjectURL(blob);
    }
    static encodeValue(value, inserted_ptrs, add_command_end = true, deep_collapse = false, collapse_first_inserted = false, no_create_pointers = false) {
        return this.compileValue(value, { inserted_ptrs, collapse_pointers: deep_collapse, collapse_first_inserted: collapse_first_inserted, no_create_pointers: no_create_pointers }, add_command_end);
    }
    static encodeValueBase64(value, inserted_ptrs, add_command_end = true, deep_collapse = false, collapse_first_inserted = false, no_create_pointers = false) {
        return arrayBufferToBase64(this.encodeValue(value, inserted_ptrs, add_command_end, deep_collapse, collapse_first_inserted, no_create_pointers));
    }
    static getValueHash(value) {
        return crypto.subtle.digest('SHA-256', DatexCompiler.encodeValue(value, undefined, true, true, true, true));
    }
    static async getValueHashString(value) {
        return arrayBufferToBase64(await DatexCompiler.getValueHash(value));
    }
    static async compilePrecompiled(precompiled, data = [], options = {}, add_header = true) {
        const buffers = [];
        const compiled_cache = [];
        let buffer;
        let total_size = 0;
        for (let part of precompiled) {
            if (part instanceof ArrayBuffer)
                buffer = part;
            else if (part instanceof Array)
                throw new Error("Invalid precompiled dxb");
            else if (part in data) {
                if (compiled_cache[data[part]])
                    buffer = compiled_cache[data[part]];
                else
                    buffer = compiled_cache[data[part]] = await DatexCompiler.compileValue(data[part], undefined, false);
            }
            else
                throw new Datex.CompilerError("Missing data value for precompiled dxb");
            buffers.push(buffer);
            total_size += buffer.byteLength;
        }
        let i = 0;
        const finalBuffer = new ArrayBuffer(total_size);
        const finalBufferView = new Uint8Array(finalBuffer);
        for (let buffer of buffers) {
            finalBufferView.set(new Uint8Array(buffer), i);
            i += buffer.byteLength;
        }
        if (!add_header)
            return finalBuffer;
        return DatexCompiler.appendHeader(finalBuffer, options.end_of_scope, options.force_id ? (options.from ?? Datex.Runtime.endpoint).id_endpoint : options.from, options.to, options.flood, options.type, options.sign, options.encrypt, options.send_sym_encrypt_key, options.sym_encrypt_key, options.allow_execute, options.sid, options.return_index, options.inc, options.force_id, options.__routing_ttl, options.__routing_prio, options.__routing_to);
    }
    static compile(datex, data = [], options = {}, add_header = true, is_child_scope_block = false, insert_parent_scope_vars_default = 0, save_precompiled, max_block_size, _code_block_type, _current_data_index = 0) {
        if (datex instanceof PrecompiledDXB) {
            return DatexCompiler.compilePrecompiled(datex, data, options, add_header);
        }
        if (datex === '?' && !add_header) {
            return DatexCompiler.compileValue(data[0], options);
        }
        let return_data;
        if (typeof datex == "object" && datex) {
            return_data = datex;
            datex = datex.datex;
        }
        if (typeof datex != "string")
            throw new Datex.CompilerError("'datex' must be a string or a precompiled dxb");
        if (save_precompiled)
            save_precompiled.datex = datex;
        if (options.encrypt && !options.sym_encrypt_key)
            throw new Datex.CompilerError("Cannot encrypt without a symmetric encryption key");
        const SCOPE = {
            datex: datex,
            return_data: return_data,
            data: data,
            options: options,
            inserted_values: new Map(),
            jmp_label_indices: {},
            indices_waiting_for_jmp_lbl: {},
            assignment_end_indices: new Set(),
            used_lbls: [],
            jmp_indices: [],
            add_header: add_header,
            is_child_scope_block: is_child_scope_block,
            insert_parent_scope_vars_default: insert_parent_scope_vars_default,
            precompiled: save_precompiled,
            max_block_size: max_block_size,
            buffer: new ArrayBuffer(400),
            uint8: null,
            data_view: null,
            b_index: 0,
            internal_var_index: 0,
            internal_vars: new WeakMap(),
            internal_primitive_vars: new Map(),
            serialized_values: new WeakMap(),
            dynamic_indices: [],
            current_data_index: _current_data_index,
            current_line_nr: 1,
            end: false,
            subscopes: [{
                    start_index: -1,
                    last_value_index: -1,
                    wait_for_add: false,
                    in_template_string: false,
                    path_info_index: -1
                }],
            inner_scope: null,
            _code_block_type: _code_block_type
        };
        if (is_child_scope_block) {
            SCOPE.extract_var_index = 0;
            SCOPE.extract_var_indices = new Map();
            SCOPE.extract_var_scope = {
                b_index: 0,
                buffer: new ArrayBuffer(400),
                inner_scope: {},
                dynamic_indices: [],
                inserted_values: new Map()
            };
            SCOPE.extract_var_scope.uint8 = new Uint8Array(SCOPE.extract_var_scope.buffer);
            SCOPE.extract_var_scope.data_view = new DataView(SCOPE.extract_var_scope.buffer);
            SCOPE.extract_var_indices.set(BinaryCode.VAR, new Map());
            SCOPE.extract_var_indices.set(BinaryCode.LABEL, new Map());
            SCOPE.extract_var_indices.set(BinaryCode.POINTER, new Map());
        }
        SCOPE.inner_scope = SCOPE.subscopes[0];
        SCOPE.uint8 = new Uint8Array(SCOPE.buffer);
        SCOPE.data_view = new DataView(SCOPE.buffer);
        return DatexCompiler.compileLoop(SCOPE);
    }
    static compileValue(value, options = {}, add_command_end = true) {
        const SCOPE = {
            options: options,
            inserted_values: new Map(),
            jmp_label_indices: {},
            indices_waiting_for_jmp_lbl: {},
            assignment_end_indices: new Set(),
            used_lbls: [],
            jmp_indices: [],
            is_child_scope_block: false,
            add_header: false,
            buffer: new ArrayBuffer(200),
            uint8: null,
            data_view: null,
            b_index: 0,
            internal_var_index: 0,
            internal_vars: new WeakMap(),
            internal_primitive_vars: new Map(),
            serialized_values: new WeakMap(),
            dynamic_indices: [],
            current_line_nr: 1,
            end: false,
            subscopes: [{
                    start_index: -1,
                    last_value_index: -1,
                    wait_for_add: false,
                    in_template_string: false,
                    path_info_index: -1
                }],
            inner_scope: null
        };
        SCOPE.inner_scope = SCOPE.subscopes[0];
        SCOPE.uint8 = new Uint8Array(SCOPE.buffer);
        SCOPE.data_view = new DataView(SCOPE.buffer);
        DatexCompiler.builder.insert(value, SCOPE);
        if (add_command_end) {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CLOSE_AND_STORE;
        }
        SCOPE.buffer = SCOPE.buffer.slice(0, SCOPE.b_index);
        return SCOPE.buffer;
    }
}
globalThis.DatexCompiler = DatexCompiler;
export class PrecompiledDXB extends Array {
    #datex;
    #appended_pdxb = [];
    set datex(datex) {
        if (this.#datex == undefined)
            this.#datex = datex;
    }
    get datex() {
        let d = this.#datex ?? "";
        for (let a of this.#appended_pdxb) {
            d += "\n" + a.datex;
        }
        return d;
    }
    constructor() { super(); }
    appendBuffer(buffer) {
        this.push(buffer);
    }
    appendBufferPlaceholder(start_index, end_index) {
        this.push([start_index, end_index]);
    }
    autoInsertBuffer(buffer) {
        for (let i = 0; i < this.length; i++) {
            if (this[i] instanceof Array)
                this[i] = buffer.slice(this[i][0], this[i][1]);
        }
    }
    appendDataIndex(index) {
        this.push(index);
    }
    freeze() {
        Object.freeze(this);
    }
    static async create(datex, options = {}) {
        const precompiled = new PrecompiledDXB();
        await DatexCompiler.compile(datex, [], options, false, false, 0, precompiled);
        precompiled.freeze();
        return precompiled;
    }
    static combine(...precompiled_dxbs) {
        const precompiled = new PrecompiledDXB();
        precompiled.#appended_pdxb = precompiled_dxbs;
        precompiled.freeze();
        return precompiled;
    }
    *[Symbol.iterator]() {
        for (let i = 0; i < this.length; i++)
            yield this[i];
        for (let a = 0; a < this.#appended_pdxb.length; a++) {
            const pdxb = this.#appended_pdxb[a];
            if (pdxb == this) {
                for (let i = 0; i < pdxb.length; i++)
                    yield pdxb[i];
            }
            else {
                for (let p of pdxb)
                    yield p;
            }
        }
    }
}
