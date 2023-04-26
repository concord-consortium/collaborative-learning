import { AnimationPhase, humidAnimationPhases, humidifier } from "../controls/demo-output-control-assets";

export class BinaryStateChangeAnimation {
  private key: string;
  public currentPhase: AnimationPhase;
  public intervalId: any;
  public currentFrameIndex: number = 0;

  constructor(str: string){
    this.key = str;
    this.intervalId = null;
  }

  public setAnimationPhase(phase: AnimationPhase) {
    this.currentPhase = phase;
  }

  public setImageSrc(str: string) {
    const img = document.getElementById("humidifier-frame") as HTMLImageElement;
    img.src = str;
  }

  public playFrames(frames: string[]) {
    frames.forEach((frame, i) => {
      setTimeout(() => {
        this.setImageSrc(frame);
      }, 100 * i);
    });
  }

  public setFrame(frame: string) {
    this.setImageSrc(frame);
  }

  public advanceFrame(frames: string[]) {
    this.currentFrameIndex = (this.currentFrameIndex + 1) % frames.length;
    this.setImageSrc(frames[this.currentFrameIndex]);
  }

  public startLooping() {
    if(this.intervalId === null) {
      this.intervalId = setInterval(() => {
        this.advanceFrame(humidAnimationPhases.stayOn.frames);
      }, 100);
    }
  }

  public stopLooping() {
    if(this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public setAnimationPhaseState(fromValue: number, toValue: number) {
    if (fromValue === 0 && toValue === 1) {
      this.setAnimationPhase(humidAnimationPhases.rampUp);
    }

    if (fromValue === 1 && toValue === 0) {
      this.setAnimationPhase(humidAnimationPhases.rampDown);
    }

    if (fromValue === 0 && toValue === 0) {
      this.setAnimationPhase(humidAnimationPhases.stayOff);
    }

    if (fromValue === 1 && toValue === 1) {
      this.setAnimationPhase(humidAnimationPhases.stayOn);
    }

    const alreadyLooping = this.intervalId !== null;

    // console.log("| ACT? ", this.currentPhase.name, {alreadyLooping});

    if (this.currentPhase.name === "rampUp") {
      if (this.intervalId === null) {
        this.playFrames(humidAnimationPhases.rampUp.frames);
        setTimeout(() => { this.startLooping(); }, 400);
      }
    }

    if (this.currentPhase.name === "rampDown") {
      if (this.intervalId !== null) {
        this.stopLooping();
        this.playFrames(humidAnimationPhases.rampDown.frames);
      }
    }
  }
}

