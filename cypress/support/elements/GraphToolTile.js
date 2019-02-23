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
            // return (Math.round(((num-graphUnit)/graphUnit)*100)/100)
            return Math.round(((num-graphUnit)/graphUnit))
        }
        if (axis=='y'){
            // return (Math.round((((num-320+(graphUnit*1.2))/(-1*graphUnit)))*100)/100)
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
    getGraphPointCoordinates(){ //This is the point coordinate text
        let x=0,
            y=0;

        return this.getGraphPoint().last()
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
    selectGraphPoint(x,y){
        let transX=this.transformFromCoordinate('x', x),
            transY=this.transformFromCoordinate('y', y);

        this.getGraphTile().last().click(transX,transY);
    }
    getGraphPointID(){
        let pointId='';
         return cy.get('.geometry-content.editable ellipse').last()
            .then(($el)=>{
                return $el.attr('id');
            // }).then((id)=>{
            //     pointId=id;
         });
         return pointId;
    }
    getGraphPolygon(){
        return cy.get('.geometry-content.editable polygon');
    }
    addPointToGraph(x,y){
        let transX=this.transformFromCoordinate('x', x),
            transY=this.transformFromCoordinate('y', y);

        this.getGraphTile().last().click(transX,transY, {force:true});
    }
    getRotateTool(){
        return cy.get('.rotate-polygon-icon.enabled');
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
    copyGraphElement(){
        cy.get('.geometry-tool .button.duplicate.enabled').click();
    }
    addMovableLine(){
        cy.get('.geometry-tool .button.movable-line.enabled').click();
    }
    addComment(){
        cy.get('.geometry-tool .button.comment.enabled').click();
    }
    deleteGraphElement(){
        cy.get('.geometry-tool .button.delete.enabled').click();
    }
}
export default GraphToolTile;