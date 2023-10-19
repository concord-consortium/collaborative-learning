
const numberlineVals = [-5.0, -4.0, -3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0, 4.0, 5.0];

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

    console.log("📁 NumberlineToolTile.js ------------------------");
    const tickIndex = numberlineVals.indexOf(num);
    console.log("\t🔪 tickIndex:", tickIndex);
    console.log("\t🥩 cy.get:", cy.get(".numberline-tool-container .tick text"));
    return cy.get(".numberline-tool-container .tick text").eq(tickIndex);
  }
  getPointsOnGraph(){
    console.log("\t🏭 getPointsOnGraph");
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
    console.log("\t🏭 addPointOnNumberlineTick, num:", num);
    this.getNumberlineTick(num).click();
  }
}

export default NumberlineToolTile;
