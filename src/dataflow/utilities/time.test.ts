import { GetLocalTimeStamp } from "./time";

const time = 1573761933537; // Thu Nov 14 2019 12:05:33 GMT-0800 (Pacific Standard Time)
const timestamp = GetLocalTimeStamp(time); // 14NOV19-12:05:33
const localDaySecondDigit = timestamp[1];
const localHourFirstDigit = timestamp[8];
const localHourSecondDigit = timestamp[9];

describe("Human Readable Timestamp", () => {
  it("can return the day", () => {
    expect(timestamp[0]).toContain("1");
    expect(timestamp[1]).toContain(localDaySecondDigit);
  });
  it("can return the month", () => {
    expect(timestamp[2]).toContain("N");
    expect(timestamp[3]).toContain("O");
    expect(timestamp[4]).toContain("V");
  });
  it("can return the year", () => {
    expect(timestamp[5]).toContain("1");
    expect(timestamp[6]).toContain("9");
  });
  it("can return a tack", () => {
    expect(timestamp[7]).toContain("-");
  });
  it("can return a colon", () => {
    expect(timestamp[10]).toContain(":");
    expect(timestamp[13]).toContain(":");
  });
  it("can return the hour", () => {
    expect(timestamp[8]).toContain(localHourFirstDigit);
    expect(timestamp[9]).toContain(localHourSecondDigit);
  });
  it("can return the minutes", () => {
    expect(timestamp[11]).toContain("0");
    expect(timestamp[12]).toContain("5");
  });
  it("can return the seconds", () => {
    expect(timestamp[14]).toContain("3");
    expect(timestamp[15]).toContain("3");
  });
  it("can return the correct format of the timestamp", () => {
    expect(timestamp).toContain(`1${localDaySecondDigit}NOV19-${localHourFirstDigit}${localHourSecondDigit}:05:33`);
    expect(timestamp).toHaveLength(16);
  });
});
