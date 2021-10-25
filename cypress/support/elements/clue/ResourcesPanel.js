class ResourcesPanel{

    openTopTab(tab) {
        cy.get('.top-tab.tab-'+tab).click();
    }

    getPrimaryWorkspaceTab(tab){
        return cy.get('.top-tab.tab-'+tab);
    }

    openPrimaryWorkspaceTab(tab){
        this.getPrimaryWorkspaceTab(tab).click();
    }

    closePrimaryWorkspaceTabs(){
        cy.get('.close-button').click();
        cy.wait(1000);
    }

    getCollapsedResourcesTab() {
      return cy.get('.collapsed-resources-tab');
    }

    getCanvasItemTitle(tab, section){
        return cy.get('.list.'+section+' [data-test='+section+'-list-items] .footer');
    }

    starCanvasItem(tab, section,title){
        cy.get('.list.'+section+' .list-item[data-test='+section+'-list-items]').contains('.footer', title).siblings('.icon-holder').find('.icon-star').click();
    }

    getCanvasStarIcon(tab,section,title){
        return this.getCanvasItemTitle(tab, section).contains(title).parent().parent().siblings('.icon-holder').find('.icon-star');
    }

    closePrimaryWorkspaceTab(tab){
        cy.get('#primaryWorkspaceTab-'+tab+'.tab').click();
        cy.wait(2000);
    }

    getLeftNavExpandedSpace(){
        return cy.get('.left-nav.expanded');
    }
}
export default ResourcesPanel;
