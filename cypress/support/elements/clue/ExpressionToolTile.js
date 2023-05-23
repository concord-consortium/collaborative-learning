const workspaceClass = Cypress.env("workspaceClass");

let tileSelector;
if (workspaceClass !== undefined){
  tileSelector = `${workspaceClass} .canvas-area .expression-tool-tile`;
} else {
  tileSelector = ".primary-workspace .canvas-area .expression-tool-tile";
}

class ExpressionToolTile {
  getExpressionTile = () => {
    return cy.get(tileSelector);
  };
  getNthExpressionTile(nth) {
    return cy.get(tileSelector).eq(nth - 1);
  }
  getTileTitle = () => {
    return cy.get(`${tileSelector} .editable-title-text`);
  };
  getTitleInput = () => {
    return cy.get(`${tileSelector} .title-input-editing`);
  };
  getMathArea = () => {
    return cy.get(`${tileSelector} .expression-math-area`);
  };
  getMathField = () => {
    const mathFieldSelector = `${tileSelector} .expression-math-area math-field`;
    return cy.get(mathFieldSelector);
  };
  getMathFieldLatex = () => {
    const mathFieldSelector = `${tileSelector} .expression-math-area math-field`;
    return cy.get(mathFieldSelector).attribute("value");
  };
  getMathFieldMath = () => {
    const mathFieldSelector = `${tileSelector} .expression-math-area math-field`;
    return cy.get(mathFieldSelector).shadow().find("span");
  };
  getMathKeyboardToggle = () => {
    const mathFieldSelector = `${tileSelector} .expression-math-area math-field`;
    return cy.get(mathFieldSelector).shadow().find("div");
  };
}

export default ExpressionToolTile;
