const canvasArea = (workspaceClass) => `${workspaceClass || ".primary-workspace"} .canvas-area`;
const variableCard = (workspaceClass) => `${canvasArea(workspaceClass)} .react-flow__node`;
const dialog = (workspaceClass) => `.ReactModalPortal .custom-modal`;

class DiagramToolTile {
  getDiagramTile(workspaceClass) {
    return cy.get(`${canvasArea(workspaceClass)} .diagram-tool-tile`);
  }
  getTileTitleText(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .diagram-tool-tile .editable-tile-title-text`);
  }
  getTileTitleContainer(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .diagram-tool-tile .editable-tile-title`);
  }
  getDraggableToolbarButton(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .tile-toolbar.diagram-toolbar div[aria-roledescription=draggable]`);
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
  getVariableCardDescriptionToggle() {
    return cy.get(`.variable-description-toggle`);
  }
  getVariableCardNotesField() {
    return cy.get('.variable-description-area');
  }
  getVariableCardColorEditButton() {
    return cy.get('.color-palette-toggle');
  }
  getColorEditorDialog() {
    return cy.get('.color-editor-dialog');
  }
  getColorPicker() {
    return cy.get('.color-editor-dialog span span');
  }
  getDiagramTileTitle(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .editable-tile-title`);
  }

  getDialogField(field) {
    return cy.get(`#evd-${field}`);
  }
  getDialogOkButton() {
    return cy.get(".modal-button").last();
  }
}

export default DiagramToolTile;
