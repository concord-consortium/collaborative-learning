class ImageTool{
    getImageToolControl(){
        return cy.get('.image-tool.editable > .image-tool-controls')
    }
    getImageURLTextField(){
        return cy.get('.image-url.editing')
    }
    imageChooseFileButton(){
        return ('.image-file.editing:first')
    }
    getImageToolImage(){
        return cy.get('.image-tool.editable > .image-tool-image')
    }
}

export default ImageTool;