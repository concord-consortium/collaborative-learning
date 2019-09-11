#!/bin/bash

npm run start &
wait-on http://localhost:8080

if [[ "$TRAVIS_COMMIT_MESSAGE" == *"[dev-build]"* ]]; then 
    npm run test:cypress:smoke
elif [[ "$TRAVIS_COMMIT_MESSAGE" == *"[df-build]"* ]]; then
    npm run test:cypress:dataflow
else 
    npm run test:cypress
fi   