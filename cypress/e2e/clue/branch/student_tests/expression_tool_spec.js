import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import ExpressionToolTile from '../../../../support/elements/clue/ExpressionToolTile';

let clueCanvas = new ClueCanvas;
let exp = new ExpressionToolTile;

context('Expression Tool Tile', function () {
  before(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=example";
    cy.clearQAData('all');
    cy.visit(queryParams);
    cy.waitForLoad();
    //TODO - implement within a curriculum unit
    //cy.closeResourceTabs();
  });
  describe("Expression Tool", () => {
    it("renders expression tool tile", () => {
      clueCanvas.addTile("expression");
      exp.getExpressionTile().should("exist");
    });
    it("should have the correct default title", () => {
      exp.getTileTitle().should("exist");
      exp.getTileTitle().should("contain", "(Eq. 1)");
    });
    it("should contain a default value as latex string", () => {
      exp.getMathArea().should("exist");
      exp.getMathField().should("have.value", "a=\\pi r^2");
      exp.getMathFieldLatex().should("eq", "a=\\pi r^2");
    });
    it("should render latex string as math characters", () => {
      exp.getMathFieldMath().should("exist");
      exp.getMathFieldMath().should("contain", "π");
    });
  });
});
