#/bin/bash

rm -f dist/origin-response-function.zip dist/viewer-request-function.zip

mkdir -p dist && cd lambda/origin-response-function && zip -FS -q -r ../../dist/origin-response-function.zip * &&cd ../..
