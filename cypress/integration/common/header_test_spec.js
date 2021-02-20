import Header from '../../support/elements/common/Header';

const header = new Header;

before(function(){
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;
    cy.clearQAData('all');

    cy.visit(baseUrl+queryParams);
});
context('Test header elements',()=>{
    describe('Test header UI',()=>{
        it('verify correct information is in header elements',()=>{
          cy.location('search').then((queryParam)=>{
            const params = (queryParam.split('&'));
            let headerInfoObj = {};
            params.forEach((param)=>{
              let query = (param.split("="));
              headerInfoObj[query[0]] = query[1];
            });
            header.getVersionNumber().should('exist');
            header.getClassName().should('exist').and('contain', headerInfoObj.fakeClass);
            header.getUnitTitle().should('exist').and('contain', "Stretching and Shrinking");
            header.getInvestigationTitle().should('exist').and('contain', 'The Mug Wump Family');
            header.getProblemTitle().should('exist').and('contain', headerInfoObj.problem);
            header.getUserName().should('exist').and('contain', ((headerInfoObj.fakeUser).split(":"))[1]);
            header.getGroupNumber().should('exist').and('contain', headerInfoObj.qaGroup);
          });
        });
    });
});
after(function(){
    cy.clearQAData('all');
  });
