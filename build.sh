#!/bin/sh
# Copyright (c) The LHTML team
# See LICENSE for details.

# mac
electron-packager . LHTML --platform=darwin --arch=all --version=1.2.5 --out=dist --overwrite --icon resources/mac/lhtml.icns --extra-resource resources/mac/lhtml.icns --extend-info resources/mac/fileextensions.plist
