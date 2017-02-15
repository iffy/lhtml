#!/bin/sh

if [ -z "$GH_TOKEN" ]; then
    echo "You must set GH_TOKEN"
    exit 1
fi

build --win --mac --linux --ia32 --x64 --draft -p always
