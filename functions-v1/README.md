# Firebase Functions
The functions are split into two folders `functions-v1` and `functions-v2`. This folder `functions-v1` contains the legacy functions. We are hoping to incrementally migrate these legacy functions into the newer `functions-v2`.


## Available Functions

|Function|Purpose|
|--------|-------|
|_getImageData_|Retrieves image data that may reside in other classes and hence is not accessible client-side, e.g. for supports published to multiple classes or documents retrieved via the teacher network.|
|_getNetworkDocument_|Retrieves the contents of a document accessible to a teacher via the teacher network.|
|_getNetworkResources_|Retrieves the list of resources (documents) available to a teacher via the teacher network.|
|_postDocumentComment_|Posts a comment to a document in firestore, adding metadata for the document to firestore if necessary.|
|_publishSupport_|Publishes a document as a support that is accessible to all of a teacher's classes (including any referenced images).|
|_validateCommentableDocument_|Checks whether a specific commentable document exists in firestore and creates it if necessary.|

Here are the basic development operations you can do after you cd into the `functions-v1` directory:
```
$ cd functions-v1
$ npm install     # install local dependencies
$ npm run lint    # lint the functions code
$ npm run test    # runs jest (unit) tests for the functions code
$ npm run build   # build the functions code (transpile TypeScript)
```
### Note 1
There seems to be an uneasy relationship between the `node_modules` folder in the
`functions-v1` directory and the one in the parent directory. I had to explicitly specify the
path to typescript in the `build` function. There's probably a better configuration available,
but in the meantime this seems to mostly work.

### Note 2
When running `npm run test` with node 16, the following error is shown
```
TypeError: Cannot read properties of undefined (reading 'INTERNAL')
```
This error is triggered by the following line in `test-utils.ts`
```
import { useEmulators } from "@firebase/rules-unit-testing";
```
The current work around is to use node 14 to run the tests.

See functions/dependency-notes.md for more on this.

### Testing cloud functions

Google recommends (requires?) that [firebase-tools](https://www.npmjs.com/package/firebase-tools) be installed globally:
```
$ npm install -g firebase-tools
```
This should be run periodically to make sure you're running the latest version of the tools.

#### Running tests locally (without running functions in the emulator)
```
$ npm run serve                 # build and then start the emulators
$ npm run test                  # run all tests in `functions` directory
$ npm run test -- some.test.ts  # run a particular test
```
The existing tests currently work this way. They test the basic functionality of the cloud functions by importing and calling them directly from node.js test code. This is a simple and efficient way of testing the basic functionality without all the overhead of the functions emulator. The downside is that the node.js test environment is not the same as the hosted function environment. For instance, it's possible to return objects in node.js that can't be JSON-stringified which will throw an error when the function is hosted. That said, you can't beat the convenience of simply calling the functions directly.

#### Running local tests against functions hosted in the emulator
To run jest tests against functions running in the emulator requires [serving functions using a Cloud Functions Shell](https://firebase.google.com/docs/functions/local-shell#serve_functions_using_a_cloud_functions_shell). Currently, all of our functions are `HTTPS Callable` functions, which [can be called](https://firebase.google.com/docs/functions/local-shell#invoke_https_callable_functions) in this shell mode, but:
>Emulation of context.auth is currently unavailable.

#### Running CLUE against functions running locally in the emulator:
```
$ npm run serve   # build and then start the functions emulator
```
and launch CLUE with url parameter `functions=emulator`.

### To deploy firebase functions to production:
```
$ npm run deploy                        # deploy all functions
$ npm run deploy:getImageData           # deploy individual function
$ npm run deploy:postDocumentComment    # deploy individual function
```

By convention, our firebase functions have an internal version number that is returned with any results. This should be incremented appropriately when new versions are deployed. This will allow us to determine whether the current code in GitHub has been deployed or not, for instance. Also by convention, our firebase functions accept parameters of `{ warmUp: true }` which can be issued in advance of any actual call to mitigate the google cloud function cold-start issue.

### Serving CLUE from https://localhost
To test the deployed function(s) from your local development environment, you may need to run your local dev server with https to avoid CORS errors. To do so, [create a certificate](https://www.matthewhoelter.com/2019/10/21/how-to-setup-https-on-your-local-development-environment-localhost-in-minutes.html) in your `~/.localhost-ssl` directory and name the files `localhost.pem` and `localhost.key`. To use the certificate:
```
$ npm run start:secure
```
