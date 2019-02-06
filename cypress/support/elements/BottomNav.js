class BottomNav{

    getBottomNavTabs(){
        return cy.get('.bottom-nav .tab');
    }

    getBottomNavExpandedSpace(){
        return cy.get('.bottom-nav.expanded');
    }


}
export default BottomNav;