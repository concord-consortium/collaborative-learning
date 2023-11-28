class TeacherNetwork{

    getDividerLabel(subtab, divider) {
      return cy.get('[data-test=subtab-'+subtab+'] .network-divider-label.' + divider);
    }
    getSectionCollapseToggle(subtab, divider, classInfo) {
      return cy.get('[data-test=subtab-'+subtab+'] .network-container.' + divider + ' .collapsible-documents-section .section-collapse-toggle')
        .contains(classInfo).parent().parent();
    }
    getExpandedSectionCollapseToggle(subtab, divider, classInfo) {
      return cy.get('[data-test=subtab-'+subtab+'] .network-container.' + divider + ' .collapsible-documents-section .section-collapse-toggle')
        .contains(classInfo).parent();
    }
    getDocumentsList(subtab, divider, classInfo) {
      return this.getSectionCollapseToggle(subtab, divider, classInfo).find('.list');
    }
    getDocumentName(subtab, divider, classInfo) {
      return this.getSectionCollapseToggle(subtab, divider, classInfo).find('.list .list-item .footer .info');
    }
    verifyDividerLabel(subtab, divider) {
      this.getDividerLabel(subtab, divider).should('exist');
    }
    expandSectionClass(subtab, divider, classInfo) {
      this.getSectionCollapseToggle(subtab, divider, classInfo).click();
    }
    collapseSectionClass(subtab, divider, classInfo) {
      this.getExpandedSectionCollapseToggle(subtab, divider, classInfo).click();
    }
    verifyDocumentsListDisplays(subtab, divider, classInfo) {
      this.getDocumentsList(subtab, divider, classInfo).should('exist');
    }
    verifyDocumentName(subtab, divider, classInfo, docName) {
      this.getDocumentName(subtab, divider, classInfo).contains(docName);
    }
    selectDocument(subtab, divider, classInfo, docName) {
      this.getDocumentName(subtab, divider, classInfo).contains(docName).click();
    }
}
export default TeacherNetwork;
