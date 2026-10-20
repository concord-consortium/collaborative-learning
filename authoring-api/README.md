# Authoring API

This is an Express based REST api that the authoring system uses to load/store files from the authoring client and sync changes to GitHub.

## Unit summary generation secrets

The `/generateUnitSummary` route needs an OpenAI API key and two model names. There are no code defaults, so a deploy to a project that is missing these fails.

Set the API key as a Firebase secret, once per project:

```bash
firebase functions:secrets:set OPENAI_UNIT_SUMMARY_API_KEY
```

Set the two model names as plain (non-secret) config values. See `.env.example` for the variable names (`UNIT_SUMMARY_DIGEST_MODEL`, `UNIT_SUMMARY_MODEL`) and for local emulator runs, which use `.env.local`.

## Deploy-time params

A deployed project's values are in its own committed file: `.env.collaborative-learning-ec215` (production) and `.env.collaborative-learning-staging` (staging). The Firebase CLI reads the file for the project being deployed. These files are the record of what each project runs. The convention is the same as in `functions-v2`; see "Deploy-time params" in [functions-v2/README.md](../functions-v2/README.md).

- A new deploy-time param goes into **both** project files, in the same commit as the code that reads it. `src/deploy-env-files.test.ts` fails until it does. If a file leaves a param out, the CLI asks for a value during the deploy, even when the param has a default, and a non-interactive deploy fails.
- What each param means is documented once, in `.env.example`. The project files carry only values.
- Secrets never go in these files. They use `defineSecret` and Secret Manager.
- **`DANGEROUSLY_SKIP_AUTH_TOKEN_VALIDATION` goes in `.env.local` only.** It turns off the ID token check, so it must never be in a project file or in `.env`. The test fails if a project file sets it.
- Do not create a plain `.env`. The CLI reads it at deploy time and deploys any key it sets that the project file does not.
