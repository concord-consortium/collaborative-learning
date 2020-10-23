import React from "react";
import { Color, DrawingContentModelType } from "../../../models/tools/drawing/drawing-content";

interface IProps {
  drawingContent: DrawingContentModelType;
  colors: Color[];
  onStrokeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onFillChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onStrokeDashArrayChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onStrokeWidthChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

export const DrawingSettingsView: React.FC<IProps> = ({
              drawingContent, colors,
              onStrokeChange, onFillChange, onStrokeDashArrayChange, onStrokeWidthChange
            }: IProps) => {
  const {stroke, fill, strokeDashArray, strokeWidth} = drawingContent;
  const pluralize = (text: string, count: number) => count === 1 ? text : `${text}s`;
  return (
    <div className="settings">
      <div className="title"><span className="icon icon-menu" /> Settings</div>
      <form>
        <div className="form-group">
          <label htmlFor="stroke">Color</label>
          <select value={stroke} name="stroke" onChange={onStrokeChange}>
            {colors.map((color, index) => <option value={color.hex} key={index}>{color.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="fill">Fill</label>
          <select value={fill} name="fill" onChange={onFillChange}>
            <option value="none" key="none">None</option>
            {colors.map((color, index) => <option value={color.hex} key={index}>{color.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="strokeDashArray">Stroke</label>
          <select value={strokeDashArray} name="strokeDashArray"
              onChange={onStrokeDashArrayChange}>
            <option value="">Solid</option>
            <option value="dotted">Dotted</option>
            <option value="dashed">Dashed</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="strokeWidth">Thickness</label>
          <select value={strokeWidth} name="strokeWidth" onChange={onStrokeWidthChange}>
            {[1, 2, 3, 4, 5].map((_strokeWidth) => {
              return (
                <option value={_strokeWidth} key={_strokeWidth}>
                  {_strokeWidth} {pluralize("pixel", _strokeWidth)}
                </option>
              );
            })}
          </select>
        </div>
      </form>
    </div>
  );
};
