//each program block
class dfBlock{
    getBlocksNum(){
        return cy.get('.single-workspace .node')
    }
    getBlock(blockType){
        return cy.get('.single-workspace .node.'+blockType);
    }
    getBlockTitle(blockType){
        return cy.get('.single-workspace .node.'+blockType+' .node-title')
    }
    selectBlock(blockType, whichOne=0){
        this.getBlockTitle(blockType).eq(whichOne).trigger('pointerdown').trigger('pointerup')
    }
    getShowPlotButton(blockType){ //return a general locator instead of the show plot click because there may be multiples of the same plot
        return cy.get('.single-workspace .node.'+blockType+' .graph-button')
    }
    getPlotView(blockType){
        return cy.get('.single-workspace .node.'+blockType+' .node-graph canvas')
    }
    getInputNodesNum(blockType){
        return cy.get('.single-workspace .node.'+blockType+' .socket.input')
    }
    getInputNode(blockType,whichOne=0){
        return cy.get('.single-workspace .node.'+blockType+' .socket.input').eq(whichOne)
    }
    getInputNodeTextField(blockType,whichOne=0){
        return cy.get('.single-workspace .node.'+blockType+' .input-control .number-input').eq(whichOne)
    }
    getOutputNodesNum(blockType){
        return cy.get('.single-workspace .node.'+blockType+' .socket.output')
    }
    getOutputNode(blockType, whichOne=0){
        return cy.get('.single-workspace .node.'+blockType+' .socket.output').eq(whichOne)
    }
    moveBlock(blockType,whichOne=0, x,y) {
        cy.get('.single-workspace .node.'+blockType).eq(whichOne).parent()
        .invoke('attr','style',"position: absolute; touch-action: none; transform: translate("+x+"px, "+y+"px);")
    }
    connectBlocks(outputBlock, whichBlock=0, inputBlock, whichInput=0){
        this.getOutputNode(outputBlock, whichBlock).trigger('pointerdown',{force:true}).trigger('pointerup',{force:true});
        this.getInputNode(inputBlock,whichInput).trigger('pointerdown',{force:true}).trigger('pointerup',{force:true});
    }
    connectionLine(){
        return cy.get('.single-workspace .connection .main-path');
    }
    deleteBlock(blockType,whichOne=0){
        cy.get('.single-workspace .node.'+blockType).eq(whichOne).find('.close-node-button').click({force:true});
    }
    scrollBlockIntoView(block, whichOne=0){
        this.getBlockTitle(block).last().scrollIntoView({top: 50});
    }

    //Sensor block
    getSensorTypeListDropdown(){
        return cy.get('.single-workspace .node-select.sensor-type')
    }
    openSensorTypeListDropdown(){
        this.getSensorTypeListDropdown().click()
    }
    getSensorOptionList(){//gets the label element for list of sensors in dropdwon
        return cy.get('.single-workspace .node-select.sensor-type .label')
    }
    selectSensorType(ksensor){
        var sensor = new RegExp(`^(${ksensor})`,"g");
        this.openSensorTypeListDropdown();
        cy.get('.single-workspace .sensor-type .sensor-type-option').contains(sensor).click();
    }
    getSelectedSensorType(sensor){
        return cy.get('.single-workspace .sensor-type .sensor-type-option').contains(sensor);
    }
    getHubSensorComboListDropdown(){
        return cy.get('.single-workspace .sensor-select')
    }
    openHubSensorComboListDropdown(){
        this.getHubSensorComboListDropdown().click();
    }
    getHubSensorComboOptionList(){
        return cy.get('.single-workspace .sensor-select .sensor-type-option .label');
    }
    selectHubSensorCombo(hub){ //Don't have to open the dropdown list to select a hub
        this.openHubSensorComboListDropdown();
        this.getHubSensorComboOptionList().contains(hub).click();
    }
    getSensorValueTextField(){
        return cy.get('.single-workspace .sensor-value')
    }

    //Number block
    numberInputEl(whichOne=0){
        return ('.single-workspace .node.number .number-input:eq('+whichOne+')');
    }
    getNumberInput(whichOne=0){ //input text field
        return cy.get(this.numberInputEl(whichOne))
    }

