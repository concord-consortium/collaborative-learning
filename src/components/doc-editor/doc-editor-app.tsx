import React, { useCallback, useEffect, useState } from "react";
import stringify from "json-stringify-pretty-compact";
import { applySnapshot, getSnapshot, onSnapshot } from "mobx-state-tree";
import { observer } from "mobx-react";

import { defaultDocumentModel, defaultDocumentModelParts } from "./doc-editor-app-defaults";
import { EditableDocumentContent } from "../document/editable-document-content";
import { DocumentModelType, createDocumentModelWithEnv } from "../../models/document/document";
import { DocumentContentSnapshotType } from "../../models/document/document-content";
import { useCustomModal } from "../../hooks/use-custom-modal";
import { urlParams } from "../../utilities/url-params";
import { getAssetUrl } from "../../utilities/asset-utils";
import { useAppConfig } from "../../hooks/use-stores";
import { DocumentAnnotationToolbar } from "../document/document-annotation-toolbar";
import { CanvasComponent } from "../document/canvas";
import { DocEditorSettings } from "./doc-editor-settings";
import { SettingsDialog } from "./settings-dialog";

import "../document/document.scss";
import "../four-up.sass";
import "./doc-editor-app.scss";

const kDocEditorDocKey = "clue-doc-editor-doc";

