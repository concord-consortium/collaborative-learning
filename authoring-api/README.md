# Authoring API

This is an Express based REST api that the authoring system uses to load/store files from the authoring client and sync changes to GitHub.

## Unit summary generation secrets

The `/generateUnitSummary` route needs an OpenAI API key and two model names. There are no code defaults, so a deploy to a project that is missing these fails.

Set the API key as a Firebase secret, once per project:

```bash
firebase functions:secrets:set OPENAI_UNIT_SUMMARY_API_KEY
```

Set the two model names as plain (non-secret) config values. See `.env.example` for the variable names (`UNIT_SUMMARY_DIGEST_MODEL`, `UNIT_SUMMARY_MODEL`) and for local emulator runs, which use `.env.local`. A deployed project's values live in its own `.env.<projectId>` file (e.g. `.env.collaborative-learning-ec215`), gitignored like the rest of this directory's `.env.*` files.
