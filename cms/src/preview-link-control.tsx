import React from "react";
import { CmsWidgetControlProps } from "netlify-cms-core";

import { getGuideJson, getUnitJson } from "../../src/models/curriculum/unit";
import { stripPTNumberFromBranch } from "../../src/utilities/branch-utils";
import { urlParams } from "../../src/utilities/url-params";
import { AppConfigModel, AppConfigModelSnapshot } from "../../src/models/stores/app-config-model";
import appConfigJson from "../../src/clue/app-config.json";
import { defaultCurriculumBranch, defaultCurriculumUnit } from "./cms-constants";

import "./custom-control.scss";
import "./preview-link-control.scss";

(window as any).DISABLE_FIREBASE_SYNC = true;

interface IState {
  previewUrl?: string;
  warning?: string;
}

const delayWarning = " (Your changes may take a minute or two to appear after publishing.)";
const loadingMessage = "Finding preview link...";

// We are using the CmsWidgetControlProps for the type of properties passed to
// the control. This doesn't actually include all of the properties that are
// available. A more complete list can be found in Widget.js in the DecapCMS
// source code.
export class PreviewLinkControl extends React.Component<CmsWidgetControlProps, IState>  {
  isTeacherGuide?: boolean;
  pathParts?: string[];
  unit?: string;

  constructor(props: CmsWidgetControlProps) {
    super(props);

    let warning = "";

    // entry is not included in CmsWidgetControlProps, but it is included in the props.
    const entry = (this.props as any).entry.toJS();
    // path is of the form
    // curriculum/[unit]/teacher-guide?/investigation-[ordinal]/problem-[ordinal]/[sectionType]/content.json
    this.pathParts = entry.path.split("/");

    // If there's a unit url parameter, use that. Otherwise try to find the unit from the entry path.
    if (!urlParams.unit && !this.pathParts?.[1]) {
      warning = `Could not determine unit. Using default ${defaultCurriculumUnit}.`;
    }
    this.unit = urlParams.unit ?? this.pathParts?.[1] ?? defaultCurriculumUnit;

    const appConfig = AppConfigModel.create(appConfigJson as AppConfigModelSnapshot);

    // Finish setting up the preview link after reading the unit json
    this.isTeacherGuide = this.pathParts?.[2] === "teacher-guide";
    if (this.isTeacherGuide) {
      getGuideJson(this.unit, appConfig).then((unitJson) => this.setPreviewLink(unitJson));
    } else {
      getUnitJson(this.unit, appConfig).then((unitJson) => this.setPreviewLink(unitJson));
    }

    this.state = {
      warning
    };
  }

  // Finishes setting up the preview link after loading the unit's json so we can determine the problem parameter.
  setPreviewLink(unitJson: any) {
    // Determine the unit parameter
    const curriculumBranch = stripPTNumberFromBranch(urlParams.curriculumBranch ?? defaultCurriculumBranch);
    const previewUnit = `https://models-resources.concord.org/clue-curriculum/branch/${curriculumBranch}/${this.unit}/content.json`;

    // Determine the problem parameter
    // path is of the form
    // curriculum/[unit]/teacher-guide?/investigation-[ordinal]/problem-[ordinal]/[sectionType]/content.json
    const sectionPath = this.pathParts?.slice(-4).join("/");
    let problemParam = "";
    if (unitJson.investigations) {
      unitJson.investigations.forEach((investigation: any) => {
        if (investigation.problems) {
          investigation.problems.forEach((problem: any) => {
            if (problem.sections) {
              problem.sections.forEach((section: any) => {
                if (section.sectionPath === sectionPath) {
                  problemParam = `${investigation.ordinal}.${problem.ordinal}`;
                }
              });
            }
          });
        }
      });
    }
    if (!problemParam) {
      problemParam = "1.1";
      this.setState({ warning: `Could not determine problem parameter. Using default ${problemParam}.`});
    }

    // Determine the section parameter
    const teacherGuideOffset = this.isTeacherGuide ? 1 : 0;
    const sectionType = this.pathParts?.[4 + teacherGuideOffset];

    // Finish creating the preview link
    // TODO Do we ever want to preview on a CLUE branch other than master?
    const clueBranch = "master";
    const baseUrl = `https://collaborative-learning.concord.org/branch/${clueBranch}/`;
    const params = `?unit=${previewUnit}&problem=${problemParam}&section=${sectionType}`;
    // TODO It would be better to use the github user for the demoName rather than the curriculum branch.
    // TODO Do we want to make the user a teacher when they are not modifying a teacher guide?
    const demoParams = `&appMode=demo&demoName=${curriculumBranch}&fakeClass=1&fakeUser=teacher:2`;
    const previewUrl = `${baseUrl}${params}${demoParams}`;
    this.setState({ previewUrl });
  }

  render() {
    return (
      <div className="preview-link-box custom-widget">
        <p>
          {this.state.previewUrl
            ? <>
                <a href={this.state.previewUrl} target="_blank" rel="noreferrer">Preview Link</a>
                {delayWarning}
              </>
            : loadingMessage
          }
        </p>
        { this.state.warning &&
          <p className="warning">Preview link may be incorrect. {this.state.warning}</p>
        }
      </div>
    );
  }
}
