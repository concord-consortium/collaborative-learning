The text tile can be customized with text tile plugins.

These plugins are added by calling `registerTextPluginInfo`. The one example so far is the variables text plugin which is registered by `shared-variables-registration`.

A text tile plugin has to provide the following info:
- `iconName`: this is used both to identify the plugin and should match the slate type of blocks or marks added to the slate content
- `Icon`: this is the icon used in the text tool toolbar. Currently all plugins are added to the toolbar.
- `toolTip`: hover text of the icon in the toolbar
- `createSlatePlugin`: this is a function called with a parameter of the text content model. The function is called when the text tool is mounted. The function should return a slate plugin. This plugin will be passed to the slate-editor component.
- `command`: this is the command that is run when the toolbar button is clicked on. Currently all commands are passed a `dialogController` argument so they can bring up a dialog if they want.
- `updateTextContentAfterSharedModelChanges`: this is an optional function. If provided, it will be called by the text content model when any of the shared models linked with the text content model changes.  The text content model will not create these links itself. It is the job of the plugin to link these shared models. In the variables text plugin, this link is created if it doesn't exist when the user clicks on the variable toolbar button.

If the plugin is creating a "void" slate element it should add the `kSlateVoidClass` to the top level element it renders. In theory this should make cut and paste of void elements work. Unfortunately this cut and paste doesn't working inside of CLUE, and we don't know why.
