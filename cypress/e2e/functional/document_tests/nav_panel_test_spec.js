import Canvas from '../../../support/elements/common/Canvas';
import ClueCanvas from '../../../support/elements/common/cCanvas';
import ResourcesPanel from "../../../support/elements/common/ResourcesPanel";
import Dialog from '../../../support/elements/common/Dialog';

// const primaryWorkspace = new PrimaryWorkspace;
const resourcesPanel = new ResourcesPanel;
const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const problemSubTabTitles = ['Introduction', 'Initial Challenge', 'What If', 'Now What'];
const dialog = new Dialog;

const queryParams1 = `${Cypress.config("qaUnitStudent5")}`;
const queryParams2 = `${Cypress.config("qaNoNavPanelUnitStudent5")}`;
const queryParams3 = `${Cypress.config("qaShowNavPanelUnitStudent5")}`;
const queryParams4 = `${Cypress.config("qaNoSectionProblemTabUnitStudent5")}`;
const queryParams5 = `${Cypress.config("qaConfigSubtabsUnitStudent5")}`;

function beforeTest(params) {
  cy.visit(params);
  cy.waitForLoad();
}

//TODO: change all syntax from starred to bookmarks/"bookmarked"
//https://www.pivotaltracker.com/n/projects/2441242/stories/186891632

