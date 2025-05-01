import React, { useEffect } from "react";
import jwt_decode from "jwt-decode";
import { observer } from "mobx-react";
import { getPortalStandaloneSignInOrRegisterUrl, removeAuthParams } from "../../utilities/auth-utils";
import { useStores } from "../../hooks/use-stores";
import { urlParams } from "../../utilities/url-params";
import { createPortalClass, createPortalOffering, getLearnerJWT, getPortalClasses,
         getTeacherJWT,
         joinClass} from "../../lib/portal-api";
import { IPortalClassInfo, PortalJWT } from "../../lib/portal-types";
import { getUnitJson } from "../../models/curriculum/unit-utils";
import { authAndConnect } from "../app";

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
type ProblemItem = {problem: string};

export type AuthenticatedState =
  {state: "start"} |
  {state: "loadingClasses"} & PortalInfoItem |
  {state: "loadedClasses",
    classes: IPortalClassInfo[],
    classWord?: string,
    classId?: number,
    offeringId?: number,
  } & PortalInfoItem & UnitJsonItem & ProblemItem |
  { state: "startingCLUE",
    classWord: string,
    classId: number,
    offeringId: number,
  } & PortalInfoItem |
  { state: "creatingOffering",
    classWord: string,
    classId: number,
  } & PortalInfoItem & UnitJsonItem & ProblemItem|
  { state: "creatingClassAndOffering",
  } & PortalInfoItem & UnitJsonItem & ProblemItem|
  {state: "error", message: string}

export const findMatchingOffering = (clazz: IPortalClassInfo, unit: string, problem: string) => {
  return clazz.offerings.find((offering) => {
    // match both localhost for development and the domain for staging/production
    const url = new URL(offering.external_url ?? "");
    const domainMatches = ["localhost", "collaborative-learning.concord.org"].includes(url.hostname);
    const unitMatches = url.searchParams.get("unit") === unit;
    const problemMatches = url.searchParams.get("problem") === problem;
    return domainMatches && unitMatches && problemMatches;
  });
};

export const findMatchingClassAndOfferingIds =
  (classes: IPortalClassInfo[], classWord?: string, unit?: string, problem?: string) => {
  // find the class that matches the classWord
  let matchingClass = classWord ? classes.find((clazz) => {
    return clazz.class_word === classWord;
  }) : undefined;
  if (!matchingClass && unit && problem) {
    // if we didn't find a class with the classWord, try to find one with the unit
    matchingClass = classes.find((clazz) => !!findMatchingOffering(clazz, unit, problem));
  }
  const matchingOfferingId = matchingClass && unit && problem
    ? findMatchingOffering(matchingClass, unit, problem)?.id
    : undefined;
  const matchingClassWord = matchingClass ? matchingClass.class_word : undefined;

  return {matchingClassId: matchingClass?.id, matchingClassWord, matchingOfferingId};
};

type StartCLUEOptions = { classWord: string, classId: number, offeringId: number, portalInfo: PortalInfo};
export const startCLUE = (options: StartCLUEOptions): AuthenticatedState =>
{
  const { classWord, classId, offeringId, portalInfo } = options;
  return {
    state: "startingCLUE",
    classWord,
    classId,
    offeringId,
    portalInfo
  };
};

export const createPortalOfferingForUnit = async (
  portalInfo: PortalInfo, classId: number, unitJson: PartialUnitJson, problem: string
) => {
  const { domain, rawPortalJWT } = portalInfo;
  const name = unitJson.title;

  // the class is removed from the URL so that it doesn't get passed to the offering
  // as the url is used to create a single external activity for the unit
  const url = removeAuthParams(window.location.href, {
    removeClass: true,
    addParams: {
      // the problem is required for students
      problem,
    }
  });

  return createPortalOffering(domain, rawPortalJWT, classId, url, name );
};

export const processFinalAuthenticatedState = async (
  authenticatedState: AuthenticatedState
): Promise<AuthenticatedState> => {

  if (authenticatedState.state === "startingCLUE") {
    return startCLUE(authenticatedState);
  }

  if (authenticatedState.state === "creatingOffering") {
    const offeringId = await createPortalOfferingForUnit(
      authenticatedState.portalInfo,
      authenticatedState.classId,
      authenticatedState.unitJson,
      authenticatedState.problem    );
    return startCLUE({...authenticatedState, offeringId });
  }

  if (authenticatedState.state === "creatingClassAndOffering") {
    const { domain, rawPortalJWT } = authenticatedState.portalInfo;
    const {id: classId, classWord} = await createPortalClass(domain, rawPortalJWT);
    const offeringId = await createPortalOfferingForUnit(
      authenticatedState.portalInfo,
      classId,
      authenticatedState.unitJson,
      authenticatedState.problem
    );
    return startCLUE({...authenticatedState, classWord, classId, offeringId });
  }

  return authenticatedState;
};

