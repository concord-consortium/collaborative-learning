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
  getRectangleDrawing(){
    return cy.get('.primary-workspace [data-testid=tile-navigator-container] .drawing-layer svg rect.rectangle');
  }
}

export default TileNavigator;
