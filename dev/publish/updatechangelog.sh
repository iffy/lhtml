#!/bin/sh

set -e

thisdir="$(python -c "import sys, os; print os.path.dirname(sys.argv[1])" "$0")"

CHANGELOG="${thisdir}/../../CHANGELOG.md"

LAST_COMMIT=$(cat $CHANGELOG | grep "LAST COMMIT:" | cut -d":" -f2)
echo "LAST COMMIT: $LAST_COMMIT"

CURRENT_COMMIT=$(git log --format=%H -n1)

echo '<!-- THIS FILE IS AUTOMATICALLY UPDATED. SEE THE README -->' > _CHANGELOG.md
echo '<!--' "LAST COMMIT:${CURRENT_COMMIT}:" '-->' >> _CHANGELOG.md
"${thisdir}/extract_changes.sh" $LAST_COMMIT >> _CHANGELOG.md
tail -n +3 "${CHANGELOG}" >> _CHANGELOG.md
mv _CHANGELOG.md "${CHANGELOG}.md"
