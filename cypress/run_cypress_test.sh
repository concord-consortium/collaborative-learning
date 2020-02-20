#!/bin/bash

declare -a BRANCH_ARRAY=("master" "production" "dataflow" "dataflow_production")

npm run start &
wait-on http://localhost:8080
echo "start TRAVIS_BRANCH=$TRAVIS_BRANCH"

if [[ "$TRAVIS_COMMIT_MESSAGE" == *"[dev-build]"* ]]; then
    echo "dev-build"
    npm run test:cypress:smoke
elif !(echo $BRANCH_ARRAY | grep -q $TRAVIS_BRANCH); then
    echo "elif TRAVIS_BRANCH=$TRAVIS_BRANCH"
    npm run test:cypress:branch
else
    echo "else TRAVIS_BRANCH=$TRAVIS_BRANCH"
    npm run test:cypress
fi
