// tslint:disable:jsx-no-lambda
import * as React from "react";
import { BaseComponent } from "../../base";
import { IBaseProps } from "../../base";
import { observer, inject } from "mobx-react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";

interface IProps extends IBaseProps {
  model: ToolTileModelType;
  onAngleLabelClick: () => void;
  angleLabelDisabled: boolean;
  angleLabelSelected: boolean;
  onDeleteClick: () => void;
  deleteDisabled: boolean;
  onDuplicateClick: () => void;
  duplicateDisabled: boolean;
}
interface IState {
  showSettings: boolean;
}

@inject("stores")
@observer
export class GeometryToolbarView extends BaseComponent<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      showSettings: false,
    };
  }
  public render() {
    return (
      <div className="geometry-toolbar" data-test="geometry-toolbar" onMouseDown={this.handleMouseDown}>
        <div className="toolbar-buttons">
          {this.renderToolHeader(false)}
          {this.renderToolButton("Select", "selection", null,
                                  false, false, true)}
          {this.renderToolButton("Point", "point", null,
                                  false, false, true)}
          {this.renderToolButton("Polygon", "polygon", null,
                                  false, false, true)}
          {this.renderToolButton("Duplicate", "duplicate", this.props.onDuplicateClick,
                                  false, this.props.duplicateDisabled, false)}
          {this.renderToolButton("Line Label", "line-label", null,
                                  false, false, true)}
          {this.renderToolButton("Angle Label", "angle-label", this.props.onAngleLabelClick,
                                  this.props.angleLabelSelected, this.props.angleLabelDisabled, false)}
          {this.renderToolButton("Movable Line", "movable-line", null,
                                  false, false, true)}
          {this.renderToolButton("Draw", "draw", null,
                                  false, false, true)}
          {this.renderToolButton("Text", "text", null,
                                  false, false, true)}
          {this.renderToolButton("Delete", "delete", this.props.onDeleteClick,
                                  false, this.props.deleteDisabled, false)}
        </div>
        { this.state.showSettings
          ? <div className="settings">
              <div className="settings-header">
                Settings
              </div>
            </div>
          : null
        }
      </div>
    );
  }

  private renderToolHeader = (showSettings: boolean) => {
    return (
      <div className="toolbar-header">
        <div className="graph-tile">
          <svg className="header-icon">
            <use xlinkHref="#icon-graph-tile"/>
          </svg>
        </div>
        {showSettings
          ? <div className="settings-button" title="Settings"
                 onClick={this.handleSettingsButton}>
              <svg className="icon">
                <use xlinkHref="#icon-settings"/>
              </svg>
            </div>
          : null
        }
      </div>
    );
  }

  private renderToolButton = (toolName: string, toolClass: string, handleClick: any,
                              selected: boolean, disabled: boolean, hidden: boolean) => {
    let buttonClass = "button " + toolClass + " ";
    buttonClass += selected ? "selected " : "";
    buttonClass += disabled ? "disabled " : "enabled ";
    if (!hidden) {
      return (
        <div className={buttonClass}
             title={toolName}
             onClick={handleClick}
        >
          <svg className="toolbar-icon">
            <use xlinkHref={"#icon-geometry-" + toolClass}/>
          </svg>
        </div>
      );
    } else {
      return (null);
    }
  }

  private handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const { model } = this.props;
    const { ui } = this.stores;
    ui.setSelectedTile(model);
  }

  private handleSettingsButton = () => {
    const showSettings = !this.state.showSettings;
    this.setState({
      showSettings
    });
  }

}
