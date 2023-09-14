Dependency Cruiser is a library for building diagrams of the dependencies.
https://github.com/sverweij/dependency-cruiser/

The commands below assume you've run:
`npm install --global dependency-cruiser`

They also assume you have graphviz installed:
`brew install graphviz`

The commands below pass various options to dependency cruiser, you can read about those options in dependency cruiser's docs.

Additionally they pipe the output to:
- `dot -T svg` turns it into an svg from the graph output format. `dot` is a command from GraphViz.
- `depcruise-wrap-stream-in-html > depcruise.html` wraps the svg output from graphviz (dot) in html that makes it interactive.

# Examples of graphing dependencies in the drawing tile

The following command graphs:
- files in the drawing folder.
```
depcruise --include-only "^src/plugins/drawing" -T dot --config -- src/plugins/drawing/drawing-registration.ts | dot -T svg | depcruise-wrap-stream-in-html > depcruise.html
```

The following command graphs:
- files in the drawing folder.
- first level of files outside of the drawing folder that files in the drawing folder depend on
```
depcruise --do-not-follow "^(?\!src/plugins/drawing).+" -T dot --config -- src/plugins/drawing/drawing-registration.ts | dot -T svg | depcruise-wrap-stream-in-html > depcruise.html
```

The following command graphs:
- files in the drawing folder.
- first level of files outside of the drawing folder that files in the drawing folder depend on
- files outside drawing folder that depend on files inside the drawing folder.
```
depcruise --do-not-follow node_modules --focus "^src/plugins/drawing" -T dot --config -- src/plugins/drawing/drawing-registration.ts | dot -T svg | depcruise-wrap-stream-in-html > depcruise.html
```

If you want to just look at dependencies starting from a file this one will just go 3 deep from a file. It is configured to not follow dependencies in the node_modules:
```
depcruise --max-depth 3 -X node_modules -T dot --config -- src/plugins/drawing/model/drawing-content.ts | dot -T svg | depcruise-wrap-stream-in-html > depcruise.html
```
