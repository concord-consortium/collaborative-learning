#!/bin/bash

npm run start &
wait-on http://localhost:8080

if [[ "$TRAVIS_COMMIT_MESSAGE" == *"[dev-build]"* ]]; then 
    npm run test:cypress:smoke
elif [[ "$TRAVIS_BRANCH" != "master" ]]; then
    # echo "elif TRAVIS_BRANCH=$TRAVIS_BRANCH"
    npm run test:cypress:branch
else 
    echo "else TRAVIS_BRANCH=$TRAVIS_BRANCH"
    # npm run test:cypress
fi  
   