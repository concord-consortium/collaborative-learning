#!/bin/bash

npm run start &
wait-on http://localhost:8080

if [[ "$TRAVIS_COMMIT_MESSAGE" == *"[dev-build]"* ]]; then 
    npm run test:cypress:smoke
elif [[ "$TRAVIS_COMMIT_MESSAGE" == *"[clue]"* ]]; then 
    npm run test:cypress:clue
elif [[ "$TRAVIS_COMMIT_MESSAGE" == *"[dataflow]"* ]]; then 
    npm run test:cypress:clue    
else 
    npm run test:cypress
fi   