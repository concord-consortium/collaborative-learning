import ClueCanvas from '../../../support/elements/common/cCanvas';
import Canvas from '../../../support/elements/common/Canvas';
import ResourcesPanel from '../../../support/elements/common/ResourcesPanel';
import ClueHeader from '../../../support/elements/common/cHeader';
import TextToolTile from '../../../support/elements/tile/TextToolTile';

const clueCanvas = new ClueCanvas;
const textToolTile = new TextToolTile;
let canvas = new Canvas;
let resourcesPanel = new ResourcesPanel;
let header = new ClueHeader;
let qaGroup = 10,
  students = [15, 16, 17, 18, 19];

function getUrl(studentIndex) {
  return `/?appMode=qa&qaGroup=10&fakeClass=10&problem=1.1&fakeUser=student:${students[studentIndex]}&unit=./demo/units/qa/content.json`;
}

function setupTest(studentIndex) {
  cy.visit(getUrl(studentIndex));
  cy.waitForLoad();
  header.getGroupName().should('contain', 'Group ' + qaGroup);
  header.getGroupMembers().find('div.member').should('contain', 'S' + students[studentIndex]);
  clueCanvas.shareCanvas();
  cy.wait(5000);
  clueCanvas.addTile('text');
  textToolTile.verifyTextTileIsEditable();
  textToolTile.enterText('This is to test the 4-up view of S' + students[studentIndex]);
  textToolTile.getTextTile().last().should('contain', '4-up').and('contain', 'S' + students[studentIndex]);
  clueCanvas.addTile('geometry');
  clueCanvas.addTile('table');
  clueCanvas.addTile('drawing');
  clueCanvas.addTile('image');
}

function verifyGroup() {
  // Verify Group num and the correct 4 students are listed, now that all 4 are loaded
  header.getGroupName().should('contain', 'Group ' + qaGroup);
  header.getGroupMembers().find('div.member').should('contain', 'S' + students[0]);
  header.getGroupMembers().find('div.member').should('contain', 'S' + students[1]);
  header.getGroupMembers().find('div.member').should('contain', 'S' + students[2]);
  header.getGroupMembers().find('div.member').should('contain', 'S' + students[3]);
}

