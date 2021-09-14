class LeftNav{

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

    getCanvasItemTitle(tab, section){
        return cy.get('.list.'+section+' [data-test='+section+'-list-items] .footer');
    }

    starCanvasItem(tab, section,title){
        cy.get('.list.'+section+' .list-item[data-test='+section+'-list-items]').contains('.footer', title).siblings('.icon-holder').find('.icon-star').click();
    }

    closePrimaryWorkspaceTab(tab){
        cy.get('#primaryWorkspaceTab-'+tab+'.tab').click();
        cy.wait(2000);
    }

    getLeftNavTabs(){
        return cy.get('.left-nav .tab');
    }

    getLeftNavExpandedSpace(){
        return cy.get('.left-nav.expanded');
    }

    openLeftNavTab(title){ //Not the best way. Need a better implementation
        const workspaces = ['Introduction', 'Initial Challenge', 'What if...?', 'Now What', 'Extra Workspace'];
        const index = workspaces.indexOf(title);
        cy.get('#leftNavTab' + index).click({force:true});
    }

    closeLeftNavTab(title){ //Not the best way. Need a better implementation. Duplicate of open but reads better in test if there is an open and a close
        const workspaces = ['Introduction', 'Initial Challenge', 'What if...?', 'Now What', 'Extra Workspace'];
        const index = workspaces.indexOf(title);
        cy.get('#leftNavTab' + index).click({force:true});
    }
}
export default LeftNav;
