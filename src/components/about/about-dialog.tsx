import React from "react";
import { useCustomModal } from "../../hooks/use-custom-modal";
import { useStores } from "../../hooks/use-stores";
import { IGitInfo } from "../../models/stores/base-stores-types";
import { ExternalLink } from "../utilities/external-link";
import ClueBlockLogo from "../../assets/clue-block-logo.svg";
import InfoIcon from "../../assets/icons/info-icon.svg";
import { ICustomDropdownItem } from "../../clue/components/custom-select";

import "./about-dialog.scss";

export const kMitLicenseUrl = "https://github.com/concord-consortium/collaborative-learning/blob/master/LICENSE";
export const kTermsOfUseUrl = "https://concord.org/terms-of-use/";
export const kLicensingUrl = "https://concord.org/licensing";
export const kLicensingEmail = "licensing@concord.org";
export const kSourceCodeUrl = "https://github.com/concord-consortium/collaborative-learning";

const kShortShaLength = 7;

export function getVersionText(version: string, gitSha?: string | null) {
  const build = gitSha?.slice(0, kShortShaLength);
  return build ? `Version ${version} · build ${build}` : `Version ${version}`;
}

interface IAboutDialogContentProps {
  appVersion: string;
  gitInfo: IGitInfo;
}

export const AboutDialogContent: React.FC<IAboutDialogContentProps> = ({ appVersion, gitInfo }) => {
  const year = new Date().getFullYear();
  return (
    <div className="about-dialog-body">
      <div className="about-dialog-identity">
        <ClueBlockLogo className="about-dialog-logo" viewBox="0 0 105 70" role="img" aria-label="CLUE" />
        <div className="about-dialog-product-of">a product of The Concord Consortium</div>
        <div className="about-dialog-tagline">Collaborative Learning User Environment</div>
        <div className="about-dialog-version" data-testid="about-dialog-version">
          {getVersionText(appVersion, gitInfo.gitSha)}
        </div>
        <div>© {year} The Concord Consortium, Inc.</div>
      </div>
      <hr className="about-dialog-divider" />
      <h2 className="about-dialog-heading">License &amp; Terms of Use</h2>
      <p className="about-dialog-text">
        <strong>CLUE is free, open-source software.</strong> The CLUE source code is released under
        the <ExternalLink href={kMitLicenseUrl}>MIT License</ExternalLink>, so you’re welcome to use,
        modify, and build on it.
      </p>
      <p className="about-dialog-text">
        <strong>Your use of CLUE at collaborative-learning.concord.org</strong> is governed by
        our <ExternalLink href={kTermsOfUseUrl}>Terms of Use</ExternalLink>. The hosted version is free
        for non-commercial use; commercial use requires a separate written agreement. For more
        information, visit <ExternalLink href={kLicensingUrl}>concord.org/licensing</ExternalLink> or
        contact <a href={`mailto:${kLicensingEmail}`}>{kLicensingEmail}</a>.
      </p>
      <hr className="about-dialog-divider" />
      <div className="about-dialog-links">
        <ExternalLink href={kTermsOfUseUrl} showArrow={true}>Terms of Use</ExternalLink>
        <ExternalLink href={kLicensingUrl} showArrow={true}>Licensing details</ExternalLink>
        <ExternalLink href={kSourceCodeUrl} showArrow={true}>Source on GitHub</ExternalLink>
      </div>
    </div>
  );
};

export function useAboutDialog() {
  const { appVersion, gitInfo } = useStores();
  const [showModal] = useCustomModal({
    className: "about-dialog",
    title: "About CLUE",
    Content: AboutDialogContent,
    contentProps: { appVersion, gitInfo },
    canCancel: true,
    buttons: [{ label: "Close", isDefault: true }],
    dataTestId: "about-dialog"
  });
  return showModal as () => void;
}

export function aboutMenuItem(onShowAbout: () => void): ICustomDropdownItem {
  return {
    text: "About CLUE",
    itemIcon: <InfoIcon viewBox="0 0 24 24" aria-hidden="true" />,
    isAction: true,
    hideItemCheck: true,
    bottomBorder: true,
    onClick: onShowAbout
  };
}
