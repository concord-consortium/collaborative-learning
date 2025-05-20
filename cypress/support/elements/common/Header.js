class Header{
    getClassName(){
        return cy.get('[data-test=user-title]');
    }
    getUserName(){
        return cy.get('[data-test=user-title-prefix]');
    }
    getGroupNumber(){
        return cy.get('[data-test=group-name]');
    }
    getUnitTitle(){
      return cy.get('[data-test=unit-title]');
    }
    getInvestigationTitle(){
      return cy.get('[data-test=investigation]');
    }
    getProblemTitle(){
        return cy.get('.header[data-test=custom-select-header]');
    }
    getVersionNumber(){
        return cy.get('.app-header .version');
    }
    getNetworkStatus(){
        return cy.get('.firebase.status.connected');
    }
    getDashboardWorkspaceToggleButtons(){
        return cy.get('.middle [orientation="horizontal"]');
    }
}
export default Header;
