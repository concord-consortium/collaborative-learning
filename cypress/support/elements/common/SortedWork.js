class SortedWork {
  getPrimarySortByMenu() {
    return cy.get('.custom-select.sort-work-sort-menu.primary-sort-menu');
  }
  getPrimarySortByNameOption() {
    return cy.get('.custom-select.sort-work-sort-menu.primary-sort-menu [data-test="list-item-name"]');
  }
  getPrimarySortByGroupOption() {
    return cy.get('.custom-select.sort-work-sort-menu.primary-sort-menu [data-test="list-item-group"]');
  }
  getPrimarySortByTagOption(){
    return cy.get('.custom-select.sort-work-sort-menu.primary-sort-menu [data-test="list-item-strategy"]');
  }
  getPrimarySortByBookmarkedOption(){
    return cy.get('.custom-select.sort-work-sort-menu.primary-sort-menu [data-test="list-item-bookmarked"]');
  }
  getPrimarySortByToolsOption(){
    return cy.get('.custom-select.sort-work-sort-menu.primary-sort-menu [data-test="list-item-tools"]');
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
  getSortWorkSubgroup(groupName, subgroupName) {
    return this.getSortWorkGroup(groupName)
      .find('[data-testid="doc-group"] [data-testid="doc-group-label"]').contains(subgroupName).parent();
  }
  getSecondarySortByMenu() {
    return cy.get('.custom-select.sort-work-sort-menu.secondary-sort-menu');
  }
  getSecondarySortByNoneOption() {
    return cy.get('.custom-select.sort-work-sort-menu.secondary-sort-menu [data-test="list-item-none"]');
  }
  getSecondarySortByNameOption() {
    return cy.get('.custom-select.sort-work-sort-menu.secondary-sort-menu [data-test="list-item-name"]');
  }
  getSecondarySortByGroupOption() {
    return cy.get('.custom-select.sort-work-sort-menu.secondary-sort-menu [data-test="list-item-group"]');
  }
  getSecondarySortByTagOption(){
    return cy.get('.custom-select.sort-work-sort-menu.secondary-sort-menu [data-test="list-item-strategy"]');
  }
  getSecondarySortByBookmarkedOption(){
    return cy.get('.custom-select.sort-work-sort-menu.secondary-sort-menu [data-test="list-item-bookmarked"]');
  }
  getSecondarySortByToolsOption(){
    return cy.get('.custom-select.sort-work-sort-menu.secondary-sort-menu [data-test="list-item-tools"]');
  }
  getShowForMenu() {
    return cy.get("[data-test=filter-work-menu]");
  }
  getShowForProblemOption() {
    return cy.get("[data-test=list-item-problem]");
  }
  getShowForInvestigationOption() {
    return cy.get("[data-test=list-item-investigation]");
  }
  getShowForUnitOption() {
    return cy.get("[data-test=list-item-unit]");
  }
  getShowForAllOption() {
    return cy.get("[data-test=list-item-all]");
  }
  openSortWorkSection(sectionLabel) {
    return cy.get(".sort-work-view .sorted-sections .section-header-label").contains(".section-header-label", sectionLabel).find(".section-header-arrow").click();
  }
  checkDocumentInGroup(groupName, doc) {
    this.getSortWorkGroup(groupName).find(".documents-list .list-item .footer .info").should("contain", doc);
  }
  checkDocumentNotInGroup(groupName, doc) {
    this.getSortWorkGroup(groupName).find(".documents-list .list-item .footer .info").should("not.contain", doc);
  }
  checkSimpleDocumentInGroup(groupName, doc) {
    this.getSortWorkGroup(groupName).find('[data-testid="section-document-list"] [data-test="simple-document-item"]').should("have.attr", "title", doc);
  }
  checkSimpleDocumentInSubgroup(groupName, subgroupName, doc) {
    this.getSortWorkSubgroup(groupName, subgroupName).find('[data-test="simple-document-item"]').should("have.attr", "title", doc);
  }
  checkGroupDocumentVisibility(groupName, isPrivate, isThumbnailView = false) {
    const docSelector = isThumbnailView
      ? '[data-test="sort-work-list-items"]'
      : '[data-testid="doc-group-list"] [data-test="simple-document-item"]';

    // Assign the documents list to a variable to simplify the code
    cy.get(".section-header").contains(groupName).parent().parent()
      .siblings('[data-testid="section-document-list"]')
      .within(() => {
        cy.get(docSelector).as("groupDocs");
      });

    cy.get("@groupDocs").should(`${isPrivate ? "" : "not."}have.class`, "private");
    cy.get("@groupDocs").first().click();
    cy.get(".focus-document").should(`${isPrivate ? "not." : ""}exist`);

    if (!isPrivate) {
      cy.get(".close-doc-button").click();
    }
  }
  checkGroupIsEmpty(groupName){
    cy.get(".sort-work-view .sorted-sections .section-header-label")
      .contains(groupName).parent().parent().parent().find(".documents-list").should('be.empty');
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

  getSimpleDocumentItem() {
    return cy.get('.sort-work-view .sorted-sections .simple-document-item');
  }

  getPrimarySortLabelForItem(sortWorkItemIdx, isSimpleDocument = false) {
    const selector = isSimpleDocument ?
      '.sort-work-view .sorted-sections .simple-document-item' :
      '.sort-work-view .sorted-sections .list-item';
    return cy.get(selector)
              .eq(sortWorkItemIdx)
              .parents('.documents-list')
              .eq(0)
              .siblings('.section-header')
              .eq(0)
              .find('.section-header-left');
  }

  getSecondarySortLabelForItem(sortWorkItemIdx) {
    return cy.get('.sort-work-view .sorted-sections .simple-document-item')
              .eq(sortWorkItemIdx)
              .parent()
              .siblings('[data-testid="doc-group-label"]')
              .eq(0);
  }

  getHeaderTexts() {
    return cy.get('.document-scroller-header .header-text');
  }
}

export default SortedWork;
