import ResourcesPanel from "./ResourcesPanel";

let resourcesPanel = new ResourcesPanel;

class StarredTab {
  getScrollerAndDocument(tab) {
    return cy.get('.document-tabs.'+tab+' .scroller-and-document');
  }
  getFocusDocument(tab) {
    return this.getScrollerAndDocument(tab).find('.document-area .focus-document.'+tab);
  }
  getRightDocumentFlipper(tab) {
    return this.getFocusDocument(tab).find('.right.document-flipper');
  }
  getLeftDocumentFlipper(tab) {
    return this.getFocusDocument(tab).find('.left.document-flipper');
  }
  getFocusDocumentSection(tab, section) {
    return this.getScrollerAndDocument(tab).find('.document-area .focus-document.'+tab+'.'+section);
  }
  getSectionRightDocumentFlipper(tab, section) {
    return this.getScrollerAndDocument(tab).find('.'+section+' .right.document-flipper');
  }
  getSectionLeftDocumentFlipper(tab, section) {
    return this.getScrollerAndDocument(tab).find('.'+section+' .left.document-flipper');
  }
  getThumbnailRightDocumentFlipper(tab) {
    return this.getScrollerAndDocument(tab).find('.'+tab+' .right .scroll-arrow-button');
  }
  getThumbnailLeftDocumentFlipper(tab) {
    return this.getScrollerAndDocument(tab).find('.'+tab+' .left .scroll-arrow-button');
  }
  verifySingleDocumentFlipper(tab) {
    resourcesPanel.getCanvasItemTitle(tab, 'starred').first().should("exist").click({ force: true });
    cy.wait(1000);
    resourcesPanel.getCanvasItemTitle(tab, 'starred').first().parent().invoke("attr", "class").should("contain", "selected");
    this.getScrollerAndDocument(tab).find('.document-area .focus-document.'+tab).should("exist");
    this.getRightDocumentFlipper(tab).should("exist");
    this.getLeftDocumentFlipper(tab).should("not.exist");
    this.getFocusDocumentSection(tab, "secondary").should("not.exist");
    this.getRightDocumentFlipper(tab).click();
    cy.wait(1000);
    this.getLeftDocumentFlipper(tab).should("exist");
    resourcesPanel.getCanvasItemTitle(tab, 'starred').first().parent().invoke("attr", "class").should("not.contain", "selected");
    this.getLeftDocumentFlipper(tab).click();
    this.getLeftDocumentFlipper(tab).should("not.exist");
    cy.wait(1000);
    resourcesPanel.getCanvasItemTitle(tab, 'starred').first().should('exist').click({ force: true });
    cy.wait(1000);
    this.getScrollerAndDocument(tab).find('.document-area .focus-document.'+tab).should("not.exist");
  }
  verifyDoubleDocumentFlipper(tab) {
    resourcesPanel.getCanvasItemTitle(tab, 'starred').first().should("exist").click({ force: true });
    cy.wait(1000);
    resourcesPanel.getCanvasItemTitle(tab, 'starred').last().should("exist").click({ force: true });
    cy.wait(1000);
    resourcesPanel.getCanvasItemTitle(tab, 'starred').first().parent().invoke("attr", "class").should("contain", "selected");
    resourcesPanel.getCanvasItemTitle(tab, 'starred').last().parent().invoke("attr", "class").should("contain", "secondary");
    this.getFocusDocumentSection(tab, "primary").should("exist");
    this.getFocusDocumentSection(tab, "secondary").should("exist");
    this.getSectionRightDocumentFlipper(tab, "primary").should("exist");
    this.getSectionLeftDocumentFlipper(tab, "primary").should("not.exist");
    this.getSectionRightDocumentFlipper(tab, "secondary").should("not.exist");
    this.getSectionLeftDocumentFlipper(tab, "secondary").should("exist");
    this.getSectionRightDocumentFlipper(tab, "primary").click();
    cy.wait(1000);
    this.getSectionLeftDocumentFlipper(tab, "primary").should("exist");
    resourcesPanel.getCanvasItemTitle(tab, 'starred').first().parent().invoke("attr", "class").should("not.contain", "selected");
    this.getSectionLeftDocumentFlipper(tab, "secondary").click();
    cy.wait(1000);
    resourcesPanel.getCanvasItemTitle(tab, 'starred').last().parent().invoke("attr", "class").should("not.contain", "secondary");
    this.getSectionRightDocumentFlipper(tab, "primary").should("exist");
    this.getSectionLeftDocumentFlipper(tab, "primary").should("exist");
    this.getSectionRightDocumentFlipper(tab, "secondary").should("exist");
    this.getSectionLeftDocumentFlipper(tab, "secondary").should("exist");
    this.getSectionLeftDocumentFlipper(tab, "primary").click();
    this.getSectionRightDocumentFlipper(tab, "secondary").click();
    cy.wait(1000);
    resourcesPanel.getCanvasItemTitle(tab, 'starred').first().should('exist').click({ force: true });
    cy.wait(1000);
    this.getScrollerAndDocument(tab).find('.document-area .focus-document.'+tab).should("exist");
    this.getFocusDocumentSection(tab, "secondary").should("not.exist");
    resourcesPanel.getCanvasItemTitle(tab, 'starred').last().should('exist').click({ force: true });
    cy.wait(1000);
    this.getScrollerAndDocument(tab).find('.document-area .focus-document.'+tab).should("not.exist");
  }
  getCanvasItem(tab, section) {
    return cy.get('.'+tab+ ' .list.'+section+'.bottom-panel .list-item[data-test='+section+'-list-items]');
  }
  getCanvasItemWithIndex(tab, section, index) {
    return cy.get('.'+tab+ ' .list.'+section+'.bottom-panel .list-item[data-test='+section+'-list-items]').find('.icon-holder .icon-star').eq(index);
  }
  starMultipleCanvasItem(tab, section) {
    let i;
    let totalCount;
    this.getCanvasItem(tab, section).then(((value) => {
      totalCount = Cypress.$(value).length;
      expect(value).to.have.length(totalCount);
        for(i=0; i < totalCount; i++) {
          if(this.getCanvasItemWithIndex(tab, section, i).invoke("attr", "class").should("not.contain", "starred")) {
            this.getCanvasItemWithIndex(tab, section, i).click();
            cy.wait(1000);
          }  
        }
      })
    )  
  }
  verifyThumbnailFlipper(tab) {
    this.getThumbnailRightDocumentFlipper(tab).should("exist");
    resourcesPanel.getCanvasItemTitle(tab, 'starred').first().parent().should("be.visible");
    resourcesPanel.getCanvasItemTitle(tab, 'starred').last().parent().should("not.be.visible");
    this.getThumbnailLeftDocumentFlipper(tab).should("not.exist");
    this.getThumbnailRightDocumentFlipper(tab).click();
    cy.wait(1000);
    this.getThumbnailRightDocumentFlipper(tab).should("not.exist");
    resourcesPanel.getCanvasItemTitle(tab, 'starred').first().parent().should("not.be.visible");
    resourcesPanel.getCanvasItemTitle(tab, 'starred').last().parent().should("be.visible");
    this.getThumbnailLeftDocumentFlipper(tab).should("exist");
    this.getThumbnailLeftDocumentFlipper(tab).click();
    cy.wait(1000);
    this.getThumbnailRightDocumentFlipper(tab).should("exist");
    this.getThumbnailLeftDocumentFlipper(tab).should("not.exist");
  }
}

export default StarredTab;
