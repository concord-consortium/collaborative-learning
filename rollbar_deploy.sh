#!/bin/bash
# ROLLBAR_POST_SERVER_ITEM must be defined (e.g. as Travis secure environment variable)
# TRAVIS_BRANCH and TRAVIS_COMMIT must be defined (defined by default in Travis)
STAGING_BRANCH='master'
PRODUCTION_BRANCH='production'
ENVIRONMENT=''

if [[ -z $ROLLBAR_POST_SERVER_ITEM ]]; then
  echo "Error: ROLLBAR_POST_SERVER_ITEM environment variable not defined"
  exit 1
fi

if [[ $TRAVIS_BRANCH == $STAGING_BRANCH ]]; then
  ENVIRONMENT='staging'
fi
if [[ $TRAVIS_BRANCH == $PRODUCTION_BRANCH ]]; then
  ENVIRONMENT='production'
fi

if [[ -n $ENVIRONMENT ]]; then
  LOCAL_USERNAME=`whoami`
  curl https://api.rollbar.com/api/1/deploy/ \
    -F access_token=$ROLLBAR_POST_SERVER_ITEM \
    -F environment=$ENVIRONMENT \
    -F revision=$TRAVIS_COMMIT \
    -F local_username=$LOCAL_USERNAME
fi
