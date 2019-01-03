import * as React from "react";
import NewColumnDialog from "./new-column-dialog";
import RenameColumnDialog from "./rename-column-dialog";
import { IDataSet } from "../../../models/data/data-set";
import { GridApi } from "ag-grid-community";
import { Icon, Menu, Popover, Position, MenuDivider, MenuItem } from "@blueprintjs/core";
import { listenForTableEvents } from "../../../models/tools/table/table-events";

export interface IMenuItemFlags {
  addAttribute?: boolean;
  addCase?: boolean;
  addRemoveDivider?: boolean;
  renameAttribute?: boolean;
  removeAttribute?: boolean;
  removeCases?: boolean;
}

interface IProps {
  api: GridApi;
  dataSet?: IDataSet;
  readOnly?: boolean;
  itemFlags?: IMenuItemFlags;
  onNewAttribute: (name: string) => void;
  onRenameAttribute: (id: string, name: string) => void;
  onNewCase: () => void;
  onRemoveAttribute: (id: string) => void;
  onRemoveCases: (ids: string[]) => void;
  onSampleData?: (name: string) => void;
}

interface IState {
  isNewAttributeDialogOpen: boolean;
  isRenameAttributeDialogOpen: boolean;
  renameAttributeId: string;
  renameAttributeName: string;
}

export class TableHeaderMenu extends React.Component<IProps, IState> {

  constructor(props: IProps) {
    super(props);

    this.state = {
      isNewAttributeDialogOpen: false,
      isRenameAttributeDialogOpen: false,
      renameAttributeId: "",
      renameAttributeName: ""
    };

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
        <NewColumnDialog
          isOpen={this.state.isNewAttributeDialogOpen}
          onNewAttribute={this.props.onNewAttribute}
          onClose={this.closeNewAttributeDialog}
        />
        <RenameColumnDialog
          id={this.state.renameAttributeId}
          isOpen={this.state.isRenameAttributeDialogOpen}
          onRenameAttribute={this.handleRenameAttributeCallback}
          onClose={this.closeRenameAttributeDialog}
          name={this.state.renameAttributeName}
        />
      </div>
    );
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
          key={attr.id}
          onClick={handleClick}
        />
      );
    });
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
                          onClick={this.handleNewCase}
                        />
                      : null;
    const addRemoveDivider = itemFlags.addRemoveDivider !== false
                              ? <MenuDivider />
                              : null;
    const renameColumn = itemFlags.renameAttribute !== false
                          ? <MenuItem
                              icon="text-highlight"
                              text={`Rename Column...`}
                              disabled={!this.props.dataSet || !this.props.dataSet.attributes.length}
                            >
                              {this.renderAttributeSubMenuItems(this.handleRenameAttribute)}
                            </MenuItem>
                          : null;
    const removeColumn = itemFlags.removeAttribute !== false
                          ? <MenuItem
                              icon="remove-column"
                              text={`Remove Column...`}
                              disabled={!this.props.dataSet || !this.props.dataSet.attributes.length}
                            >
                              {this.renderAttributeSubMenuItems(this.handleRemoveAttribute)}
                            </MenuItem>
                          : null;
    const removeRows = itemFlags.removeCases !== false
                          ? <MenuItem
                              icon="remove-row-bottom"
                              text={`Remove Rows`}
                              onClick={this.handleRemoveCases}
                              disabled={!this.getSelectedRowNodeCount()}
                            />
                          : null;
    return (
      <Menu>
        {addColumn}
        {addRow}
        {addRemoveDivider}
        {renameColumn}
        {removeColumn}
        {removeRows}
      </Menu>
    );
  }

}
