import Workspace from '../../support/elements/Workspace'
import RightNav from '../../support/elements/RightNav'
import Canvas from '../../support/elements/Canvas'

describe('Test right nav tabs', function(){

    const workspace = new Workspace();
    const rightNav = new RightNav();
    const canvas = new Canvas();

    //This assumes there were canvases previously created from the left nav tabs
    it('will setup for tests', function(){
        workspace.openAndPublishCanvases();
    });
    describe('My Work tab tests', function(){
        it('verify that opened content is listed in My Work tab space', function(){ //still need to verify the titles match the titles from opened canvases
            cy.wait(1000);
            rightNav.openMyWorkTab();
            rightNav.getAllMyWorkAreaCanvasItems().each(($item,index,$list)=>{
                cy.log('Title is ' + $item.text());
            });
            rightNav.closeMyWorkTab();
        });
        // TODO: display: none issue
        it.skip('will open the correct canvas selected from the My Work list', function(){
            rightNav.openMyWorkTab();
            rightNav.getAllMyWorkAreaCanvasItems().each(($item,index,$list)=>{
                let title= $item.text().replace(/[^\x00-\x7F]/g, "");
                cy.wrap($item).click();
                canvas.getCanvasTitle()
                    .then(($canvasTitle)=>{
                        let canvasTitle=$canvasTitle.text();
                        expect($canvasTitle.text()).to.contain(title);
                    });
                rightNav.openMyWorkTab();
                cy.wait(1000);
            });
            rightNav.closeMyWorkTab(); // clean up
        });
        // TODO: display: none issue
        it.skip('will verify that My Work canvas has a tool palette', function(){
            rightNav.openMyWorkTab();
            rightNav.openMyWorkAreaCanvasItem('Introduction');
            canvas.getToolPalette().should('be.visible');
        })    });
    // TODO: New feature changes.
    describe.skip('Class Work tab tests', function(){

        it('will open correct canvas from Class Work list', function(){ //this assumes there are published work
            rightNav.openClassWorkTab();
            rightNav.openClassWorkSections();
            rightNav.getClassWorkAreaCanvasItem().each(($item,index,$list)=>{
                let title= $item.text().replace(/[^\x00-\x7F]/g, "")//.split('Group'),
                   // group = title[1];
              //  expect(($item).text()).to.contain(group);
                cy.wrap($item).click();
                // canvas.getRightSideWorkspaceTitle() //This assumes that Class Work always opens in 2-up right workspace
                //     .then(($canvasTitle)=>{
                //         let canvasTitle=$canvasTitle.text();
                //         expect($canvasTitle.text()).to.contain(title[0]);
                //     });
                cy.wait(1000);
            });
            rightNav.closeClassWorkTab(); //clean up
        });

        it('will verify that Class Work canvas does not have a tool palette', function(){
            rightNav.openClassWorkTab();
            rightNav.getClassWorkAreaCanvasItem().first().click();
            canvas.getToolPalette().should('not.be.visible');
        })
    })

    describe('Class Log tab tests', function(){
        //TODO Currently commented out until Class Log is setup

        // it('will open correct canvas from Class Log list', function(){ //this assumes there are learning log published work
        //     rightNav.openClassLogTab();
        //     rightNav.getClassLogAreaCanvasItem().each(($item,index,$list)=>{
        //         let title= $item.text().replace(/[^\x00-\x7F]/g, "")//.split('Group'),
        //         // group = title[1];
        //         //  expect(($item).text()).to.contain(group);
        //         cy.wrap($item).click();
        //         canvas.getRightSideWorkspaceTitle() //This assumes that Class Log always opens in 2-up right workspace
        //             .then(($canvasTitle)=>{
        //                 let canvasTitle=$canvasTitle.text();
        //                 expect($canvasTitle.text()).to.contain(title[0]);
        //             });
        //         cy.wait(1000);
        //     });
        //     rightNav.closeClassLogTab(); //clean up
        // });
        //
        // it('will verify that Class Work canvas does not have a tool palette', function(){
        //     rightNav.openClassLogTab();
        //     rightNav.getClassLogAreaCanvasItem().first().click();
        //     canvas.getToolPalette().should('not.be.visible');
        // })
    })
});
