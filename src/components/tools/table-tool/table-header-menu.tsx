import * as React from "react";
import NewColumnDialog from "./new-column-dialog";
import RenameColumnDialog from "./rename-column-dialog";
import { SetTableNameDialog } from "./set-table-name-dialog";
import { IDataSet } from "../../../models/data/data-set";
import { GridApi } from "@ag-grid-community/core";
import { Icon, Menu, Popover, Position, MenuDivider, MenuItem, Alert, Intent } from "@blueprintjs/core";
import { listenForTableEvents } from "../../../models/tools/table/table-events";
import UpdateExpressionDialog from "./update-expression-dialog";

export interface IMenuItemFlags {
  addAttribute?: boolean;
  addCase?: boolean;
  addRemoveDivider?: boolean;
  setTableName?: boolean;
  renameAttribute?: boolean;
  removeAttribute?: boolean;
  removeCases?: boolean;
  unlinkGeometry?: boolean;
}

export interface IProps {
  api: GridApi;
  expressions?: Map<string, string>;
  rawExpressions?: Map<string, string>;
  dataSet?: IDataSet;
  readOnly?: boolean;
  itemFlags?: IMenuItemFlags;
  onSetTableName: (name: string) => void;
  onNewAttribute: (name: string) => void;
  onRenameAttribute: (id: string, name: string) => void;
  onUpdateExpression: (id: string, expression: string, rawExpression: string) => void;
  onNewCase: () => void;
  onRemoveAttribute: (id: string) => void;
  onRemoveCases: (ids: string[]) => void;
  onGetLinkedGeometries: () => string[];
  onUnlinkGeometry: () => void;
  onSampleData?: (name: string) => void;
}

interface IState {
  isNewAttributeDialogOpen?: boolean;
  isTableNameDialogOpen?: boolean;
  tableName?: string;
  isRenameAttributeDialogOpen?: boolean;
  renameAttributeId?: string;
  renameAttributeName?: string;

  isUpdateExpressionDialogOpen?: boolean;
  updateExpressionAttributeId?: string;
  showInvalidVariableAlert?: boolean;
}

export class TableHeaderMenu extends React.Component<IProps, IState> {

  public state: IState = {};

  constructor(props: IProps) {
    super(props);

    listenForTableEvents((event) => {
      switch (event.type) {
        case "rename-column":
          this.setState({
            isRenameAttributeDialogOpen: true,
            renameAttributeId: event.id,
            renameAttributeName: event.name
          });
          break;
        case "add-column":
          this.setState({
            isNewAttributeDialogOpen: true
          });
          break;
        default:
          break;
      }
    });
  }

  public buildColumnNameValidator(columnHasExpression: boolean): (name: string) => string | undefined {
    return (name: string) => {
      if (!name) {
        return "Column must have a non-empty name";
      }
      // TODO: Expand valid variable names to include additional character sets
      if (columnHasExpression && !/^[a-z]+$/i.test(name)) {
        return "Columns with expressions must have single-word names";
      }
    };
  }

  public render() {
    if (this.props.readOnly) return null;
    return (
      <div>
        <Popover
          popoverClassName="nc-table-menu-popover"
          content={this.renderMenu()}
          position={Position.BOTTOM_LEFT}
          autoFocus={false}
        >
          <Icon icon="menu" />
        </Popover>
        <SetTableNameDialog
          isOpen={!!this.state.isTableNameDialogOpen}
          tableName={this.props.dataSet?.name}
          onSetTableName={this.props.onSetTableName}
          onClose={this.handleCloseTableNameDialog} />
        <NewColumnDialog
          isOpen={!!this.state.isNewAttributeDialogOpen}
          onNewAttribute={this.props.onNewAttribute}
          onClose={this.closeNewAttributeDialog}
        />
        {this.renderRenameColumnDialog()}
        {this.renderUpdateExpressionDialog()}
        {this.renderInvalidVariableAlert()}
      </div>
    );
  }