export const DocEditorApp = observer(function DocEditorApp() {
  const {document: documentURL, readOnly, noStorage } = urlParams;

  const appConfig = useAppConfig();
  const [document, setDocument] = useState(() => {
    const savedDocString = noStorage ? undefined : window.sessionStorage.getItem(kDocEditorDocKey);
    const initalDoc = savedDocString ? JSON.parse(savedDocString) : defaultDocumentModel;

    return createDocumentModelWithEnv(appConfig, initalDoc);
  });
  const [remoteDocument] = useState(() => {
    return createDocumentModelWithEnv(appConfig, getSnapshot(document));
  });
  const [fileHandle, setFileHandle] = useState<FileSystemHandle|undefined>();
  const [sectionSnapshot, setSectionSnapshot] = useState<any>();
  const [fileName, setFileName] = useState<string>("<no file loaded>");
  const [settings] = useState(() => {
    const _settings = DocEditorSettings.create();
    // Expose the settings to make it easier for Cypress to change them
    (window as any).docEditorSettings = _settings;
    return _settings;

  });

  const {showLocalReadOnly,showRemoteReadOnly,anyReadOnly} = settings;


  const loadDocument = useCallback((text: string) => {
    const _parsedText = JSON.parse(text);
    let documentContentSnapshot;
    if (_parsedText.content ) {
      setSectionSnapshot(_parsedText);
      documentContentSnapshot = _parsedText.content as DocumentContentSnapshotType;
    } else {
      documentContentSnapshot = _parsedText;
    }
    setDocument(createDocumentModelWithEnv(appConfig, {
      ...defaultDocumentModelParts,
      content: documentContentSnapshot
    }));
  }, [appConfig]);

  useEffect(() => {
    return onSnapshot(document, (docSnap) => {
      const snapString = JSON.stringify(docSnap);

      if (!noStorage) {
        window.sessionStorage.setItem(kDocEditorDocKey, snapString);
      }

      // Emulate what happens during remote syncing.
      // The document is turned into a string and back into a object
      // This can turn up problems with values not supported by JSON
      // such as NaN or undefined.
      const jsonFiltered = JSON.parse(snapString);
      applySnapshot(remoteDocument, jsonFiltered);
    });
  }, [document, noStorage, remoteDocument]);

  // Handle opening both section documents with a content field
  // and basic documents which are just the content itself
  async function handleOpen() {
    const [_fileHandle] = await (window as any).showOpenFilePicker();
    setFileHandle(_fileHandle);
    const file = await _fileHandle.getFile();
    setFileName(file.name);
    const text = await file.text();
    loadDocument(text);
  }

  async function handleSave() {
    if (!document.content) {
      console.error("Can't save without document.content");
      return;
    }

    let _fileHandle = fileHandle;
    if (!_fileHandle) {
      _fileHandle = await (window as any).showSaveFilePicker();
      setFileHandle(_fileHandle);
      if (_fileHandle) {
        const file = await (_fileHandle as any).getFile();
        setFileName(file.name);
      }

    }

    let contents;
    // Save in the same format that was loaded: either an export or raw
    if (sectionSnapshot) {
      // construct the contents of the section
      const docContentString = document.content.exportAsJson({ includeTileIds: true });
      const docContentJSON = JSON.parse(docContentString);
      sectionSnapshot.content = docContentJSON;
      contents = JSON.stringify(sectionSnapshot, undefined, 2);
    } else {
      const contentJson = getSnapshot(document.content);
      contents = stringify(contentJson, {maxLength: 100});
    }

    const writable = await (_fileHandle as any).createWritable();
    // Write the contents of the file to the stream.
    await writable.write(contents);
    // Close the file and write the contents to disk.
    await writable.close();
  }

  const [showSettings] = useCustomModal({
    title: "Settings",
    Content: SettingsDialog,
    contentProps: {settings},
    buttons: [
      { label: "Done",
        isDefault: true,
        isDisabled: false
      }
    ]
  }, [settings]);

  function handleSettings() {
    showSettings();
  }

  function handleClear() {
    window.sessionStorage.removeItem(kDocEditorDocKey);
    window.location.reload();
  }

  useEffect(() => {
    if (!documentURL) {
      return;
    }

    // Load the documentURL relative to the assets not the html page itself.
    // This makes the document URLs work with /editor/ as well as on a
    // production release.
    const adjustedURL = getAssetUrl(documentURL);

    fetch(adjustedURL)
    .then(async response => {
      if (response.ok) {
        const documentText = await response.text();
        loadDocument(documentText);
      } else {
        throw Error(`status ${response.status}`);
      }
    })
    .catch(error => {
      // This error is printed in the console as an "Uncaught (in promise)..."
      throw Error(`Request rejected with exception ${error}`);
    });
  }, [documentURL, loadDocument]);

  // This is wrapped in a div.primary-workspace so it can be used with cypress
  // tests that are looking for stuff in a div like this
  return (
    <div id="doc-editor-app">
      <div id="left-panel">
        <div className="primary-workspace single-workspace">
          <div className="document">
            <div className="titlebar">
              <div className="actions left">
                <button onClick={handleOpen}>open</button>
                <button onClick={handleSave}>save</button>
                <span className="filename">{fileName}</span>
                <button onClick={handleClear}>reset doc</button>
                <button onClick={handleSettings}>settings</button>
                <DocumentAnnotationToolbar/>
              </div>
            </div>
            <EditableDocumentContent
                contained={false}
                mode="1-up"
                isPrimary={true}
                readOnly={readOnly}
                document={document}
                toolbar={appConfig.authorToolbar}
              />
          </div>
        </div>
      </div>
      { anyReadOnly &&
        <div id="right-panel">
          { showLocalReadOnly &&
            <>
              <div className="readonly-header">Read Only Local</div>
              <ReadonlyCanvas document={document}/>
            </>
          }
          { showRemoteReadOnly &&
            <>
              <div className="readonly-header">Read Only Remote (emulated)</div>
              <ReadonlyCanvas document={remoteDocument}/>
            </>
          }
        </div>
      }
    </div>
  );
});

const ReadonlyCanvas = ({document}:{document: DocumentModelType}) => {
  const readOnlyScale = 0.5;
  const scaledStyle = {
    position: "absolute",
    transformOrigin: "0 0",
    transform: `scale(${readOnlyScale})`,
    width: "200%",
    height: "200%"
  } as const;

  return (
    <div className="canvas-container">
      <div className="canvas-scaler" style={scaledStyle} >
        <CanvasComponent
          document={document}
          context="doc-editor-read-only"
          readOnly={true}
          scale={readOnlyScale}
          />
      </div>
    </div>
  );
};
