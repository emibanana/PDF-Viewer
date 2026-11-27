import { beforeEach, describe, expect, it } from "vitest";
import {
  cancelCalibration,
  getCalibrationState,
  placeCalibrationPoint,
  restartCalibration,
  startCalibration,
} from "./calibrateStore";

beforeEach(() => cancelCalibration());

describe("calibration clicks", () => {
  it("ignores clicks while not calibrating", () => {
    placeCalibrationPoint({ pageIndex: 0, x: 1, y: 1 });
    expect(getCalibrationState().start).toBeNull();
  });

  it("places the start, then the end with the distance between them", () => {
    startCalibration();
    placeCalibrationPoint({ pageIndex: 2, x: 0, y: 0 });
    expect(getCalibrationState().start).toEqual({ pageIndex: 2, x: 0, y: 0 });
    placeCalibrationPoint({ pageIndex: 2, x: 3, y: 4 });
    expect(getCalibrationState().span?.distancePts).toBe(5);
  });

  it("starts over when the second click is on another page", () => {
    startCalibration();
    placeCalibrationPoint({ pageIndex: 0, x: 0, y: 0 });
    placeCalibrationPoint({ pageIndex: 1, x: 5, y: 5 });
    expect(getCalibrationState().span).toBeNull();
    expect(getCalibrationState().start?.pageIndex).toBe(1);
  });

  it("ignores a second click on the same spot", () => {
    startCalibration();
    placeCalibrationPoint({ pageIndex: 0, x: 2, y: 2 });
    placeCalibrationPoint({ pageIndex: 0, x: 2, y: 2 });
    expect(getCalibrationState().span).toBeNull();
  });

  it("takes no more clicks while the distance is being entered", () => {
    startCalibration();
    placeCalibrationPoint({ pageIndex: 0, x: 0, y: 0 });
    placeCalibrationPoint({ pageIndex: 0, x: 10, y: 0 });
    placeCalibrationPoint({ pageIndex: 0, x: 50, y: 0 });
    expect(getCalibrationState().span?.end.x).toBe(10);
  });

  it("goes back to picking after a restart and idle after a cancel", () => {
    startCalibration();
    placeCalibrationPoint({ pageIndex: 0, x: 0, y: 0 });
    placeCalibrationPoint({ pageIndex: 0, x: 10, y: 0 });
    restartCalibration();
    expect(getCalibrationState()).toEqual({ active: true, start: null, span: null });
    cancelCalibration();
    expect(getCalibrationState().active).toBe(false);
  });
});
