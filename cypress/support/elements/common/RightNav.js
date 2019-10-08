class RightNav{
    getRightNavTabs(){
        return cy.get('.right-nav .tabs');
    }

    closeRightNavTabs(){
        cy.get('.right-nav .tabs').click()
    }

    getRightNavTab(tab){
        return cy.get('#rightNavTab'+tab+'.tab');
    }

    openRightNavTab(tab){   
        cy.get('#rightNavTab-'+tab+'.tab').click();
        cy.wait(2000);
    }
    closeRightNavTab(tab){   
        cy.get('#rightNavTab-'+tab+'.tab').click();
        cy.wait(2000);
    }

    getRightNavExpandedSpace(){
        return cy.get('.right-nav > .expanded-area.expanded > .contents > .container');
    }

    getSectionTitle(tab, section){
        return cy.get('[data-test='+tab+'-section-'+section+'] .title')
    }

    openSection(tab,section){
        cy.get('[data-test='+tab+'-section-'+section+']').click()
    }

    closeSection(tab,section){
        cy.get('[data-test='+tab+'-section-'+section+']').click()
    }

    getAllSectionCanvasItems(tab, section){
        return cy.get('[data-test='+tab+'-section-'+section).siblings('[data-test=my-work-list-items]');
    }

    getCanvasItemTitle(tab,section){
        return cy.get('[data-test='+tab+'-section-'+section+']').siblings('.list.shown').find('.footer .info div')
    }

    openCanvasItem(tab, section, title){
        this.getCanvasItemTitle(tab,section).contains(title).parent().parent().siblings('.scaled-list-item-container').click();
    }
}
export default RightNav;