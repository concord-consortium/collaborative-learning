import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "./modal";
import { useCurriculum } from "../hooks/use-curriculum";
import { useAuthoringApi } from "../hooks/use-authoring-api";
import { useAuthoringPreview } from "../hooks/use-authoring-preview";
import { sanitizeFileName } from "../utils/sanitize-filename";

import "./media-library.scss";

interface IProps {
  onClose: () => void;
}

const MediaLibrary: React.FC<IProps> = ({ onClose }) => {
  const { files, branch, unit } = useCurriculum();
  const api = useAuthoringApi();
  const authoringPreview = useAuthoringPreview();
  const [filter, setFilter] = useState("");
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<"images" | "upload">("images");
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadingFileDataUrl, setUploadingFileDataUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<"uploading" | "completed" | "error" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sanitizedName, setSanitizedName] = useState<string | null>(null);

  const imageFileKeys = useMemo(() => {
    return Object.keys(files ?? {}).filter(key => key.startsWith("images"));
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

  const resetUpload = useCallback(() => {
    setUploadingFileDataUrl(null);
    setUploadingFile(null);
    setUploadProgress(null);
    setErrorMessage(null);
    setSanitizedName(null);
  }, []);

  // Cleanup function to reset upload state when component unmounts
  useEffect(() => {
    return () => resetUpload();
  }, [resetUpload]);

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

  const handleClearFilter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setFilter("");
    filterInputRef.current?.focus();
  };

  const handleUpload = (file: File) => {
    resetUpload();

    if (!branch || !unit) {
      setUploadProgress("error");
      setErrorMessage("Branch or unit is not defined");
      return;
    }

    const sanitized = sanitizeFileName(file.name);
    setSanitizedName(sanitized);

    // Overwrite check — only warn when sanitization changed the name and it collides
    // (imageFileKeys are decoded in use-curriculum.tsx)
    const existingKey = `images/${sanitized}`;
    if (sanitized !== file.name && imageFileKeys.includes(existingKey)) {
      const confirmed = window.confirm(
        `The filename "${file.name}" was sanitized to "${sanitized}", ` +
        `which matches an existing image. Overwrite it?`
      );
      if (!confirmed) {
        resetUpload();
        return;
      }
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      if (!reader.result) {
        setUploadProgress("error");
        setErrorMessage(reader.error?.message ?? "Failed to read file");
        return;
      }

      const base64Url = reader.result?.toString() ?? "";
      const base64Match = /^data:.*;base64,(.*)$/.exec(base64Url);
      const base64String = base64Match?.[1];
      if (!base64String) {
        setUploadProgress("error");
        setErrorMessage("Failed to encode file as base64");
        return;
      }

      setUploadingFile(file);
      setUploadingFileDataUrl(base64Url);
      setUploadProgress("uploading");

      try {
        const response = await api.post("/putImage", {branch, unit}, {
          image: base64String,
          fileName: sanitized
        });
        if (response.success) {
          setUploadProgress("completed");
          authoringPreview.reloadAllPreviews();
        } else {
          setUploadProgress("error");
          setErrorMessage(response.error ?? "Upload failed");
        }
      } catch (error) {
        console.error("Upload failed:", error);
        setUploadProgress("error");
        setErrorMessage(error instanceof Error ? error.message : "Upload failed");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetUpload = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    resetUpload();
  };

  const renderImageListTabContent = () => {
    return (
      <div className="media-library-image-list">
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
    );
  };

  const renderUploadTabContent = () => {
    const showUploadInstructions = !uploadingFile;
    const showTryAgainButton = uploadProgress === "error" || uploadProgress === "completed";

    return (
      <div
        className="media-library-upload-area"
        tabIndex={0}
        onClick={e => {
          // Open file picker
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          input.onchange = (ev: Event) => {
            const target = ev.target as HTMLInputElement;
            const file = target.files?.[0];
            if (file) {
              handleUpload(file);
            }
          };
          input.click();
        }}
        onDragOver={e => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={e => {
          e.preventDefault();
          e.stopPropagation();
          const file = e.dataTransfer.files?.[0];
          if (file && file.type.startsWith("image/")) {
            handleUpload(file);
          }
        }}
      >
        {uploadingFileDataUrl && (
          <div className="media-library-upload-preview">
            <img src={uploadingFileDataUrl} alt={uploadingFile?.name} className="media-library-upload-img" />
            <div className="media-library-upload-filename">
              {sanitizedName ?? uploadingFile?.name}
            </div>
            {sanitizedName && sanitizedName !== uploadingFile?.name && (
              <div className="media-library-upload-renamed">
                Renamed from &quot;{uploadingFile?.name}&quot;
              </div>
            )}
            {uploadProgress === "uploading" && (
              <div className="media-library-upload-progress">Uploading...</div>
            )}
            {uploadProgress === "completed" && (
              <div className="media-library-upload-progress">Upload completed!</div>
            )}
            {uploadProgress === "error" && (
              <div className="media-library-upload-progress error">{errorMessage ?? "Upload failed."}</div>
            )}
          </div>
        )}
        {showUploadInstructions && (
          <div className="media-library-upload-instructions">
            Click here or drop an image here to upload.
          </div>
        )}
        {showTryAgainButton && (
          <div className="media-library-upload-try-again">
            <button onClick={handleResetUpload}>
              {uploadProgress === "completed" ? "Upload Another Image" : "Try Again"}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal onClose={onClose} title="Media Library">
      <div className="media-library-content">
        <div className="media-library-tabs">
          <button
            className={"media-library-tab" + (activeTab === "images" ? " active" : "")}
            onClick={() => setActiveTab("images")}
          >
            Existing Images
          </button>
          <button
            className={"media-library-tab" + (activeTab === "upload" ? " active" : "")}
            onClick={() => setActiveTab("upload")}
          >
            Upload New Image
          </button>
        </div>
        {activeTab === "images" ? renderImageListTabContent() : renderUploadTabContent()}
      </div>
    </Modal>
  );
};

export default MediaLibrary;
