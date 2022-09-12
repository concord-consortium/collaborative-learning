  /*
  * ----------------------------------------------------------------------------------------------------
  * Muscle SpikerShield Arduino UNO Code for Interface with Dataflow
  *
  * This sketch allows for two way communication between Concord Consortium's Dataflow Tile and
  * Backyard Brains' Muscle Spiker Shield & associated hardware.
  *
  * Based on original script by Backyard Brains 2015, by Marcio Amorim and Stanislav Mircic
  * Adapted by Concord Consortium, 2022.
  *
  * These two resources were very helpful for writing the serial reception code:
  * https://www.programmingelectronics.com/serial-read/
  * https://docs.arduino.cc/built-in-examples/strings/StringToInt
  *
  * Tested with Muscle SpikerShield V2.31
  * ----------------------------------------------------------------------------------------------------
  */

  #include <Servo.h>
  #define SERVO_PIN 2                         //pin for servo motor
  #define SENSITIVITY_BUTTON_PIN 7            //pin for button that selects sensitivity
  #define NUM_LED 6                           //number of LEDs in LED bar
  #define GRIPPER_MINIMUM_STEP 5              //5 degree dead zone (used to avoid aiming oscillation)
  #define MINIMUM_SERVO_UPDATE_TIME 100       //update servo position every 100ms

  Servo Gripper;                              //servo for gripper
  byte ledPins[] = {8, 9, 10, 11, 12, 13};    //pins for LEDs in LED bar

  int sensitivities[] = {200, 350, 520, 680, 840, 1000}; // will appear as approximate max to user
  int lastSensitivitiesIndex = 3;             //initial sensitivity index

  int emgSaturationValue = 0;                 //selected sensitivity/EMG saturation value
  int emgReading;                             //measured value for EMG
  int fsrReading;                             //measured value for surface pressure sensor
  byte ledbarHeight = 0;                      //temporary variable for led bar height

  unsigned long oldTime = 0;                  //timestamp of last servo angle update (ms)
  int oldDegrees = 0;                         //old value of angle for servo
  int newDegree;                              //new value of angle for servo

  String emgId = "emg";                       //key for Dataflow to know what sensor this came from
  String fsrId = "fsr";                       //key for Dataflow to know what sensor this came from
  String kvSeparator = ":";                   //separator for key and value
  String emgStringOut = "";                   // init empty string for default output
  String fsrStringOut = "";                   // init empty string for default output

  const int BUFFER_SIZE = 4;                  // Accommodate length of new angles coming in which will be `120` - `180`, plus delimiter
  char buf[BUFFER_SIZE];                      // a char array buffer

  const unsigned int MAX_ANGLE_BYTE_LENGTH = 4;  // size of incoming angle data

  /* setup */
  void setup(){
    Serial.begin(9600);
    Gripper.attach(SERVO_PIN);
    pinMode(SENSITIVITY_BUTTON_PIN, INPUT);
    for(int i = 0; i < NUM_LED; i++){
      pinMode(ledPins[i], OUTPUT);
    }
    emgSaturationValue = sensitivities[lastSensitivitiesIndex];
  }

  /* main loop */
  void loop()
  {
    // 1 handle incoming directions for Gripper and pass to Gripper
    while (Serial.available() > 0){
      static char message[MAX_ANGLE_BYTE_LENGTH];
      static unsigned int message_pos = 0;
      char inByte = Serial.read();

      // building up message from byte coming in, checking for terminating char or extra length
      if ( inByte != '\n' && (message_pos < MAX_ANGLE_BYTE_LENGTH - 1) ){
        //Add the incoming byte to our message and advance to next slot
        message[message_pos] = inByte;
        message_pos++;
      }
      // otherwise we have reached a newline or end of max length, so that's the whole message
      else {
        message[message_pos] = '\0';
        String asString = String(message);
        Gripper.write(asString.toInt());
        message_pos = 0;
      }
    }

    // 2 handle any clicks of the sensitivity button - adjust sensitivity
    if (digitalRead(SENSITIVITY_BUTTON_PIN)){
      for(int j = 0; j < NUM_LED; j++){
        digitalWrite(ledPins[j], LOW);
      }

      //increment sensitivity index
      lastSensitivitiesIndex++;
      if(lastSensitivitiesIndex==NUM_LED){
        lastSensitivitiesIndex = 0;
      }

      //light up LED at lastSensitivitiesIndex position for visual feedback
      emgSaturationValue = sensitivities[lastSensitivitiesIndex];
      digitalWrite(ledPins[lastSensitivitiesIndex], HIGH);

      //wait user to release button
      while (digitalRead(SENSITIVITY_BUTTON_PIN)){
        delay(10);
      }
      delay(100);
    }

    // 3 Collect EMG and FSR readings
    emgReading = analogRead(A0);
    fsrReading = analogRead(A1);

    // 4 Turn off LEDs, then light up 1 -6 of them to reflect sensitivity
    for(int j = 0; j < NUM_LED; j++){
      digitalWrite(ledPins[j], LOW);
    }
    emgReading= constrain(emgReading, 30, emgSaturationValue);
    ledbarHeight = map(emgReading, 30, emgSaturationValue, 0, NUM_LED);
    for(int k = 0; k < ledbarHeight; k++){
      digitalWrite(ledPins[k], HIGH);
    }

    // 5 if enough time has passed, send EMG and FSR readings to serial out (where Dataflow will find it)
    if (millis() - oldTime > MINIMUM_SERVO_UPDATE_TIME){
      oldTime = millis();
      oldDegrees = newDegree;

      // assemble keyed strings so Dataflow knows what is what
      emgStringOut = String(emgId + kvSeparator + emgReading);
      fsrStringOut = String(fsrId + kvSeparator + fsrReading);

      Serial.println(emgStringOut);
      Serial.println(fsrStringOut);
    }
}
