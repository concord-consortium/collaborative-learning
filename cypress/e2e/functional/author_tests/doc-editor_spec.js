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
  });
});
