class Header{
    getClassName(){
        return cy.get('[data-test=user-problem]');
    }
    getUserName(){
        return cy.get('[data-test=user-name]')
    }
    getProblemTitle(){
        return cy.get('[data-test=problem-title]')
    }
    getVersionNumber(){
        return cy.get('.app-header .version')
    }
}
export default Header;