import LeftNav from '../../../../support/elements/clue/LeftNav'

let leftNav = new LeftNav;

before(function(){
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;

    cy.visit(baseUrl+queryParams);
    cy.waitForSpinner()
});

describe('Test Left tabs',function(){

    let titles=['Introduction', 'Initial Challenge', 'What If...?', 'Now What Do You Know', 'Extra Workspace']

    it('verify tab names are visible',()=>{
        let titleArr = [], i=0;

        leftNav.getLeftNavTabs().each(($tab, index, $tabList)=>{
            expect($tab.text()).to.contain(titles[index])
        })
    })    
    it('verify content when switching tabs', function(){
        let titleArr = [], i=0;

        leftNav.getLeftNavTabs().each(($tab,index, tabList)=>{
            var title = $tab.text();
            cy.wrap($tab).click({force:true});
            cy.get('#leftNavContainer'+index).find('.left-nav-panel .section-header h1').should("contain",title)
        })
    });
});

after(function(){
  cy.clearQAData('all');
});