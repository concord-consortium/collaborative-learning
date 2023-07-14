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
    //cy.collapseResourceTabs();
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
    it("should accept basic keyboard input", () => {
      // Can now perform keyboard input
      // but thus far cannot get sequences like {del} to work in test
      exp.getMathField().eq(0).click({force: true});
      exp.getMathField().eq(0).type("hi", {force: true});
      exp.getMathField().eq(0).should("have.value", "hia=\\pi r^2");
      cy.wait(2000);
    });
    it("expression can be changed and re-renders", () => {
      //  The below tests a change, but does not follow a genuine user path
      //   see: https://github.com/arnog/mathlive/issues/830
      exp.getMathField().invoke("val", "a=\\theta r^3");
      exp.getMathFieldMath().should("contain", "θ");
    });
    it("can create a mixed fraction with the button", () => {
      exp.clearValue();
      exp.getMathField().eq(0).click({force: true});
      exp.getMixedFractionButton().eq(0).click();
      exp.getMathField().eq(0).should("have.value", "\\placeholder{}\\frac{\\placeholder{}}{\\placeholder{}}");
    });
    it("can add an empty division expression when division button clicked in empty expression", () => {
      exp.clearValue();
      exp.getMathField().eq(0).click({force: true});
      exp.getDivisionButton().eq(0).click();
      exp.getMathField().eq(0).should("have.value", "\\placeholder{}\\div\\placeholder{}");
    });
    it("can add a division sign and a placeholder when division button clicked following existing value", () => {
      exp.clearValue();
      exp.getMathField().eq(0).click({force: true});
      exp.getMathField().eq(0).invoke("val", "123");
      exp.getDivisionButton().eq(0).click();
      exp.getMathField().eq(0).should("have.value", "123\\div\\placeholder{}");
    });
    it("should name new expressions with an incrementing id", () => {
      clueCanvas.addTile("expression");
      cy.contains("(Eq. 1)").should("exist");
      clueCanvas.addTile("expression");
      cy.contains("(Eq. 2)").should("exist");
    });
    it("should become the active tile when equation is clicked", () => {
      exp.getMathField().eq(1).click({force: true});
      exp.getExpressionTile().eq(1).should("have.class", "selected");
      exp.getExpressionTile().eq(0).should("not.have.class", "selected");
    });
    it("should have a toggleable toolbar", () => {
      exp.getExpressionToolbar().eq(1).should("be.visible");
      exp.getExpressionToolbar().eq(0).should("not.be.visible");
      exp.getMathField().eq(0).click({force: true});
      exp.getExpressionToolbar().eq(0).should("be.visible");
      exp.getExpressionToolbar().eq(1).should("not.be.visible");
    });
    it("delete expression button deletes the whole expression", () => {
      exp.getMathField().eq(0).click({force: true});
      exp.getDeleteExpressionButton().eq(0).click();
      exp.getMathFieldMath().eq(0).should("not.contain.text");
      exp.getMathField().should("not.have.value", "a=\\pi r^2");
    });
    it("adds placeholder to negative sign", () => {
      exp.getDeleteExpressionButton().eq(0).click();
      exp.getMathField().eq(0).click({force: true});
      exp.getMathField().eq(0).type("-", {force: true});
      exp.getMathField().eq(0).should("have.value", "-\\placeholder{}");
    });
    it("adds placeholders to multiplication symbol", () => {
      exp.getDeleteExpressionButton().eq(0).click();
      // Normally typing "*" will add a \cdot to the latex value. This happens because
      // of some special handling in the mathField. Apparently when cypress types
      // characters this handling doesn't happen. So instead we use MathLives
      // executeCommand to insert the \cdot directly
      exp.getMathField().then($mf => {
        const mf = $mf[0];
        mf.executeCommand(["insert", "\\cdot"]);
      });
      exp.getMathField().eq(0).should("have.value", "\\placeholder{}\\cdot\\placeholder{}");
      cy.wait(2000);
    });
  });
});
