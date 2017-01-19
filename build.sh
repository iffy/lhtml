#!/bin/sh
# Copyright (c) The LHTML team
# See LICENSE for details.

target=$1

if [ -z "$target" ]; then
    target="all"
fi

# mac
if [ "$target" = "mac" ] || [ "$target" = "all" ]; then
    electron-packager . LHTML --platform=darwin --arch=all --version=1.2.5 --out=dist --overwrite --icon resources/mac/lhtml.icns --extra-resource resources/mac/lhtml.icns --extend-info resources/mac/fileextensions.plist
fi

# linux
if [ "$target" = "linux" ] || [ "$target" = "all" ]; then
    electron-packager . LHTML --platform=linux --arch=all --version=1.2.5 --out=dist --overwrite
fi

# windows
if [ "$target" = "win" ] || [ "$target" = "all" ]; then
    electron-packager . LHTML --platform=win --arch=all --version=1.2.5 --out=dist --overwrite
fi