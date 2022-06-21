Here is the command used to generate the dependency diagram for the drawing-content:
```
depcruise --max-depth 3 -X node_modules -T dot --config -- src/plugins/drawing-tool/model/drawing-content.ts | dot -T svg | depcruise-wrap-stream-in-html > depcruise.html
```

The `--max-depth 3` is to keep it from spiralling out into the rest of the framework because there isn't a good separation of SDK for tools.
The `-X node_models` tells it to not traverse into the node_modules.
The `-- src/plugins/drawing-tool/model/drawing-content.ts` tells it to start from that file and work its way out.
`dot -T svg` turns it into an svg from the graph output format
`depcruise-wrap-stream-in-html > depcruise.html` wraps it in html that makes it interactive.