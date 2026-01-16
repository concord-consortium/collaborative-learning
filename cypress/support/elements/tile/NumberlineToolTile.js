
const numberlineVals = [-5.0, -4.0, -3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0, 4.0, 5.0]; //these are default values for the numberline

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
  addPointOnNumberlineTick(num){
    this.getNumberlineTick(num).parent().click({force: true}); //we need to click the <g> element that is the parent of the text element
  }
  getNumberlineTick(num){
    const tickIndex = numberlineVals.indexOf(num);
    return this.getAllNumberlineTicks().eq(tickIndex);
  }
  getAllNumberlineTicks(){
    return cy.get(".numberline-tool-container .tick text");
  }
  getPointsOnGraph(){
    //exclude the hovering circle that follows the mouse on the numberline
    return cy.get(".numberline-tool-container .point-inner-circle").not(".mouse-follow-point");
  }
  hasNoPoints(){
    return cy.get(".numberline-tool-container").should("not.have.descendants", ".point-inner-circle:not(.mouse-follow-point)");
  }
  setToolbarSelect(){
    cy.get(".numberline-toolbar .select").click();
  }
  setToolbarPoint(){
    cy.get(".numberline-toolbar .point").click();
  }
  setToolbarOpenPoint(){
    cy.get(".numberline-toolbar .point-open").click();
  }
  setToolbarReset(){
    cy.get(".numberline-toolbar .reset").click();
  }
  setToolbarDelete(){
    cy.get(".numberline-toolbar .delete").click();
  }
  setMaxValue(max){
    this.getMaxBox().dblclick();
    this.getMaxBox().clear().type(`${max}{enter}`);
  }
  getMaxBox(){
    return cy.get(".numberline-tool-container .border-box").eq(1); //second element is max
  }
  setMinValue(min){
    this.getMinBox().dblclick();
    this.getMinBox().clear().type(`${min}{enter}`);
  }
  getMinBox(){
    return cy.get(".numberline-tool-container .border-box").eq(0); //first element is min
  }
  getValueLabel(){
    return cy.get(".numberline-tool-container .point-value-label-group");
  }
  getValueLabelText(){
    return cy.get(".numberline-tool-container .point-value-label-text");
  }
  getValueLabelLine(){
    return cy.get(".numberline-tool-container .point-value-label-line");
  }



}

export default NumberlineToolTile;