  private renderRenameColumnDialog() {
    const { expressions } = this.props;
    const nonNullExpression = !!expressions && Array.from(expressions.values()).some(expr => !!expr);
    return this.state.isRenameAttributeDialogOpen && this.state.renameAttributeId
            ? <RenameColumnDialog
                id={this.state.renameAttributeId}
                isOpen={!!this.state.isRenameAttributeDialogOpen}
                onRenameAttribute={this.handleRenameAttributeCallback}
                onClose={this.closeRenameAttributeDialog}
                name={this.state.renameAttributeName || ""}
                columnNameValidator={this.buildColumnNameValidator(nonNullExpression)}
              />
            : null;
  }

  private renderUpdateExpressionDialog() {
    const id = this.state.updateExpressionAttributeId;
    const { dataSet, expressions, rawExpressions } = this.props;
    if (!id || !dataSet || !this.state.isUpdateExpressionDialogOpen) return null;
    const xName = dataSet.attributes[0].name;
    const yName = dataSet.attrFromID(id).name;
    return <UpdateExpressionDialog
            id={id}
            isOpen={true}
            onUpdateExpression={this.handleUpdateExpressionCallback}
            onClose={this.closeUpdateExpressionDialog}
            expression={expressions && expressions.get(id) || ""}
            rawExpression={rawExpressions && rawExpressions.get(id) || ""}
            xName={xName}
            yName={yName}
          />;
  }

  private openNewAttributeDialog = () => {
    this.setState({ isNewAttributeDialogOpen: true });
  }

  private closeNewAttributeDialog = () => {
    this.setState({ isNewAttributeDialogOpen: false });
  }

  private closeRenameAttributeDialog = () => {
    this.setState({ isRenameAttributeDialogOpen: false });
  }

  private handleRenameAttributeCallback = (id: string, name: string) => {
    this.props.onRenameAttribute(id, name);
    this.closeRenameAttributeDialog();
  }

  private handleRenameAttribute = (evt: React.MouseEvent<HTMLElement>, attrID: string, name: string) => {
    this.setState({
      isRenameAttributeDialogOpen: true,
      renameAttributeId: attrID,
      renameAttributeName: name
    });
  }

  private handleSetTableName = () => {
    this.setState({ isTableNameDialogOpen: true });
  }

  private handleCloseTableNameDialog = () => {
    this.setState({ isTableNameDialogOpen: false });
  }

  private closeUpdateExpressionDialog = () => {
    this.setState({ isUpdateExpressionDialogOpen: false });
  }

  private handleUpdateExpressionCallback = (id: string, expression: string, rawExpression: string) => {
    this.props.onUpdateExpression(id, expression, rawExpression);
    this.closeUpdateExpressionDialog();
  }

  private handleUpdateExpression = (evt: React.MouseEvent<HTMLElement>) => {
    const { dataSet } = this.props;
    const xAttr = dataSet && dataSet.attributes[0];
    const yAttr = dataSet && dataSet.attributes[1];
    if (xAttr && yAttr) {
      if (this.buildColumnNameValidator(true)(xAttr.name) || this.buildColumnNameValidator(true)(yAttr.name)) {
        this.setState({
          showInvalidVariableAlert: true
        });
      } else {
        this.setState({
          isUpdateExpressionDialogOpen: true,
          updateExpressionAttributeId: yAttr.id
        });
      }
    }
  }

  private handleNewCase = () => {
    if (this.props.onNewCase) {
      this.props.onNewCase();
    }
  }

  private handleRemoveAttribute = (evt: React.MouseEvent<HTMLElement>, attrID: string) => {
    if (this.props.onRemoveAttribute) {
      this.props.onRemoveAttribute(attrID);
    }
  }

  private getSelectedRowNodes() {
    return this.props.api && this.props.api.getSelectedNodes();
  }

  private getSelectedRowNodeCount() {
    const selectedNodes = this.getSelectedRowNodes();
    return selectedNodes ? selectedNodes.length : 0;
  }

  private handleRemoveCases = (evt: React.MouseEvent<HTMLElement>) => {
    if (this.props.onRemoveCases) {
      const selectedRows = this.getSelectedRowNodes() || [];
      this.props.onRemoveCases(selectedRows.map(row => row.id));
    }
  }

  private handleUnlinkGeometry = () => {
    this.props.onUnlinkGeometry && this.props.onUnlinkGeometry();
  }

