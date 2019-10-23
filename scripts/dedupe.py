#!/usr/local/bin/python

# A script to compare the contents of the classes in the "authed/portals/learn_concord_org"
# branch of the firebase database to the contents of the classes in the
# "archived/portals/learn_concord_org-{DATE}" branch and to optionally delete classes
# whose contents match from the source. This is designed to be used after the corresponding
# archive script has archived copies of the class contents. Classes to be preserved can be
# specified in the "retainedClasses" set below.

import hashlib
import json
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
retainedClasses = { "8a55c706e857b21a061316e9b25cdde142348de4ed933e8b" }
# extract list of class keys (class hashes)
srcClassList = srcClassesRef.get(False, True)
# loop through class hashes
for i, classHash in enumerate(sorted(srcClassList)):
  print(f'{twoChar(i + 1)}: {classHash}')
  srcClassRef = srcClassesRef.child(classHash)
  dstClassRef = dstClassesRef.child(classHash)
  print('..srcPath:', srcClassRef.path)
  print('..dstPath:', dstClassRef.path)
  # compare MD5 hashes of class contents
  srcClassContentHash = hashlib.md5(json.dumps(srcClassRef.get()).encode('utf-8'))
  dstClassContentHash = hashlib.md5(json.dumps(dstClassRef.get()).encode('utf-8'))
  if classHash in retainedClasses:
    # retain classes listed in retainedClasses
    print(f'..retaining class {classHash}')
  elif srcClassContentHash.hexdigest() == dstClassContentHash.hexdigest():
    # delete classes from source that have been successfully archived
    print(f'..deleting! class {classHash}')
    srcClassRef.delete()
  else:
    # don't delete classes if MD5 hash doesn't match
    print(f'..no-match! class {classHash}')
