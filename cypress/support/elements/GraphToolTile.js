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
        return cy.get('.canvas-area > .canvas > .document-content > .tile-row >  .tool-tile > .geometry-size-me > .geometry-tool');
    }

    getGraphPointText(){ //This is the point coordinate text
        return cy.get('.geometry-tool.editable > .JXGinfobox');
    }

    getGraphPointLabel(){ //This is the letter label for a point
        return cy.get('.geometry-tool.editable > .JXGtext');
    }

    getGraphPoint(){
        return cy.get('.geometry-tool.editable > svg > g > ellipse');
    }
    selectGraphPoint(x,y){
        let transX=this.transformCoordinate('x', x),
            transY=this.transformCoordinate('y', y);

        this.getGraphTile().last().click(transX,transY, {force:true});
    }

    getGraphPointID(){
        let pointId='';
         cy.get('.geometry-tool.editable > svg > g > ellipse').last()
            .then(($el)=>{
                return $el.attr('id');
            }).then((id)=>{
                pointId=id;
                cy.log('in getGraphPointId, pointId: '+pointId);
         });
         return pointId;

    }
    getGraphPolygon(){
        return cy.get('.geometry-tool.editable > svg > g > polygon');
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
        this.getGraphToolMenuIcon().click();
        cy.get('.bp3-text-overflow-ellipsis').contains('Show Angle').click();
    }
    hideAngle(){
        this.getGraphToolMenuIcon().click();
        cy.get('.bp3-text-overflow-ellipsis').contains('Hide Angle').click();
    }
}
export default GraphToolTile;