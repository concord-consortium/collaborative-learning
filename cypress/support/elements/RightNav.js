class RightNav{
    getRightNavTabs(){
        return cy.get('.right-nav .tab');
    }
    getMyWorkTab(){
        return cy.get('#rightNavTab-my-work.tab');
    }
    getRightNavExpandedSpace(){
        return cy.get('.right-nav > .expanded-area.expanded > .contents > .container');
    }

    getAllMyWorkAreaCanvasItems(){
        return cy.get('[data-test=my-work-list-items]');
    }

    openMyWorkAreaCanvasItem(){
        cy.get('.my-work .section-header').last().click();
        cy.get('[data-test=my-work-list-items] .scaled-list-item').click();
        // cy.get('[data-test=my-work-list-items][title*="'+title+'"]').click();
        // cy.get('.my-work > .list > .list-item[title*="'+title+'"]').click();
    }
    openSavedProgramItem(title){
        cy.get('[data-test=my-work-section]').contains("Df: Investigation ").click();
        cy.get('[data-test="my-work-list-items"] .footer .info').contains(title).parent().parent().siblings(".scaled-list-item-container").click();
    }

    openMyWorkTab(){
        this.getMyWorkTab().click({force:true});
        this.getRightNavExpandedSpace();
        // this.getRightNavExpandedSpace().should('be.visible');
    }

    closeMyWorkTab(){
        this.getMyWorkTab().click({force:true});
        this.getRightNavExpandedSpace().should('not.be.visible');
    }

    getClassWorkTab(){
        return cy.get('#rightNavTab-class-work.tab');
    }

    getClassWorkAreaCanvasItem(){
        return cy.get('[data-test=class-work-list-items] .scaled-list-item');
        // return cy.get('.right-nav > .expanded-area.expanded > .contents > .class-work > .list > .list-item');
    }

    getAllClassWorkAreaCanvasItems(){
        return cy.get('[data-test=class-work-list-items]')
        // return cy.get('.right-nav > .expanded-area.expanded > .contents > .class-work > .list > .list-item');
    }

    openClassWorkAreaCanvasItem(student){
        this.getClassWorkAreaCanvasItem(student).parent().siblings().click();
        // return cy.get('[data-test=class-work-list-items] .scaled-list-item');
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
        return cy.get('#rightNavTab-class-logs.tab');
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