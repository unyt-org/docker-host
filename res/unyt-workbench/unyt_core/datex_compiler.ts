/**
 ╔══════════════════════════════════════════════════════════════════════════════════════╗
 ║  Datex Compiler                                                                      ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  Compiles datex to binary                                                            ║
 ║  Visit https://docs.unyt.org/datex for more information                              ║
 ╠═════════════════════════════════════════╦════════════════════════════════════════════╣
 ║  © 2020 unyt.org                        ║                                            ║
 ╚═════════════════════════════════════════╩════════════════════════════════════════════╝
 */

import Logger  from "./logger.js";
let logger = new Logger("datex compiler");

import {Datex, ReadableStream, arrayBufferToBase64, DatexRuntimePerformance} from "./datex_runtime.js";

export enum BinaryCode {

    /*
        SHORTCUT CODES for datex std
    */

    // primitive / fundamental types

    END                 = 0x00,
    
    STD_TYPE_STRING     = 0x10,
    STD_TYPE_INT        = 0x11,
    STD_TYPE_FLOAT      = 0x12,
    STD_TYPE_BOOLEAN    = 0x13,
    STD_TYPE_NULL       = 0x14,
    STD_TYPE_VOID       = 0x15,
    STD_TYPE_BUFFER     = 0x16,
    STD_TYPE_CODE_BLOCK = 0x17,
    STD_TYPE_UNIT       = 0x18,

    STD_TYPE_FILTER     = 0x19,
    STD_TYPE_ARRAY      = 0x1a,
    STD_TYPE_OBJECT     = 0x1b,
    STD_TYPE_SET        = 0x1c,
    STD_TYPE_MAP        = 0x1d,
    STD_TYPE_TUPLE      = 0x1e,
    STD_TYPE_RECORD     = 0x1f,

    STD_TYPE_FUNCTION   = 0x20,
    STD_TYPE_STREAM     = 0x21,
    STD_TYPE_ANY        = 0x22,
    STD_TYPE_ASSERTION  = 0x23,
    STD_TYPE_TASK       = 0x24,
    STD_TYPE_ITERATOR   = 0x25,

    // internal variables and other shorthands
    VAR_RESULT          = 0x30,
    SET_VAR_RESULT      = 0x31,
    VAR_RESULT_ACTION   = 0x32,

    VAR_SUB_RESULT          = 0x33,
    SET_VAR_SUB_RESULT      = 0x34,
    VAR_SUB_RESULT_ACTION   = 0x35,

    VAR_ROOT            = 0x36,
    SET_VAR_ROOT        = 0x37,
    VAR_ROOT_ACTION     = 0x38,

    VAR_ORIGIN          = 0x39,
    SET_VAR_ORIGIN      = 0x3a,
    VAR_ORIGIN_ACTION   = 0x3b,

    VAR_SENDER          = 0x3c,
    VAR_CURRENT         = 0x3d,
    VAR_ENCRYPTED       = 0x3e,
    VAR_SIGNED          = 0x3f,

    VAR_TIMESTAMP       = 0x40,
    VAR_META            = 0x41,
    VAR_STATIC          = 0x42,
    VAR_THIS            = 0x43,
    VAR_IT              = 0x47,
    SET_VAR_IT          = 0x48,
    VAR_IT_ACTION       = 0x49,
    VAR_ITER            = 0x4a,
    SET_VAR_ITER        = 0x4b,
    VAR_ITER_ACTION     = 0x4c,

    VAR_REMOTE          = 0x44,
    SET_VAR_REMOTE      = 0x45,
    VAR_REMOTE_ACTION   = 0x46,


    CACHE_POINT         = 0x50, // cache dxb from this point on
    CACHE_RESET         = 0x51, // reset dxb scope cache

    URL                 = 0x52, //file://... , https://...

    REQUEST             = 0x58, // resolve "file://...", resolve @user

    /*
        OTHER BINARY CODES
    */

    TEMPLATE            = 0x53, // template
    EXTENDS             = 0x54, // extends
    IMPLEMENTS          = 0x55, // implements
    MATCHES             = 0x56, // matches
    DEBUG               = 0x57, // debug


    CLOSE_AND_STORE     = 0xa0, // ;
    SUBSCOPE_START      = 0xa1, // (
    SUBSCOPE_END        = 0xa2, // )
    RETURN              = 0xa4, // return
    JMP                 = 0xa5, // jmp labelname
    JTR                 = 0xa6, // jtr labelname
    JFA                 = 0x66, // jfa labelname (TODO replace with 0xa)
    EQUAL_VALUE         = 0xa7, // ==
    NOT_EQUAL_VALUE     = 0xa8, // ~=
    EQUAL               = 0xa3, // ===
    NOT_EQUAL           = 0xdf, // ~==
    GREATER             = 0xa9, // >
    LESS                = 0xaa, // <
    GREATER_EQUAL       = 0xab, // >=
    LESS_EQUAL          = 0xac, // <=
    COUNT               = 0xad, // count x
    ABOUT               = 0xae, // about x
    WILDCARD            = 0xaf, // *


    VAR                 = 0xb0, // x, _eeffaa
    SET_VAR             = 0xb1, // x = ..., _aaee = ...
    VAR_ACTION          = 0xb2, // x ?= ...

    INTERNAL_VAR        = 0xb3, // __xyz
    SET_INTERNAL_VAR    = 0xb4, // __aa = ...
    INTERNAL_VAR_ACTION = 0xb5, // __x ?= ...

    POINTER             = 0xb6, // $x
    SET_POINTER         = 0xb7, // $aa = ...
    POINTER_ACTION      = 0xb8, // $aa ?= ...

    CREATE_POINTER      = 0xb9, // $$ ()
    DELETE_POINTER      = 0xba, // delete $aa
    SUBSCRIBE           = 0xbb, // subscribe $aa
    UNSUBSCRIBE         = 0xbc, // unsubscribe $aa
    VALUE               = 0xbd, // value $aa
    ORIGIN              = 0xbe, // origin $aa
    SUBSCRIBERS         = 0xbf, // subscribers $aa
    TRANSFORM           = 0x67, // transform x <Int>
    OBSERVE             = 0x68, // observe x ()=>()
    DO                  = 0x69, // do xy;
    AWAIT               = 0x70, // await xy;
    HOLD                = 0x71, // hold xy;
    FUNCTION            = 0x72, // function ()
    ASSERT              = 0x59, // assert
    ITERATOR            = 0x5a, // iterator x;
    ITERATION           = 0x5b, // iteration ()

    STRING              = 0xc0,
    INT_8               = 0xc1, // byte
    INT_16              = 0xc2, 
    INT_32              = 0xc3,
    INT_64              = 0xc4,
    FLOAT_64            = 0xc5,
    TRUE                = 0xc6,
    FALSE               = 0xc7,
    NULL                = 0xc8,
    VOID                = 0xc9,
    BUFFER              = 0xca,
    SCOPE_BLOCK         = 0xcb,
    UNIT                = 0xcc,
    FLOAT_AS_INT        = 0xcd,
    SHORT_STRING        = 0xce, // string with max. 255 characters

    PERSON_ALIAS        = 0xd0,
    PERSON_ALIAS_WILDCARD = 0xd1,
    INSTITUTION_ALIAS   = 0xd2,
    INSTITUTION_ALIAS_WILDCARD = 0xd3,
    BOT                 = 0xd4,
    BOT_WILDCARD        = 0xd5,

    // todo rearrange (move to pointers / variables)
    LABEL               = 0xda, // #x
    SET_LABEL           = 0xdb, // #x = ...,
    LABEL_ACTION        = 0xdc, // #x ?= ...
   
    ENDPOINT            = 0xd6,
    ENDPOINT_WILDCARD   = 0xd7,
    FILTER              = 0xde,

    SYNC                = 0xd8,
    STOP_SYNC           = 0xd9,
    FREEZE              = 0x60, // freeze
    SEAL                = 0x61, // seal
    HAS                 = 0x62, // x has y
    KEYS                = 0x63, // keys x

    ARRAY_START         = 0xe0,  // array / or array
    ARRAY_END           = 0xe1,
    OBJECT_START        = 0xe2,  // {}
    OBJECT_END          = 0xe3,
    TUPLE_START         = 0xe4,  // (a,b,c)
    TUPLE_END           = 0xe5,
    RECORD_START        = 0xe6,  // (a:a,b:b)
    RECORD_END          = 0xe7,  
    ELEMENT_WITH_KEY    = 0xe8,  // for object elements
    KEY_PERMISSION      = 0xf7,  // for object elements with permission prefix
    ELEMENT             = 0xe9,  // for array elements
    AND                 = 0xea,  // &
    OR                  = 0xeb,  // |
    NOT                 = 0xec,  // ~
    STREAM              = 0xed,  // << stream
    STOP_STREAM         = 0xdd,  // </ stream

    CHILD_GET           = 0xf0,  // .y
    CHILD_GET_REF       = 0xef,  // ->y

    CHILD_SET           = 0xf1,  // .y = a
    CHILD_ACTION        = 0xf2,  // .y += a, ...

    THROW_ERROR         = 0xf4,  // !
    GET_TYPE            = 0xf5, // type $aa

    REMOTE              = 0xf6, // ::

    ADD                 = 0xf8, // +
    SUBTRACT            = 0xfa, // -
    MULTIPLY            = 0xfb, // *
    DIVIDE              = 0xfc, // /
    RANGE               = 0xfd, // ..
    EXTEND              = 0xfe, // ...
    TYPE                = 0xff, // <type>
    EXTENDED_TYPE       = 0xee, // <type/xy()>
}



// for actions on variables, pointers, ...
enum ACTION_TYPE {
    GET,
    SET,
    OTHER
}


