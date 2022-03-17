
// Try importing shared models first since they will be referenced
// by the some of the models
import "./plugins/shared-variables/shared-variables-registration";

// import all tools so they are registered
import "./models/tools/unknown-content";
import "./models/tools/placeholder/placeholder-registration";
import "./models/tools/drawing/drawing-registration";
import "./models/tools/text/text-registration";
import "./models/tools/table/table-registration";
import "./models/tools/image/image-registration";
import "./models/tools/geometry/geometry-registration";
import "./plugins/vlist/vlist-registration";
