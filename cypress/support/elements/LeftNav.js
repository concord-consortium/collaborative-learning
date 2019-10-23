class LeftNav{
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

    // getOpenToWorkspaceButton(index){
    //     return cy.get('#leftNavContainer' + index + ' [data-test=open-document-button]');
    // }

    openToWorkspace(title) {
        // const workspaces = ['Introduction', 'Initial Challenge', 'What if...?', 'Now What', 'Extra Workspace'];
        // const index = workspaces.indexOf(title);
        // this.openLeftNavTab(title);
        // this.getOpenToWorkspaceButton(index).click({force:true});
    }
}
export default LeftNav;