This is a two part configuration:
- ESLint is configured to catch out of order imports
- ESLint is also configured to autofix things when the file is saved

# Plan to implement
- get fix on save added to vscode config
- add comma-spacing eslint rule:
  - it seems to only modify 30 files in `src`/` I didn't test the cypress folder though, if there is a different style in cypress we can add overrides for that folder
- add curly-object-spacing rule:
  - it seems to modify 300 files. I didn't check them all carefully, some of them might be json curriculum files that we could ignore at this point.

## Add indent rule
This is the hard one. I think I'd recommend this config:
```js
  "indent": ["error", 2, {
    SwitchCase: 1,
    FunctionDeclaration: { parameters: 2 },
    FunctionExpression: { parameters: 2 },
  }],
```

It has problems with:
- our ternary styling: there are many cases where the parts of the ternary are indented to the closest tabstop below the condition. I don't see a way to match that. So either we:
  - disable ternary indentation checking and fixing with:  `ignoredNodes: [ "ConditionalExpression" ]`.
  - switch to one of the supported indentation formatting
  - look for another rule which can handle them for us.
- maps within JSX:
  - there is a jsx-indent plugin which has rules for the indentation of jsx, it might be possible to use it fix the map problem. However we'll also have to use ignoreNodes in the indent rule so they don't fight with each other.

## Add simple import rule
```js
  "simple-import-sort/imports": ["error", {
    groups: [
      // Non assigned, this will match a shorter string than the css group
      ["^\\u0000"],
      // Node.js builtins prefixed with `node:`.
      ["^node:"],
      // Packages.
      // Things that start with a letter (or digit or underscore), or `@` followed by a letter.
      // Always put react first
      ["^react$", "^@?\\w"],
      // Absolute imports and other imports such as Vue-style `@/foo`.
      // Anything not matched in another group.
      ["^"],
      // Relative imports.
      // Anything that starts with a dot.
      ["^\\."],
      // Assets
      ["\.png$", "\.svg$"],
      // Non assigned css imports
      ["^\\u0000.*\.(css|sass|scss)"],
      // Non assigning local registration imports
      ["^\\u0000\..*/register-", "^\\u0000\..*-registration$"]
    ]
  }],
```

# Changes to make before fixing the whole source with eslint-plugin-simple-import-sort:
- `app-icons.tsx` this is manually grouped. **solution**: disable import sorting
- `geometry-tool-button.tsx` this is manually grouped.  **solution**: disable import sorting
- `dataflow/.../node.ts` this is manually grouped.  **solution**: disable import sorting
- `dataflow/.../demo-output-control-assets.tsx` this is manually grouped. I'd guess it'd be OK to just let the rule reorder this grouping. We could add comments above the first import of each group to break it up a little.

# Notes
Dealing with formatting like above is probably not what we should be doing:
https://typescript-eslint.io/linting/troubleshooting/formatting

- Hopefully we can also configure VSCode to put the imports in the correct order when it adds them to the file:
"TypeScript Import Sorter"

The popular `import/order` ESLint plugin will ignore all unassigned imports. This includes our style imports.
Stuff like: `import "./app.scss";`
Here is the note about it:
https://github.com/import-js/eslint-plugin-import/issues/1639#issuecomment-580862011

It is possible to give unassigned imports a warning, but they won't be auto fixed, so this isn't very useful.

Another option is eslint-plugin-simple-import-sort
Which will group unassigned imports but says it will not sort them within the group.
That approach might be good enough for us.
This one seems good enough except that has alphabetical sorting which is going to make the change set very
large. And if people don't have autofix on save turned on it will make the PRs very noisy with ESLint warnings


There is also:
https://eslint.org/docs/latest/rules/sort-imports
This seems to only sort by the imported members not the files they are imported from.

VSCode extension: TypeScript Import Sorter
- this doesn't group imports

Features we are looking for:
- put css imports at the bottom
- put empty lines between some groups
- group asset imports
- might need to to disable it in some cases
- it would be nice if we could turn off alphabetical sorting, this is nice but will result in a much large changeset


# TODO: Need to add a plugin to fix the formatting of multiple import items
Could use prettier or maybe another ESLint whitespace plugin
Incrementally add new ESLint rules so that the import reordering whitespace is addressed properly
- the comma-spacing rule seems like a fine one to enable
- the "indent" rule is much harder:
  - the indenting of the actions and views of a MST model goes against what is done in other cases it seems, but maybe not. "MemberExpression" seems to be the option to control this.
  - the indentation of multi-line function parameters doesn't match what I'd want. "FunctionDeclaration.parameters" seems to be this setting. Default is `1` we might want it to be `2` or it could be first. Or we could just turn it off for now.
  - will this conflict with what VSCode does already with auto indenting a file? How does that auto indenting work?
  - it seems the best approach is to only apply this indentation to the imports with this style:
  ```
    "indent": ["error", 2, {
      ignoredNodes: [ ":not(ImportDeclaration, ImportDeclaration *)" ],
      ImportDeclaration: "first",
    }],
  ```
- the `"object-curly-spacing": ["error", "always"]`, causes a lot of changes but it seems OK
- we probably want to enable auto fix on save before turning any of these on, otherwise new PRs are going to lots of frivolous formatting errors
- perhaps we can find a way to disable these kinds of errors on production/ CI builds. This way the errors only show up for developers locally, but by the time we get to CI we don't have to care about them.


- `image-map.test.ts` import plugin tries to re-order the imported items and messes up the spacing. This is why we need the formatting fixes described above.

I haven't found a plugin which can format our multi-line imports in the same style that we like. The plugins I've found will put each imported item on its own line if the set of them is too long for the max-line length. This seems to be the same thing that prettier does.
