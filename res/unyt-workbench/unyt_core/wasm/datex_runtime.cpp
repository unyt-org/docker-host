#include <string>
#include <iostream>
#include <regex>

using std::string;


namespace datex {
  
  enum BinaryCode {

      // SHORTCUT CODES for datex std

      // primitive / fundamental types
      
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
      STD_TYPE_FUNCTION   = 0x1f,


      // OTHER BINARY CODES


      COMMAND_END         = 0xa0, // ;
      SUBSCOPE_START      = 0xa1, // (
      SUBSCOPE_END        = 0xa2, // )
      COMPARE             = 0xa3,
      USE_STATIC          = 0xa4, // use (x,y)
      RETURN              = 0xa5,

      VAR                 = 0xb0, // x
      POINTER             = 0xb1, // $x
      TYPE                = 0xb2, // <type>x
      NOT                 = 0xb4, // ~
      ADD                 = 0xb5, // +
      REDIRECT            = 0xb6, // ::
      STATIC_SCOPE        = 0xb7, // static/...

      STRING              = 0xc0,
      INT_32              = 0xc1,
      INT_64              = 0xc2,
      FLOAT               = 0xc3,
      TRUE                = 0xc4,
      FALSE               = 0xc5,
      NULL_               = 0xc6,
      VOID                = 0xc7,
      BUFFER              = 0xc8,
      CODE_BLOCK          = 0xc9,
      UNIT                = 0xca,
      FILTER              = 0xcb,

      ALIAS               = 0xd0,
      LABEL               = 0xd1,
      FLAG                = 0xd2,
      ORG                 = 0xd3,
      APP                 = 0xd4,
      NODE                = 0xd5,

      PLUS_ALIAS          = 0xd6,
      PLUS_LABEL          = 0xd7,
      PLUS_FLAG           = 0xd8,
      PLUS_ORG            = 0xd9,
      PLUS_APP            = 0xda,
      PLUS_NODE           = 0xdb,

      ARRAY_START         = 0xe0,  // array / or array
      ARRAY_END           = 0xe1,
      OBJECT_START        = 0xe2,  // {}
      OBJECT_END          = 0xe3,
      KEY                 = 0xe4,  // object key
      LIST_SEP            = 0xe5,  // comma
      AND                 = 0xe6,  // &
      OR                  = 0xe7,  // |

      ASSIGN_SET          = 0xf0,  // =
      GET                 = 0xf1,  // x.y
      ASSIGN_ADD          = 0xf2,  // +=
      ASSIGN_SUB          = 0xf3,   // -=
      CALL                = 0xf4,  // ()
      THROW_ERROR         = 0xf6,  // !
      DELETE              = 0xf7
  };
  

  // std::regex REGEX_COMMAND_END(R"(^(;\s*)+)"); // one or multiple ;
  // std::regex REGEX_VARIABLE(R"(^[A-Za-z_][A-Za-z0-9À-ž_]*)"); ///^[a-zA-Z_]+\w*\b(?! *(=|:))/,
  // std::regex REGEX_ERROR(R"(^\!(\w|\.)+)");

  // std::regex REGEX_SUBSCOPE_START(R"(^\()");
  // std::regex REGEX_SUBSCOPE_END(R"(^\))");

  // std::regex REGEX_APPLY_FILTER("^([^;\\n\"'])+::( *|\\b)");
  // std::regex REGEX_APPLY_FILTER_AND_ENCRYPT("(^([^;\\n\"'])+:::( *|\\b))");

  // std::regex REGEX_APPLY_FILTER_ENCRYPT_BLOCK_OPEN(R"(^\:\:\: *\()"); // ::: ()
  // std::regex REGEX_APPLY_FILTER_BLOCK_OPEN(R"(^\:\: *\()");  // :: ()
  // std::regex REGEX_APPLY_FILTER_ENCRYPT_OPEN(R"(^\:\:\:)"); // :::
  // std::regex REGEX_APPLY_FILTER_OPEN(R"(^\:\:)"); // ::

  // std::regex REGEX_INSERT_PLUS_FILTER_BLOCK(R"(^\:\: *\^(\d*))");// combined: :: ^0

