//Tabs: ['my-work','class-work','learning-log','supports', 'student-work'] *student-work is teacher only
//Sections: [['workspaces','investigations', 'starred'], *starred is teacher only
//           ['personal', 'published', 'learning-log', 'starred']
//           [''],
//           ['jit','teacher-supports']]
class RightNav{
    getRightNavTabs(){
        return cy.get('.right-nav .tabs');
    }

    closeRightNavTabs(){
        cy.get('.right-nav .tabs').click();
    }

    getRightNavTab(tab){
        return cy.get('#rightNavTab-'+tab+'.tab');
    }

    openRightNavTab(tab){
        this.getRightNavTab(tab).click();
        cy.wait(1000);
    }
    closeRightNavTab(tab){
        cy.get('#rightNavTab-'+tab+'.tab').click();
        cy.wait(2000);
    }

    getRightNavExpandedSpace(){
        return cy.get('.right-nav > .expanded-area.expanded > .contents > .container');
    }

    getSectionTitle(tab, section){
        return cy.get('[data-test='+tab+'-section-'+section+'] .title');
    }

    openSection(tab,section){
        if (tab==='learning-log'){
            cy.get('[data-test='+tab+'-section]').click();
        } else {
            cy.get('[data-test='+tab+'-section-'+section+']').click({ force: true });
            cy.wait(1000);
        }
    }

    closeSection(tab,section){
        cy.get('[data-test='+tab+'-section-'+section+']').click();
    }

    getAllSectionCanvasItems(tab, section){
        return cy.get('[data-test='+tab+'-section-'+section).siblings('.list-container').find('[data-test='+tab+'-list-items]');
    }

    getCanvasItemTitle(tab,section){
        if ((tab==='learning-log')||(section==='')){
            return cy.get('[data-test='+tab+'-section]').siblings('.list-container').find('.footer .info div');
        } else {
            return cy.get('[data-test='+tab+'-section-'+section+']').siblings('.list-container').find('.footer .info div');

        }
    }

    openCanvasItem(tab, section, title){
        this.getCanvasItemTitle(tab,section).contains(title).parent().parent().siblings('.scaled-list-item-container').click({force:true});
    }

    starCanvasItem(tab,section,title){
        this.getCanvasItemTitle(tab, section).contains(title).parent().siblings('.icon-holder').find('.icon-star').click();
    }
    getCanvasStarIcon(tab,section,title){
        return this.getCanvasItemTitle(tab, section).contains(title).parent().siblings('.icon-holder').find('.icon-star');
    }

    deleteSupport(index) {
        if (index === "all") {
            return cy.get('svg.icon-delete-document').click({multiple:true, force:true});
        } else {
            return cy.get('svg.icon-delete-document').eq(index-1).click({force:true});
        }
    }
    confirmDeleteDialog() {
        return cy.get('.dialog-container').within(() => {
            cy.get('.dialog-title').contains('Confirm Delete');
            cy.get('.dialog-text').contains('Do you want to delete this?');
            cy.get('button#okButton').contains('Yes').click({force:true});
        });
    }
}
export default RightNav;
