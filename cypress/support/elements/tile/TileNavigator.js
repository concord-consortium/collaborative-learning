class TileNavigator {
  getTileNavigator() {
    return cy.get('.primary-workspace [data-testid=tile-navigator]');
  }
  getTileNavigatorContainer() {
    return cy.get('.primary-workspace [data-testid=tile-navigator-container]');
  }
  getTileNavigatorPlacementButton() {
    return cy.get('.primary-workspace [data-testid=tile-navigator-placement-button]');
  }
  getTileNavigatorPanningButtons(){
    return cy.get('.primary-workspace [data-testid=navigator-panning-buttons]');
  }
  getTileNavigatorPanningButton(direction){
    return cy.get(`.primary-workspace [data-testid=navigator-panning-button-${direction}]`);
  }

  // Rectangle showing inside the drawing tile's navigator
  getRectangleDrawing(){
    return cy.get('.primary-workspace [data-testid=tile-navigator-container] .drawing-layer svg rect.rectangle');
  }

  // Geometry point showing inside the geometry tile's navigator
  getGeometryPoint(){
    return cy.get('.primary-workspace [data-testid=tile-navigator-container] ellipse[display="inline"][fill-opacity="1"]');
  }

}

export default TileNavigator;