context('Nav Panel', function () {
  it('Nav tiles', function () {
    beforeTest(queryParams1);

    cy.log('Tiles in nav panel should not show resize handle');
    cy.openTopTab("problems");
    for (const section of problemSubTabTitles) {
      cy.openProblemSection(section);
      cy.get('.problem-panel .tool-tile').each(($tile) => {
        cy.wrap($tile).click();
        cy.wrap($tile).find('.resize-handle').should('not.exist');
      });
    }
  });

  it('Test nav panel tabs', function () {
    beforeTest(queryParams1);
    let copyDocumentTitle = 'copy Investigation';

    clueCanvas.getInvestigationCanvasTitle().then(($canvasTitle) => {
      let title = $canvasTitle.text().trim();

      cy.log('verify tab names are visible');
      // cy.get(".resources-expander.my-work").click();
      cy.openTopTab("problems");
      cy.get(".problem-tabs .tab-list .prob-tab").each(($tab, index, $tabList) => {
        expect($tab.text()).to.contain(problemSubTabTitles[index]);
      });

      cy.log('saves current subtab when the resources panel is collapsed and expand');
      cy.openTopTab("problems");
      const section = "Initial Challenge";
      cy.openProblemSection(section);
      cy.get('.prob-tab').contains(section).should('have.class', 'selected');
      cy.collapseResourceTabs();
      cy.openResourceTabs();
      cy.get('.prob-tab').contains(section).should('have.class', 'selected');

      cy.log('verify that a problem workspace thumbnail is visible in the My Work/Workspaces nav panel');
      cy.openTopTab('my-work');
      cy.openSection('my-work', 'workspaces');
      resourcesPanel.getCanvasItemTitle('my-work', 'workspaces').contains(title).should('exist');

      cy.log('verify publish Investigation');
      canvas.publishCanvas("investigation");
      cy.openTopTab('class-work');
      resourcesPanel.getCanvasItemTitle('class-work', 'workspaces').should('contain', title);

      cy.log('verify make a copy of a canvas');
      canvas.copyDocument(copyDocumentTitle);
      canvas.getPersonalDocTitle().find('span').text().should('contain', copyDocumentTitle);

      cy.log('verify copied investigation appears in the workspaces section');
      cy.openTopTab("my-work");
      resourcesPanel.getCanvasItemTitle('my-work', 'workspaces').contains(copyDocumentTitle).should('be.visible');

      cy.log('verify publish of personal workspace');
      canvas.publishCanvas("personal");
      cy.openTopTab('class-work');
      cy.openSection('class-work', 'workspaces');
      resourcesPanel.getCanvasItemTitle('class-work', 'workspaces').should('contain', copyDocumentTitle);

      cy.log('verify delete document reverts nav-tab panel to show thumbnails');
      const deleteDocument = "Delete me";
      canvas.copyDocument(deleteDocument);

      cy.log('verify Workspaces Section');
      cy.openTopTab('my-work');
      cy.wait(1000);
      resourcesPanel.getCanvasItemTitle('my-work', 'workspaces').should('contain', deleteDocument);
      cy.openDocumentWithTitle('my-work', 'workspaces', copyDocumentTitle);
      cy.openDocumentWithTitle('my-work', 'workspaces', deleteDocument);
      canvas.deleteDocument();
      resourcesPanel.getCanvasItemTitle('my-work', 'workspaces').should('not.contain', deleteDocument);

      cy.log('verify open the correct canvas selected from Investigations section');
      cy.openTopTab("my-work");
      cy.openDocumentWithTitle('my-work', 'workspaces', title);
      clueCanvas.getInvestigationCanvasTitle().should('contain', title);

      cy.log('verify open the correct canvas selected from Extra Workspace section');
      cy.openTopTab("my-work");
      cy.openDocumentWithTitle('my-work', 'workspaces', copyDocumentTitle);
      canvas.getPersonalDocTitle().should('contain', copyDocumentTitle);

      cy.log('verify Starred Section');
      cy.openTopTab('my-work');
      cy.openSection("my-work", "workspaces");
      resourcesPanel.starCanvasItem('my-work', 'workspaces', copyDocumentTitle);

      cy.log('verify starred document star is highlighted');
      resourcesPanel.getCanvasStarIcon('my-work', 'workspaces', copyDocumentTitle).should('have.class', 'starred');

      cy.log('verify starred document appears in the Starred section');
      cy.openSection('my-work', 'bookmarks');
      resourcesPanel.getCanvasItemTitle('my-work', 'bookmarks').contains(copyDocumentTitle).should('exist');

      cy.log('remains open after the resources panel is collapsed and expand');
      cy.collapseResourceTabs();
      cy.openResourceTabs();
      cy.get('.doc-tab.my-work.bookmarks').should('have.class', 'selected');

      cy.log('verify Learning Log Section');
      cy.openTopTab('my-work');
      cy.openSection('my-work', 'learning-log');

      cy.log('verify investigation canvas is not listed in Learning Log ');
      resourcesPanel.getCanvasItemTitle('my-work', 'learning-log').contains(title).should('not.exist');
      resourcesPanel.getCanvasItemTitle('my-work', 'learning-log').should('have.length', 1);

      cy.log('verify user starter learning log canvas exists');
      resourcesPanel.getCanvasItemTitle('my-work', 'learning-log').contains("My First Learning Log").should('be.visible');

      cy.log('verify open of learning log canvas into main workspace');
      cy.openDocumentWithTitle('my-work', 'learning-log', "My First Learning Log");
      cy.get("[data-test=learning-log-title]").should('contain', "My First Learning Log");

      cy.log('verify Learning Log copy appears in Learning Log section');
      canvas.copyDocument("Learning Log Copy");
      cy.openSection("my-work", "learning-log");
      cy.wait(2500);
      resourcesPanel.getCanvasItemTitle('my-work', 'learning-log').contains("Learning Log Copy").should("be.visible");

      cy.log('verify publish learning log');
      canvas.publishCanvas("personal");
      cy.openTopTab("class-work");
      cy.openSection("class-work", "learning-logs");
      resourcesPanel.getCanvasItemTitle("class-work", "learning-logs", "Learning Log Copy");

      cy.log('Class Work tab tests');
      cy.openTopTab('class-work');

      cy.log('verify open published canvas from Workspace list');
      cy.openSection("class-work", "workspaces");
      cy.openDocumentThumbnail('class-work', 'workspaces', copyDocumentTitle);

      cy.log('will verify that published canvas does not have Edit button');
      resourcesPanel.getActiveTabEditButton().should("not.exist");

      cy.log('verify open published canvas from Investigations list');
      cy.openSection("class-work", "workspaces");
      cy.openDocumentThumbnail('class-work', 'workspaces', title);

      cy.log('will verify that published canvas does not have Edit button');
      resourcesPanel.getActiveTabEditButton().should("not.exist");

      cy.log('verify delete document from Workspace list');
      cy.openSection("class-work", "workspaces");
      cy.deleteDocumentThumbnail("class-work", 'workspaces', copyDocumentTitle);
      dialog.getDialogTitle().should('exist').contains('Confirm Delete');
      dialog.getDialogOKButton().click();
      resourcesPanel.getCanvasItemTitle('class-work', 'workspaces').should('not.contain', copyDocumentTitle);
    });
  });

  it('Nav panel tab configs', function () {
    beforeTest(queryParams2);

    cy.log('Single Top tab with visible resource tab panel');
    cy.get(".resources-expander.my-work").should('not.exist');
    canvas.openFileMenu();
    cy.get("[data-test=list-item-icon-open-workspace]").click();
    cy.get(".document-tabs .tab-list").should("not.be.visible");

    cy.log('Single Top tab with visible resource tab panel');
    beforeTest(queryParams3);
    cy.get(".top-tab").should("have.length", 1);
    cy.get(".document-tabs.my-work .tab-list").should("not.be.visible");
    canvas.openFileMenu();
    cy.get("[data-test=list-item-icon-open-workspace]").click();
    cy.get(".document-tabs .tab-list").should("not.be.visible");

    cy.log('Problem Tabs with no sub tabs');
    beforeTest(queryParams4);
    cy.openTopTab("problems");
    cy.get(".problem-tabs .tab-list").should("not.be.visible");

    cy.log('Customized tabs');
    const exampleProblemSubTabTitles = ["First Section", "Second Section", "Third Section"];
    //TODO: Need to change the syntax to "Bookmarks"
    const exampleMyWorkSubTabTitles = ["Workspaces", "Bookmarks"];
    const exampleClassWorkSubTabTitles = ["Workspaces", "Supplemental Work", "Bookmarks"];

    beforeTest(queryParams5);
    cy.openTopTab("problems");
    cy.get(".problem-tabs .tab-list .prob-tab").each(($tab, index, $tabList) => {
      expect($tabList).to.have.lengthOf(exampleProblemSubTabTitles.length);
      expect($tab.text()).to.contain(exampleProblemSubTabTitles[index]);
    });
    cy.openTopTab("my-work");
    cy.get(".document-tabs .tab-list .doc-tab.my-work").each(($tab, index, $tabList) => {
      expect($tabList).to.have.lengthOf(exampleMyWorkSubTabTitles.length);
      expect($tab.text()).to.contain(exampleMyWorkSubTabTitles[index]);
    });
    cy.openTopTab("class-work");
    cy.get(".document-tabs .tab-list .doc-tab.class-work").each(($tab, index, $tabList) => {
      expect($tabList).to.have.lengthOf(exampleClassWorkSubTabTitles.length);
      expect($tab.text()).to.contain(exampleClassWorkSubTabTitles[index]);
    });
  });

  it('Keyboard navigation and accessibility', function () {
    beforeTest(queryParams1);

    cy.log('Arrow key navigation moves focus between top-level tabs');
    cy.get('.top-tab.tab-problems').focus();
    cy.focused().should('have.class', 'tab-problems');
    cy.focused().should('have.attr', 'aria-selected', 'true');

    cy.realPress('ArrowRight');
    cy.focused().should('have.class', 'tab-my-work');
    cy.focused().should('have.attr', 'aria-selected', 'true');

    cy.realPress('ArrowRight');
    cy.focused().should('have.class', 'tab-class-work');
    cy.focused().should('have.attr', 'aria-selected', 'true');

    cy.log('Arrow left navigates back');
    cy.realPress('ArrowLeft');
    cy.focused().should('have.class', 'tab-my-work');
    cy.focused().should('have.attr', 'aria-selected', 'true');

    cy.log('Tab from top-level tab moves focus to sub-tabs');
    cy.openTopTab("problems");
    cy.get('.top-tab.tab-problems').focus();
    cy.realPress('Tab');
    cy.focused().should('have.class', 'prob-tab');

    cy.log('Arrow keys navigate between problem sub-tabs');
    cy.get('.prob-tab').contains('Introduction').focus();
    cy.focused().should('have.attr', 'aria-selected', 'true');

    cy.realPress('ArrowRight');
    cy.focused().should('contain', 'Initial Challenge');
    cy.focused().should('have.attr', 'aria-selected', 'true');

    cy.realPress('ArrowRight');
    cy.focused().should('contain', 'What If');
    cy.focused().should('have.attr', 'aria-selected', 'true');

    cy.realPress('ArrowLeft');
    cy.focused().should('contain', 'Initial Challenge');
    cy.focused().should('have.attr', 'aria-selected', 'true');

    cy.log('Panel action button has aria-label');
    cy.openTopTab("problems");
    cy.get('.nav-tab-panel').then($panel => {
      if ($panel.find('.close-button').length > 0) {
        cy.get('.close-button')
          .should('have.attr', 'aria-label', 'Close resources panel');
      } else {
        cy.get('.chat-panel-toggle')
          .should('have.attr', 'aria-label', 'Open chat panel');
      }
    });
  });
});
