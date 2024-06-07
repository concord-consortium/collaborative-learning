const url = "/editor/";
const documentContent = () => cy.get(".canvas-area .canvas .document-content");

function beforeTest() {
  cy.visit(url);
  cy.get('.editable-document-content', { timeout: 60000 });
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
    cy.contains("button", 'save').click();
    cy.get('@showSaveFilePicker')
      .should('have.been.calledOnce')
      .invoke('restore');
    cy.get(".status").should("contain", "test.json");


    cy.log("test open an empty document");
    cy.window().then((win) => {
      fakeFile.name = "test-open.json";
      cy.stub(win, 'showOpenFilePicker').as('showOpenFilePicker')
        .returns([fakeFileHandle]);
    });
    cy.contains("button", 'open').click();
    cy.get('@showOpenFilePicker')
      .should('have.been.calledOnce')
      .invoke('restore');
    cy.get(".status").should("contain", "test-open.json");

    cy.log("test opening the settings dialog");
    cy.contains("button", "settings").click();
    cy.get(".modal-header").should("contain", "Settings");
  });

});
