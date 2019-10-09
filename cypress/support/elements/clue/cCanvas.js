import GraphToolTile from './GraphToolTile'
import ImageToolTile from './ImageToolTile'
import DrawToolTile from './DrawToolTile'
import TextToolTile from './TextToolTile'
import TableToolTile from './TableToolTile'
import Canvas from '../common/Canvas'

let graphToolTile = new GraphToolTile,
    imageToolTile = new ImageToolTile,
    drawToolTile = new DrawToolTile,
    textToolTile = new TextToolTile,
    tableToolTile = new TableToolTile,
    canvas = new Canvas;

class ClueCanvas{
    //canvas header
    getInvestigationCanvasTitle(){
        return cy.get('[data-test=document-title]')
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
        canvas.getSingleCanvas().should('be.visible');
    }

    getFourUpView(){
        return cy.get('.canvas-area .four-up');
    }

    getLeftSideFourUpView(){
        return cy.get('.left-workspace .canvas-area .four-up')
    }
    northWestCanvas(){
        return '.canvas-area .four-up .canvas-container.north-west .canvas' //.document-content'
    }

    getNorthEastCanvas(){
        return cy.get('.canvas-area .four-up .canvas-container.north-east');
    }
    getNorthWestCanvas(){
        return cy.get(this.northWestCanvas()).parent().parent().parent();
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
        return cy.get('[data-test=share-icon]');
    }

    shareCanvas(){
        this.getShareButton().click();
    }

    unshareCanvas(){
        this.getShareButton().click();
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
    getSelectTool(){
        return cy.get('.single-workspace .tool.select[title=Select]');
    }

    addTile(tile){ //tile=[text,table,geometry,image,drawing,delete]
        cy.get('.single-workspace .tool.'+tile).click({force:true})
    }

    getDeleteTool(){
        return cy.get('.single-workspace .tool.delete');
    }

    deleteTile(tile){
        switch(tile) {
            case 'text':
                textToolTile.getTextTile().first()
                    .invoke('attr', 'class', 'selected');
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
            case 'table':
                tableToolTile.getTableTile().last().click({force:true});
                break;
        }
        this.getDeleteTool().click({force: true});
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
        canvas.getSingleCanvas().should('be.visible');
     }

     getRightSideWorkspaceTitle(){
         return cy.get('.right-workspace [data-test=personal-doc-title]')
     }
     getRightSideInvestigationTitle(){
        return cy.get('.right-workspace [data-test=document-title]')
    }
    getRightSideLLTitle(){
        return cy.get('.right-workspace [data-test=learning-log-title]')
    }

     getLeftSideWorkspaceTitle(){
         return cy.get('.left-workspace [data-test=document-title]')
     }
     getRightSideDocumentContent(){
         return cy.get('.right-workspace .document-content')
     }
}

export default ClueCanvas;