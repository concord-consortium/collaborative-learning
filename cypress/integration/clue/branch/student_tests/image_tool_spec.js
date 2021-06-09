import Canvas from '../../../../support/elements/common/Canvas';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import ImageToolTile from '../../../../support/elements/clue/ImageToolTile';
import RightNav from '../../../../support/elements/common/RightNav';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const imageToolTile = new ImageToolTile;
const rightNav = new RightNav;
// const baseUrl = (`${Cypress.config("baseUrl")}`).split('/branch/')[0];

let userCanvas = 'Uploaded Images';

before(function(){
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;
    cy.clearQAData('all');

    cy.visit(baseUrl+queryParams);
    cy.waitForSpinner();
});

context('Test image functionalities', function(){
    describe.skip('upload image from URL', function(){
        it('will load an png from a URL', function(){
            const imageFileURL = 'https://codap.concord.org/~eireland/image.png';
            clueCanvas.addTile('image');
            imageToolTile.getImageToolControl().last().click();
            imageToolTile.getImageURLTextField().last().click().clear().type(imageFileURL);
            cy.get(imageToolTile.imageChooseFileButton()).last().click();
            imageToolTile.getImageToolImage().last().should('have.css', 'background-image','url("'+imageFileURL+'")');
        });
        it('will load an jpg from a URL', function(){
            const imageFileURL = 'https://codap.concord.org/~eireland/case_image.jpg';
            clueCanvas.addTile('image');
            imageToolTile.getImageToolControl().last().click();
            imageToolTile.getImageURLTextField().last().click().clear().type(imageFileURL);
            cy.wait(1000);
            cy.get(imageToolTile.imageChooseFileButton()).last().click();
            cy.wait(2000);
            imageToolTile.getImageToolImage().last().should('have.css', 'background-image','url("'+imageFileURL+'")');
        });
        it('will load an gif from a URL', function(){
            const imageFileURL = 'https://codap.concord.org/~eireland/model_image.gif';
            clueCanvas.addTile('image');
            imageToolTile.getImageToolControl().last().click();
            imageToolTile.getImageURLTextField().click().clear().type(imageFileURL);
            cy.get(imageToolTile.imageChooseFileButton()).click();
            cy.wait(2000);
            imageToolTile.getImageToolImage().last().should('have.css', 'background-image','url("'+imageFileURL+'")');
        });
    });
    describe('upload image from user computer',()=>{
        before(()=>{ //create a new doc so that save and restore can be tested
            canvas.createNewExtraDocumentFromFileMenu(userCanvas, "my-work");
            cy.wait(2000);
        });
        it('will upload png file from user computer', function(){
            const imageFilePath='image.png';
            clueCanvas.addTile('image');
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
    });
    describe.skip('restore of images', function(){
        before(()=>{ //reopen the first canvas
            rightNav.openRightNavTab('my-work');
            cy.openSection('my-work','workspaces');
            cy.openDocumentWithTitle('my-work','workspaces', '2.1 Drawing Wumps');
            cy.wait(5000);
            rightNav.closeRightNavTabs();
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
            rightNav.openRightNavTab('my-work');
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

after(function(){
  cy.clearQAData('all');
});
