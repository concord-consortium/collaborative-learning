class ImageToolTile{
    getImageTile(workspaceClass){
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .image-tool`);
    }
    imageChooseFileButton(){
        return ('.toolbar-button.image-upload input');
    }
    getImageToolImage(){
        return cy.get('.image-tool.editable .image-tool-image');
    }
    getImageToolTile(workspaceClass) {
        return cy.get('.image-tool-tile');
    }
    getTileTitle(workspaceClass){
        return cy.get(`${workspaceClass || ".primary-workspace"} .editable-tile-title-text`);
    }
    getImageTileTitle(workspaceClass){
        return cy.get(`${workspaceClass || ".primary-workspace"} .editable-tile-title`);
    }
}

export default ImageToolTile;
