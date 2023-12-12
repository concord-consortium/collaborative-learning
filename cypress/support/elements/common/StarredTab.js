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
    resourcesPanel.getCanvasItemTitle(tab, 'starred').first().parent().invoke("attr", "class").should("contain", "selected");
    this.getScrollerAndDocument(tab).find('.document-area .focus-document.'+tab).should("exist");
    this.getRightDocumentFlipper(tab).should("exist");
    this.getLeftDocumentFlipper(tab).should("not.exist");
    this.getFocusDocumentSection(tab, "secondary").should("not.exist");
    this.getRightDocumentFlipper(tab).click();
    this.getLeftDocumentFlipper(tab).should("exist");
    resourcesPanel.getCanvasItemTitle(tab, 'starred').first().parent().invoke("attr", "class").should("not.contain", "selected");
    this.getLeftDocumentFlipper(tab).click();
    this.getLeftDocumentFlipper(tab).should("not.exist");
    resourcesPanel.getCanvasItemTitle(tab, 'starred').first().should('exist').click({ force: true });
    this.getScrollerAndDocument(tab).find('.document-area .focus-document.'+tab).should("not.exist");
  }
  verifyDoubleDocumentFlipper(tab) {
    resourcesPanel.getCanvasItemTitle(tab, 'starred').first().should("exist").click({ force: true });
    resourcesPanel.getCanvasItemTitle(tab, 'starred').last().should("exist").click({ force: true });
    resourcesPanel.getCanvasItemTitle(tab, 'starred').first().parent().invoke("attr", "class").should("contain", "selected");
    resourcesPanel.getCanvasItemTitle(tab, 'starred').last().parent().invoke("attr", "class").should("contain", "secondary");
    this.getFocusDocumentSection(tab, "primary").should("exist");
    this.getFocusDocumentSection(tab, "secondary").should("exist");
    this.getSectionRightDocumentFlipper(tab, "primary").should("exist");
    this.getSectionLeftDocumentFlipper(tab, "primary").should("not.exist");
    this.getSectionRightDocumentFlipper(tab, "secondary").should("not.exist");
    this.getSectionLeftDocumentFlipper(tab, "secondary").should("exist");
    this.getSectionRightDocumentFlipper(tab, "primary").click();
    this.getSectionLeftDocumentFlipper(tab, "primary").should("exist");
    resourcesPanel.getCanvasItemTitle(tab, 'starred').first().parent().invoke("attr", "class").should("not.contain", "selected");
    this.getSectionLeftDocumentFlipper(tab, "secondary").click();
    resourcesPanel.getCanvasItemTitle(tab, 'starred').last().parent().invoke("attr", "class").should("not.contain", "secondary");
    this.getSectionRightDocumentFlipper(tab, "primary").should("exist");
    this.getSectionLeftDocumentFlipper(tab, "primary").should("exist");
    this.getSectionRightDocumentFlipper(tab, "secondary").should("exist");
    this.getSectionLeftDocumentFlipper(tab, "secondary").should("exist");
    this.getSectionLeftDocumentFlipper(tab, "primary").click();
    this.getSectionRightDocumentFlipper(tab, "secondary").click();
    resourcesPanel.getCanvasItemTitle(tab, 'starred').first().should('exist').click({ force: true });
    this.getScrollerAndDocument(tab).find('.document-area .focus-document.'+tab).should("exist");
    this.getFocusDocumentSection(tab, "secondary").should("not.exist");
    resourcesPanel.getCanvasItemTitle(tab, 'starred').last().should('exist').click({ force: true });
    this.getScrollerAndDocument(tab).find('.document-area .focus-document.'+tab).should("not.exist");
  }
  getCanvasItem(tab, section) {
    return cy.get('.'+tab+ ' .list.'+section+'.bottom-panel .list-item[data-test='+section+'-list-items]');
  }
  getCanvasItemWithIndex(tab, section, index) {
    return cy.get('.'+tab+ ' .list.'+section+'.bottom-panel .list-item[data-test='+section+'-list-items]').find('.icon-holder .icon-star').eq(index);
  }
  getTopPanelCanvasItemWithIndex(tab, section, index) {
    return cy.get('.'+tab+ ' .list.'+section+'.top-panel .list-item[data-test='+section+'-list-items]').find('.icon-holder .icon-star').eq(index);
  }
  getTopPanelCanvasItemWithIndexStar(tab, section) {
    return cy.get('.'+tab+ ' .list.'+section+'.top-panel .list-item[data-test='+section+'-list-items]').find('.icon-holder .icon-star');
  }
  starMultipleCanvasItem(tab, section) {
    let i, j;
    let totalCount, starCount;
    this.getTopPanelCanvasItemWithIndexStar(tab, section).then(((value) => {
      starCount = Cypress.$(value).length;
      expect(value).to.have.length(starCount);
        for(j=0; j < (starCount - (starCount-1)); j++) {
            if (Cypress.$(value).eq(j).parent().find('.starred').length > 0) {
                cy.log("Document Already Starred");
          } else {
            this.getTopPanelCanvasItemWithIndex(tab, section, j).click();
            this.getTopPanelCanvasItemWithIndex(tab, section, j).invoke("attr", "class").should("contain", "starred");
          }      
        }
      }))
    this.getCanvasItem(tab, section).then(((value) => {
      totalCount = Cypress.$(value).length;
      expect(value).to.have.length(totalCount);
        for(i=0; i < totalCount; i++) {
          if(Cypress.$(value).eq(i).parent().find('.starred').length > 0){
            cy.log("Document Already Starred");
          } else {
            this.getCanvasItemWithIndex(tab, section, i).click();
            this.getCanvasItemWithIndex(tab, section, i).invoke("attr", "class").should("contain", "starred");
          }  
        }
      })
    )  
  }
  starMultipleCanvasItemClassWork(tab, section) {
    let i;
    let totalCount;
    this.getTopPanelCanvasItemWithIndexStar(tab, section).then(((value) => {
      totalCount = Cypress.$(value).length;
      expect(value).to.have.length(totalCount);
        for(i=0; i < totalCount; i++) {
            if (Cypress.$(value).eq(i).parent().find('.starred').length > 0) {
                cy.log("Document Already Starred");
          } else {
            this.getTopPanelCanvasItemWithIndex(tab, section, i).click();
            this.getTopPanelCanvasItemWithIndex(tab, section, i).invoke("attr", "class").should("contain", "starred");
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
  getScrollerToggle(tab) {
    return this.getScrollerAndDocument(tab).find(".collapse-scroller-button");
  }
  verifyScrollerToggle(tab) {
    this.getScrollerToggle(tab).should("not.have.class", "collapsed");
    this.getScrollerToggle(tab).click();
    this.getScrollerToggle(tab).should("have.class", "collapsed");
    this.getScrollerAndDocument(tab).find(".document-scroller").should("have.class", "collapsed");
    this.getThumbnailRightDocumentFlipper(tab).should("not.exist");
    this.getThumbnailLeftDocumentFlipper(tab).should("not.exist");

    this.getScrollerToggle(tab).click();
    this.getScrollerToggle(tab).should("not.have.class", "collapsed");
    this.getScrollerAndDocument(tab).find(".document-scroller").should("not.have.class", "collapsed");
  }
}

export default StarredTab;
