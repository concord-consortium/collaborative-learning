const graphUnit=18.3;

class GraphToolTile{
    transformCoordinate(axis, num){
        if (axis=='x'){
            return (num+1)*18.3;
        }
        if (axis=='y'){
            return 320-((num+1.2)*18.3);
        }
    }

    getBottomNavExpandedSpace(){
        return cy.get('.bottom-nav.expanded');
    }

    getGraphTile(){
        return cy.get('.canvas-area .geometry-content');
    }

    getGraphPointText(){ //This is the point coordinate text
        return cy.get('.geometry-content.editable .JXGinfobox');
    }

    getGraphPointLabel(){ //This is the letter label for a point
        return cy.get('.geometry-content.editable .JXGtext');
    }

    getGraphPoint(){
        return cy.get('.geometry-content.editable ellipse');
    }
    selectGraphPoint(x,y){
        let transX=this.transformCoordinate('x', x),
            transY=this.transformCoordinate('y', y);

        this.getGraphTile().last().click(transX,transY, {force:true});
    }

    getGraphPointID(){
        let pointId='';
         cy.get('.geometry-content.editable ellipse').last()
            .then(($el)=>{
                return $el.attr('id');
            }).then((id)=>{
                pointId=id;
                cy.log('in getGraphPointId, pointId: '+pointId);
         });
         return pointId;

    }
    getGraphPolygon(){
        return cy.get('.geometry-content.editable polygon');
    }

    addPointToGraph(x,y){
        let transX=this.transformCoordinate('x', x),
            transY=this.transformCoordinate('y', y);

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