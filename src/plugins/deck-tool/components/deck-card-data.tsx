import React from "react";

export const DeckCardData: React.FC = ({ children }) => {
  return (
    <div className="data-deck-card-data" key="data-area">
        { children }
    </div>
  );
};
