# Firebase functions

The functions are split into two folders `functions-v1` and `functions-v2`. This folder `functions-v2` contains the newer functions. We are hoping to incrementally migrate the legacy functions from `functions-v1` into this folder.

## Available Functions

Named below by their implementation name. Five of them are deployed under a `_v2` suffix — see the
re-exports at the bottom of `src/index.ts` — and the suffixed name is what clients invoke and what
the `deploy:` scripts target, so `getAiContent` is called as `getAiContent_v2`.

|Function|Purpose|
|--------|-------|
|_onUserDocWritten_|Monitors Firestore user documents for changes and updates the Firestore class documents with the networks of all of the teachers in these classes|
|_onAnalyzableTestDocWritten_, _onAnalyzableProdDocWritten_|Monitor Firestore user metadata for updates to documents that request AI analysis, and put them into the analysis queue. One each for the test and prod roots.|
|_onAnalysisDocumentPending_|Monitors the queue for documents to analyze, and sends them to Shutterbug to create a screenshot of the document|
|_onAnalysisDocumentImaged_|Sends new screenshots to ChatGPT for analysis and creates a comment on the original document|
|_atMidnight_|Clears old Firebase roots for dev and qa instances|
|_onDocumentTagged_|Updates metadata documents with strategies as needed whenever a comment is made|
|_onDocumentSummarized_|Updates document summaries whenever a comment is made that has an ai agreement set|
|_postDocumentComment_|Posts a comment to a document in firestore, adding metadata for the document to firestore if necessary.|
|_postExemplarComment_|Posts a comment to a document in firestore that is labeled as being from the "exemplar user" (Ivan Idea).|
|_createFirestoreMetadataDocument_|Checks whether a specific commentable document exists in firestore and creates it if necessary.|
|_onClassDataDocWritten_|Summarizes a class's collected student and teacher work with an LLM whenever the scheduled task updates its document under `/aicontent`|
|_generateClassData_|Callable. Rebuilds a class-and-unit data doc on demand, which in turn triggers _onClassDataDocWritten_. The daily scheduled task normally does this; the callable exists so development and testing don't have to wait for it|
|_getAiContent_|Callable. Generates tile content from an LLM, given a client-supplied prompt plus the current summary of the class's work. Caches the response until the prompt or the summary changes|
|_chatTutorOnWrite_|Answers the AI chat tutor. Watches each conversation's `messages` subcollection, and on a student message assembles the context, calls OpenAI, and writes the assistant's reply back|

## Operations

Here are the basic development operations you can do after you cd into the `functions-v2` directory:

```shell
$ cd functions-v2
$ nvm use 20      # Recent version of node is required for these functions
$ npm install     # install local dependencies
$ npm --prefix ../shared ci   # ../shared has its own openai/zod; the build needs them
$ npm run lint    # lint the functions code
$ npm run test    # runs jest (unit) tests for the functions code (requires emulator, see below)
$ npm run build   # build the functions code (transpile TypeScript)
```

There is also a script, `src/categorize-docs.ts`, that uses the same procedure as _onAnalysisDocumentImaged_ to categorize a directory full of screenshots using ChatGPT. In order to use this, you would need to set an environment variable with the API key, as described in the comment at the top of that script.

## Runtime settings

Some behavior is read from Firestore on every invocation rather than from a Firebase parameter,
because parameters are read at deploy time and changing one means another `firebase deploy`.

|Document|Field|Effect|
|--------|-----|------|
|`analysis/settings`|`imagesEnabled`|`false` stops _onAnalysisDocumentPending_ calling Shutterbug. Any other value, a missing field, or a missing document means screenshots are taken as usual — the switch only ever turns them off.|

Flip it in the Firestore console; no deploy or redeploy is needed, and it takes effect on the next
document analyzed. It is there for a Shutterbug that is failing or overloaded. Firestore rules deny
clients everything under `analysis`, so only the functions can read or write it.

## Testing cloud functions

### Running tests locally (without running functions in the emulator)

```shell
$ npm run test:emulator         # start the firestore and database emulators
$ npm run test                  # run all tests in `functions` directory
```

To run `on-analysis-document-imaged.test.ts` you also need to create a `functions-v2/.secret.local` file with `OPENAI_API_KEY=[secret_key]`. You can get the key from 1password.

The chat tutor (`chatTutorOnWrite`) uses its own `OPENAI_TUTOR_API_KEY` secret — a separate key under its own OpenAI project so tutor usage is tracked apart from the comments/analysis functions. It does **not** read `OPENAI_API_KEY`, so having that one set is not enough. To exercise the tutor against the local emulator, add `OPENAI_TUTOR_API_KEY=[secret_key]` to `.secret.local` as well.

