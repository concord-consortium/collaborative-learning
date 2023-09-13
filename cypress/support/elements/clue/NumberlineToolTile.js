
const numberlineVals = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];

class NumberlineToolTile {
  getNumberlineTile(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .numberline-tool-tile`);
  }
  getNumberlineTileTitleText(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .editable-tile-title-text`);
  }
  getNumberlineTileTitle(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .editable-tile-title`);
  }
  getNumberlineTick(num){
    const tickIndex = numberlineVals.indexOf(num);
    return cy.get(".numberline-tool-container .tick text").eq(tickIndex);
  }
  getPointsOnGraph(){
    //exclude the hovering circle that follows the mouse on the numberline
    return cy.get(".numberline-tool-container .point-inner-circle").not(".mouse-follow-point");
  }
  getClearButton(){
    return cy.get(`.clear-points`);
  }
  deleteAllPointsOnNumberline(){
    this.getClearButton().click();
  }
  addPointOnNumberlineTick(num){
    this.getNumberlineTick(num).click();
  }
}

export default NumberlineToolTile;
