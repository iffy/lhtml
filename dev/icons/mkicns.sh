#!/bin/sh

SOURCE=$1
DST=$2

if [ -z "$SOURCE" ] || [ -z "$DST" ]; then
    echo "usage: $0 source.png dst.icns"
    exit 1
fi

TMPDIR=$(mktemp -d -t mkicns)
echo "Working in $TMPDIR"

subdir="${TMPDIR}/whatevs.iconset"
mkdir -p "$subdir"

for i in 16 32 128 256 512; do
    convert -resize $i "$SOURCE" "${subdir}/icon_${i}x${i}.png"
done

iconutil --convert icns -o "$DST" "$subdir"
