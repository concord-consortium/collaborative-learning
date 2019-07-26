#!/bin/bash

if [[ "$TRAVIS_COMMIT_MESSAGE" == *"dev-build"* ]]; then 
    cypress run --spec "cypress/integration/smoke/single_student_canvas_test.js" --config video=false,defaultCommandTimeout=8000 --env testEnv=local
else 
    npm run test:cypress
fi   