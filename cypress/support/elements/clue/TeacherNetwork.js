class TeacherNetwork{

    getMyClassesDividerLabel(subtab) {
      return cy.get('[data-test=subtab-'+subtab+'] .network-divider-label.my-classes');
    }
    getMyNetworkDividerLabel(subtab) {
      return cy.get('[data-test=subtab-'+subtab+'] .network-divider-label.my-network');
    }
    verifyMyClassesDividerLabel(subtab) {
      this.getMyClassesDividerLabel(subtab).should('exist');
    }
    verifyMyNetworkDividerLabel(subtab) {
      this.getMyNetworkDividerLabel(subtab).should('exist');
    }
}
export default TeacherNetwork;