  // std::regex REGEX_ADD(R"(^\+)");

  // std::regex REGEX_ASSIGN_SET(R"(^\=)");
  // std::regex REGEX_ASSIGN_ADD(R"(^\+\=)");
  // std::regex REGEX_ASSIGN_SUB(R"(^\-\=)");
  // std::regex REGEX_THROW_ERROR(R"(^\!)");

  // std::regex REGEX_COMPARE(R"(^\=\=)");

  // std::regex REGEX_STRING("(^(\"(.|\\n)*?(?<![^\\\\]\\\\)\"|'(.|\\n)*?(?<![^\\\\]\\\\)'))");
  // std::regex REGEX_INT(R"(^-?(\d_?)+\b(?!\.\d))");
  // std::regex REGEX_HEX(R"(^0x[0-9a-fA-F]+)");

  // std::regex REGEX_UNIT(R"(^(-?((\d_?)*\.)?(\d_?)+)u)");

  // std::regex REGEX_TSTRING_START(R"(^'([^']|[^\\]\\')*?(?<![^\\]\\){)"); // check before string
  // std::regex REGEX_TSTRING_B_CLOSE(R"(^(}([^']|\\')*?(?<![^\\]\\){))");
  // std::regex REGEX_TSTRING_END(R"(^}(.|\n)*?(?<![^\\]\\)')");
      
  // std::regex REGEX_FLOAT(R"(^(-?((\d_?)*\.)?(\d_?)*((E|e)-?(\d_?)+)|(-|\+)?(\d_?)+\.(\d_?)+))");
  // std::regex REGEX_BOOLEAN(R"(^(true|false))");
  // std::regex REGEX_USE(R"(^use[ \n]*([A-Za-z_][A-Za-z0-9À-ž_]*))");
  // std::regex REGEX_USE_MULTIPLE(R"(^use[ \n]*\([ \n]*(([A-Za-z_][A-Za-z0-9À-ž_]*[ \n,]*)*)\))");
  // std::regex REGEX_STATIC_SCOPE(R"(^([A-Za-z_][A-Za-z0-9À-ž_]*)\/)"); ///^[a-zA-Z_]+\w*\b(?! *(=|:)))");

  std::regex REGEX_NULL(R"(^null)");

  std::regex REGEX_VOID(R"(^void)"); // void 
  // std::regex REGEX_QUASI_VOID(R"(^\(\s*\))"); //  empty brackets ( )

  // std::regex REGEX_ALIAS(R"(^@\+?[A-Za-z0-9À-ž-_]{1,18}(\/(\*|[A-Za-z0-9À-ž-_]{1,8}))?)");
  // std::regex REGEX_LABEL(R"(^#\+?[A-Za-z0-9À-ž-_]{1,18}(\/(\*|[A-Za-z0-9À-ž-_]{1,8}))?)");
  // std::regex REGEX_FLAG(R"(^§\+?[A-Za-z0-9À-ž-_]{1,18}(\/(\*|[A-Za-z0-9À-ž-_]{1,8}))?)");
  // std::regex REGEX_ORG(R"(^\:\+?[A-Za-z0-9À-ž-_]{1,18}(\/(\*|[A-Za-z0-9À-ž-_]{1,8}))?)");
  // std::regex REGEX_APP(R"(^\+\+?[A-Za-z0-9À-ž-_]{1,18}(\/(\*|[A-Za-z0-9À-ž-_]{1,8}))?)");
  // std::regex REGEX_NODE(R"(^\*\+?[A-Za-z0-9À-ž-_]{1,18}(\/(\*|[A-Za-z0-9À-ž-_]{1,8}))?)");
      
  // std::regex REGEX__ANY_FILTER_TARGET(R"(^[@#§+:*]\+?[A-Za-z0-9À-ž-_]{1,18}(\/(\*|[A-Za-z0-9À-ž-_]{1,8}))?$)");

