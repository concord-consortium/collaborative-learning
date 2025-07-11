import ClueCanvas from '../../../support/elements/common/cCanvas';
import TextToolTile from '../../../support/elements/tile/TextToolTile';

const clueCanvas = new ClueCanvas;
const textToolTile = new TextToolTile;
let students = [15, 16, 17, 18];

function getUrl(studentIndex) {
  return `/?appMode=qa&qaGroup=10&fakeClass=10&problem=1.1&fakeUser=student:${students[studentIndex]}&unit=./demo/units/qa/content.json`;
}

function setupTest(studentIndex) {
  cy.visit(getUrl(studentIndex));
  cy.waitForLoad();
  clueCanvas.shareCanvas();//all students will share their canvas
  cy.wait(10000);
  clueCanvas.addTile('text');
  textToolTile.verifyTextTileIsEditable();
  textToolTile.enterText('This is to test the 4-up view of S' + students[studentIndex]);
  textToolTile.getTextTile().last().should('contain', '4-up').and('contain', 'S' + students[studentIndex]);
}

context('Test group functionalities', function () {
  it('4-up view read-only', function () {

    cy.log('students to check each others tiles in 4-up view read-only');

    setupTest(0);
    setupTest(1);
    setupTest(2);
    setupTest(3);

    clueCanvas.openFourUpView();
    clueCanvas.getSingleWorkspace().find('.member').eq(0).click();
    clueCanvas.getSingleWorkspace().find('.text-tool').should('not.have.class', 'read-only');
    clueCanvas.toggleFourUpViewToolbarButton();
    clueCanvas.getSingleWorkspace().find('.member').eq(1).click();
    clueCanvas.getSingleWorkspace().find('.text-tool').should('have.class', 'read-only');
    clueCanvas.toggleFourUpViewToolbarButton();
    clueCanvas.getSingleWorkspace().find('.member').eq(2).click();
    clueCanvas.getSingleWorkspace().find('.text-tool').should('have.class', 'read-only');
    clueCanvas.toggleFourUpViewToolbarButton();
    clueCanvas.getSingleWorkspace().find('.member').eq(3).click();
    clueCanvas.getSingleWorkspace().find('.text-tool').should('have.class', 'read-only');
  });
});