  private renderAttributeSubMenuItems(onClick: (evt: React.MouseEvent<HTMLElement>,
                                                attrID: string, name?: string) => void) {
    if (!this.props.dataSet || !this.props.dataSet.attributes.length) { return null; }
    return this.props.dataSet.attributes.map((attr) => {
      function handleClick(evt: React.MouseEvent<HTMLElement>) {
        return onClick(evt, attr.id, attr.name);
      }
      return (
        <MenuItem
          text={attr.name}
          data-test={`attr-menu-item`}
          key={attr.id}
          onClick={handleClick}
        />
      );
    });
  }

  private renderInvalidVariableAlert() {
    const { showInvalidVariableAlert } = this.state;
    if (!showInvalidVariableAlert) return;

    return (
      <Alert
          confirmButtonText="OK"
          icon="error"
          intent={Intent.DANGER}
          isOpen={true}
          onClose={this.handleCloseInvalidVariableAlert}
          canEscapeKeyCancel={true}
          key={"invalid-variable-alert"}
      >
        <p>
          The names of all columns must be a single word to create expressions.
        </p>
      </Alert>
    );
  }

  private handleCloseInvalidVariableAlert = () => {
    this.setState({ showInvalidVariableAlert: false });
  }

  private renderMenu() {
    const itemFlags = this.props.itemFlags || {};
    const addColumn = itemFlags.addAttribute !== false
                        ? <MenuItem
                            icon="add-column-right"
                            text={`New Column...`}
                            onClick={this.openNewAttributeDialog}
                          />
                        : null;
    const addRow = itemFlags.addCase !== false
                      ? <MenuItem
                          icon="add-row-bottom"
                          text={`New Row...`}
                          data-test={`new-row-menu-item`}
                          onClick={this.handleNewCase}
                        />
                      : null;
    const addRemoveDivider = itemFlags.addRemoveDivider && <MenuDivider />;
    const setTableName = itemFlags.setTableName &&
                          <MenuItem
                            icon="label"
                            text={`Set Title...`}
                            data-test={`set-title-menu-item`}
                            disabled={!this.props.dataSet}
                            onClick={this.handleSetTableName} />;
    const renameColumn = itemFlags.renameAttribute !== false
                          ? <MenuItem
                              icon="text-highlight"
                              text={`Rename Column...`}
                              data-test={`rename-column-menu-item`}
                              disabled={!this.props.dataSet || !this.props.dataSet.attributes.length}
                            >
                              {this.renderAttributeSubMenuItems(this.handleRenameAttribute)}
                            </MenuItem>
                          : null;
    const updateExpression = itemFlags.renameAttribute !== false
                            ? <MenuItem
                                icon="text-highlight"
                                text={`Set Expression...`}
                                data-test={`set-expression-menu-item`}
                                disabled={!this.props.dataSet || this.props.dataSet.attributes.length < 2}
                                onClick={this.handleUpdateExpression}
                              />
                            : null;
    const removeColumn = itemFlags.removeAttribute !== false
                          ? <MenuItem
                              icon="remove-column"
                              text={`Remove Column...`}
                              data-test={`remove-column-menu-item`}
                              disabled={!this.props.dataSet || !this.props.dataSet.attributes.length}
                            >
                              {this.renderAttributeSubMenuItems(this.handleRemoveAttribute)}
                            </MenuItem>
                          : null;
    const removeRows = itemFlags.removeCases !== false
                          ? <MenuItem
                              icon="remove-row-bottom"
                              text={`Remove Rows`}
                              data-test={`remove-row-menu-item`}
                              onClick={this.handleRemoveCases}
                              disabled={!this.getSelectedRowNodeCount()}
                            />
                          : null;
    const linkedGeometryCount = this.props.onGetLinkedGeometries
                                  ? this.props.onGetLinkedGeometries().length
                                  : 0;
    const unlinkGeometry = itemFlags.unlinkGeometry !== false
                            ? <MenuItem
                                icon="th-disconnect"
                                text={`Unlink Geometry`}
                                data-test={`unlink-geometry-menu-item`}
                                onClick={this.handleUnlinkGeometry}
                                disabled={!linkedGeometryCount}
                              />
                            : null;
    return (
      <Menu>
        {addColumn}
        {addRow}
        {addRemoveDivider}
        {setTableName}
        {renameColumn}
        {removeColumn}
        {removeRows}
        {updateExpression}
        {unlinkGeometry}
      </Menu>
    );
  }

}
