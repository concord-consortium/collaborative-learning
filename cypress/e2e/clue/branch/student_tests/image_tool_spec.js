import Canvas from '../../../../support/elements/common/Canvas';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import ImageToolTile from '../../../../support/elements/clue/ImageToolTile';
// import PrimaryWorkspace from '../../../../support/elements/common/PrimaryWorkspace';
import ResourcesPanel from "../../../../support/elements/clue/ResourcesPanel";

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const imageToolTile = new ImageToolTile;
// const primaryWorkspace = new PrimaryWorkspace;
const resourcesPanel = new ResourcesPanel;
// const baseUrl = (`${Cypress.config("baseUrl")}`).split('/branch/')[0];

let userCanvas = 'Uploaded Images';

context('Test image functionalities', function(){
    before(function(){
        const queryParams = `${Cypress.config("queryParams")}`;
        cy.clearQAData('all');
        cy.visit(queryParams);
        cy.waitForLoad();
        cy.showOnlyDocumentWorkspace();
    });

    describe('upload image from user computer',()=>{
        before(()=>{ //create a new doc so that save and restore can be tested
            canvas.createNewExtraDocumentFromFileMenu(userCanvas, "my-work");
            cy.wait(2000);
        });
        it('will upload png file from user computer', function(){
            const imageFilePath='image.png';
            clueCanvas.addTile('image');
            imageToolTile.getImageToolTile().should("exist");
            // imageToolTile.getImageToolControl().last().click();
            cy.uploadFile(imageToolTile.imageChooseFileButton(), imageFilePath, 'image/png');
            cy.wait(2000);
        });

        it('will upload jpg file from user computer', function(){
            const imageFilePath='case_image.jpg';
            clueCanvas.addTile('image');
            // imageToolTile.getImageToolControl().last().click();
            cy.uploadFile(imageToolTile.imageChooseFileButton(), imageFilePath, 'image/jpg');
            cy.wait(2000);
        });

        it('will upload gif file from user computer', function(){
            const imageFilePath='model_image.gif';
            clueCanvas.addTile('image');
            // imageToolTile.getImageToolControl().last().click();
            cy.uploadFile(imageToolTile.imageChooseFileButton(), imageFilePath, 'image/gif');
            cy.wait(2000);
        });
        // TODO: Figure out how to get the clipboard paste check below to work when the tests
        // are run using Chrome. It will pass when using Electron, but not Chrome. In Chrome
        // the attempt to write to the clipboard results in an error: "Must be handling a user
        // gesture to use custom clipboard." See https://github.com/cypress-io/cypress/issues/2752
        // for more background. Apparently, the basic problem is that Cypress "currently uses
        // programmatic browser APIs which Chrome doesn't consider as genuine user interaction."
        it.skip('will accept a valid image URL pasted from the clipboard', function(){
            const imageFilePath = "curriculum/test/images/image.png";
            Cypress.automation("remote:debugger:protocol", {
                command: "Browser.grantPermissions",
                params: {
                  permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
                  origin: window.location.origin,
                },
              }).then(cy.window().then((win) => {
                win.navigator.clipboard.write([new win.ClipboardItem({
                    "text/plain": new Blob([imageFilePath], { type: "text/plain" }),
                })]);
            }));
            const isMac = navigator.platform.indexOf("Mac") === 0;
            const cmdKey = isMac ? "meta" : "ctrl";
            imageToolTile.getImageToolTile().last().type(`{${cmdKey}+v}`);
            imageToolTile.getImageToolImage().last().should("have.css", "background-image").and("contain", "test/images/image.png");
        });
    });
    describe.skip('restore of images', function(){
        before(()=>{ //reopen the first canvas
            resourcesPanel.openPrimaryWorkspaceTab('my-work');
            cy.openSection('my-work','workspaces');
            cy.openDocumentWithTitle('my-work','workspaces', '2.1 Drawing Wumps');
            cy.wait(5000);
            // resourcePanel.closePrimaryWorkspaceTabs();
        });
        it('verify restore of all images that were added by URL', function(){
            // TODO: Need to figure out how to check that correct images were reloaded. For now just checking for 3 image tools are reloaded
            // const imageFileURL = ['https://codap.concord.org/~eireland/image.png', 'https://codap.concord.org/~eireland/case_image.jpg','https://codap.concord.org/~eireland/model_image.gif'];
            // imageToolTile.getImageToolImage().each(($images, index, $list)=>{
                // expect($list).to.have.length(3);
                // expect($images).to.have.css('background-image').and.contains(imageFileURL[index]);
                // expect($images).to.have.css('background-image').and.contains('url("data:image/png;base64');
            // });
            imageToolTile.getImageToolImage().should('have.length', 3);
        });
        it('verify restore of all  images that were added by upload', function(){
            resourcesPanel.openPrimaryWorkspaceTab('my-work');
            cy.openSection('my-work','workspaces');
            cy.openDocumentWithTitle('my-work','workspaces', userCanvas);
            cy.wait(3000);
            // TODO: Need to figure out how to check that correct images were reloaded. For now just checking for 3 image tools are reloaded
            // const imageFilePath=['image.png','case_image.jpg',/*'model_image.gif'*/];

            // imageToolTile.getImageToolImage().each(($images, index, $list)=>{
            //     expect($list).to.have.length(imageFilePath.length);
            //     expect($images).to.have.css('background-image').and.contains('url("data:image');
            // });
            imageToolTile.getImageToolImage().should('have.length', 3);
        });
    });

});

context('Test undo redo functionalities', function(){
    before(function(){
        const queryParams = `${Cypress.config("queryParams")}`;
        cy.clearQAData('all');
        cy.visit(queryParams);
        cy.waitForLoad();
        cy.showOnlyDocumentWorkspace();
    });

    describe('Image tile title edit, undo redo and delete tile',()=>{
        it('will undo redo image tile creation/deletion', function () {
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
        });
        it("edit tile title", () => {
            const newName = "Image Tile";
            clueCanvas.addTile('image');
            imageToolTile.getTileTitle().first().should("contain", "Image 1");
            imageToolTile.getImageTileTitle().first().click();
            imageToolTile.getImageTileTitle().first().type(newName + '{enter}');
            imageToolTile.getTileTitle().should("contain", newName);
        });
        it("undo redo actions", () => {
            clueCanvas.getUndoTool().click();
            imageToolTile.getTileTitle().first().should("contain", "Image 1");
            clueCanvas.getRedoTool().click();
            imageToolTile.getTileTitle().should("contain", "Image Tile");
        });
        it('will undo redo image tile using keyboard', function () {
            clueCanvas.addTile('image');
            imageToolTile.getTileTitle().first().click();
            imageToolTile.getTileTitle().first().type('{cmd+z}');
            imageToolTile.getTileTitle().should("not.contain", "Image 1");
            imageToolTile.getTileTitle().first().type('{cmd+shift+z}');
            imageToolTile.getTileTitle().should("contain", "Image 1");
        });
        it('verify delete image', function () {
            imageToolTile.getImageToolTile().first().click();
            clueCanvas.deleteTile('image');
            imageToolTile.getImageToolTile().first().click();
            clueCanvas.deleteTile('image');
            imageToolTile.getImageToolTile().should("not.exist");
        });
    });

});

