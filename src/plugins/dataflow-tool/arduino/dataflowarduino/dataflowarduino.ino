  /*
  * ----------------------------------------------------------------------------------------------------
  * This sketch allows for two way communication between Concord Consortium's Dataflow Tile and
  * an Arduino controlling a Servo motor.
  *
  * Based on original script by Backyard Brains 2015, by Marcio Amorim and Stanislav Mircic
  * Adapted by Concord Consortium, 2023.
  *
  * ----------------------------------------------------------------------------------------------------
  */

  #include <Servo.h>

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

  Servo servo;

  int a1Reading;

  unsigned long oldTime = 0;                  //timestamp of last servo angle update (ms)
  int oldDegrees = 0;                         //old value of angle for servo
  int newDegree;                              //new value of angle for servo

  // these will be used to assemble strings for Dataflow
  String a1Id = "a1";
  String kvSeparator = ":";
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
    servo.attach(SERVO_PIN);

    // Reserve memory for output strings to prevent fragmentation
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
    // 1 handle incoming directions for Servo and pass to Servo
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
        servo.write(atoi(message));
        message_pos = 0;
      }
    }

    // 2 Collect A1 readings
    a1Reading = analogRead(A1);

    // 3 if enough time has passed send readings to serial out (where Dataflow will find it)
    if (millis() - oldTime > MINIMUM_SEND_TIME){
      oldTime = millis();
      oldDegrees = newDegree;

      // assemble keyed strings so Dataflow knows what is what
      // Using assignment to reuse pre-allocated memory from reserve()
      a1StringOut = a1Id + kvSeparator + a1Reading;

      // send to Dataflow via serial out
      Serial.println(a1StringOut);

      // This is disabled because some versions of the CLUE code can't handle unexpected messages.
      // Output current free memory for leak detection
      // memStringOut = memId + kvSeparator + freeMemory();
      // Serial.println(memStringOut);
    }
}
