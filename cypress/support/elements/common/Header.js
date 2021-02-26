class Header{
    getClassName(){
        return cy.get('.class[data-test=user-class]');
    }
    getUserName(){
        return cy.get('[data-test=user-name]');
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
}
export default Header;
