# Firebase Schema

The core design elements of the schema are:

1. The top level keys are `test`, `dev` and `authed` where `test` and `dev` use subkeys based on the user id to create unique environments per Firebase user.  Unit tests automatically delete any data added.
2. Under the top level keys are the  `users` and `portals` keys with sub-keys under `portals` for each portal domain found during authentication.  There will be a special `localhost` domain used for portals when in dev mode.  All data except for user data will live under a portal domain.
3. Keep the object heirarchy shallow and use full path references (using the portal as the root) when storing "pointers" from one object to the other.  Using full paths lets us to both be self documenting and potentially restructure the schema in later versions.
4. All objects will have a version property.
5. Any objects that can be loaded as a list should contain the minimum amount of metadata to display the information on the UI with full path references to larger objects.
6. All read-only write-once data (such as "publications") will be stored using Firebase storage.

## Objects

### Users

Stored under `users` as `users/<portal-user-id>` where `portal-user-id` is an opaque string (in the form `<userid>@<portal>`) that is retrieved during authentication with the portal.  All data under `users` will be readable by all users but only writable by the authenticated user with the specific `portal-user-id`.

Each user key stores

1. The users `group-id` for that user

#### User Problems

Stored under `users/<portal-id>/problems/<problem-id>` using the problem id passed in the query string.

Each problem key stores

1. The users `current-tab` for that problem
2. Potentially store other ui element selections.

#### User Documents

Stored under `users/<portal-id>/documents/<document-id>` using Firebase pushes to generate keys for the `document-id`.

This stores the serialized document model.

### Classes

Stored under `portals/<portal-domain>/classes/<class-hash>` where `class-hash` is retrieved during authentication.

### Groups

Stored under `portals/<portal-domain>/classes/<class-hash>/groups` where `class-hash` is retrieved during authentication.
