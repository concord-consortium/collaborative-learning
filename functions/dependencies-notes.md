# Dependencies Notes

Notes on dependencies, particularly reasons for not updating to their latest versions.

We are currently stuck on older versions of the firebase packages until we update at least our unit testing code.

## Upgrading `@firebase/rules-unit-testing` to `1.3.16` or higher

This causes:
```
    TypeError: Cannot read properties of undefined (reading 'INTERNAL')

      at fireauth.util.getEnvironment (node_modules/@firebase/auth/dist/src/utils.js:681:7)
      at new Ze (node_modules/@firebase/auth/dist/src/utils.js:1225:32)
      at node_modules/@firebase/auth/dist/src/rpchandler.js:371:5
      at Object.<anonymous> (node_modules/@firebase/auth/dist/auth.js:438:9)
      at Object.<anonymous> (node_modules/firebase/dist/index.node.cjs.js:4:1)
```
This error happens when just importing it, even without calling any of its functions.

My guess based on looking at similar issues on Stack Overflow is that the required import style has changed for the library. However I can't find old documentation to know the recommended import style.

## Upgrading `firebase-admin` to `^10.0.2` or higher

This fails because `rules-unit-testing@"^1.3.15` requires a peer of `firebase-admin@"^9.7.0`.

## Intermediate solution

Without changing the code the best thing I've found to keep most of the dependencies up-to-date is is to run `npm audit fix --package-lock-only` this prevents issues that break our code.

## Best solution

The best solution is to upgrade all of the firebase dependencies. Then we have to reactor the way the tests are working with the emulator and mocking the firebase admin object.

The official firebase documentation recommends unit testing firebase using a real firebase project. This is fragile, so we'd prefer to keep using our emulator based approach.

I found this blog post and repo:
https://timo-santi.medium.com/jest-testing-firebase-functions-with-emulator-suite-409907f31f39
https://github.com/diginikkari/jest-testing-firebase-functions-with-emulator-suite

And here is another one:
https://laurentcazanove.com/articles/testing-firebase-functions-with-emulators-suite/

They both describe the same pattern for working with the emulator to unit test firebase functions. They do not use the `rules-unit-testing package`.  Instead they use `firebase-functions-test` and set environment variables to modify the behavior of the firestore packages. In the first `FIRESTORE_EMULATOR_HOST` environment variable is used. In the second `FIREBASE_AUTH_EMULATOR_HOST` is used. `firebase-functions-test` provides methods for clearing the firestore data like `clearFirestoreData` that we are using from `rules-unit-testing package`.

The first one also calls `admin.initializeProject` with a different `projectId` on each test. Both approaches are from 2021 though, so I think a first step would be to clone the first one and then upgrade the dependencies to see if the approach still works with the latest firebase packages.

Something neither blog post describes is emulating the firebase realtime database. Our functions require this and the emulator supports it, so hopefully it is just another environment variable we can set. This would allow us to remove all mocking from the functions.

It is likely that we'll have to populate the realtime database and firestore emulators with seed data before the tests can be successfully run.
