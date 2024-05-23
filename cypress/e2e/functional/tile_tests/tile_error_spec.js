context('Tile Errors', function () {
  it("Shows Errors without crashing CLUE", () => {
    cy.log("shows error message for tiles with render errors");
    cy.visit("/doc-editor.html?unit=./curriculum/example-curriculum/error-unit.json&document=curriculum/example-curriculum/error-document.json");
    cy.get(".document-error").should("contain.text", "Error rendering the document");
  });
});
