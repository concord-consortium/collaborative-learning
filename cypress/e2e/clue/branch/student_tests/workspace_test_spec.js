import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import TextToolTile from '../../../../support/elements/clue/TextToolTile';

const queryParams = `${Cypress.config("queryParams")}`;
let clueCanvas = new ClueCanvas,
    textToolTile = new TextToolTile;

context('Test the overall workspace', function () {
  before(function () {
    cy.clearQAData('all');

    cy.visit(queryParams);
    cy.waitForLoad();
  });

  describe('Desktop functionalities', function () {
    it('will verify that clicking on collapsed resource tab opens the nav area', function () {
      // cy.get(".collapsed-resources-tab.my-work").click();
      cy.openTopTab("my-work");
      cy.get('[data-test=my-work-section-investigations-documents]').should('be.visible');
    });
    it('will verify clicking on subtab opens panel to subtab section', function () {
      const section = "learning-log";
      cy.openSection('my-work', section);
      cy.get('[data-test=subtab-learning-log]').should('be.visible');
      cy.get('.list.'+section+' [data-test='+section+'-list-items] .footer').should('contain', "My First Learning Log");
    });
    it('verify click on document thumbnail opens document in nav panel', function () {
      cy.openDocumentWithTitle('my-work', 'learning-log','My First Learning Log');
      cy.get('.editable-document-content [data-test=canvas]').should('be.visible');
      cy.get('.edit-button.learning-log').should('be.visible');
    });
    it('verify click on Edit button opens document in main workspace', function () {
      cy.get('.edit-button.learning-log').click();
      cy.get('.primary-workspace [data-test=learning-log-title]').should('contain', "Learning Log: My First Learning Log");
    });
    it('verify close of nav tabs', function () {
      cy.closeResourceTabs();
      cy.get('.nav-tab-panel').should('not.exist');
      cy.get('.primary-workspace').should('be.visible');
    });
    it('verify collapse workspace', function () {
      cy.get('.collapsed-resources-tab').click();
      cy.collapseWorkspace();
      cy.get('.primary-workspace').should('not.exist');
      cy.get('.collapsed-workspace-tab').should('exist');
      cy.get('.nav-tab-panel').should('exist');
    });
    it('verify collapsed workspace tab opens on click', function () {
      cy.get('.collapsed-workspace-tab').click({force:true});
      cy.get('.primary-workspace').should('exist');
      cy.get('.nav-tab-panel').should('exist');
    });
    // TODO: Changes in new document add feature.
    it('will verify canvases do not persist between problems', function () {
      let problem1 = '1',
        problem2 = '2.1';
      let tab1 = 'Introduction';

      cy.visit('?appMode=qa&fakeClass=5&fakeUser=student:1&qaGroup=1&problem=' + problem1);
      cy.waitForLoad();

      clueCanvas.addTile('text');
      textToolTile.enterText('This is the ' + tab1 + ' in Problem ' + problem1 + '{enter}');
      textToolTile.getTextTile().last().should('contain', 'Problem ' + problem1);
      // the save to firebase is debounced, so we need to wait for it to complete
      cy.wait(3000);

      cy.visit('?appMode=qa&fakeClass=5&fakeUser=student:1&qaGroup=1&problem=' + problem2);
      cy.waitForLoad();
      // cy.wait(1000);
      textToolTile.getTextTile().should('not.exist');

      //Shows student as disconnected and will not load the introduction canvas
      cy.visit('?appMode=qa&fakeClass=5&fakeUser=student:1&qaGroup=1&problem=' + problem1);
      cy.waitForLoad();
      // cy.wait(2000);
      textToolTile.getTextTile().last().should('contain', 'Problem ' + problem1);
      clueCanvas.deleteTile('text');//clean up
    });

  });
});
