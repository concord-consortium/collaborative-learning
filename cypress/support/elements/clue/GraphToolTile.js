const graphUnit=18.33;

class GraphToolTile{
    transformFromCoordinate(axis, num){
        if (axis=='x'){
            return (num+1)*graphUnit;
        }
        if (axis=='y'){
            return 320-((num+1.2)*graphUnit);
        }
    }
    transformToCoordinate(axis, num){
        if (axis=='x'){
            return Math.round(((num-graphUnit)/graphUnit))
        }
        if (axis=='y'){
            return Math.round((((num-320+(graphUnit*1.2))/(-1*graphUnit))))
        }
    }
    getGraphTile(){
        return cy.get('.canvas-area .geometry-content');
    }
    getGraphAxisLabelId(axis){
        return this.getGraphAxisLabel(axis)
            .then(($label)=>{
                let id= $label.attr('id');
                return id;
        })
    }
    getGraphAxisLabel(axis){
        if (axis=='x') {
            return cy.get('.canvas-area .geometry-content .JXGtext').contains('x')
        }
        if(axis=='y') {
            return cy.get('.canvas-area .geometry-content .JXGtext').contains('y')
        }
    }
    getGraphPointCoordinates(index){ //This is the point coordinate text
        let x=0,
            y=0;

        return (index > -1 ? this.getGraphPoint().eq(index) : this.getGraphPoint().last())
            .then(($point)=>{
                x = $point.attr('cx');
                y = $point.attr('cy');
                var coords = ('"(' + this.transformToCoordinate('x',x) + ', ' + this.transformToCoordinate('y',y) + ')"');
                return coords
            });
    }
    getGraphPointLabel(){ //This is the letter label for a point
        return cy.get('.geometry-content.editable .JXGtext');
    }
    getGraphPoint(){
        return cy.get('.geometry-content.editable ellipse[display="inline"]');
    }
    getGraphPointAtCoordinate(x,y) {
        let transX=this.transformFromCoordinate('x', x),
            transY=this.transformFromCoordinate('y', y);
        this.getGraphTile().last().click(transX,transY);
    }
    hoverGraphPoint(x,y){
        let transX=this.transformFromCoordinate('x', x),
        transY=this.transformFromCoordinate('y', y);

        this.getGraphTile().last()
            .trigger('mouseover',transX,transY);
    }
    selectGraphPoint(x,y){
        let transX=this.transformFromCoordinate('x', x),
            transY=this.transformFromCoordinate('y', y);

        this.getGraphTile().last().click(transX,transY);
    }
    getGraphPointID(point){
         return cy.get('.geometry-content.editable ellipse').eq(point)
            .then(($el)=>{
                let id=$el.attr('id');
                return id;
         });
    }
    getGraphPolygon(){
        return cy.get('.single-workspace .geometry-content.editable polygon');
    }
    addPointToGraph(x,y){
        let transX=this.transformFromCoordinate('x', x),
            transY=this.transformFromCoordinate('y', y);

        this.getGraphTile().last().click(transX,transY, {force:true});
    }
    getRotateTool(){
        return cy.get('.single-workspace .rotate-polygon-icon.enabled');
    }
    getGraphToolMenuIcon(){
        return cy.get('.geometry-menu-button')
    }
    showAngle(){
        cy.get('.geometry-tool .button.angle-label.enabled').click();
    }
    hideAngle(){
        cy.get('.geometry-tool .button.angle-label.enabled').click();
    }
    getAngleAdornment(){
        return cy.get('.single-workspace .geometry-content g polygon').siblings('path');
    }
    copyGraphElement(){
        cy.get('.geometry-tool .button.duplicate.enabled').click();
    }
    addMovableLine(){
        cy.get('.single-workspace .geometry-tool .button.movable-line.enabled').click();
    }
    addComment(){
        cy.get('.geometry-tool .button.comment.enabled').click();
    }
    deleteGraphElement(){
        cy.get('.geometry-tool .button.delete.enabled').click();
    }
}
export default GraphToolTile;