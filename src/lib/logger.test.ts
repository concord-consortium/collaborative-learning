import mock from "xhr-mock";
import { IStores, createStores } from "../models/stores";
import { Logger, LogEventName } from "./logger";
import { ToolTileModel } from "../models/tools/tool-tile";
import { defaultTextContent } from "../models/tools/text/text-content";

describe("logger", () => {
  let stores: IStores;

  beforeEach(() => {
    mock.setup();
    stores = createStores({
      appMode: "test"
    });

    Logger.initializeLogger(stores);
  });

  afterEach(() => {
    mock.teardown();
  });

  it("can log a simple message with all the appropriate properties", async (done) => {
    mock.post(/.*/, (req, res) => {
      expect(req.header("Content-Type")).toEqual("application/json; charset=UTF-8");

      const request = JSON.parse(req.body());

      expect(request.application).toBe("CLUE");
      expect(request.username).toBe("0");
      expect(request.session).toEqual(expect.anything());
      expect(request.time).toEqual(expect.anything());
      expect(request.event).toBe("CREATE_TILE");
      expect(request.method).toBe("do");
      expect(request.parameters).toEqual({foo: "bar"});

      done();
      return res.status(201);
    });

    await Logger.log(LogEventName.CREATE_TILE, {foo: "bar"});
  });

  it("can log tile creation", async (done) => {
    const tile = ToolTileModel.create({content: defaultTextContent()});

    mock.post(/.*/, (req, res) => {
      const request = JSON.parse(req.body());

      expect(request.event).toBe("CREATE_TILE");
      expect(request.parameters.objectId).toBe(tile.id);
      expect(request.parameters.objectType).toBe("Text");

      done();
      return res.status(201);
    });

    await Logger.logTileEvent(LogEventName.CREATE_TILE, tile);
  });
});
