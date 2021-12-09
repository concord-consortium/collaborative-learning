import GraphToolTile from './GraphToolTile';
import ImageToolTile from './ImageToolTile';
import DrawToolTile from './DrawToolTile';
import TextToolTile from './TextToolTile';
import TableToolTile from './TableToolTile';
import Canvas from '../common/Canvas';
import Dialog from '../common/Dialog';

let graphToolTile = new GraphToolTile,
    imageToolTile = new ImageToolTile,
    drawToolTile = new DrawToolTile,
    textToolTile = new TextToolTile,
    tableToolTile = new TableToolTile,
    canvas = new Canvas,
    dialog = new Dialog;

class ClueCanvas {
    //canvas header
    getInvestigationCanvasTitle() {
        return cy.get('.primary-workspace [data-test=document-title]');
    }

    getPublishSupport() {
        return cy.get('[data-test=publish-support-icon]');
    }
    publishSupportDoc() {
        this.getPublishSupport().click();
        dialog.getDialogTitle().should('be.visible').and('contain', 'Support Published');
        dialog.getDialogOKButton().click();
    }

    getSingleWorkspace() {
        return cy.get('.primary-workspace');
    }

    getRowSectionHeader() {
        return cy.get('.primary-workspace .row-section-header');
    }

    getSectionHeader(header) {
        // headers=['IN','IC','WI','NW'];
        // headerTitles=["Introduction", "Initial Challenge", "What If...?","Now What Do You Know?"]
        return cy.get('#section_' + header);
    }

    getPlaceHolder() {
        return cy.get('.primary-workspace .placeholder-tool');
    }

    getFourUpViewToggle() {
        return cy.get('[data-test=document-titlebar-actions] .up1');
    }

    openFourUpView() {
        this.getFourUpViewToggle().click();
        this.getFourUpView().should('be.visible');
    }

    getFourToOneUpViewToggle() {
        return cy.get('[data-test=document-titlebar-actions] .up4');
    }

    openOneUpViewFromFourUp() {
        this.getFourToOneUpViewToggle().click();
        canvas.getSingleCanvas().should('be.visible');
    }

    getFourUpView() {
        return cy.get('.canvas-area .four-up');
    }

    getLeftSideFourUpView() {
        return cy.get('.nav-tab-panel .canvas-area .four-up');
    }
    northWestCanvas() {
        return '.canvas-area .four-up .canvas-container.north-west .canvas'; //.document-content'
    }

    getNorthEastCanvas() {
        return cy.get('.canvas-area .four-up .canvas-container.north-east');
    }
    getNorthWestCanvas() {
        return cy.get(this.northWestCanvas()).parent().parent().parent();
    }
    getSouthEastCanvas() {
        return cy.get('.canvas-area .four-up .canvas-container.south-east');
    }
    getSouthWestCanvas() {
        return cy.get('.canvas-area .four-up .canvas-container.south-west');
    }

    getCenterSeparator() {
        return cy.get('.canvas-area .four-up .center');
    }

    getShareButton() {
        return cy.get('[data-test=share-button]');
    }

    shareCanvas() {
        this.getShareButton().click();
    }

    unshareCanvas() {
        this.getShareButton().click();
    }

    getToolPalette() {
        return cy.get('.primary-workspace> .toolbar');
    }

    getLeftSideToolPalette() {
        return cy.get('.nav-tab-panel > .toolbar');
    }

    getRightSideToolPalette() {
        return cy.get('.single-workspace.half.primary-workspace > .toolbar');
    }
    getSelectTool() {
        return cy.get('.primary-workspace .tool.select[title=Select]');
    }

    addTile(tile) { //tile=[text,table,geometry,image,drawing,delete]
        cy.get('.primary-workspace .tool.' + tile).click({ force: true });
    }
    addTileByDrag(tile, dropzone){//tile=[text,table,geometry,image,drawing,delete]
        const dropzoneArray = ['top', 'left', 'right', 'bottom'];
        const dataTransfer = new DataTransfer;
        let nthType = dropzoneArray.indexOf(dropzone)+2;
        cy.log(nthType);
        cy.get('.primary-workspace .tool.' + tile)
            .trigger('dragstart', { dataTransfer });
        cy.get('.drop-feedback:nth-of-type('+nthType+')').eq(1).invoke('attr','class','drop-feedback show '+dropzone)
            .trigger('drop', { dataTransfer, force: true })
            .trigger('dragend', { dataTransfer, force: true });
    }

    getDeleteTool() {
        return cy.get('.tool.delete');
    }

