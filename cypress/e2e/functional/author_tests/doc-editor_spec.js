const url = "/editor/";
const documentContent = () => cy.get(".canvas-area .canvas .document-content");

function beforeTest() {
  cy.visit(url);
  cy.get('.editable-document-content', { timeout: 60000 });
}

// Open/Save/Export/Reset now live in the "File" menu.
function clickFileMenuItem(label) {
  cy.contains("button", "File").click();
  cy.contains('[role="menuitem"]', label).click();
}
context('Doc Editor', () => {
  it('verify doc editor and solution button work', function () {
    beforeTest();

    cy.log("verify doc editor loads");
    cy.get(".toolbar").should("exist");
    documentContent().should("exist");

    cy.log("verify solution button works");
    const toolbarButton = tool => cy.get(`.toolbar .${tool}`);
    const solutionButton = () => cy.get(".toolbar .solution");
    const imageTile = () => documentContent().find(".image-tool-tile").last();
    solutionButton().should("exist").should("have.class", "disabled");
    toolbarButton("image").click();
    imageTile().should("exist").click();
    solutionButton().should("have.class", "enabled");
    solutionButton().click();
    imageTile().should("have.class", "teacher");
    solutionButton().should("have.class", "active");
    solutionButton().click();
    imageTile().should("not.have.class", "teacher");
    solutionButton().should("not.have.class", "active");

    cy.log("test save button");
    // Note we can't actually save a file because Cypress can't drive the dialog
    const fakeFile = {
      name: "test.json",
      text() {
        return "{}";
      }
    };
    const fakeFileHandle = {
      getFile() {
        return fakeFile;
      },
      createWritable() {
        return {
          write() {},
          close() {}
        };
      }
    };
    cy.window().then((win) =>
      cy.stub(win, 'showSaveFilePicker').as('showSaveFilePicker')
        .returns(fakeFileHandle)
    );
    clickFileMenuItem('Save');
    cy.get('@showSaveFilePicker')
      .should('have.been.calledOnce')
      .invoke('restore');
    cy.get(".status").should("contain", "test.json");


    cy.log("test export as authoring format");
    cy.window().then((win) => {
      fakeFile.name = "test-export.json";
      cy.stub(win, 'showSaveFilePicker').as('showSaveFilePickerExport')
        .returns(fakeFileHandle);
    });
    clickFileMenuItem('Export as Authoring Format');
    cy.get('@showSaveFilePickerExport')
      .should('have.been.calledOnce')
      .invoke('restore');
    cy.get(".status").should("contain", "exported: test-export.json");


    cy.log("test open an empty document");
    cy.window().then((win) => {
      fakeFile.name = "test-open.json";
      cy.stub(win, 'showOpenFilePicker').as('showOpenFilePicker')
        .returns([fakeFileHandle]);
    });
    clickFileMenuItem('Open');
    cy.get('@showOpenFilePicker')
      .should('have.been.calledOnce')
      .invoke('restore');
    cy.get(".status").should("contain", "test-open.json");

    cy.log("test opening the settings dialog");
    cy.contains("button", "settings").click();
    cy.get(".modal-header").should("contain", "Settings");
  });

});