  // std::regex REGEX_KEY(R"(^\w+? *:)");
  // std::regex REGEX_KEY_ESCAPED("(^(\"(?:(?!(?<!\\\\)\").)*?\"|'(?:(?!(?<!\\\\)').)*?'):(?!:))");
  // std::regex REGEX_ARRAY_START(R"(^\[)");
  // std::regex REGEX_ARRAY_END(R"(^\])");
  // std::regex REGEX_AND(R"(^\&)");
  // std::regex REGEX_OR(R"(^\|)");
  // std::regex REGEX_NOT(R"(^\~)");

  // std::regex REGEX_CODE_BLOCK_START(R"(^\(((([A-Za-z_][A-Za-z0-9À-ž_]*)[, ]*)*)\) *=> *(\(?))");
  // std::regex REGEX_CODE_BLOCK_START_SINGLE_ARG(R"(^([A-Za-z_][A-Za-z0-9À-ž_]*) *=> *(\(?))");

  // std::regex REGEX_DELETE(R"(^\-)");

  // std::regex REGEX_OBJECT_START(R"(^\{)");
  // std::regex REGEX_OBJECT_END(R"(^\})");

  // std::regex REGEX_BUFFER(R"(^\`(\d+)\:(.*)\`)");

  // std::regex REGEX_COMMENT(R"(^(# .*|###(.|\n)*?###))");

  // std::regex REGEX_COMMA(R"(^,)");
  // std::regex REGEX_PATH_SEPERATOR_STRING(R"(^\.)");
  // std::regex REGEX_PATH_SEPERATOR(R"(^\?)");

  // std::regex REGEX_REGEX(R"(^\/.*?(?<!\\)\/)");

  // std::regex REGEX_END(R"(^stop)");
  // std::regex REGEX_RETURN(R"(^return)");

  // std::regex REGEX_TYPE(R"(^<(([^:>]*?):)?(.*?)>)"); // <type> x
      
  // std::regex REGEX_STRING_PROPERTY(R"(^[ \n]*([A-Za-z_][A-Za-z0-9À-ž_]*))");

  // std::regex REGEX_POINTER(R"(^\$([A-Fa-f0-9_-]{2,48}))");

  // std::regex REGEX_INSERT(R"(^\^(\d*))");
  // std::regex REGEX_SPREAD_INSERT(R"(^\.\.\.\^(\d*))");

  // std::regex REGEX_ALL_BACKSLASHES(R"((?<!\\)\\(?!\\))");
  // std::regex REGEX_ALL_DBL_BACKSLASHES(R"(\\\\)");


  /*
  enum DatexProtocolDataType {
      REQUEST = 0,        // default datex request
      SESSION_REQUEST = 1, // datex request after establishing pseudo-'session'
      REQUEST_LOCAL = 2, // default datex request, but don't want a response (use for <Function> code blocks, ....)
      RESPONSE = 3, // response to a request (can be empty)
      CACHED_REQUEST = 4, // default datex request + cache data if no receiver found
    
      DATA = 5,           // store data (e.g. in a file)
      BC_TRANSACTION = 6,  // write to blockchain
      
      SUBSCRIBE = 7, // subscribe for pointer updates -> returns current pointer value
    
      REDIRECT = 8, // returns a recommended endpoint to which a request should be sent instead (e.g. pointer subscription redirects)
      HELLO = 9 // info message that endpoint is online
      // TODO ERROR ?
  };
  */


  /* DATEX Compiler */

  unsigned char* compile(char* datex_char) { 
    string datex;
    datex.assign(datex_char);

    int i = 0;
    
    std::smatch m;
    unsigned char* dxb = new unsigned char[4];
    dxb[i++] = 42;

    if (datex == "") datex = ";";

    for (int j=0; j<100; j++) {

      if (datex == "") break;
      else if (std::regex_search(datex, m, REGEX_NULL, std::regex_constants::match_continuous)) {
          datex = datex.substr(m.position()+m.length());
          dxb[i++] = BinaryCode::NULL_;
      }
      else if (std::regex_search(datex, m, REGEX_VOID, std::regex_constants::match_continuous)) {
          datex = datex.substr(m.position()+m.length());
          dxb[i++] = BinaryCode::VOID;
      }
    }
   
    dxb[i] = 0;

    return dxb;
  }


}