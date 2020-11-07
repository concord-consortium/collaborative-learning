class ImageToolTile{
    getImageTile(workspaceClass){
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .image-tool`);
    }
    imageChooseFileButton(){
        return ('.toolbar-button.image-upload input');
    }
    getImageToolImage(){
        return cy.get('.image-tool.editable > .image-tool-image');
    }
}

export default ImageToolTile;
