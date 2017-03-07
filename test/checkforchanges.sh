#!/bin/bash

TARGET_BRANCH=${TRAVIS_BRANCH:-master}

PR_BRANCH=${TRAVIS_PULL_REQUEST_BRANCH:-$1}
if [ -z "$PR_BRANCH" ]; then
    echo "Not a pull request, so skipping change snippet check"
    exit 0
fi

git fetch origin "${TARGET_BRANCH}"
ADDED_SNIPPETS=$(git diff --name-only --diff-filter=A "${TARGET_BRANCH}..." -- changes/)

echo "$ADDED_SNIPPETS"

if [ -z "$ADDED_SNIPPETS" ]; then
    echo "FAILURE: Missing a change snippet."
    exit 1
else
    echo "OK: At least one change snippet detected."
fi
