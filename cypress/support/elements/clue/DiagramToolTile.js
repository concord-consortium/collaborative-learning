const canvasArea = (workspaceClass) => `${workspaceClass || ".primary-workspace"} .canvas-area`;

class DiagramToolTile {
  getDiagramTile(workspaceClass) {
    return cy.get(`${canvasArea(workspaceClass)} .diagram-tool-tile`);
  }
  getDiagramToolbar(workspaceClass) {
    this.getDiagramTile(workspaceClass).click();
    return cy.get(`${canvasArea(workspaceClass)} .diagram-toolbar`);
  }
  getDiagramToolbarButton(buttonClass, workspaceClass) {
    this.getDiagramTile(workspaceClass).click();
    return cy.get(`${canvasArea(workspaceClass)} .diagram-toolbar .${buttonClass}`);
  }
}

export default DiagramToolTile;
