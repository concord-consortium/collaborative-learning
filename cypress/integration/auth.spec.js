context('Auth', () => {
  beforeEach(() => {
    cy.visit('');
  })

  it('renders', () => {
    cy.get('.header')
      .should('contain', 'Developer Mode')
      .should('contain', 'Sample Problem');
  })
})
