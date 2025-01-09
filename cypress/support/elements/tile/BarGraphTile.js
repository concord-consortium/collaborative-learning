class BarGraphTile {

  getTiles(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .canvas .bar-graph-tile`);
  }

  getTile(workspaceClass, tileIndex = 0) {
    return this.getTiles(workspaceClass).eq(tileIndex);
  }

  getTileTitle(workspaceClass, tileIndex = 0) {
    return this.getTile(workspaceClass, tileIndex).find(`.editable-tile-title-text`);
  }

  getTileContent(workspaceClass, tileIndex = 0) {
    return this.getTile(workspaceClass, tileIndex).find(`[data-testid="bar-graph-content"]`);
  }

  getChakraMenuItem(workspaceClass, tileIndex = 0) {
    return cy.get(`body .chakra-portal button`).filter(':visible');
  }

  getChartArea(workspaceClass, tileIndex = 0) {
    return this.getTile(workspaceClass, tileIndex).find(`svg.bar-graph-svg`);
  }

  getYAxisLabel(workspaceClass, tileIndex = 0) {
    return this.getChartArea(workspaceClass, tileIndex).find(`.editable-axis-label`);
  }

  getYAxisLabelButton(workspaceClass, tileIndex = 0) {
    return this.getChartArea(workspaceClass, tileIndex).find(`[data-testid="axis-label-button"]`);
  }

  getYAxisLabelEditor(workspaceClass, tileIndex = 0) {
    return this.getChartArea(workspaceClass, tileIndex).find(`[data-testid="axis-label-editor"] input`);
  }

  getXAxisPulldown(workspaceClass, tileIndex = 0) {
    return this.getChartArea(workspaceClass, tileIndex).find(`[data-testid="category-pulldown"]`);
  }

  getXAxisPulldownButton(workspaceClass, tileIndex = 0) {
    return this.getXAxisPulldown(workspaceClass, tileIndex).find(`button`);
  }

  getYAxisTickLabel(workspaceClass, tileIndex = 0) {
    return this.getChartArea(workspaceClass, tileIndex).find(`.visx-axis-left text`);
  }

  getXAxisTickLabel(workspaceClass, tileIndex = 0) {
    return this.getChartArea(workspaceClass, tileIndex).find(`.visx-axis-bottom text`);
  }

  getBar(workspaceClass, tileIndex = 0) {
    return this.getChartArea(workspaceClass, tileIndex).find(`.visx-bar`);
  }

  getBarHighlight(workspaceClass, tileIndex = 0) {
    return this.getChartArea(workspaceClass, tileIndex).find(`.bar-highlight`);
  }

  getLegendArea(workspaceClass, tileIndex = 0) {
    return this.getTile(workspaceClass, tileIndex).find(`.bar-graph-legend`);
  }

  getDatasetLabel(workspaceClass, tileIndex = 0) {
    return this.getLegendArea(workspaceClass, tileIndex).find(`.dataset-header .dataset-name`);
  }

  getDatasetUnlinkButton(workspaceClass, tileIndex = 0) {
    return this.getLegendArea(workspaceClass, tileIndex).find(`.dataset-header .dataset-icon a`);
  }

  getSortByMenuButton(workspaceClass, tileIndex = 0) {
    return this.getLegendArea(workspaceClass, tileIndex).find(`.sort-by button.chakra-menu__menu-button`);
  }

  getSecondaryValueName(workspaceClass, tileIndex = 0) {
    return this.getLegendArea(workspaceClass, tileIndex).find(`.secondary-values .secondary-value-name`);
  }

  getBarColorButton(workspaceClass, tileIndex = 0) {
    return this.getLegendArea(workspaceClass, tileIndex).find(`[data-testid="color-menu-button"]`);
  }

  getBarColorMenu(workspaceClass, tileIndex = 0, menuIndex = 0) {
    return this.getLegendArea(workspaceClass, tileIndex).find(`[data-testid="color-menu-list"]`).eq(menuIndex);
  }

  getBarColorMenuButtons(workspaceClass, tileIndex = 0, menuIndex = 0) {
    return this.getBarColorMenu(workspaceClass, tileIndex, menuIndex).find(`[data-testid="color-menu-list-item"]`);
  }

}
export default BarGraphTile;
