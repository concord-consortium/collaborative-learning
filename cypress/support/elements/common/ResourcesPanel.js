class ResourcesPanel{

    openTopTab(tab) {
        cy.get('.top-tab.tab-'+tab).click();
    }

    openBottomTab(tabName) {
        cy.get('.prob-tab').contains(tabName).click();
    }

    getPrimaryWorkspaceTab(tab){
        return cy.get('.top-tab.tab-'+tab);
    }

    getResourcesPanelExpandedSpace() {
        return cy.get('.nav-tab-panel .problem-panel .canvas');
    }

    openPrimaryWorkspaceTab(tab){
        this.getPrimaryWorkspaceTab(tab).click();
    }

    closePrimaryWorkspaceTabs(){
        cy.get('.close-button').click();
        cy.wait(1000);
    }

    getCollapsedResourcesTab() {
      return cy.get('.resources-expander');
    }

    // TODO: this is duplicated in commands.js, however in that case the tab
    // isn't passed in.
    getCanvasItemTitle(tab, section){
        return cy.get('.document-tabs.'+tab+' .documents-list.'+section+' [data-test='+section+'-list-items] .footer');
    }

    starCanvasItem(tab, section,title){
        cy.get('.documents-list.'+section+' .list-item[data-test='+section+'-list-items]').contains('.footer', title).siblings('.icon-holder').find('.icon-star').click();
    }

    getCanvasStarIcon(tab,section,title){
        return this.getCanvasItemTitle(tab, section).contains(title).parent().parent().siblings('.icon-holder').find('.icon-star');
    }

    getDocumentCloseButton() {
      return cy.get('.document-buttons .close-doc-button');
    }

    getDocumentEditButton() {
      return cy.get('.document-buttons .edit-button');
    }

    getExemplarShareCheckbox() {
      return cy.get('.focus-document .document-status input[type=checkbox]');
    }

    getEditableDocumentContent() {
      return cy.get('.resource-and-chat-panel .editable-document-content .document-content');
    }

    getDocumentScroller() {
      return cy.get('[data-testid="document-thumbnail-scroller"]');
    }

    getDocumentScrollerLeftBtn() {
      return cy.get('[data-testid="scroll-arrow-left"]');
    }

    getDocumentScrollerRightBtn() {
      return cy.get('[data-testid="scroll-arrow-right"]');
    }

    getDocumentScrollerToggle() {
      return cy.get('[data-testid="toggle-document-scroller"]');
    }

    getDocumentSwitchBtnPrev() {
      return cy.get('[data-testid="switch-document-button-previous"]');
    }

    getDocumentSwitchBtnNext() {
      return cy.get('[data-testid="switch-document-button-next"]');
    }

    closePrimaryWorkspaceTab(tab){
        cy.get('#primaryWorkspaceTab-'+tab+'.tab').click();
        cy.wait(2000);
    }

    getLeftNavExpandedSpace(){
        return cy.get('.left-nav.expanded');
    }

    getActiveTabEditButton(){
        // This looks for the edit button in the active tab and active sub tab
        // both .react-tabs__tab-panel--selected classes are needed. Otherwise it
        // can find edit buttons inside of sub tabs which are active/selected,
        // but the top level (navTab) of this sub tab is not active/selected.
        return cy.get('.nav-tab-panel .react-tabs__tab-panel--selected .react-tabs__tab-panel--selected .edit-button');
    }

    getFocusDocument() {
      return cy.get('.focus-document');
    }

    getFocusDocumentTitle() {
      return this.getFocusDocument().find('.document-title');
    }

    // The Primary and Secondary documents are used in the bookmarks tab
    getPrimaryFocusDocument() {
      return cy.get('.focus-document.primary');
    }
    getPrimaryFocusDocumentTitle() {
      return this.getFocusDocument().find('.document-title');
    }
    getSecondaryFocusDocument() {
      return cy.get('.focus-document.secondary');
    }
    getSecondaryFocusDocumentTitle() {
      return this.getFocusDocument().find('.document-title');
    }
}
export default ResourcesPanel;
