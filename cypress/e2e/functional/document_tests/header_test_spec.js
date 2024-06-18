import Header from '../../../support/elements/common/Header';

const header = new Header;

function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitStudent5")}`;
  cy.clearQAData('all');
  cy.visit(queryParams);
  cy.waitForLoad();
}

context('Test header elements', () => {
  it('verify correct information is in header elements', () => {
    beforeTest();

    cy.location('search').then((queryParam) => {
      const params = (queryParam.split('&'));
      let headerInfoObj = {};
      params.forEach((param) => {
        let query = (param.split("="));
        headerInfoObj[query[0]] = query[1];
      });
      header.getVersionNumber().should('exist');
      header.getClassName().should('exist').and('contain', headerInfoObj.fakeClass);
      header.getUnitTitle().should('exist').and('contain', "QA Unit");
      header.getInvestigationTitle().should('exist').and('contain', 'Enlarging and Reducing Shapes');
      header.getProblemTitle().should('exist').and('contain', headerInfoObj.problem);
      header.getUserName().should('exist').and('contain', ((headerInfoObj.fakeUser).split(":"))[1]);
      header.getGroupNumber().should('exist').and('contain', headerInfoObj.qaGroup);
    });
  });
});
