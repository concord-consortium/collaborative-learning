// declare modules that don't have TypeScript bindings here

declare module "slate-md-serializer";

// Allow untyped imports from SASS files. Typed imports should be possible
// (cf. https://mattferderer.com/use-sass-variables-in-typescript-and-javascript),
// but I couldn't get this to work, likely because of our tsconfig settings.
// Current recommendations are to use `module: es6/esnext`, `moduleResolution: node`,
// and `esModuleInterop: true`, but that would require code changes to all of our
// "import * as foo" imports. To get the types to work, the following line should be
// removed and individualized types declared.
// Note also that we use the ".scss" format rather than the ".sass" format because
// the `:export` syntax seems not to be supported in ".sass" files.
declare module "*.scss";
