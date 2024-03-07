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
  checkDocumentInGroup(groupName, doc) {
    cy.get(".sort-work-view .sorted-sections .section-header-label").contains(groupName).parent().parent().find(".list .list-item .footer .info").should("contain", doc);
  }
  checkDocumentNotInGroup(groupName, doc) {
    cy.get(".sort-work-view .sorted-sections .section-header-label").contains(groupName).parent().parent().find(".list .list-item .footer .info").should("not.contain", doc);
  }
  checkGroupDoesNotExist(group) {
    cy.get(".sort-work-view .sorted-sections .section-header-label").should("not.contain", group);
  }
  checkSectionHeaderLabelsExist(labels){
    labels.forEach(label => {
      cy.get(".sort-work-view .sorted-sections .section-header-label").should("contain", label);
    });
  }
}

export default SortedWork;
