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
  getTileNavigatorToolbarButton() {
    return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.navigator');
  }
  getTileNavigatorToolbarButtonToolTip() {
    return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.navigator').parent().filter('[data-tooltipped]');
  }
  getTileNavigatorToolbarButtonToolTipText() {
    return this.getTileNavigatorToolbarButtonToolTip().invoke('attr', 'data-original-title');
  }
  getRectangleDrawing(){
    return cy.get('.primary-workspace [data-testid=tile-navigator-container] .drawing-layer svg rect.rectangle');
  }
}

export default TileNavigator;