    //Generator block
    getGeneratorTypeListDropdown(){
        return cy.get('.single-workspace .node.generator .generatorType')
    }
    openGeneratorTypeListDropdown(){
        this.getGeneratorTypeListDropdown().click();
    }
    selectGeneratorType(type){
        this.openGeneratorTypeListDropdown()
        cy.get('.single-workspace .node.generator .generatorType .option-list').contains(type).click();
    }
    getAmplitudeTextField(){
        return cy.get('.single-workspace .node.generator [title=amplitude] input')
    }
    enterAmplitude(amplitude){
        this.getAmplitudeTextField().type(amplitude)
    }
    getPeriodTextField(){
        return cy.get('.single-workspace .node.generator [title=period] input')
    }
    enterPeriod(period){
        this.getPeriodTextField().type(period)
    }
    getGeneratorValueTextField(){
        return cy.get('.single-workspace .node.generator [title=nodeValue] .value-container')
    }

    //Math block
    getMathOperatorDropdown(){
        return cy.get('.single-workspace .node.math .mathOperator');
    }
    openMathOperatorDropdown(){
        this.getMathOperatorDropdown().click();
    }
    selectMathOperator(operator){
        this.getMathOperatorDropdown().find('.option-list').contains(operator).click();
    }
    mathValueTextFieldEl(){
        return  '.single-workspace .node.math [title=nodeValue] .value-container'
    }
    getMathValueTextField(){
        return cy.get(this.mathValueTextFieldEl())
    }

    //Logic block
    getLogicOperatorDropdown(){
        return cy.get('.single-workspace .node.logic .logicOperator');
    }
    openLogicOperatorDropdown(){
        this.getLogicOperatorDropdown().click();
    }
    selectLogicOperator(operator){
        this.getLogicOperatorDropdown().find('.option-list .label').contains(operator).click();
    }
    getLogicValueTextField(){
        return cy.get('.single-workspace .node.logic [title=nodeValue] .value-container')
    }

    //Transform block
    getTransformOperatorDropdown(){
        return cy.get('.single-workspace .node.transform .transformOperator')
    }
    openTransformOperatorDropdown(){
        this.getTransformOperatorDropdown().click();
    }
    selectTransformOperator(operator){
        this.getTransformOperatorDropdown().find('.option-list').contains(operator).click({force:true});
        // cy.get('.single-workspace .node.transform .transformOperator .option-list').contains(operator).click();
    }
    getTransformValueTextField(){
        return cy.get('.single-workspace .node.transform [title=nodeValue] .value-container')
    }

    //Relay block
    getRelayListDropDown(){
        return cy.get('.single-workspace .node.relay .relay-select')
    }
    selectRelayOperator(hub){
        this.getRelayListDropDown().click().find('.label').contains(hub).click();
    }
    getRelayValueTextField(){
        return cy.get('.single-workspace .node.relay [title=nodeValue] .value-container')
    }

    //Data Storage Block
    storageNameTextFieldEl(){
        return '.single-workspace .node.data-storage [title=datasetName] input'
    }
    getStorageNameTextField(){
        return cy.get(this.storageNameTextFieldEl());
    }
    storageIntervalDropdownEl(){
        return'.single-workspace .node.data-storage [title=interval] .node-select.interval'
    }
    getStorageIntervalDropdown(){
        return cy.get(this.storageIntervalDropdownEl())
    }
    getStorageIntervalDropdownSelection(){
        return cy.get('.interval.selectable .label')
    }
    selectStorageIntervalTime(interval){
        this.getStorageIntervalDropdown().click();
        this.getStorageIntervalDropdownSelection().contains(interval).click();
    }
    storageSequenceTextFieldEl(sequenceNum=1){
        return '.single-workspace .node.data-storage [title=sequence'+sequenceNum+'] input'
    }
    getStorageSequenceTextField(sequenceNum=1){
        return cy.get(this.storageSequenceTextFieldEl(sequenceNum));
    }

    //Timer Block
    getTimeTextField(state){
        return cy.get('.single-workspace [title=time'+state+'] .number-input')
    }
    enterTimerDuration(state, time){ //state=['On','Off']
        this.getTimeTextField(state).type('{backspace}'+time)
    }
    getTimerOutputState(){
        return cy.get('.output-container.timer .value-container.timer')
    }
}
export default dfBlock;