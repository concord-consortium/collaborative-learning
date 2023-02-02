The text tile can be customized with text tile plugins.

These plugins are added by calling `registerTextPluginInfo`. The one example so far is the variables text plugin which is registered by `shared-variables-registration`.

A text tile plugin has to provide the following info:
- `iconName`: this is used both to identify the plugin and should match the slate type of blocks or marks added to the slate content
- `Icon`: this is the icon used in the text tool toolbar. Currently all plugins are added to the toolbar.
- `toolTip`: hover text of the icon in the toolbar
- `createSlatePlugin`: this is a function called with a parameter of the text content model. The function is called when the text tool is mounted. The function should return a slate plugin. This plugin will be passed to the slate-editor component.
- `command`: this is the command that is run when the toolbar button is clicked. Currently all commands are passed a `dialogController` argument so they can bring up a dialog if they want.
- `updateTextContentAfterSharedModelChanges`: this is an optional function. If provided, it will be called by the text content model when any of the shared models linked with the text content model changes.  The text content model will not create these links itself. It is the job of the plugin to link these shared models. In the variables text plugin, this link is created if it doesn't exist when the user clicks on the variable toolbar button.

If the plugin is creating a "void" slate element it should add the `kSlateVoidClass` to the top level element it renders. In theory this should make cut and paste of void elements work. Unfortunately this cut and paste doesn't work inside of CLUE, and we don't know why.

Currently the text tile is configured with the following tools:
"new-variable", "insert-variable", "edit-variable"

This works because the shared-variabels-registration registers 3 'plugins' with the text tile. Only the first one defines a createSlatePlugin function.
The other 2 leave it undefined. But they all include a modalHook.

The `modalHook` takes the place of the `command` in the old plugin model.

A better design would be to allow a single plugin registration to include multiple tools.
And also the name `modalHook` is too specific a plugin tool might just be changing the state of the slate without bringing up a modal like a bold button.

Each of these tools needs:
- Icon
- toolName
- toolTip
- command to run when clicked
- TODO: someway of handling disabling the button depending on where the cursor is
- TODO: someway of highlighting the button depending on where the cursor is like what bold and italics buttons do

If we rename iconName to toolName then we might need a top level name to identify the plugin, but I haven't found a reason yet.

What is needed for the selected buttons support is a map from slate type to the button id.
This could be added to each of the tool definitions from the plugin.

These slate types are added here:
...getTextPluginIds().reduce((idMap, id) => ({...idMap, [id]: id}), {})

This is in the text-tile.tsx `getSelectedIcons` that slateToButtonType is used to compute the selected toolbar buttons. They are updated each time the content changes. And they are then passed into the TextToolbar.

What is weird about that is that the TextToolbar does its own isElementActive check for the variables. The getSelectedIcons uses isMarkActive and isBlockActive. Since different buttons seem to use different checks. It might work for each button to just provide its own check. The check could return if the button is selected or enabled. This way the button doesn't have to provide any slate types since that would all be internal to the button.

For the built in buttons they use EFormat.

This is currently handled by a buttonEnabled function on text plugin infos which gets a variable (which it shouldn't).
It isn't clear if this should be done just by including a slateType on each button definition, or if we need more.
The trick is that for things like Bold it doesn't become disabled it is just marked as selected. So these
variable dialog buttons are different in that they become disabled (like a link edit button would be) if the thing selected
is not the right thing. For a link you'd want it to become enabled when any text is selected not just the link type.

So to support more kinds of tools it can't just be based on the slate type. If we could leave it up to the tool to decide when it should be selected and when it should be enabled based on the current selection and mark that would be best...

It turns out that editor.isElementActive(type) is the same as isBlockActive(editor, type)
See create-editor.ts in slate-editor repo. This editor.isElementActive is our function from slate-editor it finds all of the nodes associated with the current selection and by defaults checks if any node.type == type.

We can't use the Cypress tests easily because of some issue with CLUE, Slate, and Cypress

TODO:
I'd note that the slate-editor defines a EFormat.variable which it shouldn't be doing.

Steps:
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
- [ ] clean up the variables-plugin.tsx it should probably be broken up, it has the VariablePlugin object as well as the NewVariableTextButton, InsertVariableTextButton, EditVariableTextButton components, and the VariableComponent.
- [ ] review all of the TODOs and FIXMEs
- [ ] update text tile plugin documentation
