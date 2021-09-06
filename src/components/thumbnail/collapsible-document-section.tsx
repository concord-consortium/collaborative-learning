import React, { useState } from "react";
import ArrowIcon from "../../assets/icons/arrow/arrow.svg";

import "./collapsible-document-section.scss";

interface IProps {
  userName: string;
  classNameStr: string;
}

export const CollapsibleDocumentsSection: React.FC<IProps> = ({userName, classNameStr}) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleSectionToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="collapsible-documents-section">
      <div className={`section-collapse-toggle ${isOpen ? open: ""}`} onClick={handleSectionToggle}>
        <div className="teacher-class-info">
          {userName} / {classNameStr}
        </div>
        <ArrowIcon className={`arrow-icon ${isOpen ? open: ""}`} />
      </div>
      { isOpen &&
        <div className="documents">
          documents
        </div>
      }

    </div>
  );

};
