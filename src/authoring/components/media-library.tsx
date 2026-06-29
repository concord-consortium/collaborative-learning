import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import Modal from "./modal";
import { useCurriculum } from "../hooks/use-curriculum";
import { useAuthoringApi } from "../hooks/use-authoring-api";
import { useAuthoringPreview } from "../hooks/use-authoring-preview";
import { sanitizeFileName } from "../utils/sanitize-filename";
import { describeUsagePath, formatLocation } from "../utils/image-usage-locations";

import "./media-library.scss";

interface IProps {
  onClose: () => void;
}

const fileNameFromKey = (key: string) => key.replace(/^images\//, "");

const MediaLibrary: React.FC<IProps> = ({ onClose }) => {
  const { files, branch, unit, unitConfig, teacherGuideConfig } = useCurriculum();
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

  // Image usage map: image key ("images/{file}") -> referencing content-file paths.
  const [usages, setUsages] = useState<Record<string, string[]> | null>(null);
  const [usagesLoading, setUsagesLoading] = useState(false);
  const [usageExpanded, setUsageExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  // True while a rename/delete request is in flight, to guard against double-submits.
  const [actionPending, setActionPending] = useState(false);

  const imageFileKeys = useMemo(() => {
    return Object.keys(files ?? {}).filter(key => key.startsWith("images/"));
  }, [files]);

  const refreshUsages = useCallback(async () => {
    if (!branch || !unit) return;
    setUsagesLoading(true);
    try {
      const response = await api.get("/getImageUsages", { branch, unit });
      if (response.success) {
        setUsages(response.usages ?? {});
      }
    } catch (error) {
      // Leave any prior usages in place; the manual refresh control can retry.
      console.error("Failed to load image usages:", error);
    } finally {
      setUsagesLoading(false);
    }
  }, [api, branch, unit]);

  // Load usages when the library opens (and whenever the unit changes).
  useEffect(() => {
    refreshUsages();
  }, [refreshUsages]);

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

  const selectedFileName = selectedKey ? fileNameFromKey(selectedKey) : undefined;
  const selectedRefs = selectedKey && usages ? usages[selectedKey] : undefined;
  const selectedUsageCount = selectedRefs?.length;

  // Reset per-image UI state whenever the selection changes. (The action message is intentionally
  // left alone here: a successful rename re-points the selection to the new key, and clearing it on
  // that change would swallow the "Renamed to…" confirmation. Manual selection clears it instead.)
  useEffect(() => {
    setUsageExpanded(false);
    setRenaming(false);
    setRenameError(null);
  }, [selectedKey]);

  // User-initiated selection (clicking a thumbnail): clear any lingering action message.
  const handleSelectKey = (key: string) => {
    setActionMessage(null);
    setSelectedKey(key);
  };

  const handleDeleteImage = async () => {
    if (actionPending) return;
    if (!branch || !unit || !selectedFileName || selectedUsageCount !== 0) return;
    const confirmed = window.confirm(
      `Delete "${selectedFileName}"? It is unused, but this removes it from the unit and cannot be undone.`
    );
    if (!confirmed) return;
    setActionPending(true);
    try {
      const response = await api.post("/deleteImage", { branch, unit }, { fileName: selectedFileName });
      if (response.success) {
        // The files listener will drop the thumbnail; clear selection and refresh usages.
        setSelectedKey(undefined);
        setActionMessage(`Deleted ${selectedFileName}.`);
        await refreshUsages();
        authoringPreview.reloadAllPreviews();
      } else {
        setActionMessage(response.error ?? "Delete failed.");
      }
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setActionPending(false);
    }
  };

  const handleStartRename = () => {
    setRenameValue(selectedFileName ?? "");
    setRenameError(null);
    setRenaming(true);
  };

  const handleRenameSubmit = async () => {
    if (actionPending) return;
    if (!branch || !unit || !selectedFileName) return;
    const sanitized = sanitizeFileName(renameValue.trim());
    if (!sanitized || sanitized === selectedFileName) {
      setRenameError("Enter a different, valid filename.");
      return;
    }
    const targetKey = `images/${sanitized}`;
    if (imageFileKeys.includes(targetKey)) {
      setRenameError(`An image named "${sanitized}" already exists.`);
      return;
    }
    setActionPending(true);
    try {
      const response = await api.post(
        "/renameImage", { branch, unit }, { fromFileName: selectedFileName, toFileName: sanitized });
      if (response.success) {
        setRenaming(false);
        setSelectedKey(targetKey);
        const count = response.updatedFileCount ?? 0;
        setActionMessage(`Renamed to ${sanitized}. Updated ${count} reference${count === 1 ? "" : "s"}.`);
        await refreshUsages();
        authoringPreview.reloadAllPreviews();
      } else {
        setRenameError(response.error ?? "Rename failed.");
      }
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : "Rename failed.");
    } finally {
      setActionPending(false);
    }
  };

  const renderUsageInfo = () => {
    // A plain text line stating the usage count, always visible above the image. When the count
    // can't be determined (e.g. the usage API is unavailable) we say so rather than leaving the
    // Delete button mysteriously disabled.
    let usageText: string;
    if (selectedUsageCount === undefined) {
      usageText = usagesLoading ? "Checking usage…" : "Usage: not available";
    } else if (selectedUsageCount === 0) {
      usageText = "Not used in the curriculum";
    } else {
      usageText = `Used ${selectedUsageCount} time${selectedUsageCount === 1 ? "" : "s"} in the curriculum`;
    }

    const hasLocations = selectedUsageCount !== undefined && selectedUsageCount > 0;
    return (
      <div className="media-library-usage">
        <div className="media-library-usage-text">{usageText}</div>
        {hasLocations && (
          <button
            type="button"
            className={classNames("media-library-usage-toggle", { expanded: usageExpanded })}
            aria-expanded={usageExpanded}
            onClick={() => setUsageExpanded(v => !v)}
          >
            <span className="disclosure-caret" aria-hidden="true" />
            {usageExpanded ? "Hide locations" : "Show locations"}
          </button>
        )}
        {hasLocations && usageExpanded && (
          <ul className="media-library-usage-list">
            {(selectedRefs ?? []).map(path => (
              <li key={path} title={path}>
                {formatLocation(describeUsagePath(path, unitConfig, teacherGuideConfig))}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const renderImageActions = () => {
    if (!selectedKey) return null;
    // Preview the name the rename will actually use: invalid characters (spaces, &, etc.) are
    // silently rewritten by sanitizeFileName, so show the result when it differs from what's typed
    // rather than letting the author guess. handleRenameSubmit sanitizes the same way.
    const trimmedRename = renameValue.trim();
    const renamePreview = trimmedRename ? sanitizeFileName(trimmedRename) : "";
    const showRenamePreview = !!renamePreview && renamePreview !== trimmedRename;
    const renameDescribedBy = renameError
      ? "media-library-rename-error"
      : (showRenamePreview ? "media-library-rename-preview" : undefined);
    return (
      <div className="media-library-image-actions">
        {renaming ? (
          <div className="media-library-rename">
            <input
              type="text"
              className="media-library-rename-input"
              aria-label="New image filename"
              aria-invalid={renameError ? true : undefined}
              aria-describedby={renameDescribedBy}
              value={renameValue}
              autoFocus
              disabled={actionPending}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") setRenaming(false);
              }}
            />
            {showRenamePreview &&
              <div id="media-library-rename-preview" className="media-library-rename-preview">
                Will be saved as: {renamePreview}
              </div>}
            <div className="media-library-rename-buttons">
              <button type="button" onClick={handleRenameSubmit} disabled={actionPending}>Save</button>
              <button type="button" onClick={() => setRenaming(false)} disabled={actionPending}>Cancel</button>
            </div>
            {renameError &&
              <div id="media-library-rename-error" className="media-library-rename-error" role="alert">
                {renameError}
              </div>}
          </div>
        ) : (
          <div className="media-library-action-buttons">
            <button
              type="button"
              className="media-library-rename-btn"
              onClick={handleStartRename}
              disabled={actionPending}
            >
              Rename
            </button>
            <button
              type="button"
              className="media-library-delete-btn"
              onClick={handleDeleteImage}
              disabled={actionPending || selectedUsageCount !== 0}
              title={selectedUsageCount === 0
                ? "Delete this unused image"
                : "Only unused images can be deleted"}
            >
              Delete
            </button>
          </div>
        )}
        {actionMessage && <div className="media-library-action-message" role="status">{actionMessage}</div>}
      </div>
    );
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
                  className={classNames("media-library-image-thumb", { selected: key === selectedKey })}
                  onClick={() => handleSelectKey(key)}
                  title={key}
                >
                  <img
                    src={`${baseUrl}${key}`}
                    alt={key}
                    loading="lazy"
                    className="media-library-thumb-img"
                  />
                  {usages && (
                    <span
                      className={classNames("media-library-thumb-badge",
                        { unused: (usages[key]?.length ?? 0) === 0 })}
                      title={`Used ${usages[key]?.length ?? 0}×`}
                    >
                      {usages[key]?.length ?? 0}
                    </span>
                  )}
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
              {/* Controls go above the image so they stay visible even for tall images. */}
              <div className="media-library-preview-controls">
                <div className="media-library-preview-filename">{selectedKey}</div>
                {renderUsageInfo()}
                {renderImageActions()}
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
              </div>
              <img src={imageUrl} alt={selectedKey} className="media-library-preview-img" />
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
            className={classNames("media-library-tab", { active: activeTab === "images" })}
            onClick={() => setActiveTab("images")}
          >
            Existing Images
          </button>
          <button
            className={classNames("media-library-tab", { active: activeTab === "upload" })}
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
