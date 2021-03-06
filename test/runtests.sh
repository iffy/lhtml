#!/usr/bin/env bash

if [[ "$TRAVIS_OS_NAME" == "linux" ]]; then
  export DISPLAY=:99.0
  sh -e /etc/init.d/xvfb start
  sleep 3
fi

echo "node $(node --version)"
echo "npm $(npm --version)"
echo "yarn $(yarn --version)"

rc=0
if ! mocha; then
    rc=1
fi
if ! RUN_TESTS="yes" electron . ; then
    rc=1
fi
exit $rc
