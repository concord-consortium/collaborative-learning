import ClueCanvas from '../../../support/elements/common/cCanvas';
import TextToolTile from '../../../support/elements/tile/TextToolTile';

let clueCanvas = new ClueCanvas,
  textToolTile = new TextToolTile;

function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitStudent5")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
}

context('Test the overall workspace', function () {
  it('Desktop functionalities', function () {
    beforeTest();

    cy.log('will verify that clicking on collapsed resource tab opens the nav area');
    // cy.get(".resources-expander.my-work").click();
    cy.openTopTab("my-work");
    cy.get('[data-test=my-work-section-investigations-documents]').should('be.visible');

    cy.log('will verify clicking on subtab opens panel to subtab section');
    const section = "learning-log";
    cy.openSection('my-work', section);
    cy.get('[data-test=subtab-learning-log]').should('be.visible');
    cy.get('.documents-list.' + section + ' [data-test=' + section + '-list-items] .footer').should('contain', "My First Learning Log");

    cy.log('verify click on document thumbnail opens document in nav panel');
    cy.openDocumentWithTitle('my-work', 'learning-log', 'My First Learning Log');
    cy.get('.editable-document-content [data-test=canvas]').should('be.visible');
    cy.get('.document-header.learning-log').should('be.visible');

    cy.log('verify click on Edit button opens document in main workspace');
    cy.get('.toolbar .tool.edit').click();
    cy.get('.primary-workspace [data-test=learning-log-title]').should('contain', "Learning Log: My First Learning Log");

    cy.log('verify close of nav tabs');
    cy.collapseResourceTabs();
    cy.get('.nav-tab-panel').should('not.be.visible');
    cy.get('.primary-workspace').should('be.visible');
    cy.get('.workspace-expander').should('not.be.visible');
    cy.get('.resources-expander').should('be.visible');

    cy.log('verify collapse workspace');
    cy.get('.resources-expander').click();
    cy.collapseWorkspace();
    cy.get('.primary-workspace').should('not.be.visible');
    cy.get('.workspace-expander').should('be.visible');
    cy.get('.resources-expander').should('not.be.visible');
    cy.get('.nav-tab-panel').should('be.visible');

    cy.log('verify collapsed workspace tab opens on click');
    cy.get('.workspace-expander').click();
    cy.get('.primary-workspace').should('be.visible');
    cy.get('.nav-tab-panel').should('be.visible');

  });
  // TODO: Changes in new document add feature.
  // FIXME: The test is failing looking for the selected class
  it('will verify canvases do not persist between problems', function () {
    let tab1 = 'Introduction';

    let problem1 = `${Cypress.config("qaUnitStudent5")}`;
    let problem2 = problem1.replace("problem=1.1", "problem=2.1");

    cy.visit(problem1);
    cy.waitForLoad();

    clueCanvas.addTile('text');
    textToolTile.verifyTextTileIsEditable();
    textToolTile.enterText('This is the ' + tab1 + ' in Problem ' + problem1 + '{enter}');
    textToolTile.getTextTile().last().should('contain', 'Problem ' + problem1);
    // the save to firebase is debounced, so we need to wait for it to complete
    cy.wait(3000);

    cy.visit(problem2);
    cy.waitForLoad();
    // cy.wait(1000);
    textToolTile.getTextTile().should('not.exist');

    //Shows student as disconnected and will not load the introduction canvas
    cy.visit(problem1);
    cy.waitForLoad();
    // cy.wait(2000);
    textToolTile.getTextTile().click();
    textToolTile.getTextTile().last().should('contain', 'Problem ' + problem1);
    clueCanvas.deleteTile('text');//clean up
  });
});
