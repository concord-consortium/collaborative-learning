class BottomNav{

    getBottomNavTabs(){
        return cy.get('.bottom-nav > .tabs > .tab');
    }

    getBottomNavExpandedSpace(){
        return cy.get('.bottom-nav.expanded');
    }


}
export default BottomNav;