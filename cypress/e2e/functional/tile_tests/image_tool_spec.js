import Canvas from '../../../support/elements/common/Canvas';
import ClueCanvas from '../../../support/elements/common/cCanvas';
import ImageToolTile from '../../../support/elements/tile/ImageToolTile';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const imageToolTile = new ImageToolTile;

let userCanvas = 'Uploaded Images';

function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitStudent5")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
  cy.showOnlyDocumentWorkspace();
}

context('Image Tile', function () {
  it('Test image functionalities', function () {
    beforeTest();

    cy.log('upload image from user computer');
    canvas.createNewExtraDocumentFromFileMenu(userCanvas, "my-work");

    cy.log('will upload png file from user computer');
    const imageFilePath1 = 'image.png';
    clueCanvas.addTile('image');
    imageToolTile.getImageToolTile().should("exist");
    cy.uploadFile(imageToolTile.imageChooseFileButton(), imageFilePath1, 'image/png');
    cy.wait(2000);

    cy.log('will upload jpg file from user computer');
    const imageFilePath2 = 'case_image.jpg';
    clueCanvas.addTile('image');
    // imageToolTile.getImageToolControl().last().click();
    cy.uploadFile(imageToolTile.imageChooseFileButton(), imageFilePath2, 'image/jpg');
    cy.wait(2000);

    cy.log('will upload gif file from user computer');
    const imageFilePath3 = 'model_image.gif';
    clueCanvas.addTile('image');
    // imageToolTile.getImageToolControl().last().click();
    cy.uploadFile(imageToolTile.imageChooseFileButton(), imageFilePath3, 'image/gif');
    cy.wait(2000);

    cy.log('verify Image tile title restore upon page reload');
    const newName = "Image Tile";
    clueCanvas.addTile('image');
    imageToolTile.getTileTitle().first().should("contain", "Image 1");
    imageToolTile.getImageTileTitle().first().click();
    imageToolTile.getImageTileTitle().first().type(newName + '{enter}');
    imageToolTile.getTileTitle().should("contain", newName);
    cy.wait(2000);

    cy.reload();
    cy.waitForLoad();

    imageToolTile.getTileTitle().first().should("contain", newName);
  });

  it('Image tile title edit, undo redo and delete tile', () => {
    beforeTest();

    cy.log('will undo redo image tile creation/deletion');
    // Creation - Undo/Redo
    clueCanvas.addTile('image');
    imageToolTile.getImageToolTile().should("exist");
    clueCanvas.getUndoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().should("have.class", "disabled");
    clueCanvas.getUndoTool().click();
    imageToolTile.getImageToolTile().should("not.exist");
    clueCanvas.getUndoTool().should("have.class", "disabled");
    clueCanvas.getRedoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().click();
    imageToolTile.getImageToolTile().should("exist");
    clueCanvas.getUndoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().should("have.class", "disabled");

    // Deletion - Undo/Redo
    clueCanvas.deleteTile('image');
    imageToolTile.getImageToolTile().should('not.exist');
    clueCanvas.getUndoTool().click();
    imageToolTile.getImageToolTile().should("exist");
    clueCanvas.getRedoTool().click();
    imageToolTile.getImageToolTile().should('not.exist');

    cy.log("edit tile title");
    const newName = "Image Tile";
    clueCanvas.addTile('image');
    imageToolTile.getTileTitle().first().should("contain", "Image 1");
    imageToolTile.getImageTileTitle().first().click();
    imageToolTile.getImageTileTitle().first().type(newName + '{enter}');
    imageToolTile.getTileTitle().should("contain", newName);

    cy.log("undo redo actions");
    clueCanvas.getUndoTool().click();
    imageToolTile.getTileTitle().first().should("contain", "Image 1");
    clueCanvas.getRedoTool().click();
    imageToolTile.getTileTitle().should("contain", "Image Tile");

    cy.log('will undo redo image tile using keyboard');
    clueCanvas.addTile('image');
    imageToolTile.getTileTitle().first().click();
    imageToolTile.getTileTitle().first().type('{cmd+z}');
    imageToolTile.getTileTitle().should("not.contain", "Image 1");
    imageToolTile.getTileTitle().first().type('{cmd+shift+z}');
    imageToolTile.getTileTitle().should("contain", "Image 1");

    cy.log('verify delete image');
    imageToolTile.getImageToolTile().first().click();
    clueCanvas.deleteTile('image');
    imageToolTile.getImageToolTile().first().click();
    clueCanvas.deleteTile('image');
    imageToolTile.getImageToolTile().should("not.exist");
  });
});
