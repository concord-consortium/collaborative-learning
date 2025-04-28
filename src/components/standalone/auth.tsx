import React from "react";
import { observer } from "mobx-react";
import { getPortalStandaloneSignInOrRegisterUrl } from "../../utilities/auth-utils";
import { useUserStore } from "../../hooks/use-stores";

import "./auth.scss";

export const StandAloneAuthComponent: React.FC = observer(() => {
  const { standaloneAuth } = useUserStore();

  const renderContents = () => {

    if (standaloneAuth?.state === "error") {
      return <div data-testid="standalone-error">{standaloneAuth.message}</div>;
    }

    if (standaloneAuth?.state === "haveBearerToken") {
      return <div data-testid="standalone-authenticating">Authenticating...</div>;
    }

    if (standaloneAuth?.state === "authenticated") {
      return (
        <div className="debug" data-testid="standalone-authenticated">
          <div><strong>Authenticated</strong></div>
          <div>TBD: Check if user needs a class and/or offering (this is the next JIRA story).</div>
          <div>For debugging here is the JWT:</div>
          <div><pre>{JSON.stringify(standaloneAuth.portalJWT, null, 2)}</pre></div>
        </div>
      );
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