export const Regex = {
    CLOSE_AND_STORE: /^(;\s*)+/, // one or multiple ;
    VARIABLE: /^(\\)?()([A-Za-zÀ-ž_][A-Za-z0-9À-ž_]*)(\s*[+-/*$&|]?=(?![=>/]))?/, // var_xxx or _ffefe
    INTERNAL_VAR: /^()(#)([A-Za-z0-9À-ž_]+)(\s*[+-/*$&|]?=(?![=>/]))?/, //  __internal_var

    LABELED_POINTER: /^(\\)?(\$)([A-Za-z0-9À-ž_]{1,25})(\s*[+-/*$&|]?=(?![=>/]))?/, // #label

    HEX_VARIABLE: /^[A-Fa-f0-9_]*$/, // variable with hexadecimal name

    JUMP: /^(jmp|jtr|jfa) +([A-Za-z_]\w*)?/, // jmp x, jeq x, ...
    JUMP_LBL: /^lbl *([A-Za-z_]\w*)?/, // lbl x

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

    TSTRING_START: /^'(?:(?:[^\\']|)\\(?:\\\\)*'|(?:\\)*[^'\\])*?(?:[^'\\(](\\\\)*|(\\\\)*)\(/, // check before string
    TSTRING_B_CLOSE: /^\)(?:(?:[^\\']|)\\(?:\\\\)*'|(?:\\)*[^'\\])*?(?:[^'\\(](\\\\)*|(\\\\)*)\(/,
    TSTRING_END: /^\)(?:(?:[^\\']|)\\(?:\\\\)*'|(?:\\)*[^'\\])*?(?:[^'\\(](\\\\)*|(\\\\)*)'/,

    // (old) only usable with SaFaRI negative lookbehind support
    // TSTRING_START: /^'([^']|[^\\]\\')*?(?<![^\\]\\)\(/, // check before string
    // TSTRING_B_CLOSE: /^(\)([^']|\\')*?(?<![^\\]\\)\()/,
    // TSTRING_END: /^\)(.|\n)*?(?<![^\\]\\)'/,
    
    FLOAT: /^((-|\+)?((\d_?)*\.)?(\d_?)*((E|e)(-|\+)?(\d_?)+)|(-|\+)?(\d_?)+\.(\d_?)+)/,
    INFINITY: /^(-|\+)?infinity\b/,
    NAN: /^nan\b/,

    BOOLEAN: /^(true|false)\b/,
    USE: /^use\b/,
   
    RANGE: /^\.\./,

    SPREAD: /^\.\.\./,

    NULL: /^null\b/,
    VOID: /^void\b/, // void 
    QUASI_VOID: /^\(\s*\)/, //  empty brackets ( )
    
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

    TYPE:  /^<(?:(\w+?):)?([A-Za-z0-9À-ž_+-]+?)(\/[A-Za-z0-9À-ž_+-]*)*?(>|\()/, // <type/xy>
    
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
}
 

export enum DatexProtocolDataType {
    REQUEST     = 0, // default datex request
    RESPONSE    = 1, // response to a request (can be empty)

    DATA        = 2, // store data (e.g. in a file)
    BC_TRNSCT   = 3, // write to blockchain
    
    LOCAL_REQ   = 4, // default datex request, but don't want a response (use for <Function> code blocks, ....)


    HELLO       = 6, // info message that endpoint is online
}

globalThis.DatexProtocolDataType = DatexProtocolDataType;

export const DatexProtocolDataTypesMap = [
    "REQUEST", "RESPONSE", "DATA", "BC_TRNSCT", "LOCAL_REQ", "-", "HELLO"
]


type compiler_sub_scope = {
    last_value_index: number,  // byte index of last, pointer, var, object, ...
    first_value_index?: number, // byte index of first value in subscope
    start_index: number, // index for the opening bracket of the subscope
    wait_for_add: boolean,
    in_template_string: boolean,
    path_info_index: number,
    while?: number, // start_index, indicate that currently in a while loop
    iterate?: 0|1, // indicate that currently in a iterate loop, two steps
    loop_start?: number, // index indicates loop start
    jfa_index?: number,
    if?: number, // start_index, indicate that currently in a if condition
    else?: boolean, // currently waiting for else
    value_count?: number, // count inserted values
    if_end_indices?: number[], // contains indices inside if statements to jump to the end
    param_type_close?: boolean, // wait for parameterized type end: )>
    function?: number,
    
    comma_indices?: number[], // contains all indices where a comma was inserted

    has_ce?: boolean, // subscope contains ;
    ce_index?: number, // index of last ;
    first_element_pos?: number, // last element had key
    parent_type?: BinaryCode, // Array or Object or empty
    auto_close_scope?: BinaryCode, // does a tuple need to be auto-closed?
};

type compiler_scope = {
    datex?: string,

    return_data?: {datex:string},

    data?: any[],
    options: compiler_options,
    
    jmp_label_indices:  {[label:string]:[number]}, // jmp label -> binary index
    indices_waiting_for_jmp_lbl: {[label:string]:[number][]}, // jmp instructions waiting for resolved label indices

    assignment_end_indices: Set<number>, // contains a list of all indices at which a assignment ends (x = .), needed for inserted value indexing

    inserted_values: Map<any, [number]>, // save start indices of all inserted values

    used_lbls: string[], // already used lbls

    last_cache_point?: number, // index of last cache point (at LBL)

    add_header: boolean,
    is_child_scope_block?: boolean, // allow \x,\y,\z, \(...), execute in parent scope during runtime
    insert_parent_scope_vars_default?: 0|1|2|3,  // convert x,y,z to parent scope variables per default (treat like \x, \y, \z), 0=none, 1=variables, 2=variables,labels, 3=variables,labels,pointers
    extract_var_index?: number
    extract_var_indices?: Map<BinaryCode, Map<string|number, number>>
    extract_var_scope?:compiler_scope
    precompiled?: PrecompiledDXB, // save precompiled in precompiled object if provided
    last_precompiled?: number, // index from where to split last_precompiled buffer part

    buffer: ArrayBuffer,
    uint8: Uint8Array,
    data_view: DataView,

    // pre-generated for header
    receiver_buffer?: ArrayBuffer, // already generated buffer containing the receivers filter
    sender_buffer?: ArrayBuffer, // already generated buffer containing the sender

    full_dxb_size?: number
    pre_header_size?: number
    signed_header_size?: number

    b_index: number,

    streaming?: ReadableStreamDefaultReader<any>,

    max_block_size?: number, // max size of each block, if not Infinity (default), dxb might be split into multiple blocks

    internal_var_index: number // count up for every new internal variable
    internal_vars: WeakMap<any, number> // save variables for values with an internal variable
    internal_primitive_vars: WeakMap<any, number> // save variables for primitive values with an internal variable

    serialized_values: WeakMap<any, any> // cache serialized versions of values (if they are used multiple times)
    dynamic_indices: [number][], // contains all dynamic index [number] arrays
    jmp_indices: [number][], // contains all positions (as dynamic indices) at which a jmp to xy index exists (and might need to be updated if a buffer shift occurs)

    current_data_index?: number,

    current_line_nr: number,
    end: boolean,

    last_command_end?: boolean,

    subscopes: compiler_sub_scope[],
    inner_scope: compiler_sub_scope,

    _code_block_type?: number // 0/undefined: no code block, 1: () code block, 2: single line code block
}

export type compiler_options = {
    /** Header options */
    sid?:number,     // scope id
    return_index?: number // unique block return index
    inc?: number, // incremenented block index (should not be changed)
    end_of_scope?:boolean, // is last block for this scope id
    from?: Datex.Addresses.Endpoint,  // sender
    to?: Datex.Addresses.Filter|Datex.Addresses.Target, // receivers
    flood?: boolean, // no receiver, flood to all
    type?: DatexProtocolDataType,    // what kind of data is in the body?
    sign?: boolean,  // sign the header + body
    encrypt?: boolean, // encrypt the body?
    sym_encrypt_key?: CryptoKey, // encrypt with the provided symmetric encryption key
    send_sym_encrypt_key?: boolean, // send the encrypted encryption key to all receivers (only send once for a session per default)
    allow_execute?:boolean, // allow calling functions, per default only allowed for datex requests
    
    // for routing header
    __routing_ttl?:number,
    __routing_prio?:number,
    __routing_to?: Datex.Addresses.Filter|Datex.Pointer


    // for special compiler info
    inserted_ptrs?: Set<Datex.Pointer>
    force_id?: boolean // use endpoint id as sender, also if other identifier available
    collapse_pointers?: boolean // collapse all pointers to their actual values
    collapse_first_inserted?: boolean // collapse outer pointer to actual value
    no_create_pointers?: boolean // don't add $$ to clone pointers (useful for value comparison)
}

const utf8_decoder = new TextDecoder();

export class DatexCompiler {

    static readonly VERSION_NUMBER = 1;

    static SIGN_DEFAULT = true; // can be changed

    static BIG_BANG_TIME = new Date(2022, 0, 22, 0, 0, 0, 0).getTime() // 1642806000000
    static MAX_INT_32 = 2_147_483_647;
    static MIN_INT_32 = -2_147_483_648;

    static MAX_INT_8 = 127;
    static MIN_INT_8 = -128;

    static MAX_INT_16 = 32_767;
    static MIN_INT_16 = -32_768;

    static MAX_UINT_16 = 65_535;

    static readonly signature_size = 96 // 256;

    static _buffer_block_size = 64;

    private static utf8_encoder = new TextEncoder();


    private static combineBuffers(buffer1:ArrayBuffer, buffer2:ArrayBuffer) {
        var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
        tmp.set(new Uint8Array(buffer1), 0);
        tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
        return tmp.buffer;
    }

    private static sid_return_indices:Map<number,number> = new Map();
    private static sid_incs:Map<number,number> = new Map();
    private static sid_incs_remote:Map<Datex.Addresses.Target, Map<number,number>> = new Map();

    public static readonly MAX_SID = 4_294_967_295;
    public static readonly MAX_BLOCK = 65_535;

    public static readonly MAX_DXB_BLOCK_SIZE = DatexCompiler.MAX_UINT_16; // default max block size (Infinity)

    /** create a new random SID */
    public static generateSID():number{
        let sid:number;
        // get unique SID
        do {
            sid = Math.round(Math.random() * this.MAX_SID);
        } while (this.sid_return_indices.has(sid));

        this.sid_return_indices.set(sid,0);
        this.sid_incs.set(sid,0);
        return sid;
    }
    /** delete an SID */
    private static removeSID(sid:number){
        this.sid_return_indices.delete(sid);
        this.sid_incs.delete(sid);
    }
    /** get return index ++ for a specific SID */
    public static getNextReturnIndexForSID(sid:number):number {
        if (!this.sid_return_indices.has(sid)) {this.sid_return_indices.set(sid,0);this.sid_incs.set(sid,0);} // sid not yet loaded?
        let c = this.sid_return_indices.get(sid);
        if (c > this.MAX_BLOCK) c = 0;
        this.sid_return_indices.set(sid, c+1);
        return c; 
    }

    private static getBlockInc(sid:number):number {
        if (!this.sid_return_indices.has(sid)) {this.sid_return_indices.set(sid,0);this.sid_incs.set(sid,0);} // sid not yet loaded?

        let c = this.sid_incs.get(sid);
        if (c > this.MAX_BLOCK) c = 0;
        this.sid_incs.set(sid, c+1);
        return c;
    }

    // count up inc individually for different remote receivers (important for RESPONSE dxb)
    private static getBlockIncForRemoteSID(sid: number, remote_endpoint:Datex.Addresses.Endpoint, reset_inc = false) {
        if (!(remote_endpoint instanceof Datex.Addresses.Target)) throw new Datex.CompilerError("Can only send datex responses to endpoint targets");
        if (!this.sid_incs_remote.has(remote_endpoint)) this.sid_incs_remote.set(remote_endpoint, new Map());

        let sid_incs = this.sid_incs_remote.get(remote_endpoint);

        if (!sid_incs.has(sid)) {
            if (reset_inc) return 0; // don't even bother toc create a 0-entry, just return 0 directly
            sid_incs.set(sid, 0); // sid not yet loaded?
        }

        let c = sid_incs.get(sid);
        if (c > this.MAX_BLOCK) c = 0;
        sid_incs.set(sid, c+1);
        //logger.warn("INC for remote SID " + sid, c, (reset_inc?'RESET':''));

        // reset to 0 if scope is closed (responses are sent with the same scope id again and again, but the inc has to be reset each time)
        if (reset_inc) sid_incs.set(sid, 0);

        return c;
    }

    // 0 2 1 5 -> byte
    public static convertNumbersToByte(bit_distribution:number[], ...nrs:(boolean|number)[]):number {
        if (bit_distribution.reduce((a,b)=>a+b) > 8) throw Error("Bit size bigger than 8 bits");
        let binary = "";
        for (let s = bit_distribution.length-1; s>=0; s--) {
            let size = bit_distribution[s];
            let nr = Number(nrs[s])||0;
            if (nr > 2**size - 1) throw Error("Number " + nr + " is bigger than " + size + "  bits");
            binary = (nr?.toString(2)||'').padStart(size, '0') + binary;
        }

        return parseInt(binary, 2);
    }

    /** Set TTL of header of existing block */
    public static setHeaderTTL(dx_block:ArrayBuffer, ttl:number):ArrayBuffer {
        let uint8 = new Uint8Array(dx_block);
        uint8[4] = ttl;
        return uint8.buffer;
    }

    // get sender from header
    public static extractHeaderSender(dx_block: ArrayBuffer, last_byte?:[number], _appspace_byte = true, _start = 8): Datex.Addresses.Endpoint {
        let header_uint8 = new Uint8Array(dx_block);
        let i = _start;

        let sender_type = header_uint8[i++];

        // not anonynmous?
        if (sender_type != 0) {
            let instance:string;
            
            let name_length = header_uint8[i++]; // get name length
            let subspace_number = header_uint8[i++]; // get subspace number
            let instance_length = header_uint8[i++]; // get instance length

            let has_appspace = false;
            if (_appspace_byte) has_appspace = !!header_uint8[i++];

            if (instance_length == 0) throw new Datex.RuntimeError("Invalid sender");
            else if (instance_length == 255) instance_length = 0;

            let name_binary = header_uint8.subarray(i, i+=name_length);
            let name = (sender_type == BinaryCode.ENDPOINT || sender_type == BinaryCode.ENDPOINT_WILDCARD) ? name_binary : utf8_decoder.decode(name_binary)  // get name

            let subspaces:string[]= [];
            for (let n=0; n<subspace_number; n++) {
                let length = header_uint8[i++];
                if (length == 0) {
                    throw new Datex.RuntimeError("Invalid sender");
                }
                else {
                    let subspace_name = utf8_decoder.decode(header_uint8.subarray(i, i+=length));
                    subspaces.push(subspace_name);
                }
            }

            if (!instance) instance = utf8_decoder.decode(header_uint8.subarray(i, i+=instance_length))  // get instance
            
            if (last_byte) last_byte[0] = i;

            let appspace = has_appspace ? this.extractHeaderSender(dx_block, last_byte, false, i) : null;

            return <Datex.Addresses.Endpoint> Datex.Addresses.Target.get(name, subspaces, instance, appspace, sender_type);
        }

        if (last_byte) last_byte[0] = i;
        return null;
    }

    // dx block can be header or full dxb
    protected static extractHeaderReceiverDataList(dx_block: ArrayBuffer, start_byte:number):Map<Datex.Addresses.Endpoint, ArrayBuffer> {

        let header_uint8 = new Uint8Array(dx_block);
        let i = start_byte;

        let targets_map = new Map<Datex.Addresses.Endpoint, ArrayBuffer>();
        let targets_nr = header_uint8[i++];
        let target_list = [];

        // same as in Datex.Runtime
        for (let n=0; n<targets_nr; n++) {
            let type = header_uint8[i++];

            // is pointer
            if (type == BinaryCode.POINTER) {
                // TODO get receivers from pointer
            }

            // filter target
            else {
                
                let name_length = header_uint8[i++]; // get name length
                let subspace_number = header_uint8[i++]; // get subspace number
                let instance_length = header_uint8[i++]; // get instance length
    
                let name_binary = header_uint8.subarray(i, i+=name_length);
                let name = type == BinaryCode.ENDPOINT ? name_binary : utf8_decoder.decode(name_binary)  // get name
    
                let subspaces = [];
                for (let n=0; n<subspace_number; n++) {
                    let length = header_uint8[i++];
                    let subspace_name = utf8_decoder.decode(header_uint8.subarray(i, i+=length));
                    subspaces.push(subspace_name);
                }
    
                let instance = utf8_decoder.decode(header_uint8.subarray(i, i+=instance_length))  // get instance

                const target = <Datex.Addresses.Endpoint> Datex.Addresses.Target.get(name, subspaces, instance, null, type);

                target_list.push(target)
    
                // get attached symmetric key?
                let has_key = header_uint8[i++];
                if (has_key) {
                    // add to keys
                    targets_map.set(target, header_uint8.slice(i, i+512));
                    i += 512;
                }
            }
            
        }
        return targets_map;
    }

    /** Set receivers of header of existing block */
    public static updateHeaderReceiver(dx_block:ArrayBuffer, to:Datex.Addresses.Filter|Datex.Addresses.Target):ArrayBuffer {
        // create receiver buffer, create new
        // extract keys

        // TODO extract and recombine more efficient!
        // first get keys from old receiver header
        let last_byte:[number] = [0];
        let sender = DatexCompiler.extractHeaderSender(dx_block, last_byte);
        //console.log("> sender", sender, last_byte[0]);
        let keys = DatexCompiler.extractHeaderReceiverDataList(dx_block, last_byte[0]+2);

        // now add the required keys back into the old header
        let receiver_buffer = DatexCompiler.filterToDXB(to instanceof Datex.Addresses.Target ? new Datex.Addresses.Filter(to) : to, keys, true);
        
        if (!receiver_buffer) {
            logger.error("could not get receiver buffer");
            return
        }

        let receiver_start_index = last_byte[0];

        // get dimensions - create new buffers
        let routing_header_size = receiver_start_index + Uint16Array.BYTES_PER_ELEMENT + new DataView(dx_block).getUint16(receiver_start_index, true);

        let uint8 = new Uint8Array(dx_block);
        let routing_part = uint8.slice(0, receiver_start_index);
        let main_part = uint8.slice(routing_header_size);

        // calculate new dimensions
        let total_header_size = receiver_start_index+Uint16Array.BYTES_PER_ELEMENT+receiver_buffer.byteLength;
        let total_size = total_header_size + main_part.byteLength;

        let new_dx_block = new ArrayBuffer(total_size);
        let data_view = new DataView(new_dx_block);
        uint8 = new Uint8Array(new_dx_block);
        
        // re-write to new buffer
        uint8.set(routing_part);
        uint8.set(main_part, total_header_size);

        data_view.setUint16(receiver_start_index, receiver_buffer.byteLength, true);
        uint8.set(new Uint8Array(receiver_buffer), receiver_start_index+Uint16Array.BYTES_PER_ELEMENT);

        return new_dx_block;
    }

    /** Add a header to a Datex block */
    public static DEFAULT_TTL = 64;

    private static device_types = {
        "default": 0,
        "mobile": 1,
        "network": 2,
        "embedded": 3,
        "virtual": 4
    }

    /** return the total size of the (not yet generated) block (including the header); also saves sizes and receiver_buffer to SCOPE */
    public static async getScopeBlockSize(SCOPE:compiler_scope) {
        if (SCOPE.full_dxb_size) return SCOPE.full_dxb_size; // alreadx calculated

        const [receiver_buffer, sender_buffer, pre_header_size, signed_header_size, full_dxb_size] = await this.generateScopeBlockMetaInfo(
            SCOPE.options.to,
            SCOPE.options.from,
            SCOPE.options.sign,
            SCOPE.options.encrypt,
            SCOPE.options.flood,
            SCOPE.options.send_sym_encrypt_key,
            SCOPE.options.sym_encrypt_key,
            SCOPE.buffer.byteLength,
            SCOPE.options.force_id
        );

        // save in scope
        SCOPE.receiver_buffer = receiver_buffer;
        SCOPE.sender_buffer = sender_buffer;
        SCOPE.pre_header_size = pre_header_size;
        SCOPE.signed_header_size = signed_header_size;
        SCOPE.full_dxb_size = full_dxb_size;

        return SCOPE.full_dxb_size;
    }

    public static async generateScopeBlockMetaInfo(
        to: Datex.Addresses.Filter|Datex.Addresses.Target, // receivers
        from: Datex.Addresses.Endpoint = Datex.Runtime.endpoint, // sender
        sign: boolean = DatexCompiler.SIGN_DEFAULT,  // sign the header + body
        encrypt: boolean = false, // encrypt (sym_encrypt_key must be provided)
        flood: boolean = false, // flood to all
        send_sym_encrypt_key = true, // add encryption key info to header
        sym_encrypt_key: CryptoKey, // send encryption key to receivers
        dxb_block_length:number,
        force_id: boolean = false // force sender endpoint id
    ):Promise<[receiver_buffer:ArrayBuffer, sender_buffer:ArrayBuffer, pre_header_size:number, signed_header_size:number, full_dxb_size:number]> {
        let receiver_buffer: ArrayBuffer;

        // generate dynamic receivers buffer
        if (!flood && to) {

            // generate encrypted keys
            let endpoint_key_map = new Map<Datex.Addresses.Endpoint, ArrayBuffer>();
            if (send_sym_encrypt_key && sym_encrypt_key) {
                // endpoint or list of endpoints, ignore (currently) if only other targets (labels, flags...)
                for (let endpoint of (to instanceof Datex.Addresses.Target ? (to instanceof Datex.Addresses.Endpoint ? [to] :[]) : to.getPositiveEndpoints())) {
                    endpoint_key_map.set(endpoint, await Datex.Crypto.encryptSymmetricKeyForEndpoint(sym_encrypt_key, endpoint));
                }
            }
            receiver_buffer = DatexCompiler.filterToDXB(to instanceof Datex.Addresses.Target ? new Datex.Addresses.Filter(to) : to, endpoint_key_map, true);
        }

        if (force_id && from) from = from.id_endpoint; 

        // generate sender buffer
        const sender_buffer = from ? this.endpointToDXB(from) : new ArrayBuffer(1);

        const pre_header_size = 10 + sender_buffer.byteLength + (receiver_buffer?.byteLength??0) + (sign?Datex.Crypto.SIGN_BUFFER_SIZE:0);
        const signed_header_size = 18 + (encrypt ? Datex.Crypto.IV_BUFFER_SIZE : 0);
        
        const full_dxb_size = pre_header_size + signed_header_size + dxb_block_length;

        return [receiver_buffer, sender_buffer, pre_header_size, signed_header_size, full_dxb_size];
    }

    /** return a buffer containing the header and the scope dx_block */
    public static async appendHeader(
        dx_block:ArrayBuffer = new ArrayBuffer(0), 
        end_of_scope = true, // is last block for this scope id
        from: Datex.Addresses.Endpoint = Datex.Runtime.endpoint,  // sender
        to?: Datex.Addresses.Filter|Datex.Addresses.Target, // receivers
        flood: boolean = false, // flood to all
        type: DatexProtocolDataType = DatexProtocolDataType.REQUEST,    // what kind of data is in the body?
        sign: boolean = DatexCompiler.SIGN_DEFAULT,  // sign the header + body
        encrypt: boolean = false, // encrypt (sym_encrypt_key must be provided)
        send_sym_encrypt_key = true, // add encryption key info to header
        sym_encrypt_key?: CryptoKey, // send encryption key to receivers
        allow_execute = type == DatexProtocolDataType.REQUEST || type == DatexProtocolDataType.LOCAL_REQ, // allow calling functions, per default only allowed for datex requests
       
        sid:number = type == DatexProtocolDataType.RESPONSE ? -1 : (type == DatexProtocolDataType.DATA ? 0 : this.generateSID()),     // scope id 
        return_index:number = 0,  // generated index or fixed value
        block_inc: number = type == DatexProtocolDataType.RESPONSE ? this.getBlockIncForRemoteSID(sid, <Datex.Addresses.Endpoint>to, end_of_scope) : this.getBlockInc(sid), // should not be overriden; count up block for unique order, if response unique inc for different receivers

        force_id: boolean = false,

        // for routing header
        __routing_ttl:number = DatexCompiler.DEFAULT_TTL,
        __routing_prio:number = 0,
        __routing_to?: Datex.Addresses.Filter|Datex.Pointer,

        // can be provided if it already exists in the SCOPE (gets generated otherwise)
        receiver_buffer?:ArrayBuffer,
        sender_buffer?: ArrayBuffer,
        pre_header_size?: number,
        signed_header_size?: number,
        full_dxb_size?: number
    ) {

        const compile_measure = DatexRuntimePerformance.startMeasure("compile time", "header")

        // cannot generate new sid if type is RESPONSE
        if (sid == -1) throw new Datex.CompilerError("Cannot generate a new SID for a RESPONSE");

        // scope header data not yet generated
        if (full_dxb_size == undefined) {
            [receiver_buffer, sender_buffer, pre_header_size, signed_header_size, full_dxb_size] = await this.generateScopeBlockMetaInfo(
                to,
                from,
                sign,
                encrypt,
                flood, 
                send_sym_encrypt_key,
                sym_encrypt_key,
                dx_block.byteLength,
                force_id
            )
        }

        // get device type
        let device_type = this.device_types.mobile;

        // encryption
        let iv;
        if (encrypt) {
            if (!sym_encrypt_key) throw new Datex.CompilerError("No symmetric encryption key provided");
            [dx_block, iv] = await Datex.Crypto.encryptSymmetric(dx_block, sym_encrypt_key);
        }
       
        // init buffers
        // not-signed header part
        let pre_header = new ArrayBuffer(pre_header_size); // unsigned part, includes 'dxb' and routing information
        let pre_header_data_view = new DataView(pre_header);
        let pre_header_uint8     = new Uint8Array(pre_header); 
        // potentially signed header part
       
        let header = new ArrayBuffer(signed_header_size);
        let header_data_view = new DataView(header);
        let header_uint8     = new Uint8Array(header); 

        let i = 0;

        // Magic number (\01d)
        pre_header_uint8[i++] = 0x01;
        pre_header_uint8[i++] = 0x64;

        // version number
        pre_header_uint8[i++] = this.VERSION_NUMBER;
        
        // Full Block size (set at the end)
        i += 2;
     
        // ROUTING HEADER /////////////////////////////////////////////////
        // ttl
        pre_header_uint8[i++] = __routing_ttl;
        // priority
        pre_header_uint8[i++] = __routing_prio;

        // signed = 1, encrypted+signed = 2, encrypted = 3, others = 0
        pre_header_uint8[i++] = sign && !encrypt ? 1: (sign && encrypt ? 2 : (!sign && encrypt ? 3 : 0));

        // sender
        pre_header_uint8.set(new Uint8Array(sender_buffer), i);
        i += sender_buffer.byteLength;

        // receivers
        if (!flood && to) {
            // receivers buffer size
            pre_header_data_view.setUint16(i, receiver_buffer.byteLength, true);
            i+=Uint16Array.BYTES_PER_ELEMENT;
      
            // add receiver buffer
            pre_header_uint8.set(new Uint8Array(receiver_buffer), i);
            i+=receiver_buffer.byteLength;
        }

        // flood to all, ignore receiver if provided
        else if (flood) {
            pre_header_data_view.setUint16(i, DatexCompiler.MAX_UINT_16, true);
            i+=Uint16Array.BYTES_PER_ELEMENT;
        }

        // no receivers
        else {
            pre_header_data_view.setUint16(i, 0, true);
            i+=Uint16Array.BYTES_PER_ELEMENT;
        }

        ///////////////////////////////////////////////////////////////////
        

        const signature_index = i;

        i = 0;

        // sid
        header_data_view.setUint32(i, sid, true);
        i+=Uint32Array.BYTES_PER_ELEMENT

        // block index
        header_data_view.setUint16(i, return_index, true);
        i+=Uint16Array.BYTES_PER_ELEMENT

        // block inc
        header_data_view.setUint16(i, block_inc, true);
        i+=Uint16Array.BYTES_PER_ELEMENT

        // type 
        header_uint8[i++] = type;

        // flags encrypted - executable - end_of_scope - device_type (5 bits)
        header_uint8[i++] = this.convertNumbersToByte([1,1,1,5], encrypt, allow_execute, end_of_scope, device_type);
        
        // timestamp (current time)
        header_data_view.setBigUint64(i, BigInt(Date.now()-this.BIG_BANG_TIME), true);
        i+=BigUint64Array.BYTES_PER_ELEMENT
        
        // symmetric encryption initialization vector (if exists)
        if (encrypt && iv) {
            header_uint8.set(iv, i);
            i+=iv.byteLength;
        }
       
        let header_and_body = this.combineBuffers(header, dx_block);

        // signature
        if (sign) pre_header_uint8.set(new Uint8Array(await Datex.Crypto.sign(header_and_body)), signature_index)  // add signature to pre header

        // combine all header + body
        // set block size
        const block_size = pre_header.byteLength + header_and_body.byteLength;
        if (block_size > this.MAX_DXB_BLOCK_SIZE) {
            pre_header_data_view.setUint16(3, 0, true);
            logger.warn("DXB block size exceeds maximum size of " + this.MAX_DXB_BLOCK_SIZE + " bytes")
        }
        else pre_header_data_view.setUint16(3, block_size, true);

        // return as ArrayBuffer or [ArrayBuffer]
        const buffer = this.combineBuffers(pre_header, header_and_body);
        if (DatexRuntimePerformance.enabled) DatexRuntimePerformance.endMeasure(compile_measure)
        return buffer;
    }

    public static endpointToDXB(target:Datex.Addresses.Endpoint) {
        // targets buffer part
        let target_buffer = new ArrayBuffer(50) // estimated size
        let target_uint8 = new Uint8Array(target_buffer);
        let i = 0;

        function handleRequiredBufferSize(size_in_bytes:number) {
            if (size_in_bytes>=target_buffer.byteLength-1) {
                let new_size = (target_buffer.byteLength??0) + Math.ceil((size_in_bytes-target_buffer.byteLength)/8)*8;
                let old_uint8 = target_uint8;
                target_buffer    = new ArrayBuffer(new_size);
                target_uint8    = new Uint8Array(target_buffer);  // default                 
                target_uint8.set(old_uint8); // copy from old buffer
            }
        }

        let name_bin = (target instanceof Datex.Addresses.IdEndpoint) ? target.binary : this.utf8_encoder.encode(target.name); 
        let instance_bin = this.utf8_encoder.encode(target.instance); 

        target_uint8[i++] = target.type;
        target_uint8[i++] = name_bin.byteLength; // write name length to buffer
        target_uint8[i++] = target.subspaces.length; // write subspace number to buffer
        target_uint8[i++] = instance_bin.byteLength == 0 ? 255 : instance_bin.byteLength;  // write instance length to buffer, 0 = wildcard, 255 = no instance
        target_uint8[i++] = target.appspace ? 1 : 0; // has appspace?
        target_uint8.set(name_bin, i);  // write name to buffer
        i += name_bin.byteLength;

        for (let subspace of target.subspaces ?? []) {
            let subspace_bin = DatexCompiler.utf8_encoder.encode(subspace); 
            handleRequiredBufferSize(i+1+subspace_bin.byteLength);
            target_uint8[i++] = subspace_bin.length;  // write subspace length to buffer
            target_uint8.set(subspace_bin, i);  // write subspace_bin to buffer
            i += subspace_bin.byteLength;
        }

        handleRequiredBufferSize(instance_bin.length);
        target_uint8.set(instance_bin, i);  // write channel to buffer
        i += instance_bin.byteLength;

        target_buffer = target_buffer.slice(0, i);

        if (target.appspace) {
            target_buffer = this.combineBuffers(target_buffer, this.endpointToDXB(target.appspace));            
        }
        
        return target_buffer;
    }
    
    // create binary representation of <Filter>, max 255 ands by 255 ors, max 127 different targets in total
    // also add encrypted keys at the end
    public static filterToDXB(filter:Datex.Addresses.Filter, keys_map?:Map<Datex.Addresses.Endpoint,ArrayBuffer>, extended_keys = false): ArrayBuffer {
        const encrypted_key_size = 512;

        let cnf = filter.calculateNormalForm(false); // get CNF, do not resolve pointers

        // direct pointer -> create 'CNF'
        if (cnf instanceof Datex.Pointer) cnf = new Datex.Addresses.AndSet([cnf]);

        // filter clauses buffer part
        let filter_buffer_size = 1 + cnf.size; // coutn ands nr of ands
        for (let and of cnf) {
            filter_buffer_size += (and instanceof Set ? and.size : 1); // ors
        }
        let filter_buffer = new ArrayBuffer(filter_buffer_size)
        let filter_uint8 = new Uint8Array(filter_buffer)
        let filter_int8 = new Int8Array(filter_buffer)

        let targets:Datex.Addresses.Target[] = []; // index -> filter target
        let index_target_map = new Map<Datex.Addresses.Target,number>(); // filter target -> index
        let target_index = 1;

        let i = 0;
        filter_uint8[i++] = cnf.size; // set number of ands
        for (let and of cnf) {
            filter_uint8[i++] = (and instanceof Set ? and.size : 1); // set number of ors
            for (let or of (and instanceof Set ? and.values(): [and])) {
                let is_pointer = or instanceof Datex.Pointer;
                let or_positive = <Datex.Addresses.Endpoint>(or instanceof Datex.Addresses.Not ? or.value : or);
                // target appspace not yet in list?
                if (!is_pointer && or_positive.appspace && !index_target_map.has(or_positive.appspace)) {
                    index_target_map.set(or_positive.appspace, targets.length)
                    targets[targets.length] = or_positive.appspace;
                }
                // target already in list or add new
                if (index_target_map.has(or_positive)) {
                    target_index = index_target_map.get(or_positive);
                }
                // save target at next index
                else {
                    target_index = targets.length;
                    index_target_map.set(or_positive, target_index)
                    targets[target_index] = or_positive;
                }
                // add target (- : negated)
                filter_int8[i++] = or instanceof Datex.Addresses.Not ? -(target_index+1) : (target_index+1);
            }
        }

        // targets buffer part
        let target_buffer = new ArrayBuffer(1 + targets.length*20) // estimated size
        let target_uint8 = new Uint8Array(target_buffer);
        i = 0;

        function handleRequiredBufferSize(size_in_bytes:number) {
            if (size_in_bytes>=target_buffer.byteLength-1) {
                let new_size = (target_buffer.byteLength??0) + Math.ceil((size_in_bytes-target_buffer.byteLength)/8)*8;
                let old_uint8 = target_uint8;
                target_buffer    = new ArrayBuffer(new_size);
                target_uint8    = new Uint8Array(target_buffer);  // default                 
                target_uint8.set(old_uint8); // copy from old buffer
            }
        }


        target_uint8[i++] = targets.length; // nr of targets

        for (let _target of targets) {
            const target:Datex.Addresses.Endpoint = (_target instanceof Datex.Addresses.WildcardTarget) ? _target.target : <Datex.Addresses.Endpoint>_target;

            // is pointer?
            if (target instanceof Datex.Pointer) {
                console.log("filter has pointer: " + target + " = " + target.value);
                target_uint8[i++] = BinaryCode.POINTER;
                
                if (target.id_buffer.byteLength > Datex.Pointer.MAX_POINTER_ID_SIZE) throw new Datex.CompilerError("Pointer ID size must not exceed " + Datex.Pointer.MAX_POINTER_ID_SIZE + " bytes");

                handleRequiredBufferSize(i+Datex.Pointer.MAX_POINTER_ID_SIZE);

                target_uint8.set(target.id_buffer, i);   // write pointer id to buffer
                i+=Datex.Pointer.MAX_POINTER_ID_SIZE;
            }
            else {
                let key = (target instanceof Datex.Addresses.Endpoint) ? keys_map?.get(target) : null;
                let name_bin = (target instanceof Datex.Addresses.IdEndpoint) ? target.binary : this.utf8_encoder.encode(target.name); 
                let instance_bin = this.utf8_encoder.encode(target.instance); 
                handleRequiredBufferSize(i+4+name_bin.length)
                target_uint8[i++] = target.type;
                target_uint8[i++] = name_bin.byteLength; // write name length to buffer
                target_uint8[i++] = target.subspaces.length; // write subspace number to buffer
                target_uint8[i++] = instance_bin.byteLength;  // write instance length to buffer
                target_uint8.set(name_bin, i);  // write name to buffer
                i += name_bin.byteLength;

                for (let subspace of target.subspaces ?? []) {
                    let subspace_bin = DatexCompiler.utf8_encoder.encode(subspace); 
                    handleRequiredBufferSize(i+1+subspace_bin.byteLength);
                    target_uint8[i++] = subspace_bin.length;  // write subspace length to buffer
                    target_uint8.set(subspace_bin, i);  // write subspace_bin to buffer
                    i += subspace_bin.byteLength;
                }

                handleRequiredBufferSize(i+instance_bin.length+1+(key?encrypted_key_size+1:0));
                target_uint8.set(instance_bin, i);  // write channel to buffer
                i += instance_bin.byteLength;

                target_uint8[i++] = target.appspace ? index_target_map.get(target.appspace) : 0;  // app index or 0 - no app

                if (extended_keys) {
                    // has key?
                    target_uint8[i++] = key?1:0;  
                    if (key) { // add key
                        target_uint8.set(new Uint8Array(key), i);
                        i += key.byteLength;
                    }
                }
            }
            
        }

        target_buffer = target_buffer.slice(0, i); // slice target buffer

        filter_buffer = this.combineBuffers(target_buffer, filter_buffer);

        return filter_buffer
    }

    /** compiler builder functions */

    static builder = {

        // resize buffer by given amount of bytes, or create new
        resizeBuffer: (add_bytes:number=DatexCompiler._buffer_block_size, SCOPE:compiler_scope) => {
            let new_size = (SCOPE.buffer?.byteLength??0)+add_bytes;
            //logger.info("extending buffer size to " + new_size + " bytes");
            let old_uint8 = SCOPE.uint8;
            SCOPE.buffer    = new ArrayBuffer(new_size);
            SCOPE.uint8     = new Uint8Array(SCOPE.buffer);  // default 
            SCOPE.data_view = new DataView(SCOPE.buffer);
            
            if (old_uint8) SCOPE.uint8.set(old_uint8); // copy from old buffer
        },

        // auto resize buffer it too smol
        handleRequiredBufferSize: (size_in_bytes:number, SCOPE:compiler_scope) => {
            if (size_in_bytes>=SCOPE.buffer.byteLength-1) 
                DatexCompiler.builder.resizeBuffer(Math.max(DatexCompiler._buffer_block_size, Math.ceil((size_in_bytes-SCOPE.buffer.byteLength)/8)*8), SCOPE);
        },

        getAssignAction: (assign_string:string): [ACTION_TYPE, BinaryCode] => {
            let action_type = ACTION_TYPE.GET; 
            let action_specifier:BinaryCode;

            // is =, +=, -=
            if (assign_string) {
                assign_string = assign_string.replace(/ /g, '');

                if (assign_string == "=") action_type = ACTION_TYPE.SET;
                else if (assign_string == "+=") {
                    action_type = ACTION_TYPE.OTHER;
                    action_specifier = BinaryCode.ADD
                }
                else if (assign_string == "-=") {
                    action_type = ACTION_TYPE.OTHER;
                    action_specifier = BinaryCode.SUBTRACT
                }
                else if (assign_string == "*=") {
                    action_type = ACTION_TYPE.OTHER;
                    action_specifier = BinaryCode.MULTIPLY
                }
                else if (assign_string == "/=") {
                    action_type = ACTION_TYPE.OTHER;
                    action_specifier = BinaryCode.DIVIDE
                }
                else if (assign_string == "&=") {
                    action_type = ACTION_TYPE.OTHER;
                    action_specifier = BinaryCode.AND
                }
                else if (assign_string == "|=") {
                    action_type = ACTION_TYPE.OTHER;
                    action_specifier = BinaryCode.OR
                }
                else if (assign_string == "$=") {
                    action_type = ACTION_TYPE.OTHER;
                    action_specifier = BinaryCode.CREATE_POINTER
                }
            }

            return [action_type, action_specifier]
        },

        // getArgsTemplate(args_string: string, SCOPE:compiler_scope):Datex.code_block_args_template {
        //     const args_template = []
        //     const arg_names = []
        //     let in_multi_with = false;
        //     for (let arg of args_string.split(",")) {
        //         arg = arg.trim()
        //         if (in_multi_with || arg.match(/^with *\(/)) { // with multiple variables
        //             in_multi_with = true;
        //             // end of multi with?
        //             if (arg.includes(')')) in_multi_with = false;
        //             args_template.push([Datex.WITH, arg.replace('with', '').replace(/[() ]/g, '')])
        //         }
        //         else if (arg.startsWith('with ')) args_template.push([Datex.WITH, arg.replace('with ', '')]) // with
        //         else if (arg.startsWith('<')) {
        //             let m = arg.match(Regex.TYPE)
        //             if (!m) throw new Datex.SyntaxError("Invalid token on line "+SCOPE.current_line_nr);
        //             args_template.push([Datex.Type.get(m[1], m[2], m[3]), arg.replace(m[0],'').trim()])
        //         }
        //         else args_template.push([null, arg]);

        //         // last name double?
        //         if (arg_names.includes(args_template[args_template.length-1][1])) throw new Datex.CompilerError("Duplicate code block argument variable names are not allowed");
        //     }
        //     return args_template
        // },

        // update last_value_index / set first_value_index
        valueIndex: (SCOPE:compiler_scope) => {

            // if child value for path, it is not an actual value
            if (SCOPE.inner_scope.path_info_index != -1 && SCOPE.inner_scope.path_info_index === SCOPE.b_index-1) return;

            if ('value_count' in SCOPE.inner_scope)  SCOPE.inner_scope.value_count--; // update value count

            SCOPE.inner_scope.last_value_index = SCOPE.b_index;
            if (SCOPE.inner_scope.first_value_index === undefined) SCOPE.inner_scope.first_value_index = SCOPE.b_index;
        },

        // save all indices where commas (ELEMENT) where inserted (trailing commas can be removed on scope exit)
        commaIndex: (index:number, SCOPE:compiler_scope) => {
            if (!SCOPE.inner_scope.comma_indices) SCOPE.inner_scope.comma_indices = [];
            SCOPE.inner_scope.comma_indices.push(index);
        },

        // add index where an assignment ends
        assignmentEndIndex: (SCOPE:compiler_scope, index?:number) => {
            SCOPE.assignment_end_indices.add(index ?? SCOPE.b_index);
        },

        // index that gets updated if the buffer is shifted within

        getDynamicIndex: (index:number, SCOPE:compiler_scope): [number] => {
            const dyn_index:[number] = [index];
            SCOPE.dynamic_indices.push(dyn_index);
            return dyn_index;
        },


        // shift dynamic indices & jmp indices correctly (all indices after a specific index)
        shiftDynamicIndices: (SCOPE:compiler_scope, shift:number, after:number) => {
            // update dynamic indices
            for (let i of SCOPE.dynamic_indices) {
                if (i[0] > after) i[0] += shift;
            }

            // update jmp_indices
            for (let [i] of SCOPE.jmp_indices) {
                if (i > after) {
                    const jmp_to = SCOPE.data_view.getUint32(i, true);
                    if (jmp_to > after) SCOPE.data_view.setUint32(i, jmp_to + shift, true); // shift current jmp_to index in buffer
                }
            }

            // update assignment_end_indices
            let new_end_indices = new Set<number>();
            for (let i of SCOPE.assignment_end_indices) {
                 new_end_indices.add(i > after ? i+shift : i);
            }
            SCOPE.assignment_end_indices = new_end_indices;

            // shift other internal indices
            if (SCOPE.b_index > after) SCOPE.b_index += shift;
            if (SCOPE.inner_scope.last_value_index > after) SCOPE.inner_scope.last_value_index += shift;
            if (SCOPE.inner_scope.first_value_index > after) SCOPE.inner_scope.first_value_index += shift;
        },

        insertByteAtIndex: (byte:number, index:number|[number], SCOPE:compiler_scope) => {
            // get value from dynamic index
            if (index instanceof Array) index = index[0];

            // is current b_index (no shift needed, normal insert)
            if (index == SCOPE.b_index) {
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = byte;
                return;
            }

            // shift for gap
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE); // buffer overflowing to right
            SCOPE.uint8.copyWithin(index+1, index);

            SCOPE.uint8[index++] = byte;

            // update indices
            DatexCompiler.builder.shiftDynamicIndices(SCOPE, 1, index-2); // shift starting at correct index
        },

        // add __scope_global=_1234=... at a specific index (for recursive objects)
        createInternalVariableAtIndex: (index:number|[number], SCOPE:compiler_scope, val?:any):number => {

            // already has an internal variable reference?
            if (SCOPE.internal_vars.has((val))) return SCOPE.internal_vars.get(val);
            if (SCOPE.internal_primitive_vars.has((val))) return SCOPE.internal_primitive_vars.get(val);

            // get value from dynamic index
            if (index instanceof Array) index = index[0];
            
            let var_number = SCOPE.internal_var_index++;
            const add_scope_global = !SCOPE.assignment_end_indices.has(index); // only add if not already an assignment before
            const gap = Uint16Array.BYTES_PER_ELEMENT + 2 + (add_scope_global?1:0);

            // shift for gap
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+gap, SCOPE); // buffer overflowing to right
            SCOPE.uint8.copyWithin(index+gap, index);

            // update indices
            DatexCompiler.builder.shiftDynamicIndices(SCOPE, gap, index);

            // __scope_global = 
            if (add_scope_global) SCOPE.uint8[index++] = BinaryCode.SET_VAR_SUB_RESULT;
    
            // #1234 = 
            DatexCompiler.builder.insertVariable(SCOPE, var_number, ACTION_TYPE.SET, undefined, BinaryCode.INTERNAL_VAR, index);

      

            // save for future requests
            // not primitive
            if (typeof val == "object" || typeof val == "function") SCOPE.internal_vars.set(val, var_number)
            // primitive
            else  SCOPE.internal_primitive_vars.set(val, var_number)

            return var_number;
        },

        // insert #0, #1, instead of variable/pointer/..., returns true if the actual variable/pointer/... has to be inserted into the extract_var_scope
        insertExtractedVariable: (SCOPE:compiler_scope, base_type:BinaryCode, v_name:any)=> {
            let index:number
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

        // v: variable name or empty, action type: set/get/delete/other, action_specifier: for other actions (+=,-=,...), base_type: e.g. BinaryCode.VAR
        insertVariable: (SCOPE:compiler_scope, v?:string|number, action_type:ACTION_TYPE = ACTION_TYPE.GET, action_specifier?: BinaryCode, base_type:BinaryCode=BinaryCode.VAR,  index:number=SCOPE.b_index) => {
            
            let is_b_index = index==SCOPE.b_index; // index is same as scope index

            if (is_b_index) DatexCompiler.builder.handleRequiredBufferSize(index, SCOPE);
            SCOPE.uint8[index++] = base_type + action_type;
            if (action_specifier != undefined) {
                if (is_b_index) DatexCompiler.builder.handleRequiredBufferSize(index, SCOPE);
                SCOPE.uint8[index++] = action_specifier;
            }
          
            // has a variable name/id (is empty for predefined internal variables with custom binary codes)
            if (v != undefined) {
                let v_name_bin:Uint8Array
                const is_number = typeof v == "number";
                if (!is_number) {
                    v_name_bin = this.utf8_encoder.encode(v);  // convert var name to binary
                    if (is_b_index) DatexCompiler.builder.handleRequiredBufferSize(index+v_name_bin.byteLength+1, SCOPE);
                }
                else {
                    if (is_b_index) DatexCompiler.builder.handleRequiredBufferSize(index+Uint16Array.BYTES_PER_ELEMENT+1, SCOPE);
                }

                SCOPE.uint8[index++] = is_number ? 0 : v_name_bin.byteLength; // set length or 0 if hex variable

                if (is_number) { // write hex var name to buffer
                    if (v > 65535) { // does not fit in Uint16
                        throw new Datex.CompilerError("Invalid variable id: " + v + " (too big)");
                    }
                    SCOPE.data_view.setUint16(index, v, true);
                    index += Uint16Array.BYTES_PER_ELEMENT;
                }
                else {
                    SCOPE.uint8.set(v_name_bin, index);   // write var name to buffer
                    index+=v_name_bin.byteLength;
                }
            }

            // is assignment end
            if (action_type != ACTION_TYPE.GET) DatexCompiler.builder.assignmentEndIndex(SCOPE, index);
          

            if (is_b_index) SCOPE.b_index = index; // update scope index
        },


        handleStream: (stream:Datex.Stream|ReadableStream, SCOPE:compiler_scope) => {
            SCOPE.streaming = stream.getReader();
        },

        // add jmp or jfa / jtr - auto change jmp index if buffer is shifted later on
        addJmp: (SCOPE:compiler_scope, type:BinaryCode.JMP|BinaryCode.JTR|BinaryCode.JFA, to_index?: number) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1+Uint32Array.BYTES_PER_ELEMENT, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = type;

            // already has a jmp index
            if (to_index != undefined) SCOPE.data_view.setUint32(SCOPE.b_index, to_index, true);  // set jmp index
            SCOPE.jmp_indices.push(DatexCompiler.builder.getDynamicIndex(SCOPE.b_index, SCOPE)) // store current position of jmp index
            
            SCOPE.b_index += Uint32Array.BYTES_PER_ELEMENT;
        },

        // add data types
        addString: (s:string, SCOPE:compiler_scope) => {
            DatexCompiler.builder.valueIndex(SCOPE);
            let str_bin = DatexCompiler.utf8_encoder.encode(s);  // convert string to binary
            let short_string = str_bin.byteLength < 256;
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+str_bin.byteLength+(short_string?1:Uint32Array.BYTES_PER_ELEMENT)+1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = short_string ? BinaryCode.SHORT_STRING : BinaryCode.STRING;
            // write string length to buffer
            if (short_string) {
                SCOPE.uint8[SCOPE.b_index++] = str_bin.byteLength // 1 byte length
            }
            else {
                SCOPE.data_view.setUint32(SCOPE.b_index, str_bin.byteLength, true); // 4 byte length
                SCOPE.b_index += Uint32Array.BYTES_PER_ELEMENT; 
            }
          
            SCOPE.uint8.set(str_bin, SCOPE.b_index);   // write string to buffer
            SCOPE.b_index+=str_bin.byteLength;
        },

        addUrl: (url_string:string, SCOPE:compiler_scope) => {
            DatexCompiler.builder.valueIndex(SCOPE);
            let str_bin = DatexCompiler.utf8_encoder.encode(url_string);  // convert string to binary
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+str_bin.byteLength+(Uint32Array.BYTES_PER_ELEMENT)+1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.URL;
            // write url length to buffer
            SCOPE.data_view.setUint32(SCOPE.b_index, str_bin.byteLength, true); // 4 byte length
            SCOPE.b_index += Uint32Array.BYTES_PER_ELEMENT; 

            SCOPE.uint8.set(str_bin, SCOPE.b_index);   // write string to buffer
            SCOPE.b_index+=str_bin.byteLength;
        },

        addBoolean: (b:boolean, SCOPE:compiler_scope) => {    
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = b ? BinaryCode.TRUE : BinaryCode.FALSE;
        },
        addInt: (i:bigint|number, SCOPE:compiler_scope) => {
            if (i<=DatexCompiler.MAX_INT_8 && i>=DatexCompiler.MIN_INT_8)   return DatexCompiler.builder.addInt8(i, SCOPE); // INT8
            if (i<=DatexCompiler.MAX_INT_16 && i>=DatexCompiler.MIN_INT_16) return DatexCompiler.builder.addInt16(i, SCOPE); // INT16
            if (i<=DatexCompiler.MAX_INT_32 && i>=DatexCompiler.MIN_INT_32) return DatexCompiler.builder.addInt32(i, SCOPE); // INT32
            else return DatexCompiler.builder.addInt64(i, SCOPE); // INT64
        },
        addInt8: (i:bigint|number, SCOPE:compiler_scope) => {    
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+Int8Array.BYTES_PER_ELEMENT+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.INT_8;
            SCOPE.data_view.setInt8(SCOPE.b_index, Number(i));
            SCOPE.b_index+=Int8Array.BYTES_PER_ELEMENT;
        },
        addInt16: (i:bigint|number, SCOPE:compiler_scope) => {    
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+Int16Array.BYTES_PER_ELEMENT+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.INT_16;
            SCOPE.data_view.setInt16(SCOPE.b_index, Number(i), true);
            SCOPE.b_index+=Int16Array.BYTES_PER_ELEMENT;
        },
        addInt32: (i:bigint|number, SCOPE:compiler_scope) => {    
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+Int32Array.BYTES_PER_ELEMENT+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.INT_32;
            SCOPE.data_view.setInt32(SCOPE.b_index, Number(i), true);
            SCOPE.b_index+=Int32Array.BYTES_PER_ELEMENT;
        },
        addInt64: (i:bigint|number, SCOPE:compiler_scope) => {    
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+BigInt64Array.BYTES_PER_ELEMENT+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.INT_64;
            SCOPE.data_view.setBigInt64(SCOPE.b_index, BigInt(i), true);
            SCOPE.b_index+=BigInt64Array.BYTES_PER_ELEMENT;
        },
        addUnit: (u:Datex.Unit, SCOPE:compiler_scope) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+Float64Array.BYTES_PER_ELEMENT+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.UNIT;
            SCOPE.data_view.setFloat64(SCOPE.b_index, <number>u, true);
            SCOPE.b_index+=Float64Array.BYTES_PER_ELEMENT;
        },

        addFloat64: (f:number, SCOPE:compiler_scope) => {    
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+Float64Array.BYTES_PER_ELEMENT+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.FLOAT_64;
            SCOPE.data_view.setFloat64(SCOPE.b_index, f, true);
            SCOPE.b_index+=Float64Array.BYTES_PER_ELEMENT;
        },
        addFloatAsInt: (f:number, SCOPE:compiler_scope) => {    
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+Int32Array.BYTES_PER_ELEMENT+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.FLOAT_AS_INT;
            SCOPE.data_view.setInt32(SCOPE.b_index, f, true);
            SCOPE.b_index+=Int32Array.BYTES_PER_ELEMENT;
        },

        // get +/- as immediate operators (no space inbetween) before next token
        tryPlusOrMinus: (SCOPE:compiler_scope) => {
            if (SCOPE.datex[0] == "+") {
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ADD; 
                SCOPE.datex = SCOPE.datex.slice(1);
            }
            // - but not ->
            else if (SCOPE.datex[0] == "-" && SCOPE.datex[1] != ">") {
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBTRACT; 
                SCOPE.datex = SCOPE.datex.slice(1);
            }
        },

        addFloat: (f:number, SCOPE:compiler_scope) => {
            // can be saved as Int32 (is an integer within the Int32 bounds and not -0)
            if (Number.isInteger(f) && !Object.is(f, -0) && f<=DatexCompiler.MAX_INT_32 && f>= DatexCompiler.MIN_INT_32) return DatexCompiler.builder.addFloatAsInt(f, SCOPE); // float as int
            else return DatexCompiler.builder.addFloat64(f, SCOPE); // FLOAT_64
        },

        addScopeBlock: async (type:BinaryCode, brackets:boolean, insert_parent_scope_vars_default: 0|1|2|3, SCOPE:compiler_scope) => {

            let return_data:{datex:string} = {datex: SCOPE.datex};
            // compiled always needs to be an ArrayBuffer, not a ReadableStream
            let compiled = <ArrayBuffer> await this.compile(return_data, SCOPE.data, {}, false, true, insert_parent_scope_vars_default, undefined, Infinity, brackets?1:2, SCOPE.current_data_index);
            SCOPE.datex = return_data.datex; // update position in current datex script

            // insert scope block
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1+compiled.byteLength, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = type;
            SCOPE.uint8.set(new Uint8Array(compiled), SCOPE.b_index)
            SCOPE.b_index += compiled.byteLength;
        },

        // addCodeBlock: (compiled:ArrayBuffer, args_template:Datex.code_block_args_template=[], SCOPE:compiler_scope) => {

        
        //     if (!compiled) {
        //         throw new Datex.CompilerError("Code block has no content");
        //     }
            
        //     DatexCompiler.builder.valueIndex(SCOPE);

        //     DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+Uint16Array.BYTES_PER_ELEMENT+1, SCOPE);

        //     SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SCOPE_BLOCK;
            
        //     // injected variables (args)
        //     SCOPE.data_view.setUint16(SCOPE.b_index, args_template.length, true);   // # of params
        //     SCOPE.b_index += Uint16Array.BYTES_PER_ELEMENT;

        //     for (let param of args_template) {
        //         DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
        //         if (param[0] instanceof Datex.Type) {
        //             DatexCompiler.builder.addTypeByNamespaceAndName(SCOPE, param[0].namespace, param[0].name);
        //         }
        //         else if (param[0] == Datex.WITH) {SCOPE.uint8[SCOPE.b_index++] = 1} // use variable from outer scope ('with')
        //         else {SCOPE.uint8[SCOPE.b_index++] = 0} // no type specified

        //         let v_name_bin = DatexCompiler.utf8_encoder.encode(param[1]);  // convert var name to binary
        //         DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+v_name_bin.byteLength+2, SCOPE);
        //         SCOPE.uint8[SCOPE.b_index++] = v_name_bin.byteLength;
        //         SCOPE.uint8.set(v_name_bin, SCOPE.b_index);   // write var name to buffer
        //         SCOPE.b_index+=v_name_bin.byteLength;
        //     }

        //     // Buffer
        //     DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+Uint32Array.BYTES_PER_ELEMENT+compiled.byteLength, SCOPE);

        //     //console.log("codec " + codec, "buffer",buffer);
        //     SCOPE.data_view.setUint32(SCOPE.b_index, compiled.byteLength, true);   // buffer length
        //     SCOPE.b_index += Uint32Array.BYTES_PER_ELEMENT;

        //     SCOPE.uint8.set(new Uint8Array(compiled), SCOPE.b_index);
        //     SCOPE.b_index += compiled.byteLength;
        // },


        // insertGeneratedDatex: async (generator_function:()=>Promise<ArrayBuffer>, SCOPE:compiler_scope) => {
        //     // TODO improve
        //     DatexCompiler.builder.addCodeBlock(await generator_function(), [], SCOPE);
        // },


        addKey: (k:string, SCOPE:compiler_scope) => {
            
            let key_bin = DatexCompiler.utf8_encoder.encode(k);  // convert key to binary
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+key_bin.byteLength+1, SCOPE);

            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ELEMENT_WITH_KEY;
            SCOPE.uint8[SCOPE.b_index++] = key_bin.byteLength;  // write key length to buffer
            SCOPE.uint8.set(key_bin, SCOPE.b_index);   // write key to buffer
            SCOPE.b_index+=key_bin.byteLength;
        },
        addNull: (SCOPE:compiler_scope) => {
            
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.NULL;
        },
        addVoid: (SCOPE:compiler_scope) => {
            
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.VOID;
        },

        
        addFilter: (filter:Datex.Addresses.Filter, SCOPE:compiler_scope) => {
            let buffer = DatexCompiler.filterToDXB(filter);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1+buffer.byteLength, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.FILTER;
            SCOPE.uint8.set(new Uint8Array(buffer), SCOPE.b_index);
            SCOPE.b_index += buffer.byteLength;
        },

        addFilterTargetFromParts: (type:BinaryCode, name:string|Uint8Array, subspaces:string[], instance:string, appspace:Datex.Addresses.Endpoint, SCOPE:compiler_scope) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+4, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            const type_index = SCOPE.b_index;
            SCOPE.uint8[SCOPE.b_index++] = instance == "*" ? type+1 : type;
            let name_bin = (name instanceof Uint8Array) ? name : DatexCompiler.utf8_encoder.encode(name); 
            let instance_bin = DatexCompiler.utf8_encoder.encode(instance); 
            SCOPE.uint8[SCOPE.b_index++] = name_bin.byteLength; // write name length to buffer
            SCOPE.uint8[SCOPE.b_index++] = subspaces?.length ?? 0;  // write subspace number to buffer
            // instance length == 0 => wildcard, instance length == 255 => any instance
            SCOPE.uint8[SCOPE.b_index++] = instance ? (instance == "*" ? 0 : instance_bin.byteLength) : 255;  // write instance length to buffer
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+name_bin.byteLength, SCOPE);
            SCOPE.uint8.set(name_bin, SCOPE.b_index);  // write name to buffer
            SCOPE.b_index+=name_bin.byteLength;

            for (let subspace of subspaces ?? []) {
                // wildcard
                if (subspace == "*") {
                    SCOPE.uint8[SCOPE.b_index++] = 0;
                    SCOPE.uint8[type_index] = type + 1;
                }
                else {
                    let subspace_bin = DatexCompiler.utf8_encoder.encode(subspace); 
                    DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+subspace_bin.byteLength, SCOPE);
                    SCOPE.uint8[SCOPE.b_index++] = subspace_bin.byteLength;  // write subspace length to buffer
                    SCOPE.uint8.set(subspace_bin, SCOPE.b_index);  // write subspace_bin to buffer
                    SCOPE.b_index+=subspace_bin.byteLength;
                }
            }

            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+instance_bin.byteLength, SCOPE);

            // add instance if not wildcard
            if (instance != "*") {
                SCOPE.uint8.set(instance_bin, SCOPE.b_index);  // write instance to buffer
                SCOPE.b_index+=instance_bin.byteLength;
            }


            // append appspace?
            if (appspace) DatexCompiler.builder.addFilterTarget(appspace, SCOPE);

        },
        
        addPersonByNameAndChannel: (name:string, subspaces:string[], instance:string, appspace:Datex.Addresses.Endpoint, SCOPE:compiler_scope) => {
            DatexCompiler.builder.addFilterTargetFromParts(BinaryCode.PERSON_ALIAS, name, subspaces, instance, appspace, SCOPE);
        },
      
        addBotByNameAndChannel: (name:string, subspaces:string[], instance:string, appspace:Datex.Addresses.Endpoint, SCOPE:compiler_scope) => {
            DatexCompiler.builder.addFilterTargetFromParts(BinaryCode.BOT, name, subspaces, instance, appspace, SCOPE);
        },

    
        addInstitutionByNameAndChannel: (name:string, subspaces:string[], instance:string, appspace:Datex.Addresses.Endpoint, SCOPE:compiler_scope) => {
            DatexCompiler.builder.addFilterTargetFromParts(BinaryCode.INSTITUTION_ALIAS, name, subspaces, instance, appspace, SCOPE);
        },
       
        addIdEndpointByIdAndChannel: (id:Uint8Array, subspaces:string[], instance:string, appspace:Datex.Addresses.Endpoint, SCOPE:compiler_scope) => {
            DatexCompiler.builder.addFilterTargetFromParts(BinaryCode.ENDPOINT, id, subspaces, instance, appspace, SCOPE);
        },

        addBuffer: (buffer:Uint8Array, SCOPE:compiler_scope) => {
            
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1+Uint32Array.BYTES_PER_ELEMENT+buffer.byteLength, SCOPE);

            //console.log("codec " + codec, "buffer",buffer);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.BUFFER; 
            SCOPE.data_view.setUint32(SCOPE.b_index, buffer.byteLength, true);   // buffer length
            SCOPE.b_index += Uint32Array.BYTES_PER_ELEMENT;

            SCOPE.uint8.set(buffer, SCOPE.b_index);
            SCOPE.b_index += buffer.byteLength;
        },

        addFilterTarget: (el:Datex.Addresses.Target, SCOPE:compiler_scope) => {
            if (el instanceof Datex.Addresses.Institution) DatexCompiler.builder.addInstitutionByNameAndChannel(el.name, el.subspaces, el.instance, el.appspace, SCOPE);
            else if (el instanceof Datex.Addresses.Person) DatexCompiler.builder.addPersonByNameAndChannel(el.name, el.subspaces, el.instance, el.appspace, SCOPE);
            else if (el instanceof Datex.Addresses.Bot) DatexCompiler.builder.addBotByNameAndChannel(el.name, el.subspaces, el.instance, el.appspace, SCOPE);
            else if (el instanceof Datex.Addresses.IdEndpoint) DatexCompiler.builder.addIdEndpointByIdAndChannel(el.binary, el.subspaces, el.instance, el.appspace, SCOPE);
        },

        addTypeByNamespaceAndNameWithParams: async (SCOPE:compiler_scope, namespace:string, name:string, variation?:string, parameters?:Datex.Tuple) => {
            DatexCompiler.builder.addTypeByNamespaceAndName(SCOPE, namespace, name, variation, !!parameters);
       
            // insert parameters directly
            if (parameters instanceof Datex.Tuple) {
                DatexCompiler.builder.addArray(parameters, SCOPE);
            }
            else if (parameters) throw new Datex.CompilerError("Invalid type parameters");
        },

        addTypeByNamespaceAndName: (SCOPE:compiler_scope, namespace:string, name:string, variation?:string, parameters = false) => {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);

            DatexCompiler.builder.valueIndex(SCOPE);

            const is_extended_type = !!(variation || parameters);

            // short binary codes for std types
            if ((namespace == "std" || !namespace) && !is_extended_type) {
                switch (name) {
                    case "String": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_STRING;return;
                    case "Int": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_INT;return;
                    case "Float": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_FLOAT;return;
                    case "Boolean": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_BOOLEAN;return;
                    case "Null": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_NULL;return;
                    case "Void": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_VOID;return;
                    case "Buffer": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_BUFFER;return;
                    case "Datex": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_CODE_BLOCK;return;
                    case "Datex.Unit": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_UNIT;return;
                    case "Filter": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_FILTER;return;
                    case "Array": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_ARRAY;return;
                    case "Object": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_OBJECT;return;
                    case "Set": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_SET;return;
                    case "Map": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_MAP;return;
                    case "Tuple": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_TUPLE;return;
                    case "Function": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_FUNCTION;return;
                    case "Stream": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_STREAM;return;
                    case "Any": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_ANY;return;
                    case "Task": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_TASK;return;
                    case "Assertion": SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_ASSERTION;return;
                }
            }

            let name_bin = DatexCompiler.utf8_encoder.encode(name);  // convert type name to binary
            let ns_bin = DatexCompiler.utf8_encoder.encode(namespace);  // convert type namespace to binary
            let variation_bin = variation && DatexCompiler.utf8_encoder.encode(variation);  // convert type namespace to binary

            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+name_bin.byteLength+ns_bin.byteLength+2+(is_extended_type?2:0), SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = is_extended_type ? BinaryCode.EXTENDED_TYPE : BinaryCode.TYPE;  
            SCOPE.uint8[SCOPE.b_index++] = ns_bin.byteLength;
            SCOPE.uint8[SCOPE.b_index++] = name_bin.byteLength;

            if (is_extended_type) {
                SCOPE.uint8[SCOPE.b_index++] = variation_bin ? variation_bin.byteLength : 0;
                SCOPE.uint8[SCOPE.b_index++] = parameters?1:0;
            }

            SCOPE.uint8.set(ns_bin, SCOPE.b_index);  // write type namespace to buffer
            SCOPE.b_index+=ns_bin.byteLength;
            SCOPE.uint8.set(name_bin, SCOPE.b_index);  // write type name to buffer
            SCOPE.b_index+=name_bin.byteLength;
            if (variation) {
                SCOPE.uint8.set(variation_bin, SCOPE.b_index);  // write type variation to buffer
                SCOPE.b_index+=variation_bin.byteLength;
            }
        },

        
        addPointerBodyByID: (id:string|Uint8Array, SCOPE:compiler_scope) => {
            let id_bin = id instanceof Uint8Array ? id : Datex.Pointer.hex2buffer(id, Datex.Pointer.MAX_POINTER_ID_SIZE, true);  // convert pointer name to binary
            if (id_bin.byteLength > Datex.Pointer.MAX_POINTER_ID_SIZE) {
                throw new Datex.CompilerError("Pointer ID size must not exceed " + Datex.Pointer.MAX_POINTER_ID_SIZE + " bytes");
            }
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+Datex.Pointer.MAX_POINTER_ID_SIZE, SCOPE);
            SCOPE.uint8.set(id_bin, SCOPE.b_index);   // write pointer name to buffer
            SCOPE.b_index+=Datex.Pointer.MAX_POINTER_ID_SIZE;
        },

        addPointerByID: (SCOPE:compiler_scope, id:string|Uint8Array, action_type:ACTION_TYPE = ACTION_TYPE.GET, action_specifier?:BinaryCode) => {
            
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.POINTER + action_type;
            if (action_specifier != undefined) {
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = action_specifier;
            }
            DatexCompiler.builder.addPointerBodyByID(id, SCOPE);
        },

        addPointer: (p:Datex.Pointer, SCOPE:compiler_scope, action_type:ACTION_TYPE = ACTION_TYPE.GET, action_specifier?:BinaryCode) => {

            // pre extract per default
            if (SCOPE.insert_parent_scope_vars_default == 3 && action_type == ACTION_TYPE.GET) {
                const insert_new = DatexCompiler.builder.insertExtractedVariable(SCOPE, BinaryCode.POINTER, Datex.Pointer.buffer2hex(p.id_buffer));
                if (insert_new) DatexCompiler.builder.addPointerByID(SCOPE.extract_var_scope, p.id_buffer, action_type, action_specifier);
            }
            // add normally
            else DatexCompiler.builder.addPointerByID (SCOPE, p.id_buffer, action_type, action_specifier)
        },

        // add <Array> or <Tuple>
        addArray: (a:Array<any>, SCOPE:compiler_scope, is_root=true, parents:Set<any>=new Set(), unassigned_children:[number, any, number][]=[], start_index:[number]=[0]) => {
    
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = a instanceof Datex.Tuple ? BinaryCode.TUPLE_START : BinaryCode.ARRAY_START;

            // trim array (don't send unnecessary empty elements)
            let trimmed_length = Datex.Runtime.runtime_actions.getTrimmedArrayLength(a);

            let parent_var:number;

            // iterate over array elements
            for (let i = 0; i<trimmed_length; i++) {

                let val = a[i];
                // is recursive value?
                if (SCOPE.inserted_values.has(val) && parents.has(val)) {
                    // make sure variable for parent exists
                    parent_var = parent_var ?? DatexCompiler.builder.createInternalVariableAtIndex(start_index, SCOPE, a)
                    // get variable for the already-existing value
                    let value_index = SCOPE.inserted_values.get(val);
                    let existing_val_var = val == a ? parent_var : DatexCompiler.builder.createInternalVariableAtIndex(value_index, SCOPE, val)
                    unassigned_children.push([parent_var, BigInt(i), existing_val_var])
                    val = Datex.VOID; // insert void instead (array has to be filled at the right indices, need to insert some value at this index)
                }
                
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ELEMENT;  
                DatexCompiler.builder.insert(val, SCOPE, false, new Set(parents), unassigned_children); // shallow clone parents set
            }
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = a instanceof Datex.Tuple ? BinaryCode.TUPLE_END : BinaryCode.ARRAY_END;

            if (is_root && unassigned_children.length) DatexCompiler.builder.addChildrenAssignments(unassigned_children, SCOPE, start_index)
        },

        // add object or record
        addObject: (o:Object, SCOPE:compiler_scope, is_root=true, parents:Set<any>=new Set(), unassigned_children:[number, any, number][]=[], start_index:[number]=[0]) => {

            let entries = Object.entries(o);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = o instanceof Datex.Record ? BinaryCode.RECORD_START : BinaryCode.OBJECT_START;

            let parent_var:number;

            let ext_props:Set<string>;
            // TODO handle correctly when extending frozen object
            // first add extended objects if extended object
            if (o[Datex.EXTENDED_OBJECTS]) {
                if (o[Datex.INHERITED_PROPERTIES]) ext_props = o[Datex.INHERITED_PROPERTIES];
                for (let ext of o[Datex.EXTENDED_OBJECTS]||[]){
                    DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ELEMENT;
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.EXTEND;
                    DatexCompiler.builder.insert(ext, SCOPE, false, new Set(parents), unassigned_children); // shallow clone parents set
                }
            }
        
            for (let i = 0; i<entries.length; i++) {
                let [key,val] = entries[i];
                if (ext_props?.has(key)) continue; // ignore inherited properties

                // is recursive value?
                if (SCOPE.inserted_values.has(val) && parents.has(val)) {
                    // make sure variable for parent exists
                    parent_var = parent_var ?? DatexCompiler.builder.createInternalVariableAtIndex(start_index, SCOPE, o)
                    // get variable for the already-existing value
                    let value_index = SCOPE.inserted_values.get(val);
                    let existing_val_var = val == o ? parent_var : DatexCompiler.builder.createInternalVariableAtIndex(value_index, SCOPE, val)
                    unassigned_children.push([parent_var, key, existing_val_var])
                }
                else {
                    DatexCompiler.builder.addKey(key, SCOPE);
                    DatexCompiler.builder.insert(val, SCOPE, false, new Set(parents), unassigned_children); // shallow clone parents set
                }
               
            }
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = o instanceof Datex.Record ? BinaryCode.RECORD_END : BinaryCode.OBJECT_END;

            if (is_root && unassigned_children.length) DatexCompiler.builder.addChildrenAssignments(unassigned_children, SCOPE, start_index)
        },

        addChildrenAssignments: (unassigned_children:[number, any, number][], SCOPE:compiler_scope, root_start_index:[number]) => {
            // adds __123.xy = _456 - if has recursive assignments
            
            DatexCompiler.builder.insertByteAtIndex(BinaryCode.SUBSCOPE_START, root_start_index, SCOPE) // add (
            for (let assignment of unassigned_children) {
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CLOSE_AND_STORE;
                DatexCompiler.builder.insertVariable(SCOPE, assignment[0], ACTION_TYPE.GET, undefined, BinaryCode.INTERNAL_VAR); // parent
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CHILD_SET;
                DatexCompiler.builder.insert(assignment[1], SCOPE, true, undefined, undefined, false);  // insert key (don't save insert index for key value)
                DatexCompiler.builder.insertVariable(SCOPE, assignment[2], ACTION_TYPE.GET, undefined, BinaryCode.INTERNAL_VAR); // value
            }
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_END;  // add )
        },


        check_perm_prefix: (SCOPE:compiler_scope) => {
            // check if permission prefix (@xy x: ...)
            // start index is either last comma index or scope start index if no comma
            const start_index = (SCOPE.inner_scope.comma_indices ? SCOPE.inner_scope.comma_indices[SCOPE.inner_scope.comma_indices.length-1] : SCOPE.inner_scope.start_index) + 1;
            const permission_prefix = (SCOPE.b_index - start_index) != 0 && SCOPE.uint8[SCOPE.b_index-1] != BinaryCode.CLOSE_AND_STORE; // not a permission_prefix if command before (;)

            if (permission_prefix) {
                // replace ELEMENT byte (is not an element, but a permission prefix)
                if (SCOPE.uint8[start_index-1] == BinaryCode.ELEMENT) SCOPE.uint8[start_index-1] = BinaryCode.KEY_PERMISSION;
                // else insert byte (start of object/tuple)
                else DatexCompiler.builder.insertByteAtIndex(BinaryCode.KEY_PERMISSION, start_index, SCOPE);
            }
            return permission_prefix;
        },


        // detect Record
        detect_record: (SCOPE:compiler_scope) => {
            if (SCOPE.inner_scope.parent_type==undefined || SCOPE.inner_scope.parent_type == BinaryCode.SUBSCOPE_START) {
                // last ( bracket can be replaced with record bracket (if no commands before)
                if (SCOPE.inner_scope.parent_type == BinaryCode.SUBSCOPE_START && !SCOPE.inner_scope.has_ce) {
                    DatexCompiler.builder.change_inner_scope_parent_type(SCOPE, BinaryCode.RECORD_START)
                }
                // create new subscope
                else {
                    DatexCompiler.builder.enter_subscope(SCOPE, BinaryCode.RECORD_START);
                    SCOPE.inner_scope.auto_close_scope = BinaryCode.RECORD_END;
                }
            }
        },


        enter_subscope: (SCOPE:compiler_scope, type:BinaryCode|null = BinaryCode.SUBSCOPE_START, start_index?:number) => {

            // update parent scope value indices
            const parent_scope = SCOPE.subscopes[SCOPE.subscopes.length-1];
            parent_scope.last_value_index = SCOPE.b_index;  // last 'value' in parent scope is the new scope
            if (parent_scope.first_value_index == undefined) parent_scope.first_value_index = SCOPE.b_index;  // last 'value' in parent scope is the new scope
            if ('value_count' in parent_scope) parent_scope.value_count--; // update value count


            if (type !== null) {
                // start at current position
                if (start_index == undefined) {
                    DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
                    SCOPE.uint8[SCOPE.b_index++] = type;
                }
                // start at another position (earlier)
                else {
                    DatexCompiler.builder.insertByteAtIndex(type, start_index, SCOPE);
                }
            }

            SCOPE.inner_scope = {
                last_value_index: -1,
                start_index: start_index !=undefined ? start_index : SCOPE.b_index-1,
                wait_for_add: false,
                in_template_string: false,
                path_info_index: -1,
                parent_type: type,
                loop_start: parent_scope.loop_start // copy information from outer loop until overriden
            };
            SCOPE.subscopes.push(SCOPE.inner_scope);
        },

        exit_subscope: (SCOPE:compiler_scope, type:BinaryCode = BinaryCode.SUBSCOPE_END) => {

            // auto-close subscopes here?
            while (SCOPE.inner_scope.auto_close_scope!=undefined) {
                const type = SCOPE.inner_scope.auto_close_scope;
                delete SCOPE.inner_scope.auto_close_scope;
                DatexCompiler.builder.exit_subscope(SCOPE, type);
            }
            
            // check if code block close after outer ')'
            if (type == BinaryCode.SUBSCOPE_END && SCOPE._code_block_type==1 && SCOPE.subscopes.length == 1) {
                SCOPE.end = true;
                return true;
            } 

            // override subscope with tuple/record end bracket
            if (SCOPE.inner_scope.parent_type == BinaryCode.TUPLE_START && type == BinaryCode.SUBSCOPE_END) type = BinaryCode.TUPLE_END;
            if (SCOPE.inner_scope.parent_type == BinaryCode.RECORD_START && type == BinaryCode.SUBSCOPE_END) type = BinaryCode.RECORD_END;

            if (SCOPE.inner_scope.parent_type == BinaryCode.OBJECT_START && type != BinaryCode.OBJECT_END) throw new Datex.SyntaxError("Missing closing object bracket");
            if (SCOPE.inner_scope.parent_type == BinaryCode.ARRAY_START && type != BinaryCode.ARRAY_END)  throw new Datex.SyntaxError("Missing closing array bracket");
            if (SCOPE.inner_scope.parent_type == BinaryCode.SUBSCOPE_START && type != BinaryCode.SUBSCOPE_END)  throw new Datex.SyntaxError("Missing closing bracket");

            // cannot close subscope (already in outer scope)
            if (SCOPE.subscopes.length == 1) {
                if (type == BinaryCode.OBJECT_END) throw new Datex.SyntaxError("Invalid closing object bracket");
                if (type == BinaryCode.ARRAY_END)  throw new Datex.SyntaxError("Invalid closing array bracket");
                if (type == BinaryCode.SUBSCOPE_END)  throw new Datex.SyntaxError("Invalid closing bracket");
            }


            if (type !== null) {

                // override trailing comma(s) if <Array>, <Tuple>, <Record> or <Object>
                if (SCOPE.inner_scope.comma_indices?.length && type !== BinaryCode.SUBSCOPE_END) {
                    let comma_index:number;
                    while ((comma_index = SCOPE.inner_scope.comma_indices.pop()) == SCOPE.b_index-1) SCOPE.b_index--;
                }
                
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = type;
            }

            SCOPE.subscopes.pop();
            SCOPE.inner_scope = SCOPE.subscopes[SCOPE.subscopes.length-1];
        },

        change_inner_scope_parent_type: (SCOPE:compiler_scope, type:BinaryCode = BinaryCode.TUPLE_START) => {
            SCOPE.inner_scope.parent_type = type;
            SCOPE.uint8[SCOPE.inner_scope.start_index] = type;
        },

        // \n -> \u00A,  \ -> '',  \\ -> \
        unescape_string: (str:string):string => str
            // special escape characters
            .replace(Regex.ESCAPE_BACKSPACE, '\b') 
            .replace(Regex.ESCAPE_LINE_FEED, '\n')
            .replace(Regex.ESCAPE_FORM_FEED, '\f')
            .replace(Regex.ESCAPE_CARRIAGE_RETURN, '\r')
            .replace(Regex.ESCAPE_HORIZONTAL_TAB, '\t')
            .replace(Regex.ESCAPE_VERTICAL_TAB, '\v')
            
            .replace(Regex.ESCAPE_OCTAL, (_,x)=>{  // \nnn
                let code = parseInt(x,8);
                if (code >= 256) return x; // max octal representation, just return string (TODO not properly handled, should return valid part of octal escape code)
                return String.fromCharCode(code)
            })
            .replace(Regex.ESCAPE_UNICODE, (_,x)=>{  // \unnnn
                let code = parseInt(x,16);
                if (isNaN(code) || x.length!=4 || !x.match(Regex.HEX_STRING)) throw new Datex.SyntaxError("Invalid Unicode escape sequence");
                return String.fromCharCode(code)
            })
            .replace(Regex.ESCAPE_HEX, (_,x)=>{  // \xnn
                let code = parseInt(x,16);
                if (isNaN(code) || x.length!=2 || !x.match(Regex.HEX_STRING)) throw new Datex.SyntaxError("Invalid hexadecimal escape sequence");
                return String.fromCharCode(code)
            })
            // ignore all other sequences, just return the character
            .replace(Regex.ESCAPE_SEQUENCE, '$1'),


        // serialize values, but use cached values for this scope
        serializeValue: (v:any, SCOPE:compiler_scope):any => {
            if (SCOPE.serialized_values.has(v)) return SCOPE.serialized_values.get(v);
            else {
                let s = Datex.Runtime.serializeValue(v);
                SCOPE.serialized_values.set(v,s);
                return s;
            }
        },

        insert: (value:any, SCOPE:compiler_scope, is_root=true, parents?:Set<any>, unassigned_children?:[number, any, number][], add_insert_index = true) => {


            // same value already inserted -> refer to the value with an internal variable
            if (add_insert_index && SCOPE.inserted_values?.has(value)) {
                // get variable for the already-existing value
                let value_index = SCOPE.inserted_values.get(value);
                let existing_val_var = DatexCompiler.builder.createInternalVariableAtIndex(value_index, SCOPE, value)
                // set internal var at current index
                DatexCompiler.builder.insertVariable(SCOPE, existing_val_var, ACTION_TYPE.GET, undefined, BinaryCode.INTERNAL_VAR);
                return;
            }

            // handle <Stream> and ReadableStream, if streaming (<<)
            if ((value instanceof Datex.Stream || value instanceof ReadableStream) && SCOPE.uint8[SCOPE.b_index-1] == BinaryCode.STREAM) return DatexCompiler.builder.handleStream(value, SCOPE); 
 
            // get dynamic index for start of value
            let start_index = DatexCompiler.builder.getDynamicIndex(SCOPE.b_index, SCOPE);

            // add original value to inserted values map (only if useful, exclude short values like boolean and null)
            if (value!==Datex.VOID && 
                value !==null && 
                typeof value != "boolean" &&
                !((typeof value == "bigint" || typeof value == "number") && value<=DatexCompiler.MAX_INT_32 && value>=DatexCompiler.MIN_INT_32)
            ) {
                SCOPE.inserted_values.set(value, start_index) 
            }

            let type:Datex.Type
            let original_value = value;

            // exception for functions: convert to Datex.Function & create Pointer reference
            if (value instanceof Function && !(value instanceof Datex.Function)) value = Datex.Pointer.proxifyValue(new Datex.Function(value, null, SCOPE.options.to));

            // is not a Datex.Error -> convert to Datex.Error
            if (value instanceof Error && !(value instanceof Datex.Error)) {
                value = new Datex.Error(value.message, [[Datex.Runtime.endpoint, "[native] " + value.name]])
            }

            // serialized value -> reconstruct type and serialized value
            if (value instanceof Datex.SerializedValue) {
                [type, value] = value.getSerialized();

                // add type if exists and !pointer
                if (type?.is_complex && type != Datex.Type.std.Function) DatexCompiler.builder.addTypeByNamespaceAndNameWithParams(SCOPE, type.namespace, type.name, type.variation, type.parameters);
            }

            // normal value (pointer or value)
            else {
                // proxify to pointer 
                value = Datex.Pointer.pointerifyValue(value);

                const no_proxify = value instanceof Datex.Value && ((value instanceof Datex.Pointer && value.is_anonymous) || SCOPE.options.collapse_pointers || SCOPE.options.collapse_first_inserted);

                // proxify exceptions:
                if (no_proxify) {
                    // add $$ operator
                    if (SCOPE.options.collapse_pointers && !SCOPE.options.no_create_pointers) SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CREATE_POINTER;
                    value = value.value; // don't proxify anonymous pointers or serialize ptr
                    if (SCOPE.options.collapse_first_inserted) SCOPE.options.collapse_first_inserted = false; // reset
                }
                 
                // serialize if not pointer
                if (!(value instanceof Datex.Pointer)) {
                    // Check for Complex types
                    // get datex type first
                    type = Datex.Type.getValueDatexType(value);
                    
                    if (!type) throw new Datex.ValueError("Cannot get type for value " + value)

                    // convert to <type> + serialized object ;
                    if (type?.is_complex && type != Datex.Type.std.Function) {
                        DatexCompiler.builder.addTypeByNamespaceAndNameWithParams(SCOPE, type.namespace, type.name, type.variation, type.parameters);
                        value = DatexCompiler.builder.serializeValue(value, SCOPE);
                    }
                    else if (type?.serializable_not_complex) { // for UintArray Buffers
                        value = DatexCompiler.builder.serializeValue(value, SCOPE);
                    }

                    // try to proxify serialized value again to pointer (proxify exceptions!) 
                    if (!no_proxify) value = Datex.Pointer.pointerifyValue(value);
                }
             
            }

            // only fundamentals here:
            if (value instanceof Datex.Unit)            return DatexCompiler.builder.addUnit(value, SCOPE); // UNIT
            if (value===Datex.VOID)                     return DatexCompiler.builder.addVoid(SCOPE); // Datex.VOID
            if (value===null)                           return DatexCompiler.builder.addNull(SCOPE); // NULL
            if (typeof value == 'bigint')               return DatexCompiler.builder.addInt(value, SCOPE); // INT
            if (typeof value == 'number')               return DatexCompiler.builder.addFloat(value, SCOPE); // FLOAT
            if (typeof value == "string")               return DatexCompiler.builder.addString(value, SCOPE); // STRING
            if (typeof value == "boolean")              return DatexCompiler.builder.addBoolean(value, SCOPE); // BOOLEAN
            if (value instanceof URL)                   return DatexCompiler.builder.addUrl(value.href, SCOPE); // URL

            if (value instanceof Datex.PointerProperty) {
                // $pointer
                DatexCompiler.builder.addPointer(value.pointer, SCOPE);
                // ->
                let _SCOPE = (SCOPE.insert_parent_scope_vars_default >= 2) ? SCOPE.extract_var_scope : SCOPE;
                DatexCompiler.builder.handleRequiredBufferSize(_SCOPE.b_index, _SCOPE);
                _SCOPE.inner_scope.path_info_index = _SCOPE.b_index++;
                _SCOPE.uint8[_SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_GET_REF;
                // key
                DatexCompiler.builder.insert(value.key, _SCOPE);
                return;
            }
            if (value instanceof Datex.Pointer)      {
                // pointer action follows (if not a path property)?
                if (SCOPE.inner_scope.path_info_index == -1) {
                    let m:RegExpMatchArray;
                    let action_type:ACTION_TYPE = ACTION_TYPE.GET;
                    let action_specifier:number = undefined;
                    SCOPE.datex = SCOPE.datex?.replace(/^[^\S\n]+/, ""); // clear whitespaces
                    // match =, +=, -=
                    if ((m = SCOPE.datex?.match(Regex.ASSIGN_SET)) && SCOPE.datex[1]!="=") { // make sure it is '=', not '=='
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
                        // pointer get
                        if (SCOPE.options.inserted_ptrs) SCOPE.options.inserted_ptrs.add(value)
                    }
                    return DatexCompiler.builder.addPointer(value, SCOPE, action_type, action_specifier); // POINTER (assignment)
                }
                else {
                    if (SCOPE.options.inserted_ptrs) SCOPE.options.inserted_ptrs.add(value)
                    return DatexCompiler.builder.addPointer(value, SCOPE); // POINTER
                }
            }
            if (value instanceof Datex.Addresses.WildcardTarget) return DatexCompiler.builder.addFilterTarget(value.target, SCOPE); // Filter Target: ORG, APP, LABEL, ALIAS
            if (value instanceof Datex.Addresses.Endpoint) return DatexCompiler.builder.addFilterTarget(value, SCOPE); // Filter Target: ORG, APP, LABEL, ALIAS
            if (value instanceof Datex.Addresses.Filter)       return DatexCompiler.builder.addFilter(value, SCOPE); // Complex Filter
            if (value instanceof Datex.Type) {
                DatexCompiler.builder.addTypeByNamespaceAndNameWithParams(SCOPE, value.namespace, value.name, value.variation, value.parameters); // Datex.Type
                if (value.parameters) DatexCompiler.builder.insert(value.parameters, SCOPE);
                return;
            }
            if (value instanceof Uint8Array)        return DatexCompiler.builder.addBuffer(value, SCOPE); // Uint8Array
            if (value instanceof ArrayBuffer)       return DatexCompiler.builder.addBuffer(new Uint8Array(value), SCOPE); // Buffer
            if (value instanceof Datex.Function) { // Datex Function
                // insert scope block
                DatexCompiler.builder.insert(value.params, SCOPE);
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.FUNCTION;
                // internal scope variables
                for (let variable of value.datex?.internal_vars??[]) {
                    DatexCompiler.builder.insert(variable, SCOPE);
                }
                
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1+Uint32Array.BYTES_PER_ELEMENT+(value.datex?.compiled?.byteLength??0), SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SCOPE_BLOCK;
                SCOPE.data_view.setUint32(SCOPE.b_index, value.datex?.compiled?.byteLength??0, true);
                SCOPE.b_index += Uint32Array.BYTES_PER_ELEMENT
                if (value.datex?.compiled) {
                    SCOPE.uint8.set(new Uint8Array(value.datex.compiled), SCOPE.b_index)
                    SCOPE.b_index += value.datex.compiled.byteLength;
                }
                return;
            }

            // complex objects (with recursion)
            if (value instanceof Array) { 
                // add current value to parents list
                if (!parents) parents = new Set();
                parents.add(original_value);
                return DatexCompiler.builder.addArray(value, SCOPE, is_root, parents, unassigned_children, start_index);
            } 
            if (typeof value == "object")  {
                // add current value to parents list
                if (!parents) parents = new Set();
                parents.add(original_value);         
                return DatexCompiler.builder.addObject(value, SCOPE, is_root, parents, unassigned_children, start_index);
            }

            // convert symbols to Datex.VOID (not supported) TODO create pointers for symbols (custom class)?
            if (typeof value == "symbol") {
                return DatexCompiler.builder.addVoid(SCOPE); // Datex.VOID
            }
            else {
                console.error("Unsupported native value", value);
                throw new Datex.ValueError("Failed to compile an unsupported native type")
            }
        }


    }


    static async parseNextExpression (SCOPE:compiler_scope) {
        let m:RegExpMatchArray;

        let last_command_end = SCOPE.last_command_end; // remember last command

        SCOPE.datex = SCOPE.datex.replace(/^[^\S\n]+/, ""); //(/^[^\S\r\n]+/
        SCOPE.last_command_end = false; // reset 'last command was ;'
        
        let isEffectiveValue = false;

        // END 
        if (!SCOPE.datex) {
            SCOPE.end = true;
            SCOPE.last_command_end = last_command_end; // last command still valid
        }

        else if (m = SCOPE.datex.match(Regex.URL)) {   
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.addUrl(m[0], SCOPE);
            isEffectiveValue = true;
        }

        // INSERT data (?)
        else if (m = SCOPE.datex.match(Regex.INSERT)) {                
            SCOPE.datex = SCOPE.datex.substring(m[0].length); 

            if (SCOPE.current_data_index == undefined) SCOPE.current_data_index = 0;

            const d_index = m[1] ? parseInt(m[1]) : SCOPE.current_data_index++;

            // precompiling, don't insert a value
            if (SCOPE.precompiled) {
                // add buffer if not size 0
                if (SCOPE.b_index-(SCOPE.last_precompiled??0) != 0) SCOPE.precompiled.appendBufferPlaceholder(SCOPE.last_precompiled??0,SCOPE.b_index);
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



        // KEY  (check before variable and keywords!, only if not in :: filter)
        else if (m = SCOPE.datex.match(Regex.KEY)) {   
            if (SCOPE.inner_scope.parent_type == BinaryCode.ARRAY_START) throw new Datex.SyntaxError("Invalid key in <Array>");
            // convert tuple to record
            if (SCOPE.inner_scope.parent_type == BinaryCode.TUPLE_START) DatexCompiler.builder.change_inner_scope_parent_type(SCOPE, BinaryCode.RECORD_START)
            if (SCOPE.inner_scope.auto_close_scope == BinaryCode.TUPLE_END) SCOPE.inner_scope.auto_close_scope = BinaryCode.RECORD_END;

            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

            let key = m[0].substring(0,m[0].length-1).trim(); // get key

            // check/add  permission prefix (@xy x: ...)
            const permission_prefix = DatexCompiler.builder.check_perm_prefix(SCOPE);
            
            // override current BinaryCode.ELEMENT
            if (!permission_prefix && SCOPE.inner_scope.first_element_pos!=undefined) SCOPE.b_index = SCOPE.inner_scope.first_element_pos;

            DatexCompiler.builder.detect_record(SCOPE);
            DatexCompiler.builder.addKey(key, SCOPE);
            isEffectiveValue = true;
        }


        // END
        else if (m = SCOPE.datex.match(Regex.END)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.END;
        }

        // REQUEST
        else if (m = SCOPE.datex.match(Regex.REQUEST)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.REQUEST;
        }

        // COUNT
        else if (m = SCOPE.datex.match(Regex.COUNT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.COUNT;
        }

        // ABOUT
        else if (m = SCOPE.datex.match(Regex.ABOUT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ABOUT;
        }

        // RETURN
        else if (m = SCOPE.datex.match(Regex.RETURN)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.RETURN;
        }

        // ITERATION
        else if (m = SCOPE.datex.match(Regex.ITERATION)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ITERATION;
        }


        // ITERATOR
        else if (m = SCOPE.datex.match(Regex.ITERATOR)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ITERATOR;
        }

        // SKIP
        else if (m = SCOPE.datex.match(Regex.SKIP)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            if (!('loop_start' in  SCOPE.inner_scope)) throw new Datex.CompilerError("Invalid 'skip' command");
            DatexCompiler.builder.addJmp(SCOPE, BinaryCode.JMP, SCOPE.inner_scope.loop_start);
            DatexCompiler.builder.valueIndex(SCOPE);
        }

        // ITERATE
        else if (m = SCOPE.datex.match(Regex.ITERATE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            SCOPE.inner_scope.iterate = 0;
            SCOPE.inner_scope.value_count = 1; 

            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_START;

            // #iter = iterator
            DatexCompiler.builder.insertVariable(SCOPE, 'iter', ACTION_TYPE.SET, undefined, BinaryCode.INTERNAL_VAR);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ITERATOR;
        }

        // WHILE
        else if (m = SCOPE.datex.match(Regex.WHILE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            SCOPE.inner_scope.while = SCOPE.b_index+1;
            SCOPE.inner_scope.loop_start = SCOPE.b_index+1;
            SCOPE.inner_scope.value_count = 1; 

            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_START;
            // add jfa
            DatexCompiler.builder.addJmp(SCOPE,  BinaryCode.JFA);
        }

        // IF
        else if (m = SCOPE.datex.match(Regex.ELSE_IF)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);

            // is else if 
            if (m[1]) {
                // no previous if
                if (!SCOPE.inner_scope.if_end_indices?.length) throw new Datex.CompilerError("Invalid else-if statement - no preceding if statement");
                SCOPE.b_index--; // override SUBSCOPE_END
            }

            // is only if
            else {
                DatexCompiler.builder.valueIndex(SCOPE); // new value start
            }

            SCOPE.inner_scope.value_count = 2; 

            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1+Uint32Array.BYTES_PER_ELEMENT, SCOPE);
            if (!m[1]) SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_START; // start subscope only if first 'if'

            SCOPE.inner_scope.if = SCOPE.b_index;
 
            // add jfa
            DatexCompiler.builder.addJmp(SCOPE,  BinaryCode.JFA);
        }

        // ELSE
        else if (m = SCOPE.datex.match(Regex.ELSE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);

            // is no previous if
            if (!SCOPE.inner_scope.if_end_indices?.length) throw new Datex.CompilerError("Invalid else statement - no preceding if statement");

            SCOPE.b_index--; // override previous SUBSCOPE_END

            SCOPE.inner_scope.else = true;
            SCOPE.inner_scope.value_count = 1; 
        }

        // FUN
        else if (m = SCOPE.datex.match(Regex.FUN)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // remove fun
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_FUNCTION;
            isEffectiveValue = true;
        }

        // \n
        else if (m = SCOPE.datex.match(/^\n/)) {
            SCOPE.current_line_nr++;
            SCOPE.datex = SCOPE.datex.substring(m[0].length);
            SCOPE.last_command_end = last_command_end; // last command still valid
        }           
     
        // COMMENT - before ASSIGN, ...
        else if (m = SCOPE.datex.match(Regex.COMMENT)) {               
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // remove comment
            SCOPE.current_line_nr += m[0].split(/\r\n|\r|\n/).length - 1 // add nr of lines
            SCOPE.last_command_end = last_command_end; // last command still valid
        }

        // Datex.VOID (check before variable!)
        else if (m = SCOPE.datex.match(Regex.VOID)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.addVoid(SCOPE);
            isEffectiveValue = true;
        }

        // // CODE BLOCK (before CODE BLOCK NO ARGS)
        // else if (m = SCOPE.datex.match(Regex.CODE_BLOCK_START)) {
        //     SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

        //     let return_data = {datex: SCOPE.datex};
        //     // compiled always needs to be an ArrayBuffer, not a ReadableStream
        //     let compiled = <ArrayBuffer> await this.compile(return_data, SCOPE.data, {}, false, false, 0, undefined, Infinity, m[6]?1:2, SCOPE.current_data_index);
        //     SCOPE.datex = return_data.datex; // update position in current datex script

        //     const args_template = DatexCompiler.builder.getArgsTemplate(m[1], SCOPE);
            
        //     DatexCompiler.builder.addCodeBlock(compiled, args_template, SCOPE);
        // }

        // // CODE BLOCK SINGLE ARG (before CODE BLOCK NO ARGS)
        // else if (m = SCOPE.datex.match(Regex.CODE_BLOCK_START_SINGLE_ARG)) {
        //     SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

        //     let return_data = {datex: SCOPE.datex};
        //     // compiled always needs to be an ArrayBuffer, not a ReadableStream
        //     let compiled = <ArrayBuffer> await this.compile(return_data, SCOPE.data, {}, false, false, 0, undefined, Infinity, m[2]?1:2, SCOPE.current_data_index);
        //     SCOPE.datex = return_data.datex; // update position in current datex script

        //     const args_template = DatexCompiler.builder.getArgsTemplate(m[1], SCOPE);

        //     DatexCompiler.builder.addCodeBlock(compiled, args_template, SCOPE);
        // }


        // REMOTE CALL (::) 
        else if (m = SCOPE.datex.match(Regex.REMOTE_CALL)) {
            if (SCOPE._code_block_type==2 && SCOPE.subscopes.length==1) { // in outer scope and single line block?
                SCOPE.end = true;
                if (last_command_end) SCOPE.last_command_end = true; // last command is still the last command
                return;
            }

            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

            await DatexCompiler.builder.addScopeBlock(BinaryCode.REMOTE, !!m[1], 0, SCOPE)
        }

        // TRANSFORM
        else if (m = SCOPE.datex.match(Regex.TRANSFORM)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            await DatexCompiler.builder.addScopeBlock(BinaryCode.TRANSFORM, !!m[1], 3, SCOPE)
        }


        // Datex.VOID (empty brackets)
        else if (m = SCOPE.datex.match(Regex.QUASI_VOID)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.addVoid(SCOPE);
            isEffectiveValue = true;
        }

        // SUBSCOPE START
        else if (m = SCOPE.datex.match(Regex.SUBSCOPE_START)) {        
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
         
            DatexCompiler.builder.enter_subscope(SCOPE);
        } 

    

        // SYNC (<<<) before stream
        else if (m = SCOPE.datex.match(Regex.SYNC)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SYNC;
        }

        // STOP_SYNC (<</)
        else if (m = SCOPE.datex.match(Regex.STOP_SYNC)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STOP_SYNC;
        }

        
        // STREAM (before type and <=)
        else if (m = SCOPE.datex.match(Regex.STREAM)) {               
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STREAM;
        }

        // STOP_STREAM
        else if (m = SCOPE.datex.match(Regex.STOP_STREAM)) {               
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STOP_STREAM;
        }

        // TYPE (before <)
        else if (m = SCOPE.datex.match(Regex.TYPE)) {               
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            // is parameterized type
            if (m[4] == "(") {
                SCOPE.datex = "(" + SCOPE.datex;
                SCOPE.inner_scope.param_type_close = true;
                DatexCompiler.builder.addTypeByNamespaceAndName(SCOPE, m[1], m[2], m[3]?.slice(1), true);
            }
            // normal type
            else DatexCompiler.builder.addTypeByNamespaceAndName(SCOPE, m[1], m[2], m[3]?.slice(1))
        }

        // COMPARE 
        // ===
        else if (m = SCOPE.datex.match(Regex.EQUAL)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.EQUAL;
        }
        // ~==
        else if (m = SCOPE.datex.match(Regex.NOT_EQUAL)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.NOT_EQUAL;
        }
        // ==
        else if (m = SCOPE.datex.match(Regex.EQUAL_VALUE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.EQUAL_VALUE;
        }
        // ~=
        else if (m = SCOPE.datex.match(Regex.NOT_EQUAL_VALUE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.NOT_EQUAL_VALUE;
        }
        // >=
        else if (m = SCOPE.datex.match(Regex.GREATER_EQUAL)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.GREATER_EQUAL;
        }
        // <=
        else if (m = SCOPE.datex.match(Regex.LESS_EQUAL)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.LESS_EQUAL;
        }
        // >
        else if (m = SCOPE.datex.match(Regex.GREATER)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

            // is type close )>, ignore
            if (SCOPE.inner_scope.param_type_close) {
                SCOPE.inner_scope.param_type_close = false;
            }
            // is greater >
            else {
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.GREATER;
            }
        }
      
        // <
        else if (m = SCOPE.datex.match(Regex.LESS)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.LESS;
        }
      
    
        // THROW_ERROR (!)
        else if (m = SCOPE.datex.match(Regex.THROW_ERROR)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            

            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.THROW_ERROR;  
        }

        // SPREAD (...) = <Tuple>/<Record>
            else if (m = SCOPE.datex.match(Regex.SPREAD)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.EXTEND;
        }

        // Range (..) => <Tuple>
        else if (m = SCOPE.datex.match(Regex.RANGE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.insertByteAtIndex(BinaryCode.RANGE, SCOPE.inner_scope.last_value_index, SCOPE)
        }
  
        // PATH_SEPERATOR (.)
        else if (m = SCOPE.datex.match(Regex.PATH_SEPERATOR)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
         
            //SCOPE.inner_scope.current_path_depth++;
            //DatexCompiler.builder.handle_path(SCOPE);

            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.inner_scope.path_info_index = SCOPE.b_index++;
            SCOPE.uint8[SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_GET;

            // if '.' before:  WILDCARD (.*)
            if (m = SCOPE.datex.match(Regex.WILDCARD)) {               
                SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
                
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.WILDCARD;
                isEffectiveValue = true;
            }
            // default property key (string)
            else if (m = SCOPE.datex.match(Regex.PROPERTY)) {               
                SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
                
                DatexCompiler.builder.addString(m[0], SCOPE);
                isEffectiveValue = true;
            }
        }

        // PATH_REF_SEPERATOR (->)
        else if (m = SCOPE.datex.match(Regex.PATH_REF_SEPERATOR)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            
            const wildcard = SCOPE.datex.match(Regex.WILDCARD);

            // normal scope or extract_var_scope
            let _SCOPE = (SCOPE.insert_parent_scope_vars_default >= 2 && !wildcard) ? SCOPE.extract_var_scope : SCOPE;

            DatexCompiler.builder.handleRequiredBufferSize(_SCOPE.b_index, _SCOPE);
            _SCOPE.inner_scope.path_info_index = _SCOPE.b_index++;
            _SCOPE.uint8[_SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_GET_REF;

            // if '->' before:  WILDCARD (->*)
            if (wildcard) {               
                SCOPE.datex = SCOPE.datex.substring(wildcard[0].length);  // pop datex
                
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.WILDCARD;
            }
            // default property key (string)
            else if (m = SCOPE.datex.match(Regex.PROPERTY)) {               
                SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
                
                DatexCompiler.builder.addString(m[0], _SCOPE);
            }
        }


        // JMP instructions
        else if (m = SCOPE.datex.match(Regex.JUMP)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            let jmp_label = m[2]

            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+5, SCOPE);
            
            DatexCompiler.builder.valueIndex(SCOPE);

            let jmp_to:number;
            let type = m[1] == "jmp" ?  BinaryCode.JMP : ( m[1] == "jtr" ? BinaryCode.JTR : BinaryCode.JFA);

            // label was before
            if (Object.keys(SCOPE.jmp_label_indices).includes(jmp_label)) {
                SCOPE.used_lbls.push(jmp_label)
                jmp_to = SCOPE.jmp_label_indices[jmp_label][0];
            }
            // wait until label index resolved
            else { 
                if (!SCOPE.indices_waiting_for_jmp_lbl[jmp_label]) SCOPE.indices_waiting_for_jmp_lbl[jmp_label] = []
                SCOPE.indices_waiting_for_jmp_lbl[jmp_label].push(DatexCompiler.builder.getDynamicIndex(SCOPE.b_index+1, SCOPE)); 
            }
            
            // add jmp
            DatexCompiler.builder.addJmp(SCOPE, type, jmp_to);
        }

        // JMP label
        else if (m = SCOPE.datex.match(Regex.JUMP_LBL)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            let jmp_label = m[1]
            SCOPE.jmp_label_indices[jmp_label] = DatexCompiler.builder.getDynamicIndex(SCOPE.b_index, SCOPE);

            if (SCOPE.used_lbls.includes(jmp_label)) throw new Datex.CompilerError("Multiple use of label: " + jmp_label);
            
            // resolve index for earlier jumps
            if (SCOPE.indices_waiting_for_jmp_lbl[jmp_label]) {
                for (let [i] of SCOPE.indices_waiting_for_jmp_lbl[jmp_label]) {
                    SCOPE.data_view.setUint32(i, SCOPE.b_index, true); // insert label index  
                }
                delete SCOPE.indices_waiting_for_jmp_lbl[jmp_label];
                SCOPE.used_lbls.push(jmp_label)
            }

            // cache dxb from here on when executing (might need to jump to this position later on)
            if (SCOPE.last_cache_point == undefined) {
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
                SCOPE.last_cache_point = SCOPE.b_index
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CACHE_POINT;
            }

        }

        // USE static scope (check before variable!)
        else if (m = SCOPE.datex.match(Regex.USE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+2, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            
            // #root +=
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.VAR_ROOT_ACTION;  
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ADD;
            
            // (#root = #static;
            DatexCompiler.builder.enter_subscope(SCOPE, BinaryCode.SUBSCOPE_START);
            SCOPE.inner_scope.auto_close_scope = BinaryCode.SUBSCOPE_END;
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+6, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SET_VAR_ROOT;
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.VAR_STATIC;
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CLOSE_AND_STORE;

            // make sure the following value is a <Record>
            //SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_RECORD;
        }

        
        // BOOLEAN (check before variable!)
        else if (m = SCOPE.datex.match(Regex.BOOLEAN)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.addBoolean(m[0] == "true" ? true : false, SCOPE);
            isEffectiveValue = true;
        }

        // NULL (check before variable!)
        else if (m = SCOPE.datex.match(Regex.NULL)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.addNull(SCOPE);
            isEffectiveValue = true;
        }

        // EMPTY_ARRAY (shortcut)
        else if (m = SCOPE.datex.match(Regex.EMPTY_ARRAY)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+2, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_ARRAY;
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.VOID;
            isEffectiveValue = true;
        }

        // EMPTY_OBJECT (shortcut)
        else if (m = SCOPE.datex.match(Regex.EMPTY_OBJECT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+2, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.STD_TYPE_OBJECT;
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.VOID;
            isEffectiveValue = true;
        }


        // ARRAY_START
        else if (m = SCOPE.datex.match(Regex.ARRAY_START)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.enter_subscope(SCOPE, BinaryCode.ARRAY_START);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            SCOPE.inner_scope.first_element_pos = SCOPE.b_index;
            DatexCompiler.builder.commaIndex(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ELEMENT;  

        }

        // ARRAY_END
        else if (m = SCOPE.datex.match(Regex.ARRAY_END)) {
            if (SCOPE._code_block_type==2 && SCOPE.subscopes.length==1) { // in outer scope and single line block?
                SCOPE.end = true;
                if (last_command_end) SCOPE.last_command_end = true; // last command is still the last command
                return;
            } 
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

            DatexCompiler.builder.exit_subscope(SCOPE, BinaryCode.ARRAY_END);
            isEffectiveValue = true;
            //DatexCompiler.builder.close_current_path(SCOPE); // new path scope
        }


        // TEMPLATE STRING (before OBJECT_END) '... (
        else if (!SCOPE.inner_scope.in_template_string && (m = SCOPE.datex.match(Regex.TSTRING_START))) {                            
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

            const escaped_string = m[0].substring(1,m[0].length-1);
            SCOPE.current_line_nr += escaped_string.split(/\r\n|\r|\n/).length - 1 // add nr of lines
            let str = DatexCompiler.builder.unescape_string(escaped_string);
            

            SCOPE.inner_scope.in_template_string = true;

            DatexCompiler.builder.enter_subscope(SCOPE); // outer subscope

            // add string if it is not empty
            if (str.length) {
                DatexCompiler.builder.addString(str, SCOPE);
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ADD;
            }
  
            DatexCompiler.builder.addTypeByNamespaceAndName(SCOPE, "std", "String");
            DatexCompiler.builder.enter_subscope(SCOPE);
        }

        // ) ... (
        else if (SCOPE.subscopes[SCOPE.subscopes.length-3]?.in_template_string && (m = SCOPE.datex.match(Regex.TSTRING_B_CLOSE))) {                            
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

            const escaped_string = m[0].substring(1,m[0].length-1);
            SCOPE.current_line_nr += escaped_string.split(/\r\n|\r|\n/).length - 1 // add nr of lines
            let str = DatexCompiler.builder.unescape_string(escaped_string);

            DatexCompiler.builder.exit_subscope(SCOPE);

            if (str.length) {
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ADD;
                DatexCompiler.builder.addString(str, SCOPE);
            }

            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ADD;
            DatexCompiler.builder.addTypeByNamespaceAndName(SCOPE, "std", "String");

            DatexCompiler.builder.enter_subscope(SCOPE);
        }

        // ) ... '
        else if (SCOPE.subscopes[SCOPE.subscopes.length-3]?.in_template_string && (m = SCOPE.datex.match(Regex.TSTRING_END))) {                            
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

            const escaped_string = m[0].substring(1,m[0].length-1);
            SCOPE.current_line_nr += escaped_string.split(/\r\n|\r|\n/).length - 1 // add nr of lines
            let str = DatexCompiler.builder.unescape_string(escaped_string);

            DatexCompiler.builder.exit_subscope(SCOPE);

            // only add string if not empty
            if (str.length) {
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ADD;
            
                DatexCompiler.builder.addString(str, SCOPE);
            }
          

            DatexCompiler.builder.exit_subscope(SCOPE); // outer subscope

            SCOPE.inner_scope.in_template_string = false;
            isEffectiveValue = true;
        }


        // OBJECT_START
        else if (m = SCOPE.datex.match(Regex.OBJECT_START)) {           
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.enter_subscope(SCOPE, BinaryCode.OBJECT_START);
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            SCOPE.inner_scope.first_element_pos = SCOPE.b_index;
            DatexCompiler.builder.commaIndex(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ELEMENT;  
        }

        // OBJECT_END
        else if (m = SCOPE.datex.match(Regex.OBJECT_END)) {
            if (SCOPE._code_block_type==2 && SCOPE.subscopes.length==1) { // in outer scope and single line block?
                SCOPE.end = true;
                if (last_command_end) SCOPE.last_command_end = true; // last command is still the last command
                return;
            }
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.exit_subscope(SCOPE, BinaryCode.OBJECT_END);
            isEffectiveValue = true;
            //DatexCompiler.builder.close_current_path(SCOPE); // new path scope
        }

        // COMMA
        else if (m = SCOPE.datex.match(Regex.COMMA)) {      
            if (SCOPE._code_block_type==2 && SCOPE.subscopes.length==1) { // in outer scope and single line block?
                SCOPE.end = true;
                if (last_command_end) SCOPE.last_command_end = true; // last command is still the last command
                return;
            }
            
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            
            // detect TUPLE
            if (SCOPE.inner_scope.parent_type==undefined || SCOPE.inner_scope.parent_type == BinaryCode.SUBSCOPE_START) {
                // last ( bracket can be replaced with tuple bracket
                if (SCOPE.inner_scope.parent_type == BinaryCode.SUBSCOPE_START && SCOPE.inner_scope.start_index == SCOPE.inner_scope.first_value_index-1) {
                    DatexCompiler.builder.change_inner_scope_parent_type(SCOPE, BinaryCode.TUPLE_START)
                    DatexCompiler.builder.commaIndex(SCOPE.inner_scope.start_index+1, SCOPE);
                    DatexCompiler.builder.insertByteAtIndex(BinaryCode.ELEMENT, SCOPE.inner_scope.start_index+1, SCOPE); // also add first ELEMENT
                }
                // create new subscope
                else {
                    console.log("comma",SCOPE.inner_scope.ce_index,SCOPE.inner_scope.first_value_index)

                    const index = Math.max(SCOPE.inner_scope.ce_index??0, SCOPE.inner_scope.first_value_index); // save index from current sub scope
                    if (index === -1) throw new Datex.SyntaxError("Invalid leading comma") // value must exist before
                    DatexCompiler.builder.commaIndex(index, SCOPE);
                    DatexCompiler.builder.insertByteAtIndex(BinaryCode.ELEMENT, index, SCOPE); // also add first ELEMENT
                    DatexCompiler.builder.enter_subscope(SCOPE, BinaryCode.TUPLE_START, index);
                    SCOPE.inner_scope.auto_close_scope = BinaryCode.TUPLE_END;
                }
            }

            // always add BinaryCode.ELEMENT (migh be overriden with BinaryCode.ELEMENT_WITH_KEY)
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            SCOPE.inner_scope.first_element_pos = SCOPE.b_index; // set first element index
            DatexCompiler.builder.commaIndex(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ELEMENT;  
        }


        // BUFFER
        else if (m = SCOPE.datex.match(Regex.BUFFER)) {              

            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            let content = m[1];
            let buffer:Uint8Array;

            try {
                buffer = Datex.Pointer.hex2buffer(content,null,true);
            }
            catch(e) {
                throw new Datex.ValueError("Invalid <Buffer> format (base 16)");
            }

            DatexCompiler.builder.addBuffer(buffer, SCOPE);
            isEffectiveValue = true;
        }

       

        // CLOSE_AND_STORE
        else if ((m = SCOPE.datex.match(Regex.CLOSE_AND_STORE)) !== null) {     
            if (SCOPE._code_block_type==2) {
                SCOPE.end = true;
                if (last_command_end) SCOPE.last_command_end = true; // last command is still the last command
                return;
            }

            SCOPE.current_line_nr += m[0].split(/\r\n|\r|\n/).length - 1 // add nr of lines

            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

            // auto-close subscopes here?
            while (SCOPE.inner_scope.auto_close_scope!=undefined) {
                const type = SCOPE.inner_scope.auto_close_scope;
                delete SCOPE.inner_scope.auto_close_scope;
                DatexCompiler.builder.exit_subscope(SCOPE, type);
            }

            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CLOSE_AND_STORE;  

            // remember ; in inner scope
            SCOPE.inner_scope.has_ce = true;
            SCOPE.inner_scope.ce_index = SCOPE.b_index;

            SCOPE.last_command_end = true;
        }

        // INFINITY
        else if (m = SCOPE.datex.match(Regex.INFINITY)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.addFloat(m[1]?.[0]=='-' ? -Infinity : +Infinity, SCOPE)
            isEffectiveValue = true;
        }
                
        // NAN
        else if (m = SCOPE.datex.match(Regex.NAN)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.addFloat(NaN, SCOPE)
            isEffectiveValue = true;
        }

        // PERSON
        else if (m = SCOPE.datex.match(Regex.PERSON_ALIAS)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            const subspace_string = m[2].substring(1);
            let subspaces = subspace_string ? subspace_string.split(":") : null;
            DatexCompiler.builder.addPersonByNameAndChannel(m[1], subspaces, m[6], null, SCOPE);
            isEffectiveValue = true;
        }

        // BOT   
        else if (m = SCOPE.datex.match(Regex.BOT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            let all = m[0].substring(1);
            let name_channel = all.split("/");
            DatexCompiler.builder.addBotByNameAndChannel(name_channel[0], null, name_channel[1], null, SCOPE);
            isEffectiveValue = true;
        }

        // INSTITUTION
        else if (m = SCOPE.datex.match(Regex.INSTITUTION_ALIAS)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            const subspace_string = m[2].substring(1);
            let subspaces = subspace_string ? subspace_string.split(":") : null;
            DatexCompiler.builder.addInstitutionByNameAndChannel(m[1], subspaces, m[6], null, SCOPE);
            isEffectiveValue = true;
        }

        // ID_ENDPOINT
        else if (m = SCOPE.datex.match(Regex.ENDPOINT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            const subspace_string = m[2].substring(1);
            let subspaces = subspace_string ? subspace_string.split(":") : null;
            DatexCompiler.builder.addIdEndpointByIdAndChannel( Datex.Pointer.hex2buffer(m[1].replace(/[_-]/g, "")), subspaces, m[6], null, SCOPE);
            isEffectiveValue = true;
        }

        // ID_ENDPOINT
        else if (m = SCOPE.datex.match(Regex.BROADCAST_ENDPOINT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            const subspace_string = m[2].substring(1);
            let subspaces = subspace_string ? subspace_string.split(":") : null;
            DatexCompiler.builder.addIdEndpointByIdAndChannel(Datex.Addresses.BROADCAST.binary, subspaces, m[6], null, SCOPE);
            isEffectiveValue = true;
        }

        // STRING or ESCAPED_KEY
        else if (m = SCOPE.datex.match(Regex.STRING_OR_ESCAPED_KEY)) {                                  
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            const escaped_string = m[1].substring(1,m[1].length-1);
            SCOPE.current_line_nr += escaped_string.split(/\r\n|\r|\n/).length - 1 // add nr of lines
            let string_or_key = DatexCompiler.builder.unescape_string(escaped_string) // get key and format

            // is escaped key
            if (m[2]) {
                if (SCOPE.inner_scope.parent_type == BinaryCode.ARRAY_START) throw new Datex.SyntaxError("Invalid key in <Array>");
                // convert tuple to record
                if (SCOPE.inner_scope.parent_type == BinaryCode.TUPLE_START) DatexCompiler.builder.change_inner_scope_parent_type(SCOPE, BinaryCode.RECORD_START)
                if (SCOPE.inner_scope.auto_close_scope == BinaryCode.TUPLE_END) SCOPE.inner_scope.auto_close_scope = BinaryCode.RECORD_END;
                
                // check/add  permission prefix (@xy x: ...)
                const permission_prefix = DatexCompiler.builder.check_perm_prefix(SCOPE);

                // override current BinaryCode.ELEMENT
                if (!permission_prefix && SCOPE.inner_scope.first_element_pos!=undefined) SCOPE.b_index = SCOPE.inner_scope.first_element_pos;
                DatexCompiler.builder.detect_record(SCOPE);
                DatexCompiler.builder.addKey(string_or_key, SCOPE);
            }
            // is string
            else DatexCompiler.builder.addString(string_or_key, SCOPE);
            isEffectiveValue = true;
        }



        // SUBSCOPE_END
        else if (m = SCOPE.datex.match(Regex.SUBSCOPE_END)) {
            if (SCOPE._code_block_type==2 && SCOPE.subscopes.length==1) { // in outer scope and single line block?
                SCOPE.end = true;
                if (last_command_end) SCOPE.last_command_end = true; // last command is still the last command
                return;
            } 

            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

            let end = DatexCompiler.builder.exit_subscope(SCOPE);
            // was block close -> end compilation at this point
            if (end && last_command_end) SCOPE.last_command_end = true; // last command is still the last command

            // block close (TODO still required?)
            /*else if (SCOPE.subscopes.length == 1) {

                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);

                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.COMMAND_END;
                SCOPE.last_command_end = true;
                // reset
                DatexCompiler.builder.close_current_path(SCOPE); // new path scope
            }*/
            isEffectiveValue = true;
        }

        // FREEZE
        else if (m = SCOPE.datex.match(Regex.FREEZE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.FREEZE;  
        }

        // SEAL
        else if (m = SCOPE.datex.match(Regex.SEAL)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SEAL;  
        }

        // HAS
        else if (m = SCOPE.datex.match(Regex.HAS)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.HAS;  
        }

        // KEYS
        else if (m = SCOPE.datex.match(Regex.KEYS)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.KEYS;  
        }

        // DELETE pointer (before VARIABLE)
        else if (m = SCOPE.datex.match(Regex.DELETE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.DELETE_POINTER;  
        }

        // SUBSCRIBE to pointer
        else if (m = SCOPE.datex.match(Regex.SUBSCRIBE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCRIBE;  
        }

        // UNSUBSCRIBE from pointer
        else if (m = SCOPE.datex.match(Regex.UNSUBSCRIBE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.UNSUBSCRIBE;  
        }
        
        // VALUE of pointer
            else if (m = SCOPE.datex.match(Regex.VALUE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.VALUE;  
        }

        // get TYPE of value
        else if (m = SCOPE.datex.match(Regex.GET_TYPE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.GET_TYPE;  
        }
            
        // ORIGIN of pointer
        else if (m = SCOPE.datex.match(Regex.ORIGIN)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ORIGIN;  
        }

        // SUBSCRIBERS of pointer
        else if (m = SCOPE.datex.match(Regex.SUBSCRIBERS)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCRIBERS;  
        }

        // TEMPLATE
        else if (m = SCOPE.datex.match(Regex.TEMPLATE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.TEMPLATE;  
        }
        
        // EXTENDS
        else if (m = SCOPE.datex.match(Regex.EXTENDS)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.EXTENDS;  
        }

        // IMPLEMENTS
        else if (m = SCOPE.datex.match(Regex.IMPLEMENTS)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.IMPLEMENTS;  
        }

        // MATCHES
        else if (m = SCOPE.datex.match(Regex.MATCHES)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.MATCHES;  
        }


        // DEBUG
        else if (m = SCOPE.datex.match(Regex.DEBUG)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.DEBUG;  
        }

    
        // CONSTRUCTOR_METHOD
        else if (m = SCOPE.datex.match(Regex.CONSTRUCTOR_METHOD)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            console.log("constructor", m[0]);
        }

        // OBSERVE value
        else if (m = SCOPE.datex.match(Regex.OBSERVE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.OBSERVE;  
        }

        // FUNCTION
        else if (m = SCOPE.datex.match(Regex.FUNCTION)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            SCOPE.inner_scope.function = SCOPE.b_index;
        }


        // DO
        else if (m = SCOPE.datex.match(Regex.DO)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            await DatexCompiler.builder.addScopeBlock(BinaryCode.DO, !!m[1], 1, SCOPE)  
        }

        // ASSERT
        else if (m = SCOPE.datex.match(Regex.ASSERT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            await DatexCompiler.builder.addScopeBlock(BinaryCode.ASSERT, !!m[1], 1, SCOPE)  
        }

        // HOLD
        else if (m = SCOPE.datex.match(Regex.HOLD)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            await DatexCompiler.builder.addScopeBlock(BinaryCode.HOLD, !!m[1], 1, SCOPE)     
        }

        // AWAIT
        else if (m = SCOPE.datex.match(Regex.AWAIT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            DatexCompiler.builder.valueIndex(SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.AWAIT;  
        }

        // POINTER
        else if (m = SCOPE.datex.match(Regex.POINTER)) {               
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            let [action_type, action_specifier] = DatexCompiler.builder.getAssignAction(m[2]);

            const id = m[1].replace(/_/g, "");
            // pre extract
            if (SCOPE.insert_parent_scope_vars_default == 3 && action_type == ACTION_TYPE.GET) {
                const insert_new = DatexCompiler.builder.insertExtractedVariable(SCOPE, BinaryCode.POINTER, id)
                if (insert_new) DatexCompiler.builder.addPointerByID(SCOPE.extract_var_scope, id, action_type, action_specifier);
            }
            // insert normally
            else DatexCompiler.builder.addPointerByID(SCOPE, id, action_type, action_specifier)
            isEffectiveValue = true;
        }
        
        // INTERNAL_VAR or VARIABLE or LABELED_POINTER
        else if ((m = SCOPE.datex.match(Regex.INTERNAL_VAR)) || (m = SCOPE.datex.match(Regex.VARIABLE)) || (m = SCOPE.datex.match(Regex.LABELED_POINTER))) {
            const scope_extract = !!m[1]; // has \x
            let v_name:string|number = m[3]; // get var name
            const is_internal = m[2] == "#"; // is internal variable (#)?
            const is_label = m[2] == "$";
            const is_hex = v_name.match(Regex.HEX_VARIABLE) && (is_internal || is_label || v_name.startsWith("_"));
            
            // variable options
            let base_type = is_internal ? BinaryCode.INTERNAL_VAR : (is_label ? BinaryCode.LABEL : BinaryCode.VAR); // var or internal var
    
            // SCOPE.inner_scope.path_info_index == -1: is child property -> GET action
            // TODO re-enable is_property? example: 'c = count x;' is not working with this enabled!!?
            const is_property = false // (SCOPE.inner_scope.path_info_index !== -1);

            if (is_property) SCOPE.datex = SCOPE.datex.substring(m[1].length + m[2].length + m[3].length);  // pop datex (not "=" or "+=")
            else SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex (also "=" or "+=")

            let [action_type, action_specifier] = is_property ? [ACTION_TYPE.GET] : DatexCompiler.builder.getAssignAction(m[4]);

            if (is_hex) v_name = parseInt(v_name.replace(/[-_]/g,''),16) || 0;

            if (v_name == 'with') throw new Datex.CompilerError("Invalid variable name: with")
            else if (v_name == 'use') throw new Datex.CompilerError("Invalid variable name: use")

            // is a value
            if (action_type == ACTION_TYPE.GET) DatexCompiler.builder.valueIndex(SCOPE);

            // default internal variable shorthands
            if (is_internal) {
                if (v_name == "result") {base_type = BinaryCode.VAR_RESULT; v_name = undefined}
                else if (v_name == "sub_result") {base_type = BinaryCode.VAR_SUB_RESULT; v_name = undefined}
                else if (v_name == "root") {base_type = BinaryCode.VAR_ROOT; v_name = undefined}
                else if (v_name == "origin") {base_type = BinaryCode.VAR_ORIGIN; v_name = undefined}
                else if (v_name == "remote") {base_type =  BinaryCode.VAR_REMOTE; v_name = undefined}
                else if (v_name == "it") {base_type =  BinaryCode.VAR_IT; v_name = undefined}
                else if (v_name == "iter") {base_type =  BinaryCode.VAR_ITER; v_name = undefined}

                else if (v_name == "sender") {if (action_type != ACTION_TYPE.GET) throw new Datex.CompilerError("Invalid action on internal variable #sender"); base_type = BinaryCode.VAR_SENDER; v_name = undefined}
                else if (v_name == "current") {if (action_type != ACTION_TYPE.GET) throw new Datex.CompilerError("Invalid action on internal variable #current"); base_type = BinaryCode.VAR_CURRENT; v_name = undefined}
                else if (v_name == "timestamp") {if (action_type != ACTION_TYPE.GET) throw new Datex.CompilerError("Invalid action on internal variable #timestamp"); base_type = BinaryCode.VAR_TIMESTAMP; v_name = undefined}
                else if (v_name == "encrypted") {if (action_type != ACTION_TYPE.GET) throw new Datex.CompilerError("Invalid action on internal variable #encrypted"); base_type = BinaryCode.VAR_ENCRYPTED; v_name = undefined}
                else if (v_name == "signed") {if (action_type != ACTION_TYPE.GET) throw new Datex.CompilerError("Invalid action on internal variable #signed"); base_type = BinaryCode.VAR_SIGNED; v_name = undefined}
                else if (v_name == "meta") {  if (action_type != ACTION_TYPE.GET) throw new Datex.CompilerError("Invalid action on internal variable #meta"); base_type =  BinaryCode.VAR_META; v_name = undefined}
                else if (v_name == "static") {  if (action_type != ACTION_TYPE.GET) throw new Datex.CompilerError("Invalid action on internal variable #static"); base_type =  BinaryCode.VAR_STATIC; v_name = undefined}
                else if (v_name == "this") {  if (action_type != ACTION_TYPE.GET) throw new Datex.CompilerError("Invalid action on internal variable #this"); base_type =  BinaryCode.VAR_THIS; v_name = undefined}
            }

            // pre extract var if >=1, label if >= 2, or if scope_extract (\)
            if (action_type == ACTION_TYPE.GET && (scope_extract || (SCOPE.insert_parent_scope_vars_default >= 1 && base_type == BinaryCode.VAR) || (SCOPE.insert_parent_scope_vars_default >= 2 && base_type == BinaryCode.LABEL))) {
                const insert_new = DatexCompiler.builder.insertExtractedVariable(SCOPE, base_type, v_name)
                if (insert_new) DatexCompiler.builder.insertVariable(SCOPE.extract_var_scope, v_name, action_type, action_specifier, base_type)
            }
            // insert normally
            else DatexCompiler.builder.insertVariable(SCOPE, v_name, action_type, action_specifier, base_type);
            
            isEffectiveValue = true;
        }


        // CREATE_POINTER
        else if (m = SCOPE.datex.match(Regex.CREATE_POINTER)) {               
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CREATE_POINTER;
        }



        // UNIT (before FLOAT)
        else if (m = SCOPE.datex.match(Regex.UNIT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.addUnit(parseFloat(m[1].replace(/[_ ]/g, "")), SCOPE)
            isEffectiveValue = true;
        }

        // FLOAT (before INT)
        else if (m = SCOPE.datex.match(Regex.FLOAT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.addFloat(parseFloat(m[0].replace(/[_ ]/g, "")), SCOPE)
            isEffectiveValue = true;
        }

        // INT   
        else if (m = SCOPE.datex.match(Regex.INT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.addInt(parseInt(m[0].replace(/[_ ]/g, "")), SCOPE)
            isEffectiveValue = true;
        }

        // HEX   
        else if (m = SCOPE.datex.match(Regex.HEX)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.addInt(parseInt(m[0]), SCOPE)
            isEffectiveValue = true;
        }

        // ASSIGN (=)
        else if (m = SCOPE.datex.match(Regex.ASSIGN_SET)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

            if (SCOPE.inner_scope.path_info_index == -1) throw new Datex.CompilerError("Invalid assignment");
            else SCOPE.uint8[SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_SET;
        }
        
        // ASSIGN_ADD (+=)
        else if (m = SCOPE.datex.match(Regex.ASSIGN_ADD)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

            if (SCOPE.inner_scope.path_info_index == -1) throw new Datex.CompilerError("Invalid assignment");
            else {
                SCOPE.uint8[SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_ACTION;
                DatexCompiler.builder.insertByteAtIndex(BinaryCode.ADD, SCOPE.inner_scope.path_info_index+1, SCOPE); // add action specifier
            }
        }

        // ASSIGN_SUBTRACT (-=)
        else if (m = SCOPE.datex.match(Regex.ASSIGN_SUB)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

            if (SCOPE.inner_scope.path_info_index == -1) throw new Datex.CompilerError("Invalid assignment");
            else {
                SCOPE.uint8[SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_ACTION;
                DatexCompiler.builder.insertByteAtIndex(BinaryCode.SUBTRACT, SCOPE.inner_scope.path_info_index+1, SCOPE); // add action specifier
            }
        }

        // ASSIGN_MUTIPLY (*=)
        else if (m = SCOPE.datex.match(Regex.ASSIGN_MUTIPLY)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

            if (SCOPE.inner_scope.path_info_index == -1) throw new Datex.CompilerError("Invalid assignment");
            else {
                SCOPE.uint8[SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_ACTION;
                DatexCompiler.builder.insertByteAtIndex(BinaryCode.MULTIPLY, SCOPE.inner_scope.path_info_index+1, SCOPE); // add action specifier
            }
        }

        // ASSIGN_DIVIDE (*=)
        else if (m = SCOPE.datex.match(Regex.ASSIGN_DIVIDE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

            if (SCOPE.inner_scope.path_info_index == -1) throw new Datex.CompilerError("Invalid assignment");
            else {
                SCOPE.uint8[SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_ACTION;
                DatexCompiler.builder.insertByteAtIndex(BinaryCode.DIVIDE, SCOPE.inner_scope.path_info_index+1, SCOPE); // add action specifier
            }
        }

        // ASSIGN_AND (&=)
        else if (m = SCOPE.datex.match(Regex.ASSIGN_AND)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

            if (SCOPE.inner_scope.path_info_index == -1) throw new Datex.CompilerError("Invalid assignment");
            else {
                SCOPE.uint8[SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_ACTION;
                DatexCompiler.builder.insertByteAtIndex(BinaryCode.AND, SCOPE.inner_scope.path_info_index+1, SCOPE); // add action specifier
            }
        }

        // ASSIGN_OR (|=)
        else if (m = SCOPE.datex.match(Regex.ASSIGN_OR)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

            if (SCOPE.inner_scope.path_info_index == -1) throw new Datex.CompilerError("Invalid assignment");
            else {
                SCOPE.uint8[SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_ACTION;
                DatexCompiler.builder.insertByteAtIndex(BinaryCode.OR, SCOPE.inner_scope.path_info_index+1, SCOPE); // add action specifier
            }
        }

        // ASSIGN_POINTER_VALUE ($=)
        else if (m = SCOPE.datex.match(Regex.ASSIGN_POINTER_VALUE)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex

            if (SCOPE.inner_scope.path_info_index == -1) throw new Datex.CompilerError("Invalid assignment");
            else {
                SCOPE.uint8[SCOPE.inner_scope.path_info_index] = BinaryCode.CHILD_ACTION;
                DatexCompiler.builder.insertByteAtIndex(BinaryCode.CREATE_POINTER, SCOPE.inner_scope.path_info_index+1, SCOPE); // add action specifier
            }
        }


        // ADD
        else if (m = SCOPE.datex.match(Regex.ADD)) {               
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.ADD;  
        }

        // SUBTRACT
        else if (m = SCOPE.datex.match(Regex.SUBTRACT)) {               
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBTRACT;  
        }

        // MULTIPLY
        else if (m = SCOPE.datex.match(Regex.MULTIPLY)) {               
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.MULTIPLY;  
        }

        // DIVIDE
        else if (m = SCOPE.datex.match(Regex.DIVIDE)) {               
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.DIVIDE;  
        }
    
        // OR
        else if (m = SCOPE.datex.match(Regex.OR)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
         
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.OR;  
        }

        // AND
        else if (m = SCOPE.datex.match(Regex.AND)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.AND;  
        }

        // NOT
        else if (m = SCOPE.datex.match(Regex.NOT)) {
            SCOPE.datex = SCOPE.datex.substring(m[0].length);  // pop datex
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.NOT;  
        }

        else {
            throw new Datex.SyntaxError("Invalid token on line "+SCOPE.current_line_nr+" near '" + SCOPE.datex.split("\n")[0] + "'");
        }

        // immediate +/- operation possible
        if (isEffectiveValue) DatexCompiler.builder.tryPlusOrMinus(SCOPE);


        // after inserted last value for value_count
        if (!SCOPE.inner_scope?.value_count) {

            let end_index:number;

            if ('iterate' in SCOPE.inner_scope) {
                // insert initialisation
                if (SCOPE.inner_scope.iterate == 0) {
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CLOSE_AND_STORE;  
                    SCOPE.inner_scope.loop_start = SCOPE.b_index;

                    // ... jtr loop_start (#iter.next());
                    SCOPE.inner_scope.jfa_index = SCOPE.b_index+1;
                    DatexCompiler.builder.addJmp(SCOPE,  BinaryCode.JFA);

                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_START;
                    DatexCompiler.builder.insertVariable(SCOPE, 'iter', ACTION_TYPE.GET, undefined, BinaryCode.INTERNAL_VAR);
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CHILD_GET;
                    DatexCompiler.builder.addString('next', SCOPE);
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.VOID;
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_END;
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CLOSE_AND_STORE;  

                    // #it = #iter->val;
                    DatexCompiler.builder.insertVariable(SCOPE, 'it', ACTION_TYPE.SET, undefined, BinaryCode.INTERNAL_VAR);
                    DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index+1, SCOPE);
                    DatexCompiler.builder.insertVariable(SCOPE, 'iter', ACTION_TYPE.GET, undefined, BinaryCode.INTERNAL_VAR);
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CHILD_GET;
                    DatexCompiler.builder.addString('val', SCOPE);
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CLOSE_AND_STORE;  

                    // now wait for iterate block
                    SCOPE.inner_scope.iterate = 1;
                    SCOPE.inner_scope.value_count = 1;
                }
                // next() + jump instrution at the end
                else {
                    // jmp to start
                    DatexCompiler.builder.addJmp(SCOPE, BinaryCode.JMP, SCOPE.inner_scope.loop_start)

                    // insert end index for jfa end
                    SCOPE.data_view.setUint32(SCOPE.inner_scope.jfa_index, SCOPE.b_index, true);
                    
                    DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_END;
                            
                    delete SCOPE.inner_scope.loop_start;
                    delete SCOPE.inner_scope.iterate;
                }
                
            }

            else if ('while' in SCOPE.inner_scope) {
                // jmp start
                DatexCompiler.builder.addJmp(SCOPE, BinaryCode.JMP, SCOPE.inner_scope.loop_start)

                // insert end index for jfa end
                SCOPE.data_view.setUint32(SCOPE.inner_scope.loop_start+1, SCOPE.b_index, true);
                
                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_END;

                delete SCOPE.inner_scope.loop_start;
                delete SCOPE.inner_scope.while;
            }
            else if ('if' in SCOPE.inner_scope) {

                // add if_end_indices
                if (!SCOPE.inner_scope.if_end_indices) SCOPE.inner_scope.if_end_indices = [];
                SCOPE.inner_scope.if_end_indices.push(SCOPE.b_index+1);
                
                // jmp start
                DatexCompiler.builder.addJmp(SCOPE, BinaryCode.JMP)

                // insert end index for jfa end -> jump to next else (if) or end
                SCOPE.data_view.setUint32(SCOPE.inner_scope.if+1, SCOPE.b_index, true);
                end_index = SCOPE.b_index; // set end_index to before SUBSCOPE_END

                DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_END; // assume already end of 'if'-subscope - might be overidden
            }

            // update end index for all current if/else clauses
            if ('else' in SCOPE.inner_scope || 'if' in SCOPE.inner_scope) {
                // set end index for all previous ifs/else ifs
                end_index = end_index ?? SCOPE.b_index;
                for (let index of SCOPE.inner_scope.if_end_indices??[]) {
                    SCOPE.data_view.setUint32(index, end_index, true);
                }

                // handle only 'else'
                if ('else' in SCOPE.inner_scope) {
                    delete SCOPE.inner_scope.if_end_indices;
                    delete SCOPE.inner_scope.else;

                    // definitly end of 'if'-subscope
                    DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.SUBSCOPE_END;
                }
                // delete 'if'
                else delete SCOPE.inner_scope.if;
            
            }

            // reset value_count
            delete SCOPE.inner_scope.value_count;
        }


        // handle function scope block
        if (SCOPE.inner_scope.function != null && SCOPE.b_index != SCOPE.inner_scope.function) {
            // block with brackets ?
            let has_brackets = false;
            SCOPE.datex = SCOPE.datex.replace(/^[^\S\n]+/, ""); //(/^[^\S\r\n]+/
            if (SCOPE.datex[0] == "(") {
                has_brackets = true;
                SCOPE.datex = SCOPE.datex.slice(1);
            }
            await DatexCompiler.builder.addScopeBlock(BinaryCode.FUNCTION, has_brackets, 0, SCOPE);
            SCOPE.inner_scope.function = null;
        }
    }

    static async createBlockFromScope(SCOPE:compiler_scope):Promise<ArrayBuffer> {

        return SCOPE.add_header ? await this.appendHeader(
            SCOPE.buffer,
            SCOPE.options.end_of_scope,
            SCOPE.options.from, //sender
            SCOPE.options.to, // to
            SCOPE.options.flood, // flood
            SCOPE.options.type, // type
            SCOPE.options.sign, 
            SCOPE.options.encrypt, // encrypt
            SCOPE.options.send_sym_encrypt_key,
            SCOPE.options.sym_encrypt_key, // encryption key
            SCOPE.options.allow_execute, // allow execute

            SCOPE.options.sid,
            SCOPE.options.return_index,
            SCOPE.options.inc,

            SCOPE.options.force_id,

            SCOPE.options.__routing_ttl,
            SCOPE.options.__routing_prio,
            SCOPE.options.__routing_to,

            SCOPE.receiver_buffer,
            SCOPE.sender_buffer,
            SCOPE.pre_header_size,
            SCOPE.signed_header_size,
            SCOPE.full_dxb_size
        ) : SCOPE.buffer;
    }


    // compile loop
    static async compileLoop(SCOPE:compiler_scope):Promise<ArrayBuffer|ReadableStream<ArrayBuffer>>  {

        const body_compile_measure = DatexRuntimePerformance.enabled ? DatexRuntimePerformance.startMeasure("compile time", "body") : undefined;

        if (!SCOPE.datex) SCOPE.datex = ";";//throw new Datex.CompilerError("DATEX Script is empty");

        // iterate over all tokens / commands, stop if end not reached after 1000 tokens
        for (let i=0;i<500_000;i++) {            
            await this.parseNextExpression(SCOPE); // parse and update index in binary

            // streaming, generate multiple blocks as ReadableStream
            if (SCOPE.streaming) {

                const _end_of_scope = SCOPE.options.end_of_scope;
                
                SCOPE.buffer = SCOPE.buffer.slice(0, SCOPE.b_index);  // slice until current index
                return new ReadableStream<ArrayBuffer>({
                    async start(controller:ReadableStreamController<ArrayBuffer>) {
                        SCOPE.options.end_of_scope = false;

                        // first part of scope until the stream starts
                        controller.enqueue(await DatexCompiler.createBlockFromScope(SCOPE));
                       
                        
                        // read stream and insert
                        let reader = SCOPE.streaming;
                        let next:ReadableStreamDefaultReadResult<any>,
                            value: any;
                        while (true) {
                            next = await reader.read()
                            if (next.done) break;
                            value = next.value;
                        
                            //console.log("read chunk", next)
                        
                            // optimized: create array buffer dxb
                            if (value instanceof ArrayBuffer) {
                                SCOPE.buffer = new ArrayBuffer(value.byteLength+1+Uint32Array.BYTES_PER_ELEMENT);
                                SCOPE.uint8 = new Uint8Array(SCOPE.buffer);
                                SCOPE.data_view = new DataView(SCOPE.buffer);
                                SCOPE.uint8[0] = BinaryCode.BUFFER;
                                SCOPE.data_view.setUint32(1, value.byteLength, true);   // buffer length
                                SCOPE.uint8.set(new Uint8Array(value), 1+Uint32Array.BYTES_PER_ELEMENT);
                            }
                            // insert another value
                            else SCOPE.buffer = DatexCompiler.compileValue(value, {}, false);

                            controller.enqueue(await DatexCompiler.createBlockFromScope(SCOPE));
                        }

                        // continue after stream, reset SCOPE to previous state
                        // TODO not working properly with jumps, buffers and indices are reset
                        SCOPE.b_index = 0;
                        SCOPE.buffer = new ArrayBuffer(400);
                        SCOPE.uint8 = new Uint8Array(SCOPE.buffer);
                        SCOPE.data_view = new DataView(SCOPE.buffer);
                        SCOPE.options.end_of_scope = _end_of_scope;
                        SCOPE.streaming = null;

                        let res = await DatexCompiler.compileLoop(SCOPE);

                        // is single block
                        if (res instanceof ArrayBuffer) {
                            if (SCOPE.options.end_of_scope) controller.enqueue(new ArrayBuffer(0)); // indicate last block following
                            controller.enqueue(res);
                        }
                        // is another stream of blocks
                        else {
                            const reader = res.getReader();
                            let next:ReadableStreamDefaultReadResult<ArrayBuffer>;
                            while (true) {
                                next = await reader.read()
                                if (next.done) break;
                                controller.enqueue(next.value);
                            }
                        }

                        controller.close();
                    }
                })
            }

            // end of scope reached
            if (SCOPE.end || !SCOPE.datex) { 

                // check for missing object brackets
                for (let scope of SCOPE.subscopes) {
                    if (scope.parent_type == BinaryCode.OBJECT_START) throw new Datex.SyntaxError("Missing closing object bracket");
                    if (scope.parent_type == BinaryCode.ARRAY_START) throw new Datex.SyntaxError("Missing closing array bracket");
                    if (scope.parent_type == BinaryCode.SUBSCOPE_START) throw new Datex.SyntaxError("Missing closing bracket");
                }

                if (Object.keys(SCOPE.indices_waiting_for_jmp_lbl).length) {
                    throw new Datex.CompilerError("Jump to non-existing lbl: " + Object.keys(SCOPE.indices_waiting_for_jmp_lbl));
                }

                if (SCOPE.return_data) SCOPE.return_data.datex = SCOPE.datex;

                // add ; if missing (only if end of scope)
                if (SCOPE.options.end_of_scope!==false && !SCOPE.last_command_end) {
                    // auto-close subscopes here?
                    while (SCOPE.inner_scope?.auto_close_scope!=undefined) {
                        const type = SCOPE.inner_scope.auto_close_scope;
                        delete SCOPE.inner_scope.auto_close_scope;
                        DatexCompiler.builder.exit_subscope(SCOPE, type);
                    }

                    DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
                    SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CLOSE_AND_STORE; 
                };


                SCOPE.buffer = SCOPE.buffer.slice(0, SCOPE.b_index);  // slice until current index (remove 0s at the end)

                // prefix extract_var_scope? -> scope block
                /*
                    var1 var2 var3 BinaryCode.SCOPE_BLOCK [SCOPE.buffer.byteLength] [SCOPE.buffer]
                */
                if (SCOPE.extract_var_scope) {
                    SCOPE.extract_var_scope.uint8[SCOPE.extract_var_scope.b_index++] = BinaryCode.SCOPE_BLOCK;
                    SCOPE.extract_var_scope.data_view.setUint32(SCOPE.extract_var_scope.b_index, SCOPE.buffer.byteLength, true);
                    SCOPE.extract_var_scope.b_index += Uint32Array.BYTES_PER_ELEMENT;

                    SCOPE.extract_var_scope.buffer = SCOPE.extract_var_scope.buffer.slice(0, SCOPE.extract_var_scope.b_index);  // slice until current index (remove 0s at the end)
                    SCOPE.buffer = DatexCompiler.combineBuffers(SCOPE.extract_var_scope.buffer, SCOPE.buffer);
                }

                if (SCOPE.precompiled) {
                    // add last buffer part to precompiled dxb if available
                    SCOPE.precompiled.appendBufferPlaceholder(SCOPE.last_precompiled??0,SCOPE.b_index);
                    // now insert actual buffer data
                    SCOPE.precompiled.autoInsertBuffer(SCOPE.buffer);
                }

                // check if max block size exceeded -> return ReadableStream with multiple blocks (only if full block with header)
                if (SCOPE.add_header && (await this.getScopeBlockSize(SCOPE) >= SCOPE.max_block_size??DatexCompiler.MAX_DXB_BLOCK_SIZE)) {
                    const original_buffer = SCOPE.buffer;
                    const total_header_size = SCOPE.pre_header_size + SCOPE.signed_header_size;
                    const max_body_size = SCOPE.max_block_size - total_header_size;
                    console.log("block too big ("+await this.getScopeBlockSize(SCOPE)+" bytes), splitting into parts with body size " + max_body_size)
                    let split_index = 0;
                    // return ReadableStream (could actually just be an array of ArrayBuffers, since all buffers are already known, but ReadableStream is needed anyways)
                    return new ReadableStream<ArrayBuffer>({
                        async start(controller:ReadableStreamController<ArrayBuffer>) {
                            let last_block = false;
                            // add block by block
                            while (!last_block) {
                                SCOPE.buffer = original_buffer.slice(split_index, split_index + max_body_size);
                                split_index += max_body_size
                                SCOPE.full_dxb_size = total_header_size + SCOPE.buffer.byteLength; // update full_dxb_size to new shortened size 
                                last_block = split_index>=original_buffer.byteLength;
                                SCOPE.options.end_of_scope = last_block // set EOS to true if no more blocks coming, else false
                                const block = await DatexCompiler.createBlockFromScope(SCOPE);
                                if (last_block) controller.enqueue(new ArrayBuffer(0)); // indicate last block following
                                controller.enqueue(block);
                            }

                            controller.close();
                        }
                    })
                    
                }

                // return a single block (or split into multiple blocks if too big)
                else {
                    if (DatexRuntimePerformance.enabled) DatexRuntimePerformance.endMeasure(body_compile_measure); // compile time for a single block (dxb body) can be measure here
                    return DatexCompiler.createBlockFromScope(SCOPE);
                }

            } // end reached
        }

        // end not reached after 500_000 iterations
        throw new Datex.SyntaxError("DATEX Script to big to compile");
    }



    /** create compiled dxb (stored as a string) from any value */
    static valueToBase64DXB(value:any, inserted_ptrs?:Set<Datex.Pointer>):string {
        let dxb = DatexCompiler.compileValue(value, {inserted_ptrs})
        return arrayBufferToBase64(dxb);
    }

    /** create compiled dxb (stored as a string) from a DATEX Script string */
    static async datexScriptToBase64DXB(dx:string, type = DatexProtocolDataType.DATA, data = []):Promise<string> {
        let dxb = <ArrayBuffer> await DatexCompiler.compile(dx, data, {sign:false, encrypt: false, type})
        return arrayBufferToBase64(dxb);
    }

    /** create and download (if file_name not null) a dxb file created from a DATEX Script string */
    static async datexScriptToDXBFile(dx:string, file_name?:string, type = DatexProtocolDataType.DATA, data = [], collapse_pointers = false):Promise<Blob> {
        let dxb = <ArrayBuffer> await DatexCompiler.compile(dx, data, {sign:false, encrypt: false, type, collapse_pointers})

        let file = new Blob([dxb], {type: "application/datex"});
        if (file_name != null) {
            const a = document.createElement("a"), url = URL.createObjectURL(file);
            a.href = url;
            a.download = (file_name ?? "unknown") + ".dxb";
            document.body.appendChild(a);
            a.click();
        }
        return file;
    }

    /** create a dxb file created from a DATEX Script string and convert to data url */
    static async datexScriptToDataURL(dx:string, type = DatexProtocolDataType.DATA):Promise<string> {
        let dxb = <ArrayBuffer> await DatexCompiler.compile(dx, [], {sign:false, encrypt: false, type})

        let blob = new Blob([dxb], {type: "text/dxb"}); // workaround to prevent download

        return new Promise(resolve=>{
            var a = new FileReader();
            a.onload = function(e) {resolve(<string>e.target.result);}
            a.readAsDataURL(blob);
        });
    }

    /** create a dxb file created from a DATEX Script string and convert to object url */
    static async datexScriptToObjectURL(dx:string, type = DatexProtocolDataType.DATA):Promise<string> {
        let dxb = <ArrayBuffer> await DatexCompiler.compile(dx, [], {sign:false, encrypt: false, type})

        let blob = new Blob([dxb], {type: "text/dxb"}); // workaround to prevent download
        return URL.createObjectURL(blob);
    }

    /** does not create a full DXB block, only a buffer containing a dxb encoded value */
    static encodeValue(value:any, inserted_ptrs?:Set<Datex.Pointer>, add_command_end = true, deep_collapse = false, collapse_first_inserted = false, no_create_pointers = false):ArrayBuffer {
        // add_command_end -> end_of_scope -> add ; at the end
        return this.compileValue(value, {inserted_ptrs, collapse_pointers:deep_collapse, collapse_first_inserted:collapse_first_inserted, no_create_pointers:no_create_pointers}, add_command_end)
    }

    static encodeValueBase64(value:any, inserted_ptrs?:Set<Datex.Pointer>, add_command_end = true, deep_collapse = false, collapse_first_inserted = false, no_create_pointers = false):string {
        return arrayBufferToBase64(this.encodeValue(value, inserted_ptrs, add_command_end, deep_collapse, collapse_first_inserted, no_create_pointers));
    }

    // creates a unique hash for a given value
    static getValueHash(value:any):Promise<ArrayBuffer> {
        return crypto.subtle.digest('SHA-256', DatexCompiler.encodeValue(value, undefined, true, true, true, true));
    }

    static async getValueHashString(value:any):Promise<string> {
        return arrayBufferToBase64(await DatexCompiler.getValueHash(value))
    }

    // same as compile, but accepts a precompiled dxb array instead of a Datex Script string -> faster compilation
    static async compilePrecompiled(precompiled:PrecompiledDXB, data:any[] = [], options:compiler_options={}, add_header=true):Promise<ArrayBuffer> {
        
        // get / compile all array buffers
        const buffers:ArrayBuffer[] = [];
        const compiled_cache:ArrayBuffer[] = [];
        let buffer: ArrayBuffer;
        let total_size = 0;

        for (let part of precompiled) {
            if (part instanceof ArrayBuffer) buffer = part;
            else if (part instanceof Array) throw new Error("Invalid precompiled dxb");
            else if (part in data) {
                // already compiled, in cache
                if (compiled_cache[data[part]]) buffer = compiled_cache[data[part]]
                // compile value
                else buffer = compiled_cache[data[part]] = await DatexCompiler.compileValue(data[part], undefined, false);
            }
            else throw new Datex.CompilerError("Missing data value for precompiled dxb");

            buffers.push(buffer);
            total_size += buffer.byteLength;
        }

        // combine array buffers
        let i = 0;
        const finalBuffer = new ArrayBuffer(total_size);
        const finalBufferView = new Uint8Array(finalBuffer);

        for (let buffer of buffers) {
            finalBufferView.set(new Uint8Array(buffer), i);
            i += buffer.byteLength;
        }

        // no header
        if (!add_header) return finalBuffer;

        // add header
        return DatexCompiler.appendHeader(
            finalBuffer,
            options.end_of_scope,
            options.force_id ? (options.from??Datex.Runtime.endpoint).id_endpoint : options.from, //sender
            options.to, // to
            options.flood, // flood
            options.type, // type
            options.sign, 
            options.encrypt, // encrypt
            options.send_sym_encrypt_key,
            options.sym_encrypt_key, // encryption key
            options.allow_execute, // allow execute

            options.sid,
            options.return_index,
            options.inc,

            options.force_id,

            options.__routing_ttl,
            options.__routing_prio,
            options.__routing_to
        ) 

    }

    /** compiles datex code to binary + adds  data (binary, strings, intergers,...) if provided */
    static compile(datex:string|{datex:string}|PrecompiledDXB, data:any[] = [], options:compiler_options={}, add_header=true, is_child_scope_block = false, insert_parent_scope_vars_default:0|1|2|3 = 0, save_precompiled?:PrecompiledDXB, max_block_size?:number, _code_block_type?:0|1|2, _current_data_index=0): Promise<ArrayBuffer|ReadableStream<ArrayBuffer>>|ArrayBuffer {

        // _datex is precompiled dxb
        if (datex instanceof PrecompiledDXB) {
            return DatexCompiler.compilePrecompiled(datex, data, options, add_header);
        }

        // do optimized synchronous single value compilation
        if (datex === '?' && !add_header) {
            return DatexCompiler.compileValue(data[0], options);
        }

        // get datex as string
        let return_data:{datex:string};
        if (typeof datex == "object" && datex) {
            return_data = datex;
            datex = datex.datex;
        }
        if (typeof datex != "string") throw new Datex.CompilerError("'datex' must be a string or a precompiled dxb");

        if (save_precompiled) save_precompiled.datex = datex;

        //globalThis.performance?.mark("compile_start");

        if (options.encrypt && !options.sym_encrypt_key) throw new Datex.CompilerError("Cannot encrypt without a symmetric encryption key");


        // init scope - state variables
        const SCOPE:compiler_scope = {
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

            max_block_size: max_block_size, // might be bigger than MAX_BLOCK_SIZE

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
                start_index: -1, // has no brackets
                last_value_index: -1,  // byte index of last, pointer, var, object, ...
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
            SCOPE.extract_var_scope = <compiler_scope>{
                b_index: 0,
                buffer: new ArrayBuffer(400),
                inner_scope: {},
                dynamic_indices: [],
                inserted_values: new Map()
            }
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


    /** optimized compiler for single value encoding (no header), synchronous! */
    static compileValue(value:any, options:compiler_options = {}, add_command_end = true):ArrayBuffer{

        const SCOPE:compiler_scope = {
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
                start_index: -1, // has no brackets
                last_value_index: -1,  // byte index of last, pointer, var, object, ...
                wait_for_add: false,
                in_template_string: false,
                path_info_index: -1
            }],
            inner_scope: null
        };

        SCOPE.inner_scope = SCOPE.subscopes[0];
        SCOPE.uint8 = new Uint8Array(SCOPE.buffer);
        SCOPE.data_view = new DataView(SCOPE.buffer);

        // insert value
        DatexCompiler.builder.insert(value, SCOPE);

        // ;
        if (add_command_end) {
            DatexCompiler.builder.handleRequiredBufferSize(SCOPE.b_index, SCOPE);
            SCOPE.uint8[SCOPE.b_index++] = BinaryCode.CLOSE_AND_STORE; 
        }

        // slice until current index (remove 0s at the end)
        SCOPE.buffer = SCOPE.buffer.slice(0, SCOPE.b_index);  

        // directly return SCOPE buffer without header
        return SCOPE.buffer;
    }
}

globalThis.DatexCompiler = DatexCompiler;


/**
 * ! nested PrecompiledDXB (appendPrecompiledDXB): recursive self-reference not allowed!
 */
export class PrecompiledDXB extends Array<ArrayBuffer|number|[number,number]> {

    #datex:string
    #appended_pdxb: PrecompiledDXB[] = [];

    set datex(datex:string){
        if (this.#datex == undefined) this.#datex = datex;
    }
    get datex(){
        let d = this.#datex??"";
        for (let a of this.#appended_pdxb) {
            d += "\n" + a.datex;
        }
        return d;
    }

    private constructor(){super()}


    appendBuffer(buffer:ArrayBuffer) {
        this.push(buffer);
    }

    // buffer not yet inserted, only remember buffer slice start/end
    appendBufferPlaceholder(start_index:number, end_index:number) {
        this.push([start_index, end_index]);
    }

    // insert buffer at placeholder positions
    autoInsertBuffer(buffer:ArrayBuffer) {
        for (let i=0;i<this.length;i++) {
            if (this[i] instanceof Array) this[i] = buffer.slice(this[i][0], this[i][1]);
        }
    }

    appendDataIndex(index:number) {
        this.push(index);
    }

    freeze(){
        Object.freeze(this);
    }

    // static

    public static async create(datex:string, options:compiler_options={}){
        const precompiled = new PrecompiledDXB();
        await DatexCompiler.compile(datex, [], options, false, false, 0, precompiled);
        precompiled.freeze(); // no more changes allowed 
        return precompiled;
    }

    public static combine(...precompiled_dxbs: PrecompiledDXB[]): PrecompiledDXB {
        const precompiled = new PrecompiledDXB();
        precompiled.#appended_pdxb = precompiled_dxbs;
        precompiled.freeze(); // no more changes allowed 
        return precompiled;
    }
 

    // custom iterator, also iterate over appended PrecompiledDXB

    *[Symbol.iterator](){
        // iterate over this
        for (let i = 0; i < this.length; i++) yield this[i];

        // iterate over appended PrecompiledDXB
        for (let a = 0; a < this.#appended_pdxb.length; a++) {
            const pdxb = this.#appended_pdxb[a];
            // iterate over self (no infinite recursion)
            if (pdxb == this) {
                for (let i = 0; i < pdxb.length; i++) yield pdxb[i];
            }
            // iterate over anoother precompiled dxb
            else {
                for (let p of pdxb) yield p;
            }
        }
    }
}