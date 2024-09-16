class BarGraphTile {

  getTiles(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .bar-graph-tile`);
  }

  getTile(tileIndex = 0, workspaceClass) {
    return this.getTiles().eq(tileIndex);
  }

  getTileTitle(tileIndex = 0, workspaceClass) {
    return this.getTile(tileIndex, workspaceClass).find(`.editable-tile-title-text`);
  }

  getTileContent(tileIndex = 0, workspaceClass) {
    return this.getTile(tileIndex, workspaceClass).find(`[data-testid="bar-graph-content"]`);
  }

  getChakraMenuItem(tileIndex = 0, workspaceClass) {
    return cy.get(`body .chakra-portal button`).filter(':visible');
  }

  getChartArea(tileIndex = 0, workspaceClass) {
    return this.getTile(tileIndex, workspaceClass).find(`svg.bar-graph-svg`);
  }

  getYAxisLabel(tileIndex = 0, workspaceClass) {
    return this.getChartArea(tileIndex, workspaceClass).find(`.editable-axis-label`);
  }

  getYAxisLabelButton(tileIndex = 0, workspaceClass) {
    return this.getChartArea(tileIndex, workspaceClass).find(`[data-testid="axis-label-button"]`);
  }

  getYAxisLabelEditor(tileIndex = 0, workspaceClass) {
    return this.getChartArea(tileIndex, workspaceClass).find(`[data-testid="axis-label-editor"] input`);
  }

  getXAxisPulldown(tileIndex = 0, workspaceClass) {
    return this.getChartArea(tileIndex, workspaceClass).find(`[data-testid="category-pulldown"]`);
  }

  getXAxisPulldownButton(tileIndex = 0, workspaceClass) {
    return this.getXAxisPulldown(tileIndex, workspaceClass).find(`button`);
  }

  getYAxisTickLabel(tileIndex = 0, workspaceClass) {
    return this.getChartArea(tileIndex, workspaceClass).find(`.visx-axis-left text`);
  }

  getXAxisTickLabel(tileIndex = 0, workspaceClass) {
    return this.getChartArea(tileIndex, workspaceClass).find(`.visx-axis-bottom text`);
  }

  getBar(tileIndex = 0, workspaceClass) {
    return this.getChartArea(tileIndex, workspaceClass).find(`.visx-bar`);
  }

  getLegendArea(tileIndex = 0, workspaceClass) {
    return this.getTile(tileIndex, workspaceClass).find(`.bar-graph-legend`);
  }

  getDatasetLabel(tileIndex = 0, workspaceClass) {
    return this.getLegendArea(tileIndex, workspaceClass).find(`.dataset-header .dataset-name`);
  }

  getDatasetUnlinkButton(tileIndex = 0, workspaceClass) {
    return this.getLegendArea(tileIndex, workspaceClass).find(`.dataset-header .dataset-icon a`);
  }

  getSortByMenuButton(tileIndex = 0, workspaceClass) {
    return this.getLegendArea(tileIndex, workspaceClass).find(`.sort-by button.chakra-menu__menu-button`);
  }

  getSecondaryValueName(tileIndex = 0, workspaceClass) {
    return this.getLegendArea(tileIndex, workspaceClass).find(`.secondary-values .secondary-value-name`);
  }

}
export default BarGraphTile;
