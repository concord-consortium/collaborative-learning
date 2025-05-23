import { IDropdownItem } from "@concord-consortium/react-components";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { IBaseProps } from "./base";
import { CustomSelect } from "../clue/components/custom-select";
import { Logger } from "../lib/logger";
import { LogEventMethod, LogEventName } from "../lib/logger-types";
import { useStores } from "../hooks/use-stores";
import { addUrlParams } from "../utilities/url-utils";

interface IProps extends IBaseProps {}

export const ProblemMenuContainer: React.FC<IProps> = observer(function ProblemMenuContainer(props) {
  const stores = useStores();
  const { problem, ui, unit, user, isProblemLoaded } = stores;
  const [problemMenuItems, setProblemMenuItems] = useState<IDropdownItem[]>([]);

  useEffect(() => {

    const showUnassignedLinkAlert = (problemName: string) => {
      const message = user.isStudent
        ? `Please contact your teacher to assign ${problemName}.`
        : `You must first assign ${problemName} from the portal.`;
      ui.alert(message, "Problem not currently assigned");
    };

    const handleAssignedMenuItemClick = (item: IDropdownItem, problemName: string) => {
      const {link, text} = item;
      if (link) {
        window.location.replace(link);
      } else {
        showUnassignedLinkAlert(problemName);
      }
      Logger.log(LogEventName.DASHBOARD_SWITCH_CLASS, {text, link}, LogEventMethod.DO);
    };

    const handlePreviewMenuItemClick = (problemOrdinal: string) => {
      stores.loadUnitAndProblem(unit.code, problemOrdinal);

      // Update the URL with the new problem so that reloading the page
      // will show the selected problem and the problem will be selected when
      // the user logs in.
      addUrlParams({problem: problemOrdinal});

      Logger.log(LogEventName.STANDALONE_SWITCH_PREVIEW_PROBLEM, {problemOrdinal}, LogEventMethod.DO);
    };

    const getAssignedProblemMenuItems = () => {
      const investigations = unit.investigations;
      const links: IDropdownItem[] = [];

      // For each problem in the curriculum assigned in this class...
      investigations.forEach ( (investigation) => {
        investigation.problems.forEach ( (invProb) => {
          // Find the link, if any, in the portal offerings...
          const problemOrdinal = `${investigation.ordinal}.${invProb.ordinal}`;
          const unitCode = unit.code;
          const portalOffering = user.portalClassOfferings.find( (offering) => {
            return (
              offering.className === user.className &&
              offering.problemOrdinal === problemOrdinal &&
              offering.unitCode === unitCode
            );
          });
          let linkLocation = portalOffering?.location;
          if (portalOffering && portalOffering.location.includes("/standalone")) {
            // Add autoLogin hash param to any standalone links.  This isn't done in the portal API
            // function to keep the links "pure" for other uses.  The autoLogin hash param signals
            // to the standalone app to log in the user automatically so they don't have to
            // click the login button after they select a different problem.
            const offeringLocation = new URL(portalOffering.location);
            const hashParams = new URLSearchParams(offeringLocation.hash.substring(1));
            hashParams.set("autoLogin", "true");
            offeringLocation.hash = hashParams.toString();
            linkLocation = offeringLocation.toString();
          }
          const fullTitle = invProb.subtitle ? `${invProb.title}: ${invProb.subtitle}` : invProb.title;
          const link: IDropdownItem = {
            selected: problem.title === invProb.title,
            text: portalOffering ? fullTitle : `${fullTitle} (N/A)`,
            link: linkLocation,
            disabled: false
          };
          link.onClick = () => handleAssignedMenuItemClick(link, invProb.title);
          links.push(link);
        });
      });
      return links;
    };

    const getPreviewProblemMenuItems = () => {
      const investigations = unit.investigations;
      const links: IDropdownItem[] = [];

      investigations.forEach ( (investigation) => {
        investigation.problems.forEach ( (invProb) => {
          const text = invProb.subtitle ? `${invProb.title}: ${invProb.subtitle}` : invProb.title;
          const selected = problem.title === invProb.title;
          const link: IDropdownItem = {selected, text, disabled: false};
          const problemPath = `${investigation.ordinal}.${invProb.ordinal}`;
          link.onClick = () => handlePreviewMenuItemClick(problemPath);
          links.push(link);
        });
      });
      return links;
    };

    // this allows the user to preview all the problems in standalone mode before logging in
    const showPreviewItems = ui.standalone && user.standaloneAuth;
    setProblemMenuItems(showPreviewItems ? getPreviewProblemMenuItems() : getAssignedProblemMenuItems());
  }, [unit, problem, ui, user, stores]);

  // don't render anything if the problem is not loaded yet
  if (!isProblemLoaded) {
    return null;
  }

  return <CustomSelect dataTestId="problem-navigation-dropdown" items={problemMenuItems} />;
});
