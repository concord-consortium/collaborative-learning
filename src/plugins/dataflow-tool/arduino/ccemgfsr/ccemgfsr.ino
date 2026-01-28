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
  * Tested with Muscle SpikerShield V2.31 / CLAW PRO R3 / Dataflow
  * ----------------------------------------------------------------------------------------------------
  */

  #include <Servo.h>
  #include <Adafruit_MLX90614.h>

  // Function to calculate free RAM between heap and stack
  // Returns number of free bytes
  int freeMemory() {
    extern int __heap_start, *__brkval;
    int v;
    return (int) &v - (__brkval == 0 ? (int) &__heap_start : (int) __brkval);
  }

  #define SERVO_PIN 2
  #define SENSITIVITY_BUTTON_PIN 7
  #define NUM_LED 6                           //number of LEDs in LED bar
  #define MINIMUM_SEND_TIME 100       //send outputs every 100ms

  Servo Gripper;
  Adafruit_MLX90614 mlx = Adafruit_MLX90614();

  byte ledPins[] = {8, 9, 10, 11, 12, 13};

  // Chosen sensitivity will appear as approximate max to user
  int sensitivities[] = {200, 350, 520, 680, 840, 1000};
  int lastSensitivitiesIndex = 3;

  int emgSaturationValue = 0;
  int emgReading;
  int fsrReading;
  int a1Reading;
  float tmpReading;
  byte ledbarHeight = 0;                      //temporary variable for led bar height

  unsigned long oldTime = 0;                  //timestamp of last servo angle update (ms)
  int oldDegrees = 0;                         //old value of angle for servo
  int newDegree;                              //new value of angle for servo

  // these will be used to assemble strings for Dataflow
  String emgId = "emg";
  String fsrId = "fsr";
  String tmpId = "tmp";
  String a1Id = "a1";
  String kvSeparator = ":";
  String emgStringOut = "";
  String fsrStringOut = "";
  String tmpStringOut = "";
  String a1StringOut = "";

  const int BUFFER_SIZE = 4;                  // Accommodate <=3 digit angle, plus delimiter
  char buf[BUFFER_SIZE];                      // a char array buffer

  const unsigned int MAX_ANGLE_BYTE_LENGTH = 4;

  // Pre-allocate string capacity to avoid heap fragmentation
  // Format: "xxx:1234" = 3 char id + 1 colon + up to 4 digits = ~10 chars
  // tmpReading is float, so allow more space: "tmp:-123.45" = ~12 chars
  const int STRING_RESERVE_SIZE = 16;

  // Memory tracking
  // Note: this is disabled to avoid sending unexpected messages to Dataflow
  String memId = "mem";
  String memStringOut = "";
  int initialFreeMemory = 0;

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

    // Reserve memory for output strings to prevent fragmentation
    emgStringOut.reserve(STRING_RESERVE_SIZE);
    fsrStringOut.reserve(STRING_RESERVE_SIZE);
    tmpStringOut.reserve(STRING_RESERVE_SIZE);
    a1StringOut.reserve(STRING_RESERVE_SIZE);
    memStringOut.reserve(STRING_RESERVE_SIZE);

    // Record initial free memory for leak detection
    initialFreeMemory = freeMemory();
    // Probably want to remove this, because the serial reader won't expect it.
    // Serial.print("Initial free memory: ");
    // Serial.println(initialFreeMemory);
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
        Gripper.write(atoi(message));
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
    a1Reading = analogRead(A1);
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

    // 5 if enough time has passed send readings to serial out (where Dataflow will find it)
    if (millis() - oldTime > MINIMUM_SEND_TIME){
      oldTime = millis();
      oldDegrees = newDegree;

      // assemble keyed strings so Dataflow knows what is what
      // Using assignment to reuse pre-allocated memory from reserve()
      emgStringOut = emgId + kvSeparator + emgReading;
      fsrStringOut = fsrId + kvSeparator + fsrReading;
      tmpStringOut = tmpId + kvSeparator + tmpReading;
      a1StringOut = a1Id + kvSeparator + a1Reading;

      // send to Dataflow via serial out
      Serial.println(emgStringOut);
      Serial.println(fsrStringOut);
      Serial.println(tmpStringOut);
      Serial.println(a1StringOut);

      // This is disabled because some versions of the CLUE code can't handle unexpected messages.
      // Output current free memory for leak detection
      // memStringOut = memId + kvSeparator + freeMemory();
      // Serial.println(memStringOut);
    }
}