context('Test group functionalities', function () {
  it('4-up view tests', function () {

    cy.log('will set up groups');
    setupTest(0);
    setupTest(1);
    setupTest(2);
    setupTest(3);
    verifyGroup();

    cy.log('verify 4-up view comes up correctly with students');
    clueCanvas.openFourUpView();
    canvas.getCopyButtons().should('have.class', 'disabled');
    clueCanvas.getFourUpToolbarButton().should('have.class', 'disabled');
    clueCanvas.getFourToOneUpViewToggle().should('be.visible');
    clueCanvas.getNorthEastCanvas().should('be.visible').and('contain', 'S' + students[0]);
    clueCanvas.getSouthEastCanvas().should('be.visible').and('contain', 'S' + students[1]);
    clueCanvas.getSouthWestCanvas().should('be.visible').and('contain', 'S' + students[2]);
    clueCanvas.getNorthWestCanvas().should('be.visible').and('contain', 'S' + students[3]);

    cy.log('verify share icon toggles correctly');
    clueCanvas.getShareButton().should('have.class', 'public');
    clueCanvas.unshareCanvas();
    clueCanvas.getShareButton().should('have.class', 'private');
    clueCanvas.shareCanvas();
    clueCanvas.getShareButton().should('have.class', 'public');

    cy.log('will verify canvas is visible in groupmates 4-up view');
    clueCanvas.getFourToOneUpViewToggle().should('be.visible');
    cy.get('.canvas-area .four-up .canvas-container.north-west').should('be.visible').and('not.contain', 'not shared their workspace');
    clueCanvas.getNorthEastCanvas().should('be.visible').and('not.contain', 'not shared their workspace');
    clueCanvas.getSouthEastCanvas().should('be.visible').and('not.contain', 'not shared their workspace');
    clueCanvas.getSouthWestCanvas().should('be.visible').and('not.contain', 'not shared their workspace');

    cy.log('will unshare canvas and verify canvas is not visible in groupmates 4-up view');
    clueCanvas.unshareCanvas();
    cy.visit(getUrl(0));
    cy.waitForLoad();
    clueCanvas.openFourUpView();
    clueCanvas.getFourToOneUpViewToggle().should('be.visible');
    clueCanvas.getSouthWestCanvas().should('be.visible').and('contain', 'Student 18 has not shared their workspace.');

    cy.log('restore a 4-up canvas where a groupmate has shared a canvas while it was not open');
    const defaultProblemDocTitle = "QA 1.1 Solving a Mystery with Proportional Reasoning";
    let copyTitle1 = 'Workspace Copy Document';
    canvas.copyDocument(copyTitle1);
    canvas.getPersonalDocTitle().should('contain', copyTitle1);
    cy.openTopTab("my-work");
    cy.openSection("my-work", "workspaces");
    resourcesPanel.getCanvasItemTitle('my-work', 'workspaces').should('contain', copyTitle1);
    cy.openDocumentWithTitle('my-work', 'workspaces', copyTitle1);
    //Since we now have persistentUI we switch to the default Problem Document since it has access to the four-up view
    cy.openDocumentWithTitle('my-work', 'workspaces', defaultProblemDocTitle);
    cy.visit(getUrl(3));
    cy.waitForLoad();
    clueCanvas.getFourToOneUpViewToggle().should('be.visible');
    clueCanvas.getNorthEastCanvas().should('contain', 'S15');
    clueCanvas.getNorthEastCanvas().should('be.visible').and('not.contain', 'not shared their workspace');
    clueCanvas.shareCanvas();
    cy.visit(getUrl(0));
    cy.waitForLoad();
    clueCanvas.getFourToOneUpViewToggle().should('be.visible');
    clueCanvas.getSouthWestCanvas().should('contain', 'S18');
    clueCanvas.getSouthWestCanvas().should('be.visible').and('not.contain', 'not shared their workspace');

    cy.log('restore a 4-up canvas where a groupmate has unshared a canvas while it was not open');
    let copyTitle2 = 'Workspace Copy Document';
    cy.openTopTab("my-work");
    cy.openSection("my-work", "workspaces");
    resourcesPanel.getCanvasItemTitle('my-work', 'workspaces').should('contain', copyTitle2);
    cy.openDocumentWithTitle('my-work', 'workspaces', copyTitle2);
    cy.visit(getUrl(3));
    cy.waitForLoad();
    clueCanvas.getFourToOneUpViewToggle().should('be.visible');
    clueCanvas.getNorthEastCanvas().should('contain', 'S15');
    clueCanvas.getNorthEastCanvas().should('be.visible').and('not.contain', 'not shared their workspace');
    clueCanvas.unshareCanvas();
    cy.visit(getUrl(0));
    cy.waitForLoad();
    cy.openDocumentWithTitle('my-work', 'workspaces', defaultProblemDocTitle);
    clueCanvas.getFourToOneUpViewToggle().should('be.visible');
    clueCanvas.getSouthWestCanvas().should('contain', 'S18');
    clueCanvas.getSouthWestCanvas().should('be.visible').and('contain', 'Student 18 has not shared their workspace.');
    header.changeGroup('11');

    cy.log('will open a new 4-up canvas with shared canvas from other students updated');
    cy.visit(getUrl(3));
    cy.waitForLoad();
    clueCanvas.shareCanvas();
    //add new student to the group
    cy.visit(getUrl(4));
    cy.waitForLoad();
    clueCanvas.openFourUpView();
    clueCanvas.getFourToOneUpViewToggle().should('be.visible');
    clueCanvas.getSouthWestCanvas().should('contain', 'S18');
    clueCanvas.getSouthWestCanvas().should('be.visible').and('not.contain', 'not shared their workspace');
  });
});
