//Tabs: ['my-work','class-work','learning-log','supports', 'student-work'] *student-work is teacher only
//Sections: [['workspaces','investigations', 'starred'], *starred is teacher only
//           ['personal', 'published', 'learning-log', 'starred']
//           [''],
//           ['jit','teacher-supports']]
class PrimaryWorkspace{
    testDocumentWithTitle(tab, subTab, title, shouldTest) {
        const tabName = 'tab-' + tab;
        const buttonSelector = '.nav-tab-buttons .nav-tab.' + tabName;
        const topTabSelector = '.nav-tab-panel .top-tab.' + tabName;
        const subTabSelector = '.nav-tab-panel .doc-tab.' + tab + '.' + subTab;
        const panelSelector = '.nav-tab-panel .tab-panel-documents-section.' + subTab;
        const titlesSelector = panelSelector + ' .list.' + tab + ' .list-item .footer';
        cy.get(buttonSelector).click()
            .then(() => {
                cy.get(topTabSelector).click()
                    .then(() => {
                        cy.get(subTabSelector).click()
                            .then(() => {
                                cy.get(titlesSelector)
                                    .should(shouldTest, title)
                                    .then(() => {
                                        cy.get('.nav-tab-panel .close-button').click();
                                    });
                            });
                    });
            });

    }

    shouldHaveDocumentWithTitle(tab, subTab, title) {
        return this.testDocumentWithTitle(tab, subTab, title, 'contain');
    }

    shouldNotHaveDocumentWithTitle(tab, subTab, title) {
        return this.testDocumentWithTitle(tab, subTab, title, 'not.contain');
    }

    getResizePanelDivider(){
       return cy.get('.resize-panel-divider .drag-handles svg g');
    }

    getResizeLeftPanelHandle(){
        return cy.get('.resize-panel-divider .drag-handles svg.drag-left-handle g');
    }

    getResizeRightPanelHandle(){
        return cy.get('.resize-panel-divider .drag-handles svg.drag-right-handle g');
    }

    getSectionTitle(tab, section){
        return cy.get('[data-test='+tab+'-section-'+section+'] .title');
    }

    openSection(tab, section) {
      cy.get('.doc-tab.'+tab+'.'+section).click();
    }

    closeSection(tab,section){
        cy.get('[data-test='+tab+'-section-'+section+']').click();
    }

    getAllSectionCanvasItems(tab, section){
        return cy.get('[data-test='+tab+'-section-'+section).siblings('.list-container').find('[data-test='+tab+'-list-items]');
    }

    deleteSupport(index) {
        if (index === "all") {
            return cy.get('svg.icon-delete-document').click({multiple:true, force:true});
        } else {
            return cy.get('svg.icon-delete-document').eq(index-1).click({force:true});
        }
    }
    confirmDeleteDialog() {
        return cy.get('.dialog-container').within(() => {
            cy.get('.dialog-title').contains('Confirm Delete');
            cy.get('.dialog-text').contains('Do you want to delete this?');
            cy.get('button#okButton').contains('Yes').click({force:true});
        });
    }
}
export default PrimaryWorkspace;
