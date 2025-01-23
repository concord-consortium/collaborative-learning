# Overview

CLUE will use an OAuth2 flow to authenticate with the portal if an `authDomain` parameter is included in the URL. A typical value of `authDomain` would be `https://learn.concord.org`. However the production portal is not configured to allow CLUE to use OAuth2, so for testing you should use `https://learn.portal.staging.concord.org`.

This OAuth2 authentication will result in an `accessToken`. This `accessToken` can be used by CLUE to access other portal APIs the same way that the nonce `token` parameter is used by the current portal launches. However the portal's nonce `token` has some extra information in it in addition to the user authentication. So in order for the OAuth2 launch to work property a second parameter `resourceLinkId` needs to be included in the CLUE URL. This is an LTI name for the portal's offering id. This `resourceLinkId` is passed to the Portal JWT and Firebase JWT requests and it takes the place of the extra info that was original included in the portal's nonce `token`.

This diagram describes how OAuth2 works:
[portal-report launch diagram](https://github.com/concord-consortium/portal-report/blob/master/docs/launch.md#launched-from-third-party-site-and-authenticate-user)

- Replace "Portal Report" with "CLUE".
- Replace "Activity Player" with some other way a user can open a link. Planned cases are:
  - including links in the researcher log reports
  - updating the portal to use links like this to launch CLUE, this way the user can reload CLUE and be re-authenticated with the Portal and continue working where they left off.

## Example URLS

### Teacher Launch

Original URL:
<https://collaborative-learning.concord.org/branch/master/?class=https%3A%2F%2Flearn.portal.staging.concord.org%2Fapi%2Fv1%2Fclasses%2F111&classOfferings=https%3A%2F%2Flearn.portal.staging.concord.org%2Fapi%2Fv1%2Fofferings%3Fclass_id%3D111&logging=true&offering=https%3A%2F%2Flearn.portal.staging.concord.org%2Fapi%2Fv1%2Fofferings%2F112&reportType=offering&token=a4ebf7f5aae51671a6b7081abfd1adb0&username=google-118170338932514291325>

Params broken out:
- class=https%3A%2F%2Flearn.portal.staging.concord.org%2Fapi%2Fv1%2Fclasses%2F111
- classOfferings=https%3A%2F%2Flearn.portal.staging.concord.org%2Fapi%2Fv1%2Fofferings%3Fclass_id%3D111
- logging=true
- offering=https%3A%2F%2Flearn.portal.staging.concord.org%2Fapi%2Fv1%2Fofferings%2F112
- reportType=offering
- token=a4ebf7f5aae51671a6b7081abfd1adb0
- username=google-118170338932514291325

Localhost updated with OAuth2:
<http://localhost:8080/?class=https%3A%2F%2Flearn.portal.staging.concord.org%2Fapi%2Fv1%2Fclasses%2F111&classOfferings=https%3A%2F%2Flearn.portal.staging.concord.org%2Fapi%2Fv1%2Fofferings%3Fclass_id%3D111&logging=true&offering=https%3A%2F%2Flearn.portal.staging.concord.org%2Fapi%2Fv1%2Fofferings%2F112&reportType=offering&username=google-118170338932514291325&authDomain=https://learn.portal.staging.concord.org&resourceLinkId=112>

### Student Launch

Original URL:
<https://collaborative-learning.concord.org/branch/master/?unit=msa&problem=1.4&token=16c1c896e36d24eeb329508142bc6312&domain=https://learn.portal.staging.concord.org/&domain_uid=114>

Localhost updated With OAuth2
<http://localhost:8080/?unit=msa&problem=1.4&domain=https://learn.portal.staging.concord.org/&domain_uid=114&authDomain=https://learn.portal.staging.concord.org&resourceLinkId=112>

## Future Work

- update Portal with a new launch option for students and reports which includes the `authDomain` and `resourceLinkId` params.
- when the URL includes a current user id, we should pass this to the portal during the OAuth2 flow. This way if a different user is signed into the portal, the portal can give them them the option to logout and login with the correct user. This can happen when testing different users, it can also happen when a computer is shared by multiple students. If the wrong user is logged in the current message is confusing: "Error: Unable to get classInfoUrl or offeringId"
- add OAuth2 tests. We should be able to at least test that CLUE redirects to the authDomain and handles loading the parameters when it is loaded with the parameters after the user has logged in at the Portal.

## Notes on parameter names

It is tempting to use the existing `domain` url parameter, but that would cause problems because CLUE wouldn't be able tell the difference between a nonce token Portal launch and OAuth2 Portal launch. But if we drop support for the nonce token Portal launch we might want to consolidate the two parameters. In the AP, portal-report, and researcher report SPAs the URL param is `auth-domain` instead of the `authDomain` used in CLUE. I switched to camel case in CLUE because that is our convention, and if CLUE projects are going to fund a new OAuth2 Portal launch type we might as well use that as an opportunity to switch preferred camel case style.

## Handling Researcher Launches

To enable researcher launches two additional parameters are sent to the portal when requesting the portal JWT and Firebase JWT:

- `researcher=true`
- `target_user_id=USER_ID`

The `researcher=true` parameter causes the portal to skip the usual learner/teacher checks and instead checks if the user has access to the `target_user_id` user id as either an admin, project admin or researcher.  If the user does have access a JWT is generated with the `user_type` claim set to `researcher`.  CLUE then then uses the `researcher` user_type to alter the UI.

Further requests to the portal for the class and offering information also pass the `researcher=true` parameter if it is set in the CLUE query params.  This overrides the portals anonymization check to always anonymize the student info.  This is important as the user launching CLUE may have higher privileges like admin or project admin access to the user which normally would cause the student info to not be anonymized.

## Tech Debt

- figure out a way to handle branches with the OAuth2 redirects, so we don't have to update the portal configuration each time we want to test a new branch.
- simplify params used by a report launch of CLUE. With just the resourceLinkId and a domain it can discover all of the information it needs for the report. This makes the report launch more symmetric with the student launch. Especially if the offering api (or perhaps new resourceLinkId api) provided info about class (or context). The biggest problem with using a single id like that is that either we need a dynamic api where we can specify the shape of the result, or we have to make one request to get the offering info, wait for it, and then make a second request to get the class info. The next bullet can be used to simplify this.
- update the portal APIs so it is easier for apps like CLUE to get all of the info they need for a teacher and a student via a single request. But note that if the user is a researcher and not a student or teacher in the class, then the response should not include student names. And it should only include students that have consented for their work to be visible to researchers.
- consider changing urlParams approach so it is an interface to the actual URL. This way if the URL is changed then any code accessing the urlParams will get this updated version. Even better would be to make this observable, so components using url parameters would get re-rendered if the parameter was changed. This way the URL is the source of truth instead of some object that was copied from it.
- something simple like oauth2 redirecting is still downloading all of the javascript needed by CLUE. It looks like it is also downloading the cms libraries, but it is not. These bundles include the common code that both CLUE and the cms code use. To improve the loading time, we'd need to make CLUE loading even more dynamic. So the initial OAuth2 load would not have to wait for all of the CLUE javascript to be loaded. If we make this change, we probably want to optimize it so the other core files start downloading right away, but if all we are doing is oauth2 redirecting we just don't wait for them.
- getClassInfo adds the offeringId to the students and teachers in the ClassInfo object it creates. I think it'd be better to remove this offeringId from these user objects in the ClassInfo. Then anything that needs it will need to access it a different a way. The offeringId is basically a global since CLUE is always launched associated with an assignment (offering). The offeringId of the user ends up being set on the UserModel (which comes from the students in teachers in the ClassInfo). From there it is used by `get activityUrl` to find which of the portalClassOfferings is the active one, to find its activityUrl. It is also used by `getOfferingPath`. This should be refactored because a user does not determine an offering and really it doesn't determine a class either. We should fix things to not make this assumption. In db.ts the offeringId from the UserModel is used to setup the group. This would be the perfect place to pull it from a separate store which which isn't specific to the user. It is also used in app.tsx, in this case the offeringId could be taken from a global store also. So the only unknown spot is all of the places that might be calling getOfferingPath.

## Refactoring out offeringId from UserModel

This isn't really needed for this work. We have the offeringId provided by the resourceLinkId in the url params. But it'd be nice to fix this.

- create an IUserContext interface with user, offering, and class info
- update all of the places that currently pass a user object to getOfferingPath to pass the stores directly which would then implement this interface.
- this way we can remove the class and offering info out of the user object which would then match the actual user concept in the portal.

## Notes on affected code

Old use of `urlParams.token`:

- to figure out the app mode in index.tsx
- to figure out if we are "previewing" in initializeApp (initialize-app.tsx). This approach might be broken if we drop the token from student launches.
- bearerToken in authenticate (auth.ts)
- token param in getPortalClassOfferings (portal-apis.ts)

Use of `bearerToken` in auth.ts

- figuring out if we're in preview mode from the portal, like in initialize-app.tsx
- bailing out if it isn't set when the appMode is authed
- getting the portal JWT with `getPortalJWTWithBearerToken`
- getting the firebase JWT with `getFirebaseJWTWithBearerToken`

Update of urlParams:

- after initializeAuthorization has restored the url params from local storage we need to reprocess the url params. This is done by updating the urlParams object in place. This object is imported as a global into several files in CLUE, so updating it in place is the easiest way to handle the restored url params. See the urlParams tech debt above which would be an alternative way to handle this.

Main CLUE entry points:

- src/index.tsx (main CLUE app)
- cms/src/admin.tsx (main authoring page)
- src/cms/cms-editor.tsx (embedded CLUE for used in CMS authoring)
- src/doc-editor.tsx (standalone doc editor)

Currently the only place where the OAuth2 support is needed in the main CLUE app.

Loading spinner:
This comes from app.tsx. If the user isn't authenticated yet and the listeners are not listening yet, then the loading is rendered. The listeners are marked as "isListening" until all of their start methods have resolved. This could be relevant since all of the CLUE code has to load before it can redirect to the portal.

The classInfo url is passed to the getClassInfo along with the offeringId, then the user_type, uid, and domain are extracted from the portalJWT. The user_type is then passed to the getPortalOfferings function. The user_type is also used to figure out which user the current user is in the class. This could be removed and we could search both the teachers and students for the current user id. There might be some timing issues to deal with though. The user type might be used by CLUE before the class info data comes back from the Portal.

getClassInfo adds the offeringId to the students and teachers in the ClassInfo object it creates. See tech debt above for a way to improve this.

An important note is that there is an authenticatedUser that comes from the portal auth methods. This user is the one that gets the offeringId set. And then this user is then provided by `authenticate`. The caller of authenticate then takes this user and sets up the UserModel (stores.user).

`getPortalOfferings` - this uses the userType to decide if it should actually fetch the offerings of the current user. This is because we only show the list of offerings to teachers and don't let the students change their offering. With the new OAuth code we could allow the student to switch offerings at least in theory. However we would then lose some information in the portal that is recorded when the student launches a assignment from the portal. So we probably don't want to enable this yet.

## Review of the ways CLUE can be launched

Note that preview launch is the same for students and teachers, the student preview launch is included just to make it clear that even though we try to hide this kind of launch, it is possible to do.

- as a student on the assignment page:
  <https://collaborative-learning.concord.org/branch/master/>?
  - unit=msa
  - problem=1.4
  - token=6c6ed7997286d70835a75f9b18a83f83
  - domain=<https://learn.portal.staging.concord.org/>
  - domain_uid=114
- as a student that happens to find the preview page:
  <https://collaborative-learning.concord.org/branch/master/>?
  - unit=msa
  - problem=1.4
  - domain=https%3A%2F%2Flearn.portal.staging.concord.org%2F
  - domain_uid=114
- as a teacher opening "dashboard link" on the class page (an external report):
  <https://collaborative-learning.concord.org/branch/master/>?
  - class=https%3A%2F%2Flearn.portal.staging.concord.org%2Fapi%2Fv1%2Fclasses%2F111
  - classOfferings=https%3A%2F%2Flearn.portal.staging.concord.org%2Fapi%2Fv1%2Fofferings%3Fclass_id%3D111
  - logging=true
  - offering=https%3A%2F%2Flearn.portal.staging.concord.org%2Fapi%2Fv1%2Fofferings%2F112
  - reportType=offering
  - token=a4ebf7f5aae51671a6b7081abfd1adb0
  - username=google-118170338932514291325
- as a teacher previewing it from the class page or search results:
  <https://collaborative-learning.concord.org/branch/master/>?
  - unit=msa
  - problem=1.4
  - domain=https%3A%2F%2Flearn.portal.staging.concord.org%2F
  - domain_uid=9
- as a researcher trying to look at a specific answer. This is not currently supported by CLUE but the AP report supports it. If we add an OAuth2 launching option to the portal we should to take this case into account. And this type of launch is useful for reference when we add support to CLUE so a researcher can open a specific document.
  <https://portal-report.concord.org/branch/master/index.html>?
  - auth-domain=https%3A%2F%2Flearn-report.portal.staging.concord.org
  - firebase-app=report-service-dev
  - sourceKey=authoring.lara.staging.concord.org
  - iframeQuestionId=mw_interactive_157
  - class=https%3A%2F%2Flearn-report.portal.staging.concord.org%2Fapi%2Fv1%2Fclasses%2F94
  - offering=https%3A%2F%2Flearn-report.portal.staging.concord.org%2Fapi%2Fv1%2Fofferings%2F92
  - studentId=90
  - answersSourceKey=activity-player.concord.org

## Ramifications for Page reloading

1. Because the current portal student assignment launch does not include the offering id in the URL, we'll need to add it to the URL after launch so a reload can work properly. Or we need to update the portal launch to include this offering id. This id is now supported as the resourceLinkId. My preference is to update the portal launching, so CLUE doesn't have to rewrite the URL after launch.
2. The teacher report launch includes 3 URLs. To make these URLs more concise it would be useful to simplify that to just the resourceLinkId and then CLUE can use that id to request the information from the portal so the 3 URLs aren't needed.
3. The teacher report launch doesn't include the domain and domain_uid params. If it did, this domain could be the base URL for 3 urls above. Or we can use the authDomain param for this base.
4. The report links are used in the researcher details (or answer) report, in this case the user opening the link is a researcher, but they are looking at the data from a different user (a student). In the portal-report this is handled by passing a `studentId`, `auth-domain`, `class`, and `offering` params. The portal-report passes the studentId as the target_user_id when it requests the JWT from the portal. Note the `domain` and `domain_uid` are absent. The `domain_uid` should not be set because we don't know who the user will be that clicks on the link from the report.
