class SortedWork {
  getSortByMenu() {
    return cy.get('.custom-select.sort-work-sort-menu');
  }
  getSortByNameOption() {
    return cy.get('[data-test="list-item-name"]');
  }
  getSortByGroupOption() {
    return cy.get('[data-test="list-item-group"]');
  }
  getSortByTagOption(){
    return cy.get('[data-test="list-item-identify-design approach"]');
  }
  getSortWorkItem() {
    return cy.get(".sort-work-view .sorted-sections .list-item .footer .info");
  }
  getSortWorkItemByTitle(title) {
    return this.getSortWorkItem().contains(title);
  }
  getSortWorkGroup(groupName) {
    return cy.get(".sort-work-view .sorted-sections .section-header-label").contains(groupName).parent().parent().parent();
  }
  openSortWorkSection(sectionLabel) {
    return cy.get(".sort-work-view .sorted-sections .section-header-label").contains(sectionLabel).get(".section-header-right .section-header-arrow").click();
  }
  checkDocumentInGroup(groupName, doc) {
    this.getSortWorkGroup(groupName).find(".list .list-item .footer .info").should("contain", doc);
  }
  checkDocumentNotInGroup(groupName, doc) {
    this.getSortWorkGroup(groupName).find(".list .list-item .footer .info").should("not.contain", doc);
  }
  checkGroupIsEmpty(groupName){
    cy.get(".sort-work-view .sorted-sections .section-header-label")
      .contains(groupName).parent().parent().parent().find(".list").should('be.empty');
  }
  checkGroupDoesNotExist(group) {
    cy.get(".sort-work-view .sorted-sections .section-header-label").should("not.contain", group);
  }
  checkSectionHeaderLabelsExist(labels){
    labels.forEach(label => {
      cy.get(".sort-work-view .sorted-sections .section-header-label").should("contain", label);
    });
  }

  getFocusDocument() {
    return cy.get('.sort-work-view .focus-document.sort-work');
  }

  getFocusDocumentTitle() {
    return this.getFocusDocument().find('.document-title');
  }

}

export default SortedWork;
