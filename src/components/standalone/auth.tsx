import React, { useEffect } from "react";
import { observer } from "mobx-react";
import { getPortalStandaloneSignInOrRegisterUrl, removeAuthParams } from "../../utilities/auth-utils";
import { useStores } from "../../hooks/use-stores";
import { urlParams } from "../../utilities/url-params";
import { createPortalClass, createPortalOffering, getPortalClasses } from "../../lib/portal-api";
import { IPortalClassInfo } from "../../lib/portal-types";
import { getUnitJson } from "../../models/curriculum/unit-utils";

import "./auth.scss";

type PartialUnitJson = {
  title: string
};
type PortalInfo = {
  domain: string,
  rawPortalJWT: string
  teacher: boolean
  student: boolean
};
type PortalInfoItem = {portalInfo: PortalInfo};
type UnitJsonItem = {unitJson: PartialUnitJson};

export type AuthenticatedState =
  {state: "start"} |
  {state: "loadingClasses"} & PortalInfoItem |
  {state: "loadedClasses",
    classes: IPortalClassInfo[],
    classWord?: string,
    classId?: number,
    offeringId?: number,
  } & PortalInfoItem & UnitJsonItem |
  { state: "startingCLUE",
    classWord: string
  } |
  { state: "creatingOffering",
    classWord: string,
    classId: number,
  } & PortalInfoItem & UnitJsonItem |
  { state: "creatingClassAndOffering",
  } & PortalInfoItem & UnitJsonItem |
  {state: "error", message: string}

export const findMatchingOffering = (clazz: IPortalClassInfo, unit: string) => {
  return clazz.offerings.find((offering) => {
    // match both localhost for development and the domain for staging/production
    const url = new URL(offering.external_url ?? "");
    const domainMatches = ["localhost", "collaborative-learning.concord.org"].includes(url.hostname);
    const unitMatches = url.searchParams.get("unit") === unit;
    return domainMatches && unitMatches;
  });
};

export const findMatchingClassAndOfferingIds = (classes: IPortalClassInfo[], classWord?: string, unit?: string) => {
  // find the class that matches the classWord
  let matchingClass = classWord ? classes.find((clazz) => {
    return clazz.class_word === classWord;
  }) : undefined;
  if (!matchingClass && unit) {
    // if we didn't find a class with the classWord, try to find one with the unit
    matchingClass = classes.find((clazz) => !!findMatchingOffering(clazz, unit));
  }
  const matchingOfferingId = matchingClass && unit ? findMatchingOffering(matchingClass, unit)?.id : undefined;

  return {matchingClassId: matchingClass?.id, matchingOfferingId};
};

export const startCLUE = (classWord: string): AuthenticatedState => {

  // TODO: in next JIRA story update the url with the class and offering and start the normal CLUE user auth
  // by setting the user.standaloneAuth to undefined and setting appMode to "authed" and then rerunning authAndConnect()
  // const url = removeAuthParams(window.location.href);

  return {
    state: "startingCLUE",
    classWord
  };
};

export const createPortalOfferingForUnit = async (
  portalInfo: PortalInfo, classId: number, unitJson: PartialUnitJson
) => {
  const { domain, rawPortalJWT } = portalInfo;
  const name = unitJson.title;
  // the class is removed from the URL so that it doesn't get passed to the offering
  // as the url is used to create a single external activity for the unit
  const url = removeAuthParams(window.location.href, {removeClass: true});

  return createPortalOffering(domain, rawPortalJWT, classId, url, name );
};

export const processFinalAuthenticatedState = async (
  authenticatedState: AuthenticatedState
): Promise<AuthenticatedState> => {

  if (authenticatedState.state === "startingCLUE") {
    return startCLUE(authenticatedState.classWord);
  }

  if (authenticatedState.state === "creatingOffering") {
    await createPortalOfferingForUnit(
      authenticatedState.portalInfo,
      authenticatedState.classId,
      authenticatedState.unitJson
    );
    return startCLUE(authenticatedState.classWord);
  }

  if (authenticatedState.state === "creatingClassAndOffering") {
    const { domain, rawPortalJWT } = authenticatedState.portalInfo;
    const {id: classId, classWord} = await createPortalClass(domain, rawPortalJWT);
    await createPortalOfferingForUnit(
      authenticatedState.portalInfo,
      classId,
      authenticatedState.unitJson
    );
    return startCLUE(classWord);
  }

  return authenticatedState;
};

