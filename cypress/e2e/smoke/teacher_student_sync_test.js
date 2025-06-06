import { visitQaSubtabsUnit } from '../../support/visit_params';
import Canvas from '../../support/elements/common/Canvas';
import ClueCanvas from '../../support/elements/common/cCanvas';
import TextToolTile from '../../support/elements/tile/TextToolTile';

let canvas = new Canvas();
let clueCanvas = new ClueCanvas();
let textToolTile = new TextToolTile();

context('Teacher/Student Sync Smoke Test', () => {
  it.only('verifies teacher can see student work in readonly mode and changes sync', () => {
    // Start as student 5
    visitQaSubtabsUnit({ student: 5 });

    // Add a text tile and enter some text
    clueCanvas.addTile('text');
    textToolTile.enterText('Student test message');
    textToolTile.getTextEditor().should('contain', 'Student test message');

    // Publish the work
    canvas.publishCanvas("investigation");

    // Now switch to teacher view
    visitQaSubtabsUnit({ teacher: 1 });

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
