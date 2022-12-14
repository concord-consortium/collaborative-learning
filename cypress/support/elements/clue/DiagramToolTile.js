const canvasArea = (workspaceClass) => `${workspaceClass || ".primary-workspace"} .canvas-area`;
const variableCard = (workspaceClass) => `${canvasArea(workspaceClass)} .react-flow__node`;
const dialog = (workspaceClass) => `.ReactModalPortal .custom-modal`;

class DiagramToolTile {
  getDiagramTile(workspaceClass) {
    return cy.get(`${canvasArea(workspaceClass)} .diagram-tool-tile`);
  }
  getDiagramToolbar(workspaceClass, skipClick) {
    if (!skipClick) {
      this.getDiagramTile(workspaceClass).click();
    }
    return cy.get(`${canvasArea(workspaceClass)} .diagram-toolbar`);
  }
  getDiagramToolbarButton(buttonClass, workspaceClass, skipClick) {
    if (!skipClick) this.getDiagramTile(workspaceClass).click();
    return cy.get(`${canvasArea(workspaceClass)} .diagram-toolbar .${buttonClass}`);
  }
  getDiagramDialog(workspaceClass) {
    return cy.get(dialog(workspaceClass));
  }
  getDiagramDialogCloseButton(workspaceClass) {
    return cy.get(`${dialog(workspaceClass)} .modal-close`);
  }
  getVariableCard(workspaceClass) {
    return cy.get(variableCard(workspaceClass));
  }
  getVariableCardField(field, workspaceClass) {
    return cy.get(`.variable-info.${field}`);
  }
}

export default DiagramToolTile;
