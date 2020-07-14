import Header from '../../support/elements/common/Header'

const header = new Header;
const queryParams = `${Cypress.config("queryParams")}`;

function parseQueryParam(){
    let userInfo={}
    //"?appMode=qa&fakeClass=5&fakeUser=student:5&demoOffering=5&problem=2.1&qaGroup=5&unit=sas" for CLUE
    //"?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5" for Dataflow otherwise Null Problem is the problem title
    return userInfo
}
before(function(){
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;

    cy.visit(baseUrl+queryParams);
});
context('Test header elements',()=>{
    describe('Test header UI',()=>{
        it('verify header ui existence',()=>{
            header.getClassName().should('exist');
            header.getProblemTitle().should('exist'); //may have to move this when dropdown exists
            header.getUserName().should('exist');
            header.getVersionNumber().should('exist');
        })
        it('verify correct information is in header elements',()=>{
            //user query params to get class, user name, and problem info

        })
    })
})
after(function(){
    cy.clearQAData('all');
  });