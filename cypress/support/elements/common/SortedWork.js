class SortedWork {
  getSortByMenu() {
    return cy.get('.custom-select.sort-work-sort-menu');
  }
  getListItemByName() {
    return cy.get('[data-test="list-item-name"]');
  }
  getListItemByGroup() {
    return cy.get('[data-test="list-item-group"]')
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
}

export default SortedWork;
