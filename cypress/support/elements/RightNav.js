class RightNav{
    getRightNavTabs(){
        return cy.get('.right-nav > .tabs > .tab');
    }
    getMyWorkTab(){
        return cy.get('#rightNavTabMy\\ Work.tab');
    }
    getRightNavExpandedSpace(){
        return cy.get('.right-nav > .expanded-area.expanded');
    }

    getAllMyWorkAreaCanvasItems(){
        return cy.get('[data-test=my-work-list-items]');
    }

    openMyWorkAreaCanvasItem(title){
        cy.get('[data-test=my-work-list-items][title*="'+title+'"]').click();
        // cy.get('[data-test=my-work-list-items][title*="'+title+'"]').click();
        // cy.get('.my-work > .list > .list-item[title*="'+title+'"]').click();
    }

    openMyWorkTab(){
        this.getMyWorkTab().click({force:true});
        this.getRightNavExpandedSpace().should('be.visible');
    }

    closeMyWorkTab(){
        this.getMyWorkTab().click({force:true});
        this.getRightNavExpandedSpace().should('not.be.visible');
    }

    getClassWorkTab(){
        return cy.get('#rightNavTabClass\\ Work.tab');
    }

    getClassWorkAreaCanvasItem(){
        return cy.get('[data-test=class-work-list-items]');
        // return cy.get('.right-nav > .expanded-area.expanded > .contents > .class-work > .list > .list-item');
    }

    getAllClassWorkAreaCanvasItems(){
        return cy.get('[data-test=class-work-list-items]')
        // return cy.get('.right-nav > .expanded-area.expanded > .contents > .class-work > .list > .list-item');
    }

    openClassWorkAreaCanvasItem(title){
        // this test, as well as the previous implementation, might have unexpected results if we have
        // multiple items within a Class Work section
        cy.get('[data-test=class-work-list-items] > .info').parent().click();
    }

    openClassWorkTab(){
        this.getClassWorkTab().click({force:true});
        this.getRightNavExpandedSpace().should('be.visible');
    }

    closeClassWorkTab(){
        this.getClassWorkTab().click({force:true});
        this.getRightNavExpandedSpace().should('not.be.visible');
    }

    openClassWorkSections(){
        cy.get('[data-test=class-work-section]').click({force:true, multiple:true});
    }

    getClassLogTab(){
        return cy.get('#rightNavTabClass\\ Logs.tab');
    }

    getClassLogAreaCanvasItem(){
        return cy.get('[data-test=class-log-list-items]');
    }

    getAllClassLogAreaCanvasItems(){
        return cy.get('[data-test=class-log-list-items]');
    }

    openClassLogAreaCanvasItem(title){
        cy.get('[data-test=class-log-list-items] > .info > div:contains("'+title+'")').parent().parent().click();
    }

    openClassLogTab(){
        this.getClassLogTab().click({force:true});
        this.getRightNavExpandedSpace().should('be.visible');
    }

    closeClassLogTab(){
        this.getClassLogTab().click({force:true});
        this.getRightNavExpandedSpace().should('not.be.visible');
    }

}
export default RightNav;