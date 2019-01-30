class LeftNav{
    getLeftNavTabs(){
        return cy.get('.left-nav > .tabs > .tab');
    }

    getLeftNavExpandedSpace(){
        return cy.get('.left-nav.expanded');
    }

    openLeftNavTab(title){ //Not the best way. Need a better implementation
        switch(title){
            case 'Introduction':
                cy.get('#leftNavTab0').click({force:true});
                break;
            case 'Initial Challenge':
                cy.get('#leftNavTab1').click({force:true});
                break;
            case 'What if':
                cy.get('#leftNavTab2').click({force:true});
                break;
            case 'Now What':
                cy.get('#leftNavTab3').click({force:true});
                break;
            case 'Extra Workspace':
                cy.get('#leftNavTab4').click({force:true});
                break;
        }
    }

    closeLeftNavTab(title){ //Not the best way. Need a better implementation. Duplicate of open but reads better in test if there is an open and a close
        switch(title){
            case 'Introduction':
                cy.get('#leftNavTab0').click({force:true});
                break;
            case 'Initial Challenge':
                cy.get('#leftNavTab1').click({force:true});
                break;
            case 'What if':
                cy.get('#leftNavTab2').click({force:true});
                break;
            case 'Now What':
                cy.get('#leftNavTab3').click({force:true});
                break;
            case 'Extra Workspace':
                cy.get('#leftNavTab4').click({force:true});
                break;
        }
    }

    getOpenToWorkspaceButton(index){
        return cy.get('#leftNavContainer' + index).find('[data-test=open-document-button]');
    }

    openToWorkspace(title) {
        const workspaces = ['Introduction', 'Initial Challenge', 'What if', 'Now What', 'Extra Workspace'];
        const index = workspaces.indexOf(title);
        this.openLeftNavTab(title);
        this.getOpenToWorkspaceButton(index).click({force:true});
    }
}
export default LeftNav;