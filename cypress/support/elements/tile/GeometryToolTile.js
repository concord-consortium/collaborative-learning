const kGraphPixPerCoord = { x: 18.33, y: -18.33 };
// determined by inspection
const kGraphOriginCoordPix = { x: 40, y: 296 };

// NOTE: These don't produce exactly the right results;
// if you watch the test you can see that the coordinates are somewhat off.
// However, this does not keep the tests from passing since they are off in a consistent way.
export function pointCoordsToPix(ptCoords, originPix) {
    return { x: originPix.x + ptCoords.x * kGraphPixPerCoord.x,
             y: originPix.y + ptCoords.y * kGraphPixPerCoord.y };
}

export function pointPixToCoords(ptPix, originPix) {
    const x = Math.round((ptPix.x - originPix.x) / kGraphPixPerCoord.x);
    const y = Math.round((ptPix.y - originPix.y) / kGraphPixPerCoord.y);
    return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y }; // convert -0 to 0
}

class GeometryToolTile {
    transformFromCoordinate(axis, num){
        return kGraphOriginCoordPix[axis] + num * kGraphPixPerCoord[axis];
    }
    transformToCoordinate(axis, num){
        const coord = Math.round((num - kGraphOriginCoordPix[axis]) / kGraphPixPerCoord[axis]);
        return coord === 0 ? 0 : coord; // convert -0 to 0
    }
    getGeometryTile(workspaceClass){
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area [data-testid=geometry-tool]`);
    }
    getGeometryTileNavigatorPanel(){
      return cy.get('.primary-workspace .canvas-area .geometry-tool-tile [data-testid=tile-navigator-container]');
    }
    getGraph(workspaceClass){
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area [data-testid=geometry-tool] .geometry-content.show-tile`);
    }
    // getGraphPoint(workspaceClass){
    //     return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .geometry-content svg g`);
    // }

    getGraphPointEclipse(workspaceClass){
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .geometry-content.show-tile svg g ellipse`);
    }

    getGraphTitle(workspaceClass){
      return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area [data-testid=geometry-tool] .editable-tile-title-text`);
    }

    getGraphTileTitle(workspaceClass){
        return cy.get(`${workspaceClass || ".primary-workspace"} .editable-tile-title`);
    }

    getGraphAxisLabelId(axis){
        return this.getGraphAxisLabel(axis)
            .then(($label)=>{
                let id= $label.attr('id');
                return id;
        });
    }
    getGraphAxisLabel(axis){
        if (axis==='x') {
            return cy.get('.canvas-area .geometry-content.show-tile .JXGtext').contains('x');
        }
        if(axis==='y') {
            return cy.get('.canvas-area .geometry-content.show-tile .JXGtext').contains('y');
        }
    }
    // Returns all tick labels on both axes. The X-axis ones are first in the list.
    getGraphAxisTickLabels(axis) {
      return cy.get('.canvas-area .geometry-content.show-tile .tick-label');
    }

    getGraphPointCoordinates(index){ //This is the point coordinate text
        let x=0,
            y=0;

        return (index > -1 ? this.getGraphPoint().eq(index) : this.getGraphPoint().last())
            .then(($point)=>{
                x = $point.attr('cx');
                y = $point.attr('cy');
                return '"(' + this.transformToCoordinate('x',x) + ', ' + this.transformToCoordinate('y',y) + ')"';
            });
    }
    getGraphPointLabel(workspaceClass){ // This selects the letter labels for points as well as the x,y labels on the axes
      return this.getGeometryTile(workspaceClass).find('.geometry-content.show-tile .JXGtext:visible');
    }
    getGraphPoint(workspaceClass){
        return this.getGeometryTile(workspaceClass).find('.geometry-content.show-tile ellipse[display="inline"][fill-opacity="1"]');
    }
    getPhantomGraphPoint(workspaceClass){
      return this.getGeometryTile(workspaceClass).find('.geometry-content.show-tile ellipse[fill-opacity="0.5"]');
    }
    getSelectedGraphPoint(workspaceClass){
      return this.getGeometryTile(workspaceClass).find('.geometry-content.show-tile ellipse[fill-opacity="1"][stroke-opacity="0.25"]');
    }
    hoverGraphPoint(x,y){
        let transX=this.transformFromCoordinate('x', x),
        transY=this.transformFromCoordinate('y', y);

        this.getGraph().last()
            .trigger('mouseover',transX,transY);
    }
    selectGraphPoint(x, y, withShiftKey = false ){
        let transX=this.transformFromCoordinate('x', x),
            transY=this.transformFromCoordinate('y', y);

        this.getGraph().last()
          .click(transX, transY, { force:true, shiftKey: withShiftKey });
    }
    getGraphPointID(point){
         return cy.get('.geometry-content.editable ellipse').eq(point)
            .then(($el)=>{
                let id=$el.attr('id');
                return id;
         });
    }
    getGraphLine(){
        return cy.get('.single-workspace .geometry-content.editable line');
    }
    getGraphPolygon(){
        return cy.get('.single-workspace .geometry-content.editable polygon');
    }
    getGraphCircle(){
      return cy.get('.single-workspace .geometry-content.editable ellipse[fill-opacity="0.2"]');
    }
    getSelectedGraphCircle(){
      return cy.get('.single-workspace .geometry-content.editable ellipse[fill-opacity="0.3"]');
    }

    clickGraphPosition(x,y){
        let transX=this.transformFromCoordinate('x', x),
            transY=this.transformFromCoordinate('y', y);

        this.getGraph().last().click(transX,transY, {force:true});
    }
    getRotateTool(){
        return cy.get('.single-workspace .rotate-polygon-icon.enabled');
    }
    getGraphToolMenuIcon(){
        return cy.get('.geometry-menu-button');
    }

    getModalTitle() {
      return cy.get('.ReactModalPortal');
    }

    getModalLabelInput() {
      return cy.get('.ReactModalPortal input[type=text]');
    }

    // Name should be something like 'none', 'label', or 'length'
    chooseLabelOption(name) {
      cy.get(`.ReactModalPortal input[value=${name}]`).click();
      cy.get('.ReactModalPortal button.default').click();
    }

    toggleAngleCheckbox(value) {
      cy.get('.ReactModalPortal input#angle-checkbox').click();
      cy.get('.ReactModalPortal button.default').click();
    }

    showAngle(){
        cy.get('.single-workspace.primary-workspace .geometry-toolbar .button.angle-label').click({force: true});
    }
    hideAngle(){
        cy.get('.single-workspace.primary-workspace .geometry-toolbar .button.angle-label.enabled').click();
    }
    getAngleAdornment(){
        return cy.get('.single-workspace .geometry-content.show-tile g polygon').siblings('path');
    }
    copyGraphElement(){
        cy.get('.single-workspace.primary-workspace .geometry-toolbar .button.duplicate.enabled').click();
    }
    addMovableLine(){
        cy.get('.single-workspace [data-testid=geometry-tool] .button.movable-line.enabled').click();
    }
    addComment(){
        cy.get('.single-workspace.primary-workspace .geometry-toolbar .button.comment.enabled').click();
    }
    selectColor(color){
      return cy.get(`[data-test=canvas] .tile-toolbar .toolbar-button.color .palette-buttons .color-swatch.${color}`).click();
    }
}
export default GeometryToolTile;
