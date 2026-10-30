import { makeAutoObservable } from "mobx";
import { uniqueId } from "../../../utilities/js-utils";
import { AttemptOutcome, AttemptStep, DeviceChoice, IConnectFailure, kStallKinds } from "./connect-failures";

export type AttemptTrigger = "connect" | "reconnect";

// The connect pane's two views: the device list (Connect buttons) or the connected actions.
export type AttemptView = "devices" | "actions";

export type StepTime = "chooserClosed" | "opened" | "firmwareChecked" | "updateStarted"
  | "updateFinished" | "active" | "firstData";

/**
 * One Connect or Reconnect, from the click to its outcome, and on until its device goes away: a
 * stall ends the attempt, but the device stays open and its first data can still arrive.
 * `DeviceConnection` drives it; the pane, the help and the log read it.
 */
export class ConnectionAttempt {
  readonly id: string;
  readonly choice: DeviceChoice;
  readonly trigger: AttemptTrigger;
  // Date.now() at the click.
  readonly startedAt: number;
  step: AttemptStep;
  // When each step happened, in ms from startedAt. Only steps that happened are recorded.
  steps: Partial<Record<StepTime, number>> = {};
  updatePercent: number | undefined = undefined;
  view: AttemptView;
  actionsEnabled = false;
  outcome: AttemptOutcome | undefined = undefined;
  failure: IConnectFailure | undefined = undefined;
  firmware: { found: string | null; updated: boolean } | undefined = undefined;
  // The first data arrived after a stall had ended the attempt.
  recovered = false;
  // When the current step started, in ms from startedAt.
  private stepStartedMs = 0;

  constructor(choice: DeviceChoice, trigger: AttemptTrigger, id = uniqueId()) {
    this.id = id;
    this.choice = choice;
    this.trigger = trigger;
    this.startedAt = Date.now();
    // A Reconnect reopens the known device without the chooser when it can.
    this.step = trigger === "connect" ? "choose" : "open";
    // A Reconnect keeps the connected actions, so the focused Reconnect button stays in place.
    this.view = trigger === "connect" ? "devices" : "actions";
    makeAutoObservable<ConnectionAttempt, "stepStartedMs">(this, {
      id: false, choice: false, trigger: false, startedAt: false, stepStartedMs: false,
      elapsedMs: false, stepElapsedMs: false
    });
  }

  get ended() {
    return this.outcome !== undefined;
  }

  get elapsedMs() {
    return Date.now() - this.startedAt;
  }

  // How long the current step has run.
  get stepElapsedMs() {
    return this.elapsedMs - this.stepStartedMs;
  }

  setStep(step: AttemptStep) {
    this.step = step;
    this.stepStartedMs = this.elapsedMs;
  }

  chooserClosed() {
    this.record("chooserClosed");
    this.setStep("open");
  }

  // The port or USB device is open, so the pane shows the connected actions, still disabled.
  opened(next: AttemptStep) {
    this.record("opened");
    this.view = "actions";
    this.setStep(next);
  }

  // `found` describes the firmware the board answered with, or is null when it didn't answer.
  firmwareChecked(found: string | null, willUpdate: boolean) {
    this.record("firmwareChecked");
    this.firmware = { found, updated: false };
    if (willUpdate) {
      this.record("updateStarted");
      this.setStep("update");
    }
  }

  updateProgress(percent: number) {
    this.updatePercent = percent;
  }

  updateFinished() {
    this.record("updateFinished");
    if (this.firmware) this.firmware = { ...this.firmware, updated: true };
  }

  // The device became the active device. This may come after a stall ended the attempt.
  activated() {
    this.record("active");
    if (!this.ended) this.setStep("waitForData");
  }

  dataArrived() {
    this.record("firstData");
    if (this.ended) this.recovered = true;
  }

  end(outcome: AttemptOutcome, failure?: IConnectFailure) {
    this.outcome = outcome;
    this.failure = failure;
    if (outcome === "connected" || (kStallKinds as readonly AttemptOutcome[]).includes(outcome)) {
      this.actionsEnabled = true;
    } else {
      this.view = "devices";
    }
  }

  private record(time: StepTime) {
    this.steps = { ...this.steps, [time]: this.elapsedMs };
  }
}
