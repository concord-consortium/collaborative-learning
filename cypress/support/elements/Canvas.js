import GraphToolTile from './GraphToolTile'
import ImageToolTile from './ImageToolTile'
import DrawToolTile from './DrawToolTile'

let graphToolTile = new GraphToolTile,
    imageToolTile = new ImageToolTile,
    drawToolTile = new DrawToolTile;

class Canvas{

    canvas(){
        return cy.get('.single-workspace:first');
    }

    getCanvasTitle(){
        // return cy.get('.group-view > .single-workspace > .document > .titlebar > .title')
        return cy.get('[data-test=document-title]')
    }

    getPublishIcon(){
        return cy.get('[data-test=publish-icon]');
    }

    getDialogTitle(){
        return cy.get('[data-test=dialog-title]');
    }

    getDialogOKButton(){
        return cy.get('[data-test=dialog-buttons] #okButton');
    }

    getDialogCancelButton(){
        return cy.get('[data-test=dialog-buttons] #cancelButton');
    }

    publishCanvas(){
        this.getPublishIcon().click()
            .then(()=>{
                this.getDialogTitle().should('exist').contains('Published');
                this.getDialogOKButton().click();
                this.getDialogTitle().should('not.exist');
                this.getPublishIcon().should('exist');
            });
    }

    getFourUpViewToggle(){
        return cy.get('[data-test=document-titlebar-actions] .icon-up1');
    }

    openFourUpView(){
        this.getFourUpViewToggle().click();
        this.getFourUpView().should('be.visible');
    }

    getFourToOneUpViewToggle(){
        return cy.get('[data-test=document-titlebar-actions] .icon-up4');
    }

    openOneUpViewFromFourUp(){
        this.getFourToOneUpViewToggle().click();
        this.getSingleCanvas().should('be.visible');
    }

    getSingleCanvas(){
        // return cy.get('.canvas-area > .canvas');
        return cy.get('[data-test=canvas]:first');
    }

    getSingleCanvasDocumentContent(){
        return cy.get('[data-test=canvas]:first .document-content')
    }

    getFourUpView(){
        return cy.get('.canvas-area .four-up');
    }

    getLeftSideFourUpView(){
        return cy.get('.left-workspace .canvas-area .four-up')
    }

    getNorthEastCanvas(){
        return cy.get('.canvas-area .four-up .canvas-container.north-east');
    }
    getNorthWestCanvas(){
        return cy.get('.canvas-area .four-up .canvas-container.north-west');
    }
    getSouthEastCanvas(){
        return cy.get('.canvas-area .four-up .canvas-container.south-east');
    }
    getSouthWestCanvas(){
        return cy.get('.canvas-area .four-up .canvas-container.south-west');
    }

    getCenterSeparator(){
        return cy.get('.canvas-area .four-up .center');
    }

    getShareButton(){
        return cy.get('[data-test=document-titlebar-actions] .visibility.private .icon-share');
    }

    shareCanvas(){
        this.getShareButton().click();
    }

    getUnshareButton(){
        return cy.get('[data-test=document-titlebar-actions] .visibility.public .icon-share');
    }

    unshareCanvas(){
        this.getUnshareButton().click();
    }

    getToolPalette(){
        return cy.get('.single-workspace > .toolbar');
    }

    getLeftSideToolPalette(){
        return cy.get('.left-workspace > .toolbar');
    }

    getRightSideToolPalette(){
        return cy.get('.right-workspace > .toolbar');
    }

    getTextTool(){
        return cy.get('.single-workspace > .toolbar > .tool.text');
    }

    addTextTile(){
        this.getTextTool().click({force:true});
    }

    getTextTile(){
        return cy.get('.canvas .text-tool.editable');
    }

    enterText(text){
        this.getTextTile().last().click({force:true});
        this.getTextTile().last().type(text);
        this.getTextTile().last().should('contain',text);
    }

    addText(text){
        this.getTextTile().last().type(text);
        this.getTextTile().last().should('contain',text);
    }

    deleteText(text){
        this.getTextTile().last().type(text);
        this.getTextTile().last().should('not.contain', 'delete');
    }

    addTableTile(){
        cy.get('.single-workspace .tool.table').click({force:true});
    }
    addGraphTile(){
        cy.get('.single-workspace .tool.geometry').click({force: true});
    }

    addImageTile(){
        cy.get('.single-workspace .tool.image').click({force: true});
    }

    addDrawTile(){
        cy.get('.single-workspace .tool.drawing').click({force:true});
    }

    getDeleteTool(){
        return cy.get('.single-workspace .tool.delete');
    }

    deleteTile(tile){
        switch(tile) {
            case 'text':
                this.getTextTile().last().click({force:true});
                break;
            case 'graph':
                graphToolTile.getGraphTile().last().click({force:true});
                break;
            case 'image':
                imageToolTile.getImageTile().last().click({force:true});
                break;
            case 'draw':
                drawToolTile.getDrawTile().last().click({force:true});
                break;
            // case 'table':
            //     this.getTableTile().last().click({force:true});
            //     break;
        }
        this.getDeleteTool().click({force: true});
    }

    scrollToBottom(element){
        // cy.get('.canvas-area > .canvas > .document-content').scrollTo('bottom');
        element.scrollTo('bottom');
    }

    scrollToTop(element){
        // cy.get('.canvas-area > .canvas > .document-content').scrollTo('top') ;
        element.scrollTo('top');
    }

    getSupportList(){
        return cy.get('.statusbar .supports-list');
    }

    getSupportTitle(){
        return cy.get('.visible-supports .supports-list > div')
    }

    getTwoUpViewToggle(){
        return cy.get('.single-workspace .statusbar .action > .icon-up1');
    }
    getTwoToOneUpViewToggle(){// from 2up view
        return cy.get('.left-workspace .statusbar .action > .icon-up2');
    }

    getRightSideWorkspace(){
        return cy.get('.right-workspace')
    }
    getLeftSideWorkspace(){
        return cy.get('.left-workspace .canvas-area');
    }
     openTwoUpView(){
        this.getTwoUpViewToggle().click({force:true});
        this.getRightSideWorkspace().should('be.visible');
        this.getLeftSideWorkspace().should('be.visible');
     }

     openOneUpViewFromTwoUp(){
        this.getTwoToOneUpViewToggle().click({force:true});
        this.getSingleCanvas().should('be.visible');
     }

     getRightSideWorkspaceTitle(){
        // return cy.get('.right-workspace > .document > .titlebar > .title')
         return cy.get('.right-workspace [data-test=document-title]')
     }

     getLeftSideWorkspaceTitle(){
        // return cy.get('.left-workspace > .document > .titlebar > .title')
         return cy.get('.left-workspace [data-test=document-title]')
     }
}

export default Canvas;