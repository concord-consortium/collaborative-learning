# Access document scope

CLUE tiles often need to access stuff at the document level to get their job done.

Sometimes the code needing access is in the view layer (components and hooks) and sometimes it is in the model layer. The view layer has access to the models, but not vice versa, so anything described below about the model layer can be used by the views.

Because the view can use the model layer mechanisms code that is based on them can be used in more places.

More details to come soon hopefully including a complete list of all of the ways the code accesses the document scope.
