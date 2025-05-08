import { IDropdownItem } from "@concord-consortium/react-components";
import { observer } from "mobx-react";
import React from "react";
import { IBaseProps } from "./base";
import { CustomSelect } from "../clue/components/custom-select";
import { Logger } from "../lib/logger";
import { LogEventMethod, LogEventName } from "../lib/logger-types";
import { useStores } from "../hooks/use-stores";

interface IProps extends IBaseProps {}

export const ProblemMenuContainer: React.FC<IProps> = observer(function ProblemMenuContainer(props) {
  const { problem, ui, unit, user } = useStores();

  const showUnassignedLinkAlert = (problemName: string) => {
    const message = user.isStudent
      ? `Please contact your teacher to assign ${problemName}.`
      : `You must first assign ${problemName} from the portal.`;
    ui.alert(message, "Problem not currently assigned");
  };

  const handleMenuItemClick = (item: IDropdownItem, problemName: string) => {
    const {link, text} = item;
    if (link) {
      window.location.replace(link);
    } else {
      showUnassignedLinkAlert(problemName);
    }
    const logItem = {
      event: LogEventName.DASHBOARD_SWITCH_CLASS,
      parameters: {text, link}
    };
    Logger.log(logItem.event, logItem.parameters, LogEventMethod.DO);
  };

  const getProblemMenuItems = () => {
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
        if (portalOffering && portalOffering.location.includes("/standalone")) {
          // Add autoLogin hash param to any standalone links.  This isn't done in the portal API
          // function to keep the links "pure" for other uses.  The autoLogin hash param signals
          // to the standalone app to log in the user automatically so they don't have to
          // click the login button after they select a different problem.
          const offeringLocation = new URL(portalOffering.location);
          const hashParams = new URLSearchParams(offeringLocation.hash.substring(1));
          hashParams.set("autoLogin", "true");
          offeringLocation.hash = hashParams.toString();
          portalOffering.location = offeringLocation.toString();
        }
        const fullTitle = invProb.subtitle ? `${invProb.title}: ${invProb.subtitle}` : invProb.title;
        const link: IDropdownItem = {
          selected: problem.title === invProb.title,
          text: portalOffering ? fullTitle : `${fullTitle} (N/A)`,
          link: portalOffering ? portalOffering.location : undefined,
          disabled: false
        };
        link.onClick = () => handleMenuItemClick(link, invProb.title);
        links.push(link);
      });
    });
    return links;
  };

  const problemMenuItems = getProblemMenuItems();
  return <CustomSelect items={problemMenuItems} />;

});
