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

    getPrimaryWorkspaceTabs(){
        return cy.get('.right-nav .tabs');
    }

    closePrimaryWorkspaceTabs(){
        cy.get('.close-button').click();
        cy.wait(1000);
    }

    getPrimaryWorkspaceTab(tab){
        return cy.get('.nav-tab.tab-'+tab);
    }

    openPrimaryWorkspaceTab(tab){
        this.getPrimaryWorkspaceTab(tab).click();
    }
    closePrimaryWorkspaceTab(tab){
        cy.get('#primaryWorkspaceTab-'+tab+'.tab').click();
        cy.wait(2000);
    }

    getPrimaryWorkspaceExpandedSpace(){
        return cy.get('.right-nav > .expanded-area.expanded > .contents > .container');
    }

    getSectionTitle(tab, section){
        return cy.get('[data-test='+tab+'-section-'+section+'] .title');
    }

    openTopTab(tab) {
      cy.get('.top-tab.tab-'+tab).click();
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

    getCanvasItemTitle(tab, section){
      return cy.get('.list.'+section+' [data-test='+section+'-list-items] .footer');
    }

    starCanvasItem(section,title){
        cy.getCanvasItemTitle(section).contains(title).parent().parent().siblings('.icon-holder').find('.icon-star').click();
    }
    getCanvasStarIcon(tab,section,title){
        return this.getCanvasItemTitle(tab, section).contains(title).parent().parent().siblings('.icon-holder').find('.icon-star');
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
