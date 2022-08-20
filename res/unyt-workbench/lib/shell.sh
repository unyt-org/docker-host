#!/bin/bash
function faketty { 
	script -qefc "$(printf "%q " "$@")" /dev/null
};
faketty "bash"