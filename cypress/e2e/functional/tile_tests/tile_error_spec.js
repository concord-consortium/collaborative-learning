context('Tile Errors', function () {
  it("Shows Errors without crashing CLUE", () => {
    cy.log("shows error message for tiles with render errors");
    cy.visit("/editor/?unit=./demo/units/error/error-unit.json&document=demo/docs/error-document.json");
    cy.get(".document-error").should("contain.text", "Error rendering the document");
  });
});
