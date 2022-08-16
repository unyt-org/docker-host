#include "datex_runtime.cpp"

/* DATEX Compiler */


extern "C" {
  extern void console_log(char* sum);

  unsigned char* compile(char* datex) { 
    unsigned char *dxb;
    console_log(datex);
    dxb = datex::compile(datex);
    return dxb;
  }
}