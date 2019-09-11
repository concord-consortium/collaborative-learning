import LeftNav from '../../support/elements/LeftNav'
import Canvas from '../../support/elements/Canvas'
import TextToolTile from '../../support/elements/TextToolTile'

const leftNav = new LeftNav;
const canvas = new Canvas;
const textToolTile = new TextToolTile;

context('Text tool tile functionalities', function(){
    it('setup', function(){
        leftNav.openToWorkspace('Now What')
    })
    it('adds text tool and types Hello World', function(){
        canvas.addTextTile();
        textToolTile.enterText('Hello World');
        textToolTile.getTextTile().last().should('contain', 'Hello World');
    });
    it('clicks the same text field and allows user to edit text', function(){
        textToolTile.getTextTile().last().focus().click();
        textToolTile.addText('Adding more text to see if it gets added.');
        textToolTile.addText('Adding more text to delete');
        textToolTile.deleteText('{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}');
    });
})