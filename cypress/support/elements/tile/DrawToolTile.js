class DrawToolTile{
    getDrawTile(workspaceClass){
      return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .drawing-tool-tile`);
    }
    getTileTitle(workspaceClass){
      return cy.get(`${workspaceClass || ".primary-workspace"} .editable-tile-title-text`);
    }
    getDrawTileComponent(){
      return cy.get('.primary-workspace [data-testid=drawing-tool]')
               .not('[data-testid=tile-navigator] [data-testid=drawing-tool]');
    }
    getDrawTileObjectCanvas(){
      return this.getDrawTileComponent().find('[data-testid=drawing-layer-object-canvas]');
    }
    getDrawTileShowSortPanel(){
      return cy.get('.primary-workspace .drawing-tool .object-list');
    }
    getDrawTileShowSortPanelOpenButton(){
      return cy.get('.primary-workspace .drawing-tool .object-list.closed button');
    }
    getDrawTileShowSortPanelCloseButton(){
      return cy.get('.primary-workspace .drawing-tool .object-list.open button.close');
    }
    getDrawToolSelect(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.select');
    }
    getDrawToolFreehand(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.line');
    }
    getDrawToolVector(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.vector');
    }
    getDrawToolVectorSubmenu(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.vector .expand-collapse');
    }
    getDrawToolRectangle(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.rectangle');
    }
    getDrawToolEllipse(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.ellipse');
    }
    getDrawToolStamp(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.stamp');
    }
    getDrawToolStampExpand(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.stamp .expand-collapse');
    }
    getDrawToolText(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.text');
    }
    getDrawToolStrokeColor(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.stroke-color');
    }
    getDrawToolFillColor(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.fill-color');
    }
    getDrawToolVariable(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.variable');
    }
    getDrawToolNewVariable(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.new-variable');
    }
    getDrawToolInsertVariable(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.insert-variable');
    }
    getDrawToolEditVariable(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.edit-variable');
    }
    getDrawToolUploadImage(){
      return cy.get('.primary-workspace .drawing-toolbar .upload-button-input');
    }
    getDrawToolGroup(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.group');
    }
    getDrawToolUngroup(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.ungroup');
    }
    getDrawToolDelete(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.delete');
    }

    getFreehandDrawing(){
      return this.getDrawTileComponent().find('.drawing-layer svg path');
    }
    getVectorDrawing(){
      return this.getDrawTileComponent().find('.drawing-layer svg g.vector');
    }
    getRectangleDrawing(){
      return this.getDrawTileComponent().find('.drawing-layer svg rect.rectangle');
    }
    getEllipseDrawing(){
      return this.getDrawTileComponent().find('.drawing-layer svg ellipse');
    }
    getImageDrawing(){
      return this.getDrawTileComponent().find('.drawing-layer svg image');
    }
    getTextDrawing(){
      return this.getDrawTileComponent().find('.drawing-layer svg g.text');
    }
    getGroupDrawing(){
      return this.getDrawTileComponent().find('.drawing-layer svg g.group');
    }

    getSelectionBox(){
      return this.getDrawTileComponent().find('.drawing-layer svg [data-testid=selection-box]');
    }
    getHighlightBox(){
      return this.getDrawTileComponent().find('.drawing-layer svg [data-testid=highlight-box]');
    }
    getVariableChip() {
      return this.getDrawTileComponent().find('.drawing-layer .drawing-variable.variable-chip');
    }
    getGhostGroup() {
      return this.getDrawTileComponent().find('.drawing-layer svg g.ghost');
    }
    getDrawTileTitle(workspaceClass){
      return cy.get(`${workspaceClass || ".primary-workspace"} .drawing-tool-tile .editable-tile-title`)
               .not('[data-testid=tile-navigator] .editable-tile-title');
    }
    drawRectangle(x, y, width=25, height=25) {
      this.getDrawToolRectangle().last().click();
      this.getDrawTile().last()
        .trigger("pointerdown", x, y, { isPrimary: true })
        .trigger("pointermove", x+width, y+height, { isPrimary: true })
        .trigger("pointerup", x+width, y+height, { isPrimary: true });
    }

    drawEllipse(x, y, width=25, height=25) {
      this.getDrawToolEllipse().click();
      this.getDrawTile().last()
        .trigger("pointerdown", x, y, { isPrimary: true })
        .trigger("pointermove", x+width, y+height, { isPrimary: true })
        .trigger("pointerup", x+width, y+height, { isPrimary: true });
    }

    drawVector(x, y, width=25, height=25) {
      this.getDrawToolVector().click();
      this.getDrawTile().last()
        .trigger("pointerdown", x, y, { isPrimary: true })
        .trigger("pointermove", x+width, y+height, { isPrimary: true })
        .trigger("pointerup", x+width, y+height, { isPrimary: true });
    }

    drawFreehand(points) {
      this.getDrawToolFreehand().click();
      this.getDrawTile().last()
        .trigger("pointerdown", points[0].x, points[0].y, { isPrimary: true });
      for (let i = 1; i < points.length; i++) {
        this.getDrawTile().last()
          .trigger("pointermove", points[i].x, points[i].y, { isPrimary: true });
      }
      this.getDrawTile().last()
        .trigger("pointerup", points[points.length-1].x, points[points.length-1].y, { isPrimary: true });
    }

    dragSelectionRectangle(x, y, width, height) {
      this.getDrawToolSelect().click();
      this.getDrawTile().last()
        .trigger("pointerdown", x, y, { isPrimary: true })
        .trigger("pointermove", x+width, y+height, { isPrimary: true })
        .trigger("pointerup", x+width, y+height, { isPrimary: true });
    }

    addText(x, y, text) {
      this.getDrawToolText().click();
      this.getDrawTile().last()
        .trigger("pointerdown", x, y, { isPrimary: true })
        .trigger("pointerup", x, y, { isPrimary: true });
      this.getDrawTile().last()
        .trigger("pointerdown", x, y, { isPrimary: true })
        .trigger("pointerup", x, y, { isPrimary: true });
      this.getTextDrawing().last().get('textarea').type(text + "{enter}");
    }

    verifyTransformValues(transform, expectedTranslate, expectedScale, tolerance=1, scaleTolerance=0.01) {
      const translate = transform.replace(/.*translate\(([^,]+), ([^)]+)\).*/, '$1,$2');
      const translateX = parseFloat(translate.split(',')[0]);
      const translateY = parseFloat(translate.split(',')[1]);
      expect(translateX).to.be.closeTo(expectedTranslate.x, tolerance);
      expect(translateY).to.be.closeTo(expectedTranslate.y, tolerance);
      const scale = parseFloat(transform.replace(/.*scale\((\d+(\.\d+)?)\)/, '$1'));
      expect(scale).to.be.closeTo(expectedScale, scaleTolerance);
    }

}

export default DrawToolTile;
