class Header{
    getClassName(){
        return cy.get('[data-test=user-class]');
    }
    getGroupName(){
        return cy.get('[data-test=group-name]');
        // return cy.get('.header .group .name');
    }
    getGroupMembers(){
        return cy.get('[data-test=group-members]')
    }
    getUserName(){
        return cy.get('[data-test=user-name]')
    }
    getProblemTitle(){
        return cy.get('[data-test=problem-title]')
    }
}
export default Header;