    moveTile(movingTile, targetTile, dropZoneDirection) {
        const dataTransfer = new DataTransfer;

        switch (movingTile) {
            case ('table'):
                tableToolTile.getTableTile().eq(0).click();
                tableToolTile.getTableTile().eq(0)
                    .trigger('dragstart', { dataTransfer });
                break;
            case ('geometry'):
                graphToolTile.getGraphTile().eq(0).click();
                graphToolTile.getGraphTile().eq(0)
                    .trigger('dragstart', { dataTransfer });
                break;
            case ('text'):
                textToolTile.getTextTile().eq(0).click();
                textToolTile.getTextTile().eq(0)
                    .trigger('dragstart', { dataTransfer });
                break;
            case ('image'):
                imageToolTile.getImageTile().eq(0).click();
                imageToolTile.getImageTile().eq(0)
                    .trigger('dragstart', { dataTransfer });
                break;
            case ('draw'):
                drawToolTile.getDrawTile().eq(0).click();
                drawToolTile.getDrawTile().eq(0)
                    .trigger('dragstart', { dataTransfer });
                break;

        }
        if (targetTile === "text") {
            cy.get('.' + targetTile + '-tool').eq(0).parent().parent().parent().within(() => {
                cy.get('.drop-feedback').eq(0).invoke('attr', 'class', 'drop-feedback show ' + dropZoneDirection)
                    .trigger('drop', { dataTransfer, force: true })
                    .trigger('dragend', { dataTransfer, force: true });
            });
        } else {
            cy.get('.' + targetTile + '-tool').eq(0).parent().parent().within(() => {
                cy.get('.drop-feedback').eq(0).invoke('attr', 'class', 'drop-feedback show ' + dropZoneDirection)
                    .trigger('drop', { dataTransfer, force: true })
                    .trigger('dragend', { dataTransfer, force: true });
            });
        }
    }

    exportTileAndDocument(tileClass) {
        let clipSpy;
        cy.window().then((win) => {
            // https://github.com/cypress-io/cypress-example-recipes/tree/master/examples/stubbing-spying__window
            clipSpy = cy.spy(win.navigator.clipboard, "writeText");
        });
        // platform test from hot-keys library
        const isMac = navigator.platform.indexOf("Mac") === 0;
        const cmdKey = isMac ? "meta" : "ctrl";
        cy.get(`.primary-workspace .tool-tile.${tileClass}`)
            .type(`{${cmdKey}+option+e}`)
            .then(() => {
                expect(clipSpy.callCount).to.be.eq(1);
            })
            .type(`{${cmdKey}+shift+s}`)
            .then(() => {
                expect(clipSpy.callCount).to.be.eq(2);
            });
    }

    selectLastTileOfType(tileType) {
      let tileElement = null;

      switch (tileType) {
          case 'text':
              textToolTile.getTextTile().last().focus();
              tileElement = cy.get('.text-tool-wrapper').parent();
              break;
          case 'graph':
              tileElement = graphToolTile.getGraphTile().last().click({ force: true }).parent();
              break;
          case 'image':
              tileElement = imageToolTile.getImageTile().last().click({ force: true }).parent();
              break;
          case 'draw':
              // For some reason the getDrawTile returns the tool tile component
              tileElement = drawToolTile.getDrawTile().last().click({ force: true });
              break;
          case 'table':
              tileElement = tableToolTile.getTableTile().last().click({ force: true }).parent();
              break;
      }
      tileElement.should('have.class','selected');
    }

    deleteTile(tile) {
        this.selectLastTileOfType(tile);
        this.getDeleteTool().click({ force: true });
        cy.get('.ReactModalPortal .modal-footer .modal-button.default').click();
    }

    getSupportList() {
        return cy.get('.statusbar .supports-list');
    }

    getSupportTitle() {
        return cy.get('.visible-supports .supports-list > div');
    }

    getTwoUpViewToggle() {
        return cy.get('.single-workspace .titlebar .action > .up1');
    }
    getTwoToOneUpViewToggle() {// from 2up view
        return cy.get('.nav-tab-panel .statusbar .action > .up2');
    }

    getPrimaryWorkspace() {
        return cy.get('.single-workspace.half.primary-workspace');
    }
    getLeftSideWorkspace() {
        return cy.get('.nav-tab-panel .canvas-area');
    }
    openTwoUpView() {
        this.getTwoUpViewToggle().click({ force: true });
        this.getPrimaryWorkspace().should('be.visible');
        this.getLeftSideWorkspace().should('be.visible');
    }

    openOneUpViewFromTwoUp() {
        this.getTwoToOneUpViewToggle().click({ force: true });
        canvas.getSingleCanvas().should('be.visible');
    }

    getPrimaryWorkspaceTitle() {
        return cy.get('.single-workspace.half.primary-workspace [data-test=personal-doc-title]');
    }
    getPrimaryWorkspaceInvestigationTitle() {
        return cy.get('.single-workspace.half.primary-workspace [data-test=document-title]');
    }
    getPrimaryWorkspaceLLTitle() {
        return cy.get('.single-workspace.half.primary-workspace [data-test=learning-log-title]');
    }

     getLeftSideWorkspaceTitle(){
         return cy.get('.nav-tab-panel [data-test=document-title]');
     }
     getLeftSidePersonalDocTitle(){
         return cy.get('.nav-tab-panel [data-test=personal-doc-title]');
     }
     getPrimaryWorkspaceDocumentContent(){
         return cy.get('.single-workspace.half.primary-workspace .document-content');
     }
     getToolTileDragHandle(){ //putting it here because all tool tiles have this. Use as in a .find() after tool tile
        return '.tool-tile-drag-handle';
     }
     linkIconEl(){
         return '[data-test="link-indicator-icon"]';
     }
}

export default ClueCanvas;
