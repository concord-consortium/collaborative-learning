class DocEditor {
    hideReadOnlyPanes() {
        // The app publishes this once it has loaded, so after a cy.visit it is not there yet.
        cy.window().should(win => expect(win.docEditorSettings).to.exist);
        cy.window().then(win => {
            const settings = win.docEditorSettings;
            settings.setShowLocalReadOnly(false);
            settings.setShowRemoteReadOnly(false);
        });
    }
}
export default DocEditor;
