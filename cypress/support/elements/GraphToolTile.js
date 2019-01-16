class GraphToolTile{

    getBottomNavExpandedSpace(){
        return cy.get('.bottom-nav.expanded');
    }

    getGraphTile(){
        return cy.get('.canvas-area > .canvas > .document-content > .tile-row >  .tool-tile > .geometry-size-me > .geometry-tool');
    }

    getGraphPointText(){
        return cy.get('.geometry-tool.editable > .JXGinfobox');
    }

    getGraphPoint(){
        return cy.get('.geometry-tool.editable > svg > g > ellipse');
    }

    getGraphPointID(){
         cy.get('.geometry-tool.editable > svg > g > ellipse').last()
            .then(($el)=>{
                return $el.attr('id');
            });
    }
    getGraphPolygon(){
        return cy.get('.geometry-tool.editable > svg > g > polygon');
    }

    addPointToGraph(x,y){
        this.getGraphTile().last().click(x,y, {force:true});
    }

    getRotateTool(){
        return cy.get('.rotate-polygon-icon.enabled');
    }


}
export default GraphToolTile;