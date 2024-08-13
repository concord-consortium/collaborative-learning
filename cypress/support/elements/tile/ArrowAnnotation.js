function wsClass(wsc) {
  return wsc || ".primary-workspace";
}

class ArrowAnnotation {
  getAnnotationModeButton(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} [data-testid="annotation-mode-button"]`);
  }
  getAnnotationMenuExpander(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} [data-testid="annotation-menu-expander"]`);
  }
  getCurvedArrowToolbarButton() {
    return cy.get(`[data-testid="curved-sparrow-button"]`);
  }
  getStraightArrowToolbarButton() {
    return cy.get(`[data-testid="straight-sparrow-button"]`);
  }
  clickHideAnnotationsButton(workspaceClass) {
    cy.get(`${wsClass(workspaceClass)} [data-testid="hide-annotations-button"]`).click({force: true});
  }
  getAnnotationLayer(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .annotation-layer`);
  }
  getAnnotationButtons(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .annotation-layer .annotation-button`);
  }
  getAnnotationSvg(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .annotation-layer .annotation-svg`);
  }
  getAnnotationArrows(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .annotation-layer .annotation-svg .arrow.foreground-arrow`);
  }
  getAnnotationBackgroundArrowPaths(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .annotation-layer .annotation-svg .arrow.background-arrow path`);
  }
  getAnnotationSparrowGroups(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .annotation-layer .annotation-svg .actual-sparrow`);
  }
  getPreviewArrow(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .annotation-layer .annotation-svg .arrow.preview-arrow`);
  }
  getAnnotationTextDisplays(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .annotation-layer .annotation-svg .text-region .text-display`);
  }
  getAnnotationTextInputs(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .annotation-layer .annotation-svg .text-region .text-input`);
  }
  getAnnotationDeleteButtons(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .annotation-layer .annotation-svg .sparrow-delete-button`);
  }
}

export default ArrowAnnotation;
