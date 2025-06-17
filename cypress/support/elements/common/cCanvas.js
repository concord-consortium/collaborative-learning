import GeometryToolTile from '../tile/GeometryToolTile';
import ImageToolTile from '../tile/ImageToolTile';
import DrawToolTile from '../tile/DrawToolTile';
import TextToolTile from '../tile/TextToolTile';
import TableToolTile from '../tile/TableToolTile';
import DataflowToolTile from '../tile/DataflowToolTile';
import DiagramToolTile from '../tile/DiagramToolTile';
import SimulatorToolTile from '../tile/SimulatorTile';
import NumberlineToolTile from '../tile/NumberlineToolTile';
import ExpressionToolTile from '../tile/ExpressionToolTile';
import Canvas from './Canvas';
import Dialog from './Dialog';
import XYPlotToolTile from '../tile/XYPlotToolTile';
import BarGraphTile from '../tile/BarGraphTile';
import QuestionToolTile from '../tile/QuestionToolTile';

let graphToolTile = new GeometryToolTile,
    imageToolTile = new ImageToolTile,
    drawToolTile = new DrawToolTile,
    textToolTile = new TextToolTile,
    tableToolTile = new TableToolTile,
    dataflowToolTile = new DataflowToolTile,
    diagramToolTile = new DiagramToolTile,
    simulatorToolTile = new SimulatorToolTile,
    numberlineToolTile = new NumberlineToolTile,
    expressionToolTile = new ExpressionToolTile,
    xyPlotToolTile = new XYPlotToolTile,
    barGraphTile = new BarGraphTile,
    questionToolTile = new QuestionToolTile,
    canvas = new Canvas,
    dialog = new Dialog;

class ClueCanvas {
    //canvas header
    getInvestigationCanvasTitle() {
        return cy.get('.primary-workspace [data-test=document-title]');
    }

    publishTeacherDoc() {
        canvas.getPublishItem().click();
        dialog.getModalTitle().should('be.visible').and('contain', 'Publish');
        dialog.getModalButton().contains("Just this class").click();
        dialog.getDialogTitle().should('exist').contains('Published');
        dialog.getDialogOKButton().click();
        dialog.getDialogTitle().should('not.exist');
    }
    publishTeacherDocToMultipleClasses() {
      canvas.getPublishItem().click();
      dialog.getModalTitle().should('be.visible').and('contain', 'Publish');
      dialog.getModalButton().contains("All Classes").click();
      dialog.getDialogTitle().should('exist').contains('Published');
      dialog.getDialogOKButton().click();
      dialog.getDialogTitle().should('not.exist');
  }

    getSingleWorkspace() {
        return cy.get('.primary-workspace');
    }

    getSingleWorkspaceDocumentContent() {
      return cy.get('.primary-workspace .document-content');
    }

    getRowSectionHeader() {
        return cy.get('.primary-workspace .row-section-header');
    }

    getSectionHeader(header) {
        // headers=['IN','IC','WI','NW'];
        // headerTitles=["Introduction", "Initial Challenge", "What If...?","Now What Do You Know?"]
        return cy.get('.primary-workspace #section_' + header);
    }

    getPlaceHolder() {
        return cy.get('.primary-workspace .placeholder-tool');
    }

    getFourUpViewToggle() {
        return cy.get('[data-test=document-titlebar-actions] .up1');
    }

    getFourUpToolbarButton() {
      return cy.get('[data-testid="tool-fourup"]');
    }

    openFourUpView() {
        this.getFourUpViewToggle().click();
        this.getFourUpToolbarButton().click();
        this.getFourUpView().should('be.visible');
    }

    toggleFourUpViewToolbarButton() {
      this.getFourUpToolbarButton().click();
    }

    getPlaybackToolBarButton() {
      return cy.get('.toolbar .tool.toggleplayback');
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
        this.getShareButton().click({force:true});
        this.getShareButton().find('.track').invoke('attr', 'class').should('contain', 'toggle-on');
        this.getShareButton().find('.ball').invoke('attr', 'class').should('contain', 'toggle-on');
    }

    unshareCanvas() {
        this.getShareButton().click({force:true});
        this.getShareButton().find('.track').invoke('attr', 'class').should('not.contain', 'toggle-on');
        this.getShareButton().find('.ball').invoke('attr', 'class').should('not.contain', 'toggle-on');
    }

    getStickyNotePopup() {
      return cy.get('div.sticky-note-popup');
    }

