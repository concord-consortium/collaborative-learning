class Header{
    getClassName(){
        return cy.get('.class[data-test=user-class]');
    }
    getUserName(){
        return cy.get('[data-test=user-name]');
    }
    getProblemTitle(){
        return cy.get('[data-test=problem-title]');
    }
    getVersionNumber(){
        return cy.get('.app-header .version');
    }
}
export default Header;
