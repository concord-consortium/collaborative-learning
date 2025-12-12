import React from "react";
import { Checkbox, CheckboxGroup } from "@chakra-ui/checkbox";
import { observer } from "mobx-react";
import { IDocEditorSettings } from "./doc-editor-settings";

export const SettingsDialog = observer(function SettingsDialog({settings}: {settings: IDocEditorSettings}) {
  const {showLocalReadOnly, showRemoteReadOnly, minimalAISummary} = settings;
  return (
    <CheckboxGroup>
      <Checkbox
        isChecked={showLocalReadOnly}
        onChange={() => settings.setShowLocalReadOnly(!showLocalReadOnly)}
      >
        Show Local Read Only
      </Checkbox>
      <Checkbox
        isChecked={showRemoteReadOnly}
        onChange={() => settings.setShowRemoteReadOnly(!showRemoteReadOnly)}
      >
        Show Remote Read Only
      </Checkbox>
      <Checkbox
        isChecked={minimalAISummary}
        onChange={() => settings.setMinimalAISummary(!minimalAISummary)}
      >
        Minimal AI Summary
      </Checkbox>
    </CheckboxGroup>
  );
});
