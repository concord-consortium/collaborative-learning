export class Sequence {
  constructor(
    public frames: any[]
  ) {
  }

  getFrameIndex(percent: number) {
    const numFrames = this.frames.length;
    let frameIndex = Math.floor(numFrames * percent);
    frameIndex = Math.max(frameIndex, 0);
    frameIndex = Math.min(frameIndex, numFrames - 1);
    return frameIndex;
  }

  getFrame(percent: number) {
    return this.frames[this.getFrameIndex(percent)];
  }
}

export abstract class Animator<S extends Sequence> {
  setImage: (img: any) => void;
  period: number;
  currentFrame?: number;
  currentSequence?: S;
  interval?: NodeJS.Timeout;

  constructor(setImage: (img: any) => void, period: number) {
    this.setImage = setImage;
    this.period = period;
  }

  startIntervalIfNecessary() {
    if (this.interval) return;
    this.interval = setInterval(this.advanceFrame, this.period);
  }

  // Use an arrow function so it is bound to this
  stopInterval = () => {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = undefined;
  };

  renderFrame(sequence: S, frame: number) {
    const { length } = sequence.frames;
    if (frame >= length || frame < 0) {
      console.warn("Animator: requestedFrame is out of bounds", frame);
      return false;
    }
    this.setImage(sequence.frames[frame]);
    this.currentSequence = sequence;
    this.currentFrame = frame;
    return true;
  }

  abstract advanceFrame: () => void;
}

export class StateSequence extends Sequence {
  nextForward?: StateSequence;
}

export type PlayDirection = "forward" | "backward";

export class StateAnimator extends Animator<StateSequence> {
  requestedFrame?: number;
  requestedSequence?: StateSequence;


  /**
   * Play the sequence starting from frame 0
   *
   * @param sequence
   */
  play(sequence: StateSequence) {
    this.requestedSequence = sequence;
    this.requestedFrame = 0;
    this.startIntervalIfNecessary();
  }

  renderRequestedFrame() {
    if (!this.requestedSequence) {
      console.warn("Animator: no requested sequence");
      return false;
    }
    if (this.requestedFrame === undefined) {
      console.warn("Animator: no requestedFrame");
      return false;
    }
    this.renderFrame(this.requestedSequence, this.requestedFrame);
    this.requestedSequence = undefined;
    this.requestedFrame = undefined;
  }

  advanceFrame = () => {
    const { requestedSequence, currentSequence, currentFrame } = this;

    // If we already have a requestedSequence it means someone called play.
    if (requestedSequence) {
      this.renderRequestedFrame();
      return;
    }

    // If we don't have a requested sequence then we are going to compute
    // the next frame and possibly a new sequence based on currentSequence.
    // Without a currentSequence or currentFrame we've got no where to go.
    if (!currentSequence || currentFrame === undefined) {
      this.stopInterval();
      return;
    }

    const { frames } = currentSequence;

    const nextFrame = currentFrame + 1;

    if (nextFrame >= frames.length) {

      if (currentSequence.nextForward) {
        // We hit the end of a sequence, and it has a following sequence
        this.renderFrame(currentSequence.nextForward, 0);
      } else {
        // We hit the end of sequence without a following sequence
        // so stop and don't update anything
        this.stopInterval();
      }
      return;
    }

    // our next frame is valid
    this.renderFrame(currentSequence, nextFrame);
  };
}

export class TargetAnimator extends Animator<Sequence>{
  targetFrame?: number;
  targetSequence?: Sequence;

  // It is possible we'll need a way to a way to jump to the targetFrame
  // instead of animating to it. To do that with this function we'd need
  // to call play with a dummy sequence and then call it again with the
  // original sequence.
  playToFrame(sequence: Sequence, targetFrame: number) {
    this.targetSequence = sequence;
    this.targetFrame = targetFrame;

    this.startIntervalIfNecessary();
  }

  playToPercent(sequence: Sequence, targetPercent: number) {
    const targetFrame = sequence.getFrameIndex(targetPercent);
    this.playToFrame(sequence, targetFrame);
  }

  /**
   * Get the next frame regardless of the number of frames.
   *
   * @returns
   */
  getPossibleNextFrameIndex() {
    const {currentFrame, targetFrame} = this;
    if (currentFrame === undefined || targetFrame === undefined) {
      console.warn("TargetAnimator: unknown nextFrame", {currentFrame, targetFrame});
      return undefined;
    }
    if (targetFrame > currentFrame) {
      // TODO: base this on wall time instead of steps
      return currentFrame + 1;
    }
    if (targetFrame < currentFrame) {
      return currentFrame - 1;
    }

    // They are equal
    return currentFrame;
  }

  advanceFrame = () => {
    const { currentSequence, targetSequence, targetFrame } = this;

    if (!targetSequence || (targetFrame === undefined)) {
      console.warn("TargetAnimator: no targetSequence or targetFrame", {targetSequence, targetFrame});
      this.stopInterval();
      return;
    }

    if (targetSequence !== currentSequence) {
      // The user has switched the sequence so we just jump to the target frame
      this.renderFrame(targetSequence, targetFrame);
      // We just displayed the target frame so we don't need to keep animating
      this.stopInterval();
      return;
    }

    const { frames } = targetSequence;
    const nextFrame = this.getPossibleNextFrameIndex();
    if (nextFrame === undefined) {
      // There is something wrong with the currentFrame or targetFrame
      this.stopInterval();
      return;
    }

    if (nextFrame === this.currentFrame) {
      // We aren't changing frames, this means we hit the target frame
      this.stopInterval();
      return;
    }

    if (nextFrame >= frames.length || nextFrame < 0) {
      // Our target frame must be out of range
      console.warn("Animator: nextFrame out of range", {nextFrame, framesLength: frames.length});
      this.stopInterval();
      return;
    }

    // our next frame is valid
    this.renderFrame(targetSequence, nextFrame);
  };
}
