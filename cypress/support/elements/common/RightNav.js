//Tabs: ['my-work','class-work','learning-log','supports']
//Sections: [['workspaces','investigations'],
//           ['personal', 'published', 'learning-log', 'starred']
//           [''],
//           ['jit','teacher-supports']]
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

    openSection(tab,section,title=''){ 
        if (section===''){
            cy.get('[data-test='+tab+'-section]').find('.title').contains(title).click()
        }
        else if (tab=='learning-log'){
            cy.get('[data-test='+tab+'-section]').click();
        } else {   
            cy.get('[data-test='+tab+'-section-'+section+']').click();
        }
    }

    closeSection(tab,section){
        cy.get('[data-test='+tab+'-section-'+section+']').click()
    }

    getAllSectionCanvasItems(tab, section){
        return cy.get('[data-test='+tab+'-section-'+section).siblings('[data-test=my-work-list-items]');
    }

    getCanvasItemTitle(tab,section){
        if ((tab=='learning-log')||(section==='')){
            return cy.get('[data-test='+tab+'-section]').siblings('.list.shown').find('.footer .info div')
        } else {
            return cy.get('[data-test='+tab+'-section-'+section+']').siblings('.list.shown').find('.footer .info div')

        }
    }

    openCanvasItem(tab, section='', title){
        this.getCanvasItemTitle(tab,section).contains(title).parent().parent().siblings('.scaled-list-item-container').click({force:true});
    }
}
export default RightNav;