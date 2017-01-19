#!/bin/sh
# Copyright (c) The LHTML team
# See LICENSE for details.

target=$1

if [ -z "$target" ]; then
    target="mac"
fi

if [ "$target" = "mac" ]; then
    # mac
    electron-packager . LHTML --platform=darwin --arch=all --version=1.2.5 --out=dist --overwrite --icon resources/mac/lhtml.icns --extra-resource resources/mac/lhtml.icns --extend-info resources/mac/fileextensions.plist
fi

if [ "$target" = "linux" ]; then
    # linux
    electron-packager . LHTML --platform=linux --arch=all --version=1.2.5 --out=dist --overwrite
fi