export const getFinalAuthenticatedState = (authenticatedState: AuthenticatedState): AuthenticatedState => {
  const { unit } = urlParams;

  if (authenticatedState.state !== "loadedClasses" || !unit) {
    return authenticatedState;
  }

  const {classId, offeringId, classWord, classes, unitJson, problem, portalInfo} = authenticatedState;
  const { teacher } = portalInfo;

  if (classId && offeringId && classWord) {
    return {state: "startingCLUE", classWord, classId, offeringId, portalInfo};
  }

  if (classId && teacher && classWord) {
    return {state: "creatingOffering", classId, classWord, unitJson, problem, portalInfo};
  }

  if (teacher && classes.length > 0 && classWord) {
    return {state: "creatingOffering", classId: classes[0].id, classWord, unitJson, problem, portalInfo};
  }

  if (teacher) {
    return {state: "creatingClassAndOffering", unitJson, problem, portalInfo};
  }

  return authenticatedState;
};

export const StandAloneAuthComponent: React.FC = observer(() => {
  const stores = useStores();
  const { curriculumConfig,
          ui: { setStandalone },
          user: { standaloneAuth, setStandaloneAuth, setStandaloneAuthUser },
          appConfig
        } = stores;
  const [authenticatedState, setAuthenticatedState] = React.useState<AuthenticatedState>({state: "start"});

  useEffect(() => {
    if (standaloneAuth?.state === "authenticated") {
      const init = async () => {
        try {
          const { classWord, unit } = urlParams;
          const { domain, teacher, student } = standaloneAuth.portalJWT;
          const portalInfo: PortalInfo = {domain, rawPortalJWT: standaloneAuth.rawPortalJWT, teacher, student};
          const problem = appConfig.defaultProblemOrdinal;

          setAuthenticatedState({state: "loadingClasses", portalInfo});

          // if there is a classWord, try to join the class - it is a no-op if the user is already in the class
          if (classWord && student) {
            await joinClass(domain, standaloneAuth.rawPortalJWT, classWord);
          }

          // then get the classes to try to find the class and offering
          const classes = await getPortalClasses(domain, standaloneAuth.rawPortalJWT);
          const result = findMatchingClassAndOfferingIds(classes, classWord, unit, problem);
          const {matchingClassId, matchingClassWord, matchingOfferingId} = result;

          const unitJson = await getUnitJson(unit, curriculumConfig);

          const loadedClassState: AuthenticatedState = {
            state: "loadedClasses",
            classes,
            classWord: matchingClassWord,
            classId: matchingClassId,
            offeringId: matchingOfferingId,
            unitJson,
            problem,
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

  }, [standaloneAuth, curriculumConfig, appConfig.defaultProblemOrdinal]);

  useEffect(() => {
    const loadApp = async () => {
      if (authenticatedState.state === "startingCLUE") {
        try {
          const { classId, classWord, offeringId, portalInfo } = authenticatedState;
          const {domain, teacher, rawPortalJWT} = portalInfo;
          const rawJWT = teacher
            ? await getTeacherJWT(domain, rawPortalJWT)
            : await getLearnerJWT(domain, rawPortalJWT, offeringId);
          const jwt = jwt_decode(rawJWT) as PortalJWT;

          // ensure the classWord is in the url
          const urlWithClassWord = removeAuthParams(window.location.href, {
            removeClass: true,
            addParams: {
              classWord,
            }
          });
          window.history.replaceState(null, window.document.title, urlWithClassWord);

          // Setting these values will trigger this component to unload and the main app to load.
          // The JWT in the standaloneAuthUser will be used in the authAndConnect function
          // instead of requesting a new one from the portal.
          setStandalone(false);
          setStandaloneAuth(undefined);
          setStandaloneAuthUser({rawJWT, jwt, classId, offeringId});
          authAndConnect(stores);
        } catch (err) {
          setAuthenticatedState({state: "error", message: String(err)});
        }
      }
    };
    loadApp();
  }, [authenticatedState, setStandalone, setStandaloneAuth, setStandaloneAuthUser, stores]);

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
          Starting CLUE ...
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
