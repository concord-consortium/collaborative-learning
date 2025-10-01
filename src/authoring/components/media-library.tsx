import React, { useEffect, useMemo, useRef, useState } from "react";
import { IUnitFiles } from "../types";

import "./media-library.scss";

interface IProps {
  onClose: () => void;
  files: IUnitFiles;
  branch: string;
  unit: string;
}

const MediaLibrary: React.FC<IProps> = ({ onClose, files, branch, unit }) => {
  const [filter, setFilter] = useState("");
  const filterInputRef = useRef<HTMLInputElement | null>(null);

  const imageFileKeys = useMemo(() => {
    return Object.keys(files).filter(key => key.startsWith("images"));
  }, [files]);

  const filteredFileKeys = useMemo(() => {
    if (!filter) return imageFileKeys;
    return imageFileKeys.filter(key => key.toLowerCase().includes(filter.toLowerCase()));
  }, [imageFileKeys, filter]);

  const baseUrl = useMemo(() => {
    return `https://raw.githubusercontent.com/concord-consortium/clue-curriculum/refs/heads/${branch}/curriculum/${unit}/`;
  }, [branch, unit]);
  const [selectedKey, setSelectedKey] = useState<string | undefined>(imageFileKeys[0]);

  const imageUrl = selectedKey ? `${baseUrl}${selectedKey}` : undefined;

  useEffect(() => {
    if (imageFileKeys.length > 0 && !selectedKey) {
      setSelectedKey(imageFileKeys[0]);
    }
  }, [imageFileKeys, selectedKey]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleClearFilter = () => {
    setFilter("");
    filterInputRef.current?.focus();
  };

  return (
    <div className="media-library-lightbox">
      <div className="media-library-titlebar">
        <span>Media Library</span>
        <button className="media-library-close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="media-library-content-split">
        <div className="media-library-list">
          <div className="media-library-filter-row">
            <input
              type="text"
              className="media-library-filter-input"
              placeholder="Filter images by filename..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              autoFocus
              ref={filterInputRef}
            />
            {filter && (
              <button
                type="button"
                aria-label="Clear filter"
                className="media-library-clear-btn"
                onClick={handleClearFilter}
              >
                ×
              </button>
            )}
          </div>
          {filteredFileKeys.length > 0 && (
            <div className="media-library-image-grid">
              {filteredFileKeys.map(key => (
                <div
                  key={key}
                  className={"media-library-image-thumb" + (key === selectedKey ? " selected" : "")}
                  onClick={() => setSelectedKey(key)}
                  title={key}
                >
                  <img
                    src={`${baseUrl}${key}`}
                    alt={key}
                    loading="lazy"
                    className="media-library-thumb-img"
                  />
                </div>
              ))}
            </div>
          )}
          {filteredFileKeys.length === 0 && (
            <div className="media-library-no-images">No images match the filter.</div>
          )}
        </div>
        <div className="media-library-preview">
          {imageUrl ? (
            <>
              <img src={imageUrl} alt={selectedKey} className="media-library-preview-img" />
              <div className="media-library-preview-filename">{selectedKey}</div>
              <button
                className="media-library-select-btn"
                onClick={() => {
                  if (selectedKey) {
                    try {
                      navigator.clipboard.writeText(`curriculum/${unit}/${selectedKey}`);
                    } catch (e) {
                      alert(`Failed to copy to clipboard: ${e}`);
                    }
                    onClose();
                  }
                }}
              >
                Select
              </button>
            </>
          ) : (
            <div className="media-library-no-preview">No preview available</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaLibrary;
