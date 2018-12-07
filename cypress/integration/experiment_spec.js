import Canvas from './elements/Canvas';
import LeftNav from './elements/LeftNav'
import RightNav from './elements/RightNav'
import LearningLog from './elements/LearningLog'

let canvas = new Canvas,
    leftNav = new LeftNav,
    rightNav = new RightNav,
    learningLog = new LearningLog;

context('this is for experiments of actions', ()=>{
    function setUp(){
        cy.get('.left-nav > .tabs > .tab').each(($tab,index,$tabList)=>{})
            .then(($tabList)=>{
                var i=0;
                for (i=0;i<$tabList.length;i++){
                    cy.get('#leftNavTab'+i).click({force:true});
                    cy.get('.left-nav-panel > .section > .canvas > .document-content > .buttons > button').click({force:true});
                }
            });
        cy.wait(2000);
        canvas.openTwoUpView();
        cy.get('.right-workspace').should('be.visible');
    }

    // it('will find an elements x,y coordinate', ()=>{
    //     cy.get('#leftNavTab0').click();
    //     cy.get('.left-nav.expanded > div.expanded-area.expanded > .left-nav-panel > .section > .canvas > .document-content > .tool-tile > .image-tool ').then(($image)=>{
    //         cy.wrap($image).click();
    //         cy.log('x is ' + $image.screenX);
    //         cy.log('y is ' + $image.screenY);
    //
    //     });
    //     cy.get('#leftNavTab0').click(); //close tab
    // });
    // it('verify image can be dragged on to canvas', function(){
    //     cy.get('#leftNavTab1 > span').click({force:true});
    //     cy.get('.left-nav-panel > .section > .canvas > .document-content > .buttons > button').click();
    //     cy.get('.workspace > .titlebar > .title').should('contain','Initial');
    //     cy.get('#leftNavTab0 > span').click({force:true});
    //     cy.get('.left-nav.expanded > div.expanded-area.expanded > .left-nav-panel > .section > .canvas > .document-content > .tool-tile > .image-tool').parent().trigger('mousedown',{which:1}).trigger('mousemove',{screenX: 660, screenY: 475}).trigger('mouseup',{force:true});
    //     cy.get('#leftNavTab0 > span').click({force:true}); //close tab
    // });
    function dnd(fromElement,toElement){
        let tox = -450,
            toy = 340;

        // cy.get(fromElement).first()
        //     .trigger('mousedown', 'left', { which: 1 },{force:true})
        //     .trigger('mousemove', {which: 1}, { clientX: tox, clientY: toy }).wait(500)
        //     .trigger('mouseup', { force: true })
        cy.get(fromElement).first().trigger('dragstart', fromElement.innerHTML);
        cy.get(toElement).trigger('drop')
    }

    // it.only('test adding cypress commands', ()=>{
    //     cy.log('in test adding cypress commands');
    //    cy.setupGroup();
    // });

    it('drags and drop', function(){
        let myWork = '.my-work > .list > .list-item > .scaled-list-item-container > .scaled-list-item',
            rightWorkspace = '.right-workspace > .comparison-placeholder';
        setUp();
        cy.get('#rightNavTabMy\\ Work').click();
        dnd(myWork, rightWorkspace);
        cy.get(rightWorkspace).should('not.be visible');
        // canvas.getRightSideWorkspaceTitle().should('contain', 'Initial')
    });

    // it('close a window alert', ()=>{
    //     cy.wait(1000);
    //     cy.get('.left-nav > .tabs > .tab').last().click({force:true});
    //     cy.get('.left-nav-panel > .section > .canvas > .document-content > .buttons > button').click();
    //     cy.wait(1000);
    //     // cy.get('.workspace > .titlebar > .title').should('contain','You Know?');
    //     cy.get('.app-container > .single-workspace > .document > .titlebar > .actions > .icon-publish').click();
    //     // cy.window().then((win)=>
        // {   var confirmPublish='';
        //     confirmPublish=win.confirm(true); expect(confirmPublish).to.be.true})
    // });

    // function draganddrop(fromElement,toElement){
    // }

});