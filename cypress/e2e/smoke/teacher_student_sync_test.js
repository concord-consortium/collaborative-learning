import { visitQaSubtabsUnit } from '../../support/visit_params';
import Canvas from '../../support/elements/common/Canvas';
import ClueCanvas from '../../support/elements/common/cCanvas';
import TextToolTile from '../../support/elements/tile/TextToolTile';
import TeacherDashboard from '../../support/elements/common/TeacherDashboard';

let canvas = new Canvas();
let clueCanvas = new ClueCanvas();
let textToolTile = new TextToolTile();
let dashboard = new TeacherDashboard();

context('Teacher/Student Sync Smoke Test', () => {
  it('verifies teacher can see student work in readonly mode and changes sync', () => {
    // Start as student 5
    visitQaSubtabsUnit({ student: 5 });

    // Add a text tile and enter some text
    clueCanvas.addTile('text');
    textToolTile.enterText('Student test message');
    textToolTile.getTextEditor().should('contain', 'Student test message');

    // Test sharing functionality
    cy.log('verify share button');
    clueCanvas.getShareButton().should('be.visible');
    clueCanvas.getShareButton().should('have.class', 'private');
    clueCanvas.shareCanvas();
    clueCanvas.getShareButton().should('have.class', 'public');
    clueCanvas.unshareCanvas();
    clueCanvas.getShareButton().should('have.class', 'private');

    // Publish the work
    cy.log('verify publish button');
    canvas.publishCanvas("investigation");
    canvas.getPublishItem().should('exist');

    // Now switch to teacher view
    visitQaSubtabsUnit({ teacher: 1 });

    // Test dashboard views
    cy.log('verify dashboard views');
    dashboard.switchView("Dashboard");
    dashboard.switchWorkView('Published');
    // cy.wait(3000); // Wait for canvases to load

    // Verify published work is visible in dashboard
    cy.contains('Student test message').should('exist');

    // Test star functionality
    cy.log('verify star functionality');
    dashboard.getStarPublishIcon().should('not.have.class', 'starred');
    dashboard.getStarPublishIcon().click({ force: true });
    dashboard.getStarPublishIcon().should('have.class', 'starred');

    // Switch to current work view
    dashboard.switchWorkView('Current');
    cy.wait(3000); // Wait for canvases to load

    // // Verify current work is visible
    cy.get('[data-test="class-work-section-personal-documents"]')
      .should('exist');

    // Switch back to workspace view
    dashboard.switchView("Workspace & Resources");

    // Open the student's document from workspace tab
    cy.openTopTab('class-work');
    cy.openSection('class-work', 'workspaces');

    // Find and click on the specific student document
    cy.get('[data-test="class-work-section-published-documents"]')
      .find('.footer .info div')
      .contains('Student 5: 1.1 Unit Toolbar Configuration')
      .click();

    // Verify the text is still there and editable in the preview of the Workspace tab
    cy.contains('Student test message').should('exist');
    cy.get('.text-tool').should('have.class', 'read-only');
  });
});