export const getFinalAuthenticatedState = (authenticatedState: AuthenticatedState): AuthenticatedState => {
  const { unit } = urlParams;

  if (authenticatedState.state !== "loadedClasses" || !unit) {
    return authenticatedState;
  }

  const {classId, offeringId, classWord, classes, unitJson, portalInfo} = authenticatedState;
  const { teacher } = portalInfo;

  if (classId && offeringId && classWord) {
    return {state: "startingCLUE", classWord};
  }

  if (classId && teacher && classWord) {
    return {state: "creatingOffering", classId, classWord, unitJson, portalInfo};
  }

  if (teacher && classes.length > 0 && classWord) {
    return {state: "creatingOffering", classId: classes[0].id, classWord, unitJson, portalInfo};
  }

  if (teacher) {
    return {state: "creatingClassAndOffering", unitJson, portalInfo};
  }

  return authenticatedState;
};

export const StandAloneAuthComponent: React.FC = observer(() => {
  const { curriculumConfig, user: { standaloneAuth }} = useStores();
  const [authenticatedState, setAuthenticatedState] = React.useState<AuthenticatedState>({state: "start"});

  useEffect(() => {
    if (standaloneAuth?.state === "authenticated") {
      const init = async () => {
        try {
          const { classWord, unit } = urlParams;
          const { domain, teacher, student } = standaloneAuth.portalJWT;

          const portalInfo: PortalInfo = {domain, rawPortalJWT: standaloneAuth.rawPortalJWT, teacher, student};

          setAuthenticatedState({state: "loadingClasses", portalInfo});

          const classes = await getPortalClasses(domain, standaloneAuth.rawPortalJWT);
          const {matchingClassId, matchingOfferingId} = findMatchingClassAndOfferingIds(classes, classWord, unit);

          const unitJson = await getUnitJson(unit, curriculumConfig);

          const loadedClassState: AuthenticatedState = {
            state: "loadedClasses",
            classes,
            classWord,
            classId: matchingClassId,
            offeringId: matchingOfferingId,
            unitJson,
            portalInfo
          };
          const finalAuthenticatedState = getFinalAuthenticatedState(loadedClassState);

          setAuthenticatedState(finalAuthenticatedState);

          // wait for render and then process the final authenticated state
          setTimeout(() => {
            processFinalAuthenticatedState(finalAuthenticatedState)
              .then((maybeUpdatedFinalState) => {
                setAuthenticatedState(maybeUpdatedFinalState);
              })
              .catch((err) => {
                setAuthenticatedState({state: "error", message: err.toString()});
              });
          }, 0);
        } catch (err) {
          setAuthenticatedState({state: "error", message: String(err)});
        }
      };

      init();
    }

  }, [standaloneAuth, curriculumConfig]);

  const renderAuthenticatedState = () => {
    if (authenticatedState.state === "loadingClasses") {
      return <div data-testid="standalone-loading-classes">Loading classes...</div>;
    }

    if (authenticatedState.state === "error") {
      return <div data-testid="standalone-authenticated-error">{authenticatedState.message}</div>;
    }

    if (authenticatedState.state === "loadedClasses") {
      return (
        <div data-testid="standalone-no-unit-assigned">
          <div className="uh-oh">
            <div>
              Uh oh!
            </div>
            <div>
              This unit is not assigned to any of your classes.
            </div>
          </div>
          <div>Contact your teacher for what to do next.</div>
        </div>
      );
    }

    if (authenticatedState.state === "startingCLUE") {
      return (
        <div data-testid="standalone-starting-clue">
          TBD: Starting CLUE... (next JIRA story)
        </div>
      );
    }

    if (authenticatedState.state === "creatingOffering") {
      return (
        <div data-testid="standalone-create-offering">
          Creating offering for unit in class and starting CLUE...
        </div>
      );
    }

    if (authenticatedState.state === "creatingClassAndOffering") {
      return (
        <div data-testid="standalone-create-class-and-offering">
          Creating class and offering for unit and starting CLUE...
        </div>
      );
    }

    return null;
  };

  const renderContents = () => {

    if (standaloneAuth?.state === "error") {
      return <div data-testid="standalone-error">{standaloneAuth.message}</div>;
    }

    if (standaloneAuth?.state === "haveBearerToken") {
      return <div data-testid="standalone-authenticating">Authenticating...</div>;
    }

    if (standaloneAuth?.state === "authenticated") {
      return renderAuthenticatedState();
    }

    return (
      <div data-testid="standalone-welcome">
        <div className="welcome">
          Welcome to CLUE!
        </div>
        <div className="instructions">
          Click below to get started with an account.
        </div>
        <a className="button" href={getPortalStandaloneSignInOrRegisterUrl()}>
          Get Started
        </a>
      </div>
    );
  };

  return (
    <div className="standalone-auth">
      {renderContents()}
    </div>
  );
});
