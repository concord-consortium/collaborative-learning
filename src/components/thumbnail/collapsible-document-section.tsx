import React, { useState } from "react";
import ArrowIcon from "../../assets/icons/arrow/arrow.svg";
import NotSharedIcon from "../../assets/icons/share/not-share.svg";

import "./tab-panel-documents-section.sass";
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
      <div className="section-collapse-toggle" onClick={handleSectionToggle}>
        <div className="teacher-class-info">
          {userName} / {classNameStr}
        </div>
        <ArrowIcon className={`arrow-icon ${isOpen ? "open": ""}`} />
      </div>
      { isOpen &&
        <div className="list">
          <FauxDocumentThumbnail label={"Planning Document"}/>
          <FauxDocumentThumbnail  label={"Problem Document"} />
        </div>
      }

    </div>
  );
};

interface INewDocumentThumbnailProps {
  label: string;
}
const FauxDocumentThumbnail: React.FC<INewDocumentThumbnailProps> = ({ label }) => {
  const notShared=true;

  return (
    <div className="list-item not-shared" data-test="my-work-new-document" >
      { notShared
          ? <div className="not-shared">
              <NotSharedIcon className="not-shared-icon" />
            </div>
          : <div className="scaled-list-item-container new-document-button" >
              <div className="scaled-list-item"></div>
            </div>
      }
      <DocumentCaption captionText={label} />
    </div>
  );
};

/*
 * DocumentCaption
 */
interface IDocumentCaptionProps {
  captionText: string;
}

const DocumentCaption = (props: IDocumentCaptionProps) => {
  const { captionText } = props;
  return (
    <div className="footer">
      <div className="info">
        <div>{captionText}</div>
      </div>
    </div>
  );
};
