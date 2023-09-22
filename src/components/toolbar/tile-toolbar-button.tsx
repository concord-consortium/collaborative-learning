import React from "react";

interface TileToolbarButtonProps {
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  onClick: (e: React.MouseEvent) => void;
}

export const TileToolbarButton =
  function({Icon, onClick }: TileToolbarButtonProps) {
    /**
     * A generic, simple button that can go on a tile toolbar.
     */

    return (
        <button onClick={onClick}>
          <Icon />
        </button>);
  };