The tutor also reads its model from an `OPENAI_MODEL` param, which every other function hard-codes instead. It is a `defineString` with **no default**, so if you don't supply one the function sends `model: ""`, OpenAI rejects the request, and the conversation document ends up with `status: "error"`. Copy `.env.example` to `functions-v2/.env.local` and set a model there. It is config rather than a secret, so it is separate from `.secret.local`; both are gitignored by the `*.local` rule.

**Use `.env.local`, not `.env`.** The Firebase CLI reads `.env` at deploy time and applies its values to the deployed functions of whichever project is selected — so a local `OPENAI_MODEL` in `.env` would decide which model production calls. `.env.local` is the one Firebase reserves for emulation and never deploys.

In this approach the functions are running inside of Jest and they connect to the emulated Firestore and Realtime database services.

The tests use `firebase-functions-test`. This package does a little setup of environment variables so when the functions run they will connect to the emulator. This package also provides a way to mock some standard events and wraps the calls to the functions to emulate how they would be called in the cloud.  This is a simple and efficient way of testing the basic functionality without loading the function code into the emulator itself. The downside is that the functions are not responding to real events in Firestore or realtime database. If they are http functions they are not receiving the actual request event.

#### Notes

In the tests, the function cannot be imported normally. This is because the `firebase-functions-test`'s initialize function has to be called before the function code calls `initializeApp`. The standard practice for Firebase functions seems to be calling `initializeApp` at the module level not inside of the function body, so it will be called when the module is imported. The work around is to dynamically import the function. The docs for the `firebase-functions-test` use `require` to import the function, but we are trying to stick with the `import` syntax. The dynamic `import` syntax is asynchronous so it requires waiting, which means it can't be at the top level of the module. So the dynamic import of the function is inside of the test body. Typescript is able to track down the types for these dynamic imports. There is info about this approach in the code.

Because the tested functions are not responding to actual changes in the databases, it is necessary for the test to construct an event object that is then passed to the wrapped function. Additionally the database needs to be setup with documents before the test. The test has to make sure the event object is in sync with what is in the database.

`npm run emulator` and `npm run test:emulator` use a project name of `demo-test`. The `demo-` prefix is special and tells the emulator not to allow connections outside of itself. Without this project name being specified the emulator will use the project defined in `.firebaserc`, and will connect to the real version of any service that isn't being emulated.

That isolation is what you want for jest tests and for poking at documents in the emulator UI. It is the one thing you cannot have when a **browser** is driving the functions — see "Driving the functions from a browser" below.

### Running the functions in the emulator

```shell
npm run build
npm run emulator
```

This will load the built function code into the emulator. The only function we have so far is one that monitors Firestore docs for changes. So with the function running in the emulator you can manually change some docs and see if the function responds correctly.

To persist state between emulator runs, `npm run emulator` loads data from `functions-v2/emulator-data` when it starts, and saves data to the same location when it stops. It does this using the `--import` and `--export-on-exit` flags like so:

```
firebase emulators:start --project demo-test --import=./emulator-data --export-on-exit=./emulator-data
```

### Driving the functions from a browser

Some functions can only really be exercised by the app: `chatTutorOnWrite` answers a message that the chat tutor UI writes, and you want to see the reply arrive in the sidebar.

**`npm run emulator` does not work for this.** Start the emulator on the real project id instead:

```shell
npm run build
npx firebase emulators:start --project collaborative-learning-ec215 \
  --import=./emulator-data --export-on-exit=./emulator-data
```

Then load CLUE — from a dev server on the usual port — with the emulator params:

```
?appMode=qa&fakeClass=1&fakeUser=student:1&firestore=emulator&firebase=emulator&auth=emulator
```

For the chat tutor, add `&chatTutor` — units that don't set `chatTutorEnabled` show the launcher only when that param is present, and only for a student. Under `fakeClass=1` you also have to pick a group in the Join Group dialog before there is a document for the tutor to attach to.

**Why the project id has to match.** The client always initializes Firebase with the production project id; `useEmulator()` redirects the *host* it talks to, not the project it talks about. The functions emulator registers its triggers per project, so under `--project demo-test` the browser's write lands in a namespace where no trigger is watching. Nothing errors — the write succeeds, and the function simply never runs.

That failure is quiet and easy to misread: no console error, no functions log line, no change to the document. For the chat tutor it shows up as a typing indicator that spins forever, which looks exactly like a stale `lib/` from a skipped `npm run build`. If a browser-driven function seems dead, check the project id before you debug anything else.

The trade-off is the one the `demo-test` note above describes: on the real project id, any service you are not emulating will be the real one. Emulate all of them (the command above starts the full suite) and keep `appMode=qa` so nothing you create lands in production data.

## To deploy firebase functions

Run `npx firebase use [project]` to select which firebase project to deploy the functions to.
There are two project aliases configured in `.firebaserc`: `production` and `staging`.

Then run:
```shell
$ npm run deploy                        # deploy all functions
```

## Differences with functions-v1

- in `v2` the firebase-tools are a devDependency: it is not necessary to install them globally
