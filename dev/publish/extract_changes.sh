#!/bin/sh
# This script extracts changes from git's log and spits them out in a markdown
# format for inclusion in the CHANGELOG

SINCE_SHA=$1

if [ -z "$SINCE_SHA" ]; then
    echo "usage: $0 SHA"
    echo "SHA should be the Git commit SHA from which to start looking for changes"
    echo "ERROR: quitting"
    exit 1
fi

thisdir="$(python -c "import sys, os; print os.path.dirname(sys.argv[1])" "$0")"
version=$(cat "${thisdir}/../../package.json" | grep version | cut -d'"' -f4)

#---------------------------------------------------------------
# Version header
#---------------------------------------------------------------

echo
if echo "$version" | egrep '^.*\.0\.0'; then
    # major version
    echo "# v${version}"
elif echo "$version" | egrep '^.*\.*\.0'; then
    # minor version
    echo "## v${version}"
else
    # bugfix version
    echo "### v${version}"
fi
echo

#---------------------------------------------------------------
# Changelog body
#---------------------------------------------------------------

git log --format=%B "$SINCE_SHA"... | egrep '^(fix|break|feature|refactor|misc):' | while read line; do
    change_type="$(echo $line | cut -d':' -f1)"
    rest="$(echo $line | cut -d':' -f2-)"
    case "$change_type" in
        fix)
            echo '- **BUGFIX:**' "$rest"
            ;;
        break)
            echo '- **BACKWARDS INCOMPATIBLE CHANGE:**' "$rest"
            ;;
        feature)
            echo '- NEW:' "$rest"
            ;;
        refactor|misc)
            echo "- $rest"
            ;;
        *)
            echo >&2 "ERROR: Unknown change type: ${change_type}"
            exit 1
    esac
    echo
done
