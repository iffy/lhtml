#!/bin/sh

# this isn't perfect, but it's close enough
thisdir="$(dirname $0)"
PROJECT_ROOT="${thisdir}/../../"
CHANGE_ROOT="${PROJECT_ROOT}/changes"

log() {
    echo >&2 $* 
}

listtype() {
    for type in $@; do
        ls "${CHANGE_ROOT}"/${type}-*.md 2>/dev/null | sort
    done
}

#---------------------------------------------------------------
# Version header
#---------------------------------------------------------------
version=$(cat "${thisdir}/../../package.json" | grep version | cut -d'"' -f4)
echo >> _CHANGELOG.md
if echo "$version" | egrep '^.*\.0\.0' > /dev/null; then
    # major version
    echo "# v${version}"
elif echo "$version" | egrep '^.*\.*\.0' > /dev/null; then
    # minor version
    echo "## v${version}"
else
    # bugfix version
    echo "### v${version}"
fi
echo

#---------------------------------------------------------------
# Change body
#---------------------------------------------------------------

for changefile in $(listtype break); do
    echo "- **BACKWARD INCOMPATIBLE:** $(cat $changefile)"
    echo
done

for changefile in $(listtype fix); do
    echo "- **FIX:** $(cat $changefile)"
    echo
done

for changefile in $(listtype feature new); do
    echo "- NEW: $(cat $changefile)"
    echo
done

for changefile in $(listtype refactor info doc); do
    echo "- $(cat $changefile)"
    echo
done

