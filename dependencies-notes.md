# Dependencies Notes

Notes on dependencies, particularly reasons for not updating to their latest versions.

## Node / npm Engine Spec

`package.json` declares `"node": "^20.19.0 || ^22.13.0 || >=24"`. Combined with `engine-strict=true` in `.npmrc`, contributors on older Node versions will get a hard `npm install` failure. The constraint is driven by transitive dev dependencies pulled in by the TypeScript 5 / typescript-eslint 8 upgrade — notably `eslint-plugin-jest@29` (requires `^20.12.0 || ^22.0.0 || >=24.0.0`) and `eslint-visitor-keys@5` (requires `^20.19.0 || ^22.13.0 || >=24`). When updating these or related ESLint packages, re-check their `engines` fields and bump this spec to match the strictest transitive requirement.

## Development Dependencies

|Dependency                  |Current Version|Latest Version|Notes                                                                        |
|----------------------------|---------------|--------------|-----------------------------------------------------------------------------|
|@types/react                |18.3.12        |19.2.14       |Tied to `react` upgrade below.                                               |
|@types/react-dom            |18.3.1         |19.2.3        |Tied to `react` upgrade below.                                               |
|ts-json-schema-generator    |2.4.0          |2.9.0         |v2.5+ requires Node >= 22; CI runs Node 20.                                  |

## Runtime Dependencies

|Dependency          |Current Version|Latest Version|Notes                                                                                |
|--------------------|---------------|--------------|-------------------------------------------------------------------------------------|
|@chakra-ui/react    |2.10.5         |3.35.0        |Brought in with CODAP's Graph component. CODAP uses v2; v3+ not attempted.           |
|firebase            |8.10.1         |12.12.1       |Version 9 requires substantial migration; attempted update with `compat` imports failed. Latest is now v12.|
|immutable           |4.3.0          |5.1.5         |v5 not attempted; only required by legacy slate versions.                            |
|mobx-state-tree     |6.0.0-cc.1     |7.2.0         |We are using a concord fork which fixes a bug. Latest version changes TS types for arrays which broke a number of our models.|
|nanoid              |3.3.4          |5.1.11        |v4+ switched to ESM and dependencies such as postcss break with v4.                  |
|react               |18.3.1         |19.2.5        |React 19 upgrade not yet attempted; would also require updating the React-tied rows above.|
|react-data-grid     |7.0.0-beta.44  |7.0.0-beta.59 |We patch react-data-grid (CODAPv3's patch); our patch is beta.44-only.               |
|react-dom           |18.3.1         |19.2.5        |Tied to `react` upgrade above.                                                       |
|react-tippy         |1.4.0          |1.4.0         |Unmaintained since May 2020. Migration target if we move off it is [Floating UI](https://floating-ui.com/) (`@floating-ui/react`).|