    getStickyNoteLink() {
      return this.getStickyNotePopup().find('a');
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

    getDuplicateTool() {
        return cy.get('.primary-workspace .tool.duplicate');
    }

    verifyToolDisabled(tile) { //tile=[text,table,geometry,image,drawing,delete]
        cy.get('.primary-workspace .tool.' + tile).should("have.class", "disabled");
    }

    verifyToolEnabled(tile) { //tile=[text,table,geometry,image,drawing,delete]
        cy.get('.primary-workspace .tool.' + tile).should("not.have.class", "disabled");
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
                graphToolTile.getGeometryTile().eq(0).click();
                graphToolTile.getGeometryTile().eq(0)
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
            case 'question':
                tileElement = questionToolTile.getQuestionTile().last().click({ force: true }).parent();
                break;
            case 'text':
                textToolTile.getTextTile().last().focus();
                tileElement = cy.get('.text-tool-wrapper').last().click({ force: true }).parent();
                break;
            case 'graph':
                tileElement = graphToolTile.getGeometryTile().last().click({ force: true }).parent();
                break;
            case 'image':
                tileElement = imageToolTile.getImageTile().last().click({ force: true }).parent();
                break;
            case 'draw':
            case 'drawing':
                // For some reason the getDrawTile returns the tool tile component
                tileElement = drawToolTile.getDrawTile().last().click({ force: true });
                break;
            case 'table':
                tileElement = tableToolTile.getTableTile().last().click({ force: true }).parent();
                break;
            case 'geometry':
                tileElement = graphToolTile.getGeometryTile().last().click({ force: true }).parent();
                break;
            case 'dataflow':
                tileElement = dataflowToolTile.getDataflowTile().last().click({ force: true });
                break;
            case 'diagram':
                tileElement = diagramToolTile.getDiagramTile().last().click({ force: true });
                break;
            case 'simulator':
                tileElement = simulatorToolTile.getSimulatorTile().last().click({ force: true });
                break;
            case 'numberline':
                tileElement = numberlineToolTile.getNumberlineTile().last().click({ force: true });
                break;
            case 'expression':
                tileElement = expressionToolTile.getExpressionTile().last().click({ force: true });
                break;
            case 'xyplot':
                tileElement = xyPlotToolTile.getTile().last().click({ force: true });
                break;
            case 'bargraph':
                tileElement = barGraphTile.getTile().last().click({ force: true });
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
     getUndoTool() {
        return cy.get('.tool.undo');
     }
     getRedoTool() {
        return cy.get('.tool.redo');
     }
     publishDoc(button) {
        canvas.getPublishItem().click();
        dialog.getModalTitle().should('be.visible').and('contain', 'Publish');
        dialog.getModalButton().contains(button).click();
        dialog.getDialogTitle().should('exist').contains('Published');
        dialog.getDialogOKButton().click();
        dialog.getDialogTitle().should('not.exist');
    }

    // Tile toolbars are in portals at the workspace level.
    // These methods allow working with toolbar buttons even when invoked from,
    // say, a `within` clause scoped to a tile.
    /**
     * Locate the requested toolbar button and make sure it is enabled.
     * This escapes from any "within" restriction since toolbars are at the HTML document level.
     * @param {*} tileType string name of the tile
     * @param {*} buttonName string name of the button
     */
    toolbarButtonIsEnabled(tileType, buttonName) {
      return cy.document().within(() => {
        cy.get(`.tile-toolbar.${tileType}-toolbar .toolbar-button.${buttonName}`)
          .should('not.be.disabled');
      });
    }

    /**
     * Locate the requested toolbar button and make sure it is disabled.
     * This escapes from any "within" restriction since toolbars are at the HTML document level.
     * @param {*} tileType string name of the tile
     * @param {*} buttonName string name of the button
     */
    toolbarButtonIsDisabled(tileType, buttonName) {
      cy.document().within(() => {
        cy.get(`.tile-toolbar.${tileType}-toolbar .toolbar-button.${buttonName}`)
          .should('be.disabled');
      });
    }

    /**
     * Locate the requested toolbar button and make sure it is selected.
     * This escapes from any "within" restriction since toolbars are at the HTML document level.
     * @param {*} tileType string name of the tile
     * @param {*} buttonName string name of the button
     */
    toolbarButtonIsSelected(tileType, buttonName) {
      return cy.document().within(() => {
        cy.get(`.tile-toolbar.${tileType}-toolbar .toolbar-button.${buttonName}`)
          .should('have.class', 'selected');
      });
    }

    /**
     * Locate the requested toolbar button and make sure it is not selected.
     * This escapes from any "within" restriction since toolbars are at the HTML document level.
     * @param {*} tileType string name of the tile
     * @param {*} buttonName string name of the button
     */
    toolbarButtonIsNotSelected(tileType, buttonName) {
      return cy.document().within(() => {
        cy.get(`.tile-toolbar.${tileType}-toolbar .toolbar-button.${buttonName}`)
          .should('not.have.class', 'selected');
      });
    }

    /**
     * Locate the requested toolbar button and, make sure it is enabled, and click it.
     * This escapes from any "within" restriction since toolbars are at the HTML document level.
     * @param {*} tileType string name of the tile
     * @param {*} buttonName string name of the button
     */
    clickToolbarButton(tileType, buttonName, options = {}) {
      cy.document().within(() => {
        cy.get(`[data-test=canvas] .tile-toolbar.${tileType}-toolbar .toolbar-button.${buttonName}`)
          .should('have.length', 1)
          .should('not.be.disabled')
          .click(options);
      });
    }

    /**
     * Locate a requested toolbar button's tooltip element.
     * @param {*} tileType string name of the tile
     * @param {*} buttonName string name of the button
     */
    getToolbarButtonToolTip(tileType, buttonName) {
      return cy.root().find(`[data-test=canvas] .tile-toolbar.${tileType}-toolbar .toolbar-button.${buttonName}`)
                      .parent()
                      .filter('[data-tooltipped]');
    }
    /**
     * Locate a requested toolbar button's tooltip element and return its text value
     * @param {*} tileType string name of the tile
     * @param {*} buttonName string name of the button
     */
    getToolbarButtonToolTipText(tileType, buttonName) {
        return this.getToolbarButtonToolTip(tileType, buttonName).invoke('attr', 'data-original-title');
    }

    /**
     * Cleans up all text tiles in the workspace if any exist
     * This function will check for text tiles first, and only attempt deletion if they are found
     */
    cleanupTextTiles() {
        canvas.getSingleCanvas().then(($workspace) => {
            if ($workspace.find('.text-tool').length > 0) {
                textToolTile.getTextTile().then(($tiles) => {
                    // If there are any text tiles, delete them one by one
                    for (let i = 0; i < $tiles.length; i++) {
                        this.deleteTile('text');
                        cy.wait(500); // Wait for any animations/resize operations to complete
                    }
                });
            }
        });
    }
}

export default ClueCanvas;
