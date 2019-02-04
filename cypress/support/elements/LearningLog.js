class LearningLog {
    getLearningLogTab(){
        return cy.get('#learningLogTab');
    }

    getBottomNavExpandedSpace(){
        return cy.get('.bottom-nav.expanded > .expanded-area');
    }

    getAllLearningLogCanvasItems(){
        return cy.get('[data-test=learning-log-list-items]');
        // return cy.get('.bottom-nav > .expanded-area > .contents > .learning-log > .logs > .list > .list-item');
    }

    getLearningLogCanvasItemTitle(){
        return cy.get('[data-test=learning-log-list-item-title');
        // return cy.get('.learning-log > .logs > .list > .list-item > .info > .title');
    }

    getLLCanvasTitle(){
        // return cy.get('[data-test=learning-log-single-workspace] > .document > .titlebar > .title');
        return cy.get('[data-test=learning-log-title]');
    }

    openLearningLogCanvasItem(title){ //finds the title then clicks on the canvas
         cy.get('[data-test=learning-log-list-items] > .info > .title[title*="'+title+'"]').parent().parent().click();
    }

    selectLLCanvasTitle(title){
        cy.get('[data-test=learning-log-list-items] > .info > .title[title*="'+title+'"]').click();
    }

    createButton(){
        return cy.get('[data-test=learning-log-create-button]');
    }

    getLLTextTool(){
        return cy.get('[data-test=learning-log-single-workspace] > .toolbar > .tool.text');
    }

    getLLTextTile(){
        return cy.get('[data-test=learning-log-single-workspace] > .document > .canvas-area > .canvas > .document-content > .tile-row > .tool-tile > .text-tool')
    }

    getLLGraphTool(){
        return cy.get('[data-test=learning-log-single-workspace] > .toolbar > .tool.geometry');
    }

    getLLGraphTile(){
        return cy.get('[data-test=learning-log-single-workspace] > .document > .canvas-area > .canvas > .document-content > .tile-row > .tool-tile > .geometry-tool .geometry-content');
    }

    getLLGraphPointText(){
        return cy.get('[data-test=learning-log-single-workspace] > .document > .canvas-area > .canvas > .document-content > .tile-row> .tool-tile > .geometry-tool .geometry-content > .JXGtext');
    }

    getLLImageTool(){
        return cy.get('[data-test=learning-log-single-workspace] > .toolbar > .tool.image')
    }

    openLearningLogTab(){
        this.getLearningLogTab().click({force:true});
        this.getBottomNavExpandedSpace().should('be.visible');
    }

    closeLearningLogTab(){
        this.getLearningLogTab().click({force:true});
        this.getBottomNavExpandedSpace().should('not.be.visible');
    }

    createLearningLog(title){
        this.openLearningLogTab();//open Learning log
        this.createButton().click();
        cy.get('[data-test=dialog-title]').should('contain', 'Create Learning Log');
        cy.get('[data-test=dialog-text-input]').type(title);
        this.getDialogOKButton().click();
        // cy.get('.dialog > .dialog-container > .dialog-contents > .dialog-buttons > #okButton').click();
        this.getLearningLogCanvasItemTitle().should('contain',title);
    }

    renameLearningLog(title) {
        cy.get('[data-test=dialog-title]').should('contain', 'Renaming Learning Log');
        cy.get('[data-test=dialog-text-input]').clear().type(title);
        this.getDialogOKButton().click();
        // cy.get('.dialog > .dialog-container > .dialog-contents > .dialog-buttons > #okButton').click();
    }

    addLLTextTile(text){
        this.getLLTextTool().click();
        this.getLLTextTile().last().type(text);
        this.getLLTextTile().last().should('contain', text);
    }

    addLLGraphTile(){
        this.getLLGraphTool().click({force: true});
        this.getLLGraphTile().last().click();
        this.getLLGraphTile().last().click(); //Adds a point on the graph
        this.getLLGraphPointText().last().should('contain', 'A' );
        this.addLLPointToGraph(40,35);
        // this.getLLGraphPointText().last().should('contain', 'B' );
        this.addLLPointToGraph(240,70);
        // this.getLLGraphPointText().last().should('contain', 'C' );
        this.addLLPointToGraph(40,170);
        // this.getLLGraphPointText().last().should('contain', 'D' );
    }

    addLLImageTile(){
        this.getLLImageTool().click({force:true});
    }

    addLLPointToGraph(x,y){
        this.getLLGraphTile().last();
        cy.get('[data-test=learning-log-single-workspace] > .document > .canvas-area > .canvas > .document-content > .tile-row > .tool-tile > .geometry-tool .geometry-content').last().click(x,y, {force:true});
    }

    getSingleCanvas(){
        return cy.get('[data-test=learning-log-single-workspace] > .document > .canvas-area');
    }

    getTwoUpViewToggle(){
        return cy.get('[data-test=learning-log-single-workspace] > .document > .statusbar > .actions > .action > .icon-up2');
    }
    getTwoToOneUpViewToggle(){// from 2up view
        return cy.get('[data-test=learning-log-left-workspace] > .document > .statusbar > .actions > .action > .icon-up2');
    }

    getRightSideWorkspace(){
        return cy.get('[data-test=learning-log-right-workspace]')
    }
    getLeftSideWorkspace(){
        return cy.get('[data-test=learning-log-left-workspace] > .document > .canvas-area > .canvas');
    }

    getLeftSideToolPalette(){
        return cy.get('[data-test=learning-log-left-workspace] > .toolbar');
    }

    getRightSideToolPalette(){
        return cy.get('[data-test=learning-log-right-workspace] > .toolbar');
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
        return cy.get('[data-test=learning-log-right-workspace] > .document > .titlebar > .title')
    }

    getLeftSideWorkspaceTitle(){
        return cy.get('[data-test=learning-log-left-workspace] > .document > .titlebar > .title')
    }

    getLLPublishIcon(){
        return cy.get('[data-test=learning-log-publish-icon]')
    }

    getDialogTitle(){
        return cy.get('[data-test=dialog-title]');
    }

    getDialogOKButton(){
        return cy.get('[data-test=dialog-buttons] > #okButton');
    }

    publishLearningLog(){
        this.getLLPublishIcon().click()
            .then(()=>{
                this.getDialogTitle().should('exist').contains('Published');
                this.getDialogOKButton().click();
                this.getDialogTitle().should('not.exist');
                this.getLLPublishIcon().should('exist');
            });
    }
}

export default LearningLog;