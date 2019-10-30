#!/usr/local/bin/python

# A script to archive the classes in the "authed/portals/learn_concord_org" branch
# of the firebase database to the "archived/portals/learn_concord_org-{DATE}" branch.
# Note that firebase limits the size of a single write using the REST API to 256 MB
# (cf. https://firebase.google.com/docs/database/usage/limits).

import firebase_admin
from firebase_admin import credentials
from firebase_admin import db
from datetime import date

# cf. https://rakibul.net/fb-realtime-db-python
# Fetch the service account key JSON file contents
cred = credentials.Certificate('./scripts/serviceAccountKey.json')
# Initialize the app with a service account, granting admin privileges
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://collaborative-learning-ec215.firebaseio.com'
})

def twoChar(d):
    return f' {d}' if d < 10 else f'{d}'

def strDate():
    d = date.today()
    return f'{d.year}-{twoChar(d.month)}-{twoChar(d.day)}'

srcRoot = 'authed'
dstRoot = 'archived'
srcPortalId = 'learn_concord_org'
dstPortalId = f'learn_concord_org-{strDate()}'
srcClassesRef = db.reference(f'{srcRoot}/portals/{srcPortalId}/classes')
dstClassesRef = db.reference(f'{dstRoot}/portals/{dstPortalId}/classes')
# extract list of class keys (class hashes)
shallowClasses = srcClassesRef.get(False, True)
# loop through class hashes
for i, classHash in enumerate(sorted(shallowClasses)):
    print(f'{twoChar(i + 1)}: {classHash}')
    srcClassRef = srcClassesRef.child(classHash)
    dstClassRef = dstClassesRef.child(classHash)
    print('..srcPath:', srcClassRef.path)
    print('..dstPath:', dstClassRef.path)
    # retrieve source class content
    classContent = srcClassRef.get()
    print('..writing:', dstClassRef.path)
    # write archived class content
    dstClassRef.set(classContent)
