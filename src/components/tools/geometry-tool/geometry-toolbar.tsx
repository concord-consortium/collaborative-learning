// tslint:disable:jsx-no-lambda
import * as React from "react";
import { BaseComponent, IBaseProps } from "../../base";
import { observer, inject } from "mobx-react";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import * as classNames from "classnames";

interface IProps extends IBaseProps {
  model: ToolTileModelType;
  onAngleLabelClick: () => void;
  isAngleLabelDisabled: boolean;
  isAngleLabelSelected: boolean;
  onDeleteClick: () => void;
  isDeleteDisabled: boolean;
  onDuplicateClick: () => void;
  isDuplicateDisabled: boolean;
}
interface IState {
  showSettings: boolean;
}

interface IRenderToolButtonParams {
  onClick?: () => void;
  selected: boolean;
  disabled: boolean;
  hidden: boolean;
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
          {this.renderToolButton("Select", "selection",
                                  { onClick: undefined,
                                    selected: false,
                                    disabled: false,
                                    hidden: true })}
          {this.renderToolButton("Point", "point",
                                  { onClick: undefined,
                                    selected: false,
                                    disabled: false,
                                    hidden: true })}
          {this.renderToolButton("Polygon", "polygon",
                                  { onClick: undefined,
                                    selected: false,
                                    disabled: false,
                                    hidden: true })}
          {this.renderToolButton("Duplicate", "duplicate",
                                  { onClick: this.props.onDuplicateClick,
                                    selected: false,
                                    disabled: this.props.isDuplicateDisabled,
                                    hidden: false })}
          {this.renderToolButton("Line Label", "line-label",
                                  { onClick: undefined,
                                    selected: false,
                                    disabled: false,
                                    hidden: true })}
          {this.renderToolButton("Angle Label", "angle-label",
                                  { onClick: this.props.onAngleLabelClick,
                                    selected: this.props.isAngleLabelSelected,
                                    disabled: this.props.isAngleLabelDisabled,
                                    hidden: false })}
          {this.renderToolButton("Movable Line", "movable-line",
                                  { onClick: undefined,
                                    selected: false,
                                    disabled: false,
                                    hidden: true })}
          {this.renderToolButton("Draw", "draw",
                                  { onClick: undefined,
                                    selected: false,
                                    disabled: false,
                                    hidden: true })}
          {this.renderToolButton("Text", "text",
                                  { onClick: undefined,
                                    selected: false,
                                    disabled: false,
                                    hidden: true })}
          {this.renderToolButton("Delete", "delete",
                                  { onClick: this.props.onDeleteClick,
                                    selected: false,
                                    disabled: this.props.isDeleteDisabled,
                                    hidden: false })}
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

  private renderToolButton = (toolName: string, toolClass: string, params: IRenderToolButtonParams) => {
    const buttonClass = classNames("button",
                                    toolClass,
                                    { selected: params.selected },
                                    { disabled: params.disabled },
                                    { enabled: !params.disabled }
                                  );
    if (!params.hidden) {
      return (
        <div className={buttonClass}
             title={toolName}
             onClick={params.onClick}
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
