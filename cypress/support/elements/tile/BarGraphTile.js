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

  getYAxisLabel(tileIndex = 0, workspaceClass) {
    return this.getTile(tileIndex, workspaceClass).find(`.editable-axis-label`);
  }

  getYAxisLabelButton(tileIndex = 0, workspaceClass) {
    return this.getTile(tileIndex, workspaceClass).find(`[data-testid="axis-label-button"]`);
  }

  getYAxisLabelEditor(tileIndex = 0, workspaceClass) {
    return this.getTile(tileIndex, workspaceClass).find(`[data-testid="axis-label-editor"] input`);
  }

  getXAxisPulldown(tileIndex = 0, workspaceClass) {
    return this.getTile(tileIndex, workspaceClass).find(`[data-testid="category-pulldown"]`);
  }

  getXAxisPulldownButton(tileIndex = 0, workspaceClass) {
    return this.getXAxisPulldown(tileIndex, workspaceClass).find(`button`);
  }

  getXAxisPulldownMenuItem(tileIndex = 0, workspaceClass) {
    return cy.get(`body .chakra-portal button`).filter(':visible');
  }

}
export default BarGraphTile;
