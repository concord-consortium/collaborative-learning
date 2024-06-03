import bulbOn from "../../../assets/lightbulb-on.png";
import bulbOff from "../../../assets/lightbulb-off.png";

import backyardClaw07 from "../../../assets/backyard-claw/Claw_close_08.png";
import backyardClaw06 from "../../../assets/backyard-claw/Claw_close_07.png";
import backyardClaw05 from "../../../assets/backyard-claw/Claw_close_06.png";
import backyardClaw04 from "../../../assets/backyard-claw/Claw_close_05.png";
import backyardClaw03 from "../../../assets/backyard-claw/Claw_close_04.png";
import backyardClaw02 from "../../../assets/backyard-claw/Claw_close_03.png";
import backyardClaw01 from "../../../assets/backyard-claw/Claw_close_02.png";
import backyardClaw00 from "../../../assets/backyard-claw/Claw_close_01.png";

import paddle from "../../../assets/grabber/Paddle.png";
import grabber07 from "../../../assets/grabber/claw/Claw_close_08.png";
import grabber06 from "../../../assets/grabber/claw/Claw_close_07.png";
import grabber05 from "../../../assets/grabber/claw/Claw_close_06.png";
import grabber04 from "../../../assets/grabber/claw/Claw_close_05.png";
import grabber03 from "../../../assets/grabber/claw/Claw_close_04.png";
import grabber02 from "../../../assets/grabber/claw/Claw_close_03.png";
import grabber01 from "../../../assets/grabber/claw/Claw_close_02.png";
import grabber00 from "../../../assets/grabber/claw/Claw_close_01.png";
import cord00 from "../../../assets/grabber/cord/Cord_tilt_down_08.png";
import cord01 from "../../../assets/grabber/cord/Cord_tilt_down_07.png";
import cord02 from "../../../assets/grabber/cord/Cord_tilt_down_06.png";
import cord03 from "../../../assets/grabber/cord/Cord_tilt_down_05.png";
import cord04 from "../../../assets/grabber/cord/Cord_tilt_down_04.png";
import cord05 from "../../../assets/grabber/cord/Cord_tilt_down_03.png";
import cord06 from "../../../assets/grabber/cord/Cord_tilt_down_02.png";
import cord07 from "../../../assets/grabber/cord/Cord_tilt_down_01.png";
import cord09 from "../../../assets/grabber/cord/Cord_tilt_up_02.png";
import cord10 from "../../../assets/grabber/cord/Cord_tilt_up_03.png";
import cord11 from "../../../assets/grabber/cord/Cord_tilt_up_04.png";
import cord12 from "../../../assets/grabber/cord/Cord_tilt_up_05.png";
import cord13 from "../../../assets/grabber/cord/Cord_tilt_up_06.png";
import cord14 from "../../../assets/grabber/cord/Cord_tilt_up_07.png";
import cord15 from "../../../assets/grabber/cord/Cord_tilt_up_08.png";
import housing from "../../../assets/fan/fan_housing.png";
import blade00 from "../../../assets/fan/fan_blade_00.png";
import blade01 from "../../../assets/fan/fan_blade_01.png";
import motor from "../../../assets/fan/fan_motor.png";
import hBase from "../../../assets/humidifier/humidifier_base.png";
import mist00 from "../../../assets/humidifier/mist_00.png";
import mist01 from "../../../assets/humidifier/mist_01.png";
import mist02 from "../../../assets/humidifier/mist_02.png";
import mist03 from "../../../assets/humidifier/mist_03.png";
import mist04 from "../../../assets/humidifier/mist_04.png";
import mist05 from "../../../assets/humidifier/mist_05.png";
import mist06 from "../../../assets/humidifier/mist_06.png";
import mist07 from "../../../assets/humidifier/mist_07.png";
import mist08 from "../../../assets/humidifier/mist_08.png";
import mist09 from "../../../assets/humidifier/mist_09.png";
import mist10 from "../../../assets/humidifier/mist_10.png";
import mist11 from "../../../assets/humidifier/mist_11.png";

export const lightBulbOn = bulbOn;
export const lightBulbOff = bulbOff;

export const grabberFrames = [
  backyardClaw00, backyardClaw01, backyardClaw02, backyardClaw03,
  backyardClaw04, backyardClaw05, backyardClaw06, backyardClaw07
];

export const grabberPaddle = paddle;

export const advancedGrabberFrames = [
  grabber00, grabber01, grabber02, grabber03,
  grabber04, grabber05, grabber06, grabber07
];

// cord07 and cord08 are the same.
// We want an odd number of frames so there is a frame at the middle of the rotation
export const grabberCordFrames = [
  cord00, cord01, cord02, cord03,
  cord04, cord05, cord06, cord07,
  cord09, cord10, cord11,
  cord12, cord13, cord14, cord15
];

export const fanHousing = housing;
export const fanMotor = motor;
export const fanFrames = [ blade00, blade01 ];

export const humidifier = hBase;

export const humidOffFrames = [ mist00 ];
export const humidStartingFrames = [ mist01, mist02, mist03, mist04, mist05 ];
export const humidLoopFrames = [ mist06, mist07, mist08 ];
export const humidEndingFrames = [ mist09, mist10, mist11, mist00 ];
