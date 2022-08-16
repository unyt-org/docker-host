#include <iostream>
#include <string>
#include "datex_runtime.h"

int main(int argc, char *argv[]) {
    printf ("DATEX Runtime\n");
    std::string str = argv[1];
    unsigned char *dxb = datex::compile(str);
    
    datex::print_dxb(dxb);
}