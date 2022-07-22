/*
  TODO (CLAW): considering making this simpler version operational,
  right now still using updated version of ccemgfsr

  Possible Simplifications:
  1. No choice for sensitivity - this would allow a statc Y axis on the minigraph
  2. No "open" or "close" modes - just percentage closed and hold


  This is a Sketch meant to be run on an Arduino UNO,
  using the BackYard Brains Muscle Spiker Shield,
  and interfacing with Concord Consortium Dataflow Tile
  in the CLUE Collaborative Learning Environment
*/

#include <Servo.h>
#define SERVO_PIN 2                         // pin for servo motor
#define GRIPPER_MINIMUM_STEP 5              // 5 degree dead zone (used to avoid aiming oscilation)
#define MINIMUM_SERVO_UPDATE_TIME 100       // update servo position every 100ms
#define NUM_LED 6                           //number of LEDs in LED bar


int threshold = 0;                          // threshold voltage for touch detected (modify based on sensor placement)
int emgReading;                             // measured value for EMG
int fsrReading;                             // measured value for surface pressure sensor
int emgSaturationValue = 720;               // hardcoded EMG saturation value
int readingFromDataflow;                    // measured value for EMG as passed through Dataflow
unsigned long oldTime = 0;                  // timestamp of last servo angle update (ms)
int oldDegrees = 0;                         // old value of angle for servo
int newDegree;                              // new value of angle for servo

String fromComputer;                        // we use Serial.readStringUntil() to get our full chunk, so we need this
Servo Gripper;                              // servo for gripper
byte ledPins[] = {8, 9, 10, 11, 12, 13};    //pins for LEDs in LED bar
byte ledbarHeight = 0;                      //temporary variable for led bar height
String emgId = "emg";                       // key for Dataflow to know what sensor this came from
String fsrId = "fsr";                       // key for Dataflow to know what sensor this came from
String kvSeparator = ":";                   // separator for sensor key and value
String emgStringOut = "";                   // init empty string for default sensor output
String fsrStringOut = "";                   // init empty string for default sensor output

void setup(){
  Gripper.attach(SERVO_PIN);
  Serial.begin(9600);

  for(int i = 0; i < NUM_LED; i++){
    pinMode(ledPins[i], OUTPUT);
  }
}

void loop(){

  // Take values sent from EMG and FSR sensors
  emgReading = analogRead(A0);
  fsrReading = analogRead(A1);

  // turn OFF all LEDs on LED bar
  for(int j = 0; j < NUM_LED; j++){
    digitalWrite(ledPins[j], LOW);
  }

  // calculate what LEDs should be turned ON on the LED bar
  emgReading = constrain(emgReading, 30, emgSaturationValue);
  ledbarHeight = map(emgReading, 30, emgSaturationValue, 0, NUM_LED);

  // turn ON LEDs on the LED bar
  for(int k = 0; k < ledbarHeight; k++){
    digitalWrite(ledPins[k], HIGH);
  }

  // add keys to data so we know which sensor each comes from
  emgStringOut = String(emgId + kvSeparator + emgReading);
  fsrStringOut = String(fsrId + kvSeparator + fsrReading);

  // send data to Dataflow
  Serial.println(emgStringOut);
  Serial.println(fsrStringOut);

  // Take value sent from Dataflow
  if (Serial.available() > 0) {
    fromComputer = Serial.readStringUntil('\n');
    readingFromDataflow = fromComputer.toInt();
    Serial.println("fromComputer: " + fromComputer);
  }

  // use the value to drive the claw
  if (millis() - oldTime > MINIMUM_SERVO_UPDATE_TIME){
    // newDegree = map(readingFromDataflow * 100, 0, 100, 105, 190);
    // newDegree = constrain(newDegree, 105, 190);
    // newDegree would now be directly fromComputer
    if(abs(newDegree-oldDegrees) > GRIPPER_MINIMUM_STEP){
      Gripper.write(newDegree);
    }
    oldTime = millis();
    oldDegrees = newDegree;
  }
}
