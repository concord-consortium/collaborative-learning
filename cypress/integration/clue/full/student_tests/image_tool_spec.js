import Canvas from '../../../../support/elements/common/Canvas'
import ClueCanvas from '../../../../support/elements/clue/cCanvas'
import ImageToolTile from '../../../../support/elements/clue/ImageToolTile'
import RightNav from '../../../../support/elements/common/RightNav';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const imageToolTile = new ImageToolTile;
const rightNav = new RightNav;
const baseUrl = (`${Cypress.config("baseUrl")}`).split('/branch/')[0];

let userCanvas = 'Uploaded Images'

before(function(){
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;

    cy.visit(baseUrl+queryParams);
    cy.wait(4000);
});

context('Test image functionalities', function(){
    describe('upload image from URL', function(){
        it('will load an png from a URL', function(){
            const imageFileURL = 'https://codap.concord.org/~eireland/image.png';
            clueCanvas.addTile('image');
            imageToolTile.getImageToolControl().last().click();
            imageToolTile.getImageURLTextField().last().click().type(imageFileURL);
            cy.get(imageToolTile.imageChooseFileButton()).last().click();
            imageToolTile.getImageToolImage().last().should('have.css', 'background-image','url("'+imageFileURL+'")');
        });
        it('will load an jpg from a URL', function(){
            const imageFileURL = 'https://codap.concord.org/~eireland/case_image.jpg';
            clueCanvas.addTile('image');
            imageToolTile.getImageToolControl().last().click();
            imageToolTile.getImageURLTextField().last().click().type(imageFileURL);
            cy.get(imageToolTile.imageChooseFileButton()).last().click();
            cy.wait(2000);
            imageToolTile.getImageToolImage().last().should('have.css', 'background-image','url("'+imageFileURL+'")');
        });
        it('will load an gif from a URL', function(){
            const imageFileURL = 'https://codap.concord.org/~eireland/model_image.gif';
            clueCanvas.addTile('image');
            imageToolTile.getImageToolControl().last().click();
            imageToolTile.getImageURLTextField().click().type(imageFileURL);
            cy.get(imageToolTile.imageChooseFileButton()).click();
            cy.wait(2000);
            imageToolTile.getImageToolImage().last().should('have.css', 'background-image','url("'+imageFileURL+'")');
        });
    })
    describe('upload image from user computer',()=>{   
        before(()=>{ //create a new doc so that save and restore can e tested
            canvas.createNewProblemDocument(userCanvas) 
            cy.wait(2000)
        })
        it('will upload png file from user computer', function(){
            const imageFilePath='image.png';
            clueCanvas.addTile('image');
            imageToolTile.getImageToolControl().last().click();
            cy.uploadFile(imageToolTile.imageChooseFileButton(), imageFilePath, 'image/png')
            cy.wait(2000)
        })

        it('will upload jpg file from user computer', function(){
            const imageFilePath='case_image.jpg';
            clueCanvas.addTile('image');
            imageToolTile.getImageToolControl().last().click();
            cy.uploadFile(imageToolTile.imageChooseFileButton(), imageFilePath, 'image/jpg');
            cy.wait(2000)
        })

        it('will upload gif file from user computer', function(){
            const imageFilePath='model_image.gif';
            clueCanvas.addTile('image');
            imageToolTile.getImageToolControl().last().click();
            cy.uploadFile(imageToolTile.imageChooseFileButton(), imageFilePath, 'image/gif')
            cy.wait(2000)
        })
    });
    describe('restore of images', function(){
        before(()=>{ //reopen the first canvas
            rightNav.openRightNavTab('my-work');
            rightNav.openSection('my-work','investigations')
            rightNav.openCanvasItem('my-work','investigations', '2.1 Drawing Wumps')
            cy.wait(5000)
        })
        it('verify restore of all images that were added by URL', function(){
            const imageFileURL = ['https://codap.concord.org/~eireland/image.png', 'https://codap.concord.org/~eireland/case_image.jpg','https://codap.concord.org/~eireland/model_image.gif'];
            imageToolTile.getImageToolImage().each(($images, index, $list)=>{
                expect($list).to.have.length(3);
                expect($images).to.have.css('background-image').and.contains(imageFileURL[index]);
            });
        });
        it('open the user created document from above',()=>{
            rightNav.openRightNavTab('my-work');
            rightNav.openSection('my-work','workspaces')
            rightNav.openCanvasItem('my-work','workspaces', userCanvas)
            cy.wait(5000)
        })
        it('verify restore of all  images that were added by upload', function(){
            const imageFilePath=['image.png','case_image.jpg','model_image.gif'];

            imageToolTile.getImageToolImage().each(($images, index, $list)=>{
                expect($list).to.have.length(3);
                expect($images).to.have.css('background-image').and.contains('url("data:image');
            })
        })
    });
});

after(function(){
  cy.clearQAData('all');
});
