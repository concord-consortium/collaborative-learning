const kGraphPixPerCoord = 18.33;
// determined by inspection
// const kGraphOriginFromCoordPix = { x: 20, y: 297 };
const kGraphOriginCoordPix = { x: 20, y: 263 };

function pointCoordsToPix(ptCoords, originPix) {
    return { x: originPix.x + ptCoords.x * kGraphPixPerCoord,
             y: originPix.y - ptCoords.y * kGraphPixPerCoord };
}

function pointPixToCoords(ptPix, originPix) {
    const x = Math.round((ptPix.x - originPix.x) / kGraphPixPerCoord);
    const y = Math.round((originPix.y - ptPix.y) / kGraphPixPerCoord);
    return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y }; // convert -0 to 0
}

class GraphToolTile{
    getOriginCoords() {
        return cy.get('.geometry-content.editable svg line')
            .then(lines => {
                const x = parseFloat(lines.eq(1).attr('x1'));
                const y = parseFloat(lines.eq(0).attr('y1'));
                return { x, y };
            });
    }
    transformFromCoordinate(axis, num){
        console.log(`transformFromCoordinate[${axis}]`, "coord:", num, "pix:", kGraphOriginCoordPix[axis] + num * kGraphPixPerCoord);
        return kGraphOriginCoordPix[axis] + num * kGraphPixPerCoord;
    }
    transformToCoordinate(axis, num){
        const coord = Math.round((num - kGraphOriginCoordPix[axis]) / kGraphPixPerCoord);
        const result = coord === 0 ? 0 : coord; // convert -0 to 0
        console.log(`transformToCoordinate[${axis}]`, "pix:", num, "coord:", result);
        return result;
    }
    getGraphTile(workspaceClass){
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .geometry-tool`);
    }
    getGraph(workspaceClass){
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .geometry-content`);
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
            return cy.get('.canvas-area .geometry-content .JXGtext').contains('x');
        }
        if(axis==='y') {
            return cy.get('.canvas-area .geometry-content .JXGtext').contains('y');
        }
    }
    getGraphPointCoordinates(index){ //This is the point coordinate text
        let origin;
        cy.get('.geometry-content.editable svg line')
            .then(lines => {
                origin = { x: lines.eq(1).attr('x1'), y: lines.eq(0).attr('y1') };
            });

        return (index > -1 ? this.getGraphPoint().eq(index) : this.getGraphPoint().last())
            .then(($point)=>{
                const ptPix = { x: parseFloat($point.attr('cx')),
                                y: parseFloat($point.attr('cy')) };
                const ptCoords = pointPixToCoords(ptPix, origin);
                return `(${ptCoords.x}, ${ptCoords.y})`;
            });
    }
    getGraphPointLabel(){ //This is the letter label for a point
        return cy.get('.geometry-content.editable .JXGtext');
    }
    getGraphPoint(){
        let origin;
        cy.get('.geometry-content.editable svg line')
            .then(lines => {
                origin = { x: lines.eq(1).attr('x1'), y: lines.eq(0).attr('y1') };
            });
        cy.get('.geometry-content.editable ellipse[display="inline"]')
            .each((pt, i) => {
                const ptPix = { x: parseFloat(pt.attr('cx')), y: parseFloat(pt.attr('cy')) };
                const ptCoords = pointPixToCoords(ptPix, origin);
                console.log(`${i}: (${ptCoords.x}, ${ptCoords.y})`);
            });
        return cy.get('.geometry-content.editable ellipse[display="inline"]');
    }
    getGraphPointAt(x, y){
        let origin;
        cy.get('.geometry-content.editable svg line')
            .then(lines => {
                origin = { x: lines.eq(1).attr('x1'), y: lines.eq(0).attr('y1') };
            });
        cy.get('.geometry-content.editable ellipse[display="inline"]')
            .then(pts => {
                for (let i = pts.length - 1; i >= 0; --i) {
                    const pt = Cypress.$(pts[i]);
                    const ptPix = { x: parseFloat(pt.attr('cx')), y: parseFloat(pt.attr('cy')) };
                    const ptCoords = pointPixToCoords(ptPix, origin);
                    if ((ptCoords.x === x) && (ptCoords.y === y)) {
                        // return the first matching point
                        return pt;
                    }
                }
                // no matching point
                return Cypress.$();
            });
        return cy.get('.geometry-content.editable ellipse[display="inline"]');
    }
    hoverGraphPoint(x,y){
        let transX=this.transformFromCoordinate('x', x),
        transY=this.transformFromCoordinate('y', y);

        this.getGraph().last()
            .trigger('mouseover',transX,transY);
    }
    selectGraphPoint(x,y){
        let transX=this.transformFromCoordinate('x', x),
            transY=this.transformFromCoordinate('y', y);

        this.getGraph().last().click(transX, transY, {force:true});
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
        this.getOriginCoords()
            .then(origin => {
                const ptClick = pointCoordsToPix({ x, y }, origin);
                this.getGraph().last().click(ptClick.x, ptClick.y, {force:true});
            });
    }
    getRotateTool(){
        return cy.get('.single-workspace .rotate-polygon-icon.enabled');
    }
    getGraphToolMenuIcon(){
        return cy.get('.geometry-menu-button');
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
