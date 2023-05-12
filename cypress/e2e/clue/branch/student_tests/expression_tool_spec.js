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
    it("should have an editable title", () => {
      exp.getTileTitle().click();
      exp.getTitleInput().should("exist");
      exp.getTitleInput().should("have.value", "Eq. 1");
      exp.getTitleInput().dblclick();
      exp.getTitleInput().type("new title{enter}");
      exp.getTileTitle().should("contain", "(new title)");
    });
    // it("expression can be changed and re-renders", () => {
    //   TODO - figure out how to type into math field

    //   The below finds the toggle div, but it is not visible in cy playback
    //   and causes an error when we chain a click to it.
    //   exp.getMathKeyboardToggle().should("exist");

    //   The below tests a change, but does not follow a genuine user path
    //   exp.getMathField().invoke("val", "a=\\theta r^3");
    //   exp.getMathFieldMath().should("contain", "θ");

    //   see: https://github.com/arnog/mathlive/issues/830
    // });
    it("should name new expressions with an incrementing id", () => {
      clueCanvas.addTile("expression");
      cy.contains("(Eq. 1)").should("exist");
      clueCanvas.addTile("expression");
      cy.contains("(Eq. 2)").should("exist");
    });
  });
});
