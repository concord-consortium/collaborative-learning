# Firebase functions
The functions are split into two folders `functions-v1` and `functions-v2`. This folder `functions-v2` contains the newer functions. We are hoping to incrementally migrate the legacy functions from `functions-v1` into this folder.

## Available Functions

|Function|Purpose|
|--------|-------|
|_updateClassDocNetworksOnUserChange_|Monitors Firestore user documents for changes and updates the Firestore class documents with the networks of all of the teachers in these classes|

Here are the basic development operations you can do after you cd into the `functions-v2` directory:
```
$ cd functions-v2
$ npm install     # install local dependencies
$ npm run lint    # lint the functions code
$ npm run test    # runs jest (unit) tests for the functions code (requires emulator, see below)
$ npm run build   # build the functions code (transpile TypeScript)
```

## Testing cloud functions

### Running tests locally (without running functions in the emulator)
```
$ npm run test:emulator         # start the firestore and database emulators
$ npm run test                  # run all tests in `functions` directory
```
In this approach the functions are running inside of Jest and they connect to the emulated Firestore and Realtime database services.

The tests use `firebase-functions-test`. This package does a little setup of environment variables so when the functions run they will connect to the emulator. This package also provides a way to mock some standard events and wraps the calls to the functions to emulate how they would be called in the cloud.  This is a simple and efficient way of testing the basic functionality without loading the function code into the emulator itself. The downside is that the functions are not responding to real events in Firestore or realtime database. If they are http functions they are not receiving the actual request event.

#### Notes
In the tests, the function cannot be imported normally. This is because the `firebase-functions-test`'s initialize function has to be called before the function code calls `initializeApp`. The standard practice for Firebase functions seems to be calling `initializeApp` at the module level not inside of the function body, so it will be called when the module is imported. The work around is to dynamically import the function. The docs for the `firebase-functions-test` use `require` to import the function, but we are trying to stick with the `import` syntax. The dynamic `import` syntax is asynchronous so it requires waiting, which means it can't be at the top level of the module. So the dynamic import of the function is inside of the test body. Typescript is able to track down the types for these dynamic imports. There is info about this approach in the code.

Because the tested functions are not responding to actual changes in the databases, it is necessary for the test to construct an event object that is then passed to the wrapped function. Additionally the database needs to be setup with documents before the test. The test has to make sure the event object is in sync with what is in the database.

`npm run emulator` and `npm run test:emulator` use a project name of `demo-test`. The `demo-` prefix is special and tells the emulator not to allow connections outside of itself. Without this project name being specified the emulator will use the project defined in `.firebaserc`, and will connect to the real version of any service that isn't being emulated.

### Running the functions in the emulator
```
npm run build
npm run emulator
```
This will load the built function code into the emulator. The only function we have so far is one that monitors Firestore docs for changes. So with the function running in the emulator you can manually change some docs and see if the function responds correctly.

## To deploy firebase functions to production:
```
$ npm run deploy                        # deploy all functions
```

## Differences with functions-v1
- in `v2` the firebase-tools are a devDependency: it is not necessary to install them globally
