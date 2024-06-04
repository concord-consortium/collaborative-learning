class DocEditor {
    hideReadOnlyPanes() {
        cy.window().then(win => {
            const settings = win.docEditorSettings;
            settings.setShowLocalReadOnly(false);
            settings.setShowRemoteReadOnly(false);
        });
    }
}
export default DocEditor;
