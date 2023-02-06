The text tile can be customized with text tile plugins.

These plugins are added by calling `registerTextPluginInfo`. The one example so far is the variables text plugin which is registered by `shared-variables-registration`.

A text tile plugin has to provide the following info:
- `pluginName`: this is used to identify the plugin. It should be unique among all plugins added to the text tile. It is not serialized.
- `createSlatePlugin`: this is a function called with a parameter of the text content model. The function is called when the text tile is mounted. The function should return a plugin instance. This plugin instance needs to have an `onInitEditor(editor: Editor)` function which should return its `editor` argument wrapped with the plugin. The plugin instance will also be available to any button components the plugin adds.
- `buttonDefs` a map of button ids to button components. These button ids need to be added to the CLUE configuration for the unit so the button shows up on the toolbar.
- `updateTextContentAfterSharedModelChanges`: this is an optional function. If provided, it will be called by the text content model when any of the shared models linked with the text content model changes.  The text content model will not create these links itself. It is the job of the plugin to link these shared models. In the variables text plugin, this link is created if it doesn't exist when the plugin instance is created.

The button components should be of type `ButtonDefComponent`. This means they receive the following properties:
- `editor` the slate editor instance
- `pluginInstance` the plugin instance returned by createSlatePlugin
- `valueRevision` a number that is incremented each time the Slate state (value) changes.

To be consistent with the rest of the TextTile toolbar buttons these ButtonDefComponents should use the `TextToolbarButton` component to render themselves. It is the responsibility of the plugin button component to figure out if it should be selected and/or enabled. The button component will be re-rendered each time the Slate value changes, so it can recompute the selected and/or enabled properties.

If the plugin is creating a "void" slate element it should add the `kSlateVoidClass` to the top level element it renders. This is so cut and paste and focus works. I'm not sure if this is still needed with the latest version of Slate.

The toolbar buttons and any components rendered within the Slate editor have access to two React contexts:
- `TextContentModelContext` this provides the text content model. In the future this might be made more general so any components of any tile can access their tile's content model.
- `TextPluginsContext` this provides the plugins that were registered with the text tile. Toolbar buttons don't need this because they are passed the plugin instance that registered them. This context is useful for components rendered within the rich text. For example the SharedVariables chip component uses it to look up the shared variables.

Note: There has been an issue with the combination of CLUE, Slate and Cypress, so it might be difficult to test your plugin with Cypress.

Note: The slate-editor defines a EFormat.variable which it shouldn't be doing. It is not necessary to modify the slate-editor library in order for a plugin to add new element or mark types.

TODO:
- [x] update the plugin register function to have multiple tools
- [x] unify the tool information from the plugins with the tool information used for the built in buttons
- [x] change the code that is figuring out if a tool should be enabled and/or selected so it is inside of the button component.
- [x] update the tests so they compile without errors
- [x] need to set the key of ToolbarButton based on the name of the button
- [x] check each of the tools enabled or selected logic, at least haven't added the shouldShowEditVariableButton yet
      shouldShowEditVariableButton was called as buttonEnabled which is a prop of the registered text plugin
      `bEnabled = buttonEnabled(selectedVariable)` was calld by text-toolbar
      `selectedVariable` was computed with `const selectedVariable = hasVariable ? findSelectedVariable(selectedElements, variables) : undefined;`
- [x] manually test the functionality of the editor with and without variables
- [x] look at the built js files to see if the variable stuff is still separated out
- [x] deal with the warning about the shared variable when there isn't diagram, consider disabling the buttons
- [x] figure out why the shared variable buttons don't enable when diagram tile adds the shared variable model
- [x] remove underscore binding stuff
- [x] move all of the variable references back in the variables folder
- [x] clean up variables-text-content it is used by shared-variable-utils, have it create a VariablesPlugin instance instead, but that currently creates an autorun on instantiation ugh.
- [x] clean up the variables-plugin.tsx it should probably be broken up, it has the VariablePlugin object as well as the NewVariableTextButton, InsertVariableTextButton, EditVariableTextButton components, and the VariableComponent.
- [x] merge master to resolve conflicts
- [x] update text tile plugin documentation
- [x] reduce the duplication in the built in tools
- [ ] review all of the TODOs and FIXMEs
