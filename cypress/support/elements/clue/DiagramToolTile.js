const canvasArea = (workspaceClass) => `${workspaceClass || ".primary-workspace"} .canvas-area`;
const dialog = (workspaceClass) => `.ReactModalPortal .custom-modal`;

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
  getDiagramDialog(workspaceClass) {
    return cy.get(dialog(workspaceClass));
  }
  getDiagramDialogCloseButton(workspaceClass) {
    return cy.get(`${dialog(workspaceClass)} .modal-close`);
  }
}

export default DiagramToolTile;
