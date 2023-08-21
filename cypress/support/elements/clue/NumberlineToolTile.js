const kNumberlinePixPerCoord = { x: 18.33 };

const kNumberlineOriginCoordPix = { x: 40, y: 50 };

class NumberlineToolTile {

  // transformFromCoordinate(axis, num){
  //   return kGraphOriginCoordPix[axis] + num * kGraphPixPerCoord[axis];
  // }

  getNumberlineTile(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .numberline-tool-tile`);
  }
  getTileTitle(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .editable-tile-title-text`);
  }
  getNumberlineTileTitle(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .editable-tile-title`);
  }
  getNumberlineAxis(workspaceClass){
    return cy.get(".num-line");
  }
  addPointToGraph(){
    // let transX=this.transformFromCoordinate('x', x),
        // transY=this.transformFromCoordinate('y', y);

    this.getNumberlineAxis().last().click(0, 0, {force:true});

  }


}

export default NumberlineToolTile;
