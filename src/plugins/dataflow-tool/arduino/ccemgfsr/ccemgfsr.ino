  /*
  * ----------------------------------------------------------------------------------------------------
  * Muscle SpikerShield Arduino UNO Code for Interface with Dataflow
  * This code is up to date for use with the "Claw Pro R3"
  *
  * This sketch allows for two way communication between Concord Consortium's Dataflow Tile and
  * Backyard Brains' Muscle Spiker Shield & associated hardware.
  *
  * Based on original script by Backyard Brains 2015, by Marcio Amorim and Stanislav Mircic
  * Adapted by Concord Consortium, 2023.
  *
  * These two resources were very helpful for writing the serial reception code:
  * https://www.programmingelectronics.com/serial-read/
  * https://docs.arduino.cc/built-in-examples/strings/StringToInt
  *
  * Tested with Muscle SpikerShield V2.31
  * ----------------------------------------------------------------------------------------------------
  */

  #include <Servo.h>
  #include <Adafruit_MLX90614.h>

  #define SERVO_PIN 2
  #define SENSITIVITY_BUTTON_PIN 7
  #define NUM_LED 6                           //number of LEDs in LED bar
  #define MINIMUM_SERVO_UPDATE_TIME 100       //update servo position every 100ms

  Servo Gripper;
  Adafruit_MLX90614 mlx = Adafruit_MLX90614();

  byte ledPins[] = {8, 9, 10, 11, 12, 13};

  // Chosen sensitivity will appear as approximate max to user
  int sensitivities[] = {200, 350, 520, 680, 840, 1000};
  int lastSensitivitiesIndex = 3;

  int emgSaturationValue = 0;
  int emgReading;
  int fsrReading;
  float tmpReading;
  byte ledbarHeight = 0;                      //temporary variable for led bar height

  unsigned long oldTime = 0;                  //timestamp of last servo angle update (ms)
  int oldDegrees = 0;                         //old value of angle for servo
  int newDegree;                              //new value of angle for servo

  // these will be used to assmble strings for Dataflow
  String emgId = "emg";
  String fsrId = "fsr";
  String tmpId = "tmp";
  String kvSeparator = ":";
  String emgStringOut = "";
  String fsrStringOut = "";
  String tmpStringOut = "";

  const int BUFFER_SIZE = 4;                  // Accommodate <=3 digit angle, plus delimiter
  char buf[BUFFER_SIZE];                      // a char array buffer

  const unsigned int MAX_ANGLE_BYTE_LENGTH = 4;

  /* setup */
  void setup(){
    Serial.begin(9600);
    Gripper.attach(SERVO_PIN);
    mlx.begin();
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

    // 3 Collect EMG, Force, and Temperature readings
    // (note that A2 is pin used for FSR in newer Muscle SpikerShield)
    emgReading = analogRead(A0);
    fsrReading = analogRead(A2);
    tmpReading = mlx.readObjectTempC();

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
      tmpStringOut = String(tmpId + kvSeparator + tmpReading);

      // send to Dataflow via serial out
      Serial.println(emgStringOut);
      Serial.println(fsrStringOut);
      Serial.println(tmpStringOut);
    }
}
