  /*
  * ----------------------------------------------------------------------------------------------------
  * Based on original script by Backyard Brains 2015, by Marcio Amorim and Stanislav Mircic
  * Muscle SpikerShield Arduino UNO Code for Interface with Dataflow
  *
  * Code monitors amplitude of EMG envelope, displays EMG strength on LED bar and controls
  * Sensor data sent to serial
  *
  * Tested with Muscle SpikerShield V2.31
  * ----------------------------------------------------------------------------------------------------
  */

  #include <Servo.h>
  #define GRIPPER_STATE_BUTTON_PIN 4          //pin for button that switches defult state of the gripper (opened/closed)
  #define SERVO_PIN 2                         //pin for servo motor
  #define SENSITIVITY_BUTTON_PIN 7            //pin for button that selects sesitivity
  #define NUM_LED 6                           //number of LEDs in LED bar
  #define GRIPPER_MINIMUM_STEP 5              //5 degree dead zone (used to avoid aiming oscilation)
  #define OPEN_MODE 1                         //default gripper state is opened
  #define CLOSED_MODE 2                       //default gripper state is closed
  #define MINIMUM_SERVO_UPDATE_TIME 100       //update servo position every 100ms

  Servo Gripper;                              //servo for gripper
  byte ledPins[] = {8, 9, 10, 11, 12, 13};    //pins for LEDs in LED bar

  //EMG saturation values (when EMG reaches this value the gripper will be fully opened/closed)
  int sensitivities[] = {200, 350, 520, 680, 840, 1000};
  int lastSensitivitiesIndex = 3;             //set initial sensitivity index

  int emgSaturationValue = 0;                 //selected sensitivity/EMG saturation value
  int emgReading;                             //measured value for EMG
  int fsrReading;                             //measured value for sirface pressure sensor
  int threshold = 100;                        //threshold voltage for touch detected (modify based on sensor placement)
  byte ledbarHeight = 0;                      //temporary variable for led bar height

  unsigned long oldTime = 0;                  //timestamp of last servo angle update (ms)
  int oldDegrees = 0;                         //old value of angle for servo
  int newDegree;                              //new value of angle for servo

  unsigned long debouncerTimer = 0;           //timer for button debouncer
  int gripperStateButtonValue = 0;            //temporary variable that stores state of button
  int userReleasedButton = 1;                 //flag that is used to avoid multiple button events when user holds button

  int currentFunctionality = OPEN_MODE;       //current default position of claw

  String emgId = "emg";                       //key for Dataflow to know what sensor this came from
  String fsrId = "fsr";                       //key for Dataflow to know what sensor this came from
  String kvSeparator = ":";                   //separator for key and value
  String emgStringOut = "";                   // init empty string for default output
  String fsrStringOut = "";                   // init empty string for default output

  const int BUFFER_SIZE = 4;                  // Accomodate size of new angles coming in which will be 120 - 180, plus delimitter
  char buf[BUFFER_SIZE];                      // a char array buffer

  const unsigned int MAX_ANGLE_BYTE_LENGTH = 4;

  //-----------------------------------------------------------------------------------
  //   Setup servo, inputs and outputs
  // ----------------------------------------------------------------------------------
  void setup(){

    Serial.begin(9600);
    //init servo
    Gripper.attach(SERVO_PIN);
    //Gripper.write(180); //

    //init button pins to input
    pinMode(GRIPPER_STATE_BUTTON_PIN, INPUT);
    pinMode(SENSITIVITY_BUTTON_PIN, INPUT);

    //initialize all LED pins to output
    for(int i = 0; i < NUM_LED; i++){
      pinMode(ledPins[i], OUTPUT);
    }

    //get current sensitivity
    emgSaturationValue = sensitivities[lastSensitivitiesIndex];
  }



  //-----------------------------------------------------------------------------------
  //   Main loop
  //
  //   - Checks state of sesitivity button
  //   - Checks state of default-gripper-state button
  //   - Measure EMG
  //   - Shows EMG strength on LED bar
  //   - Sets angle of servo based on EMG strength and current mode (open/closed)
  // ----------------------------------------------------------------------------------

  void loop()
  {
    // Thanks, https://www.programmingelectronics.com/serial-read/
    // Thanks, https://docs.arduino.cc/built-in-examples/strings/StringToInt

    // Check to see if anything is in the serial receive buffer
    while (Serial.available() > 0){
      //Create a place to hold the incoming angle |message|
      static char message[MAX_ANGLE_BYTE_LENGTH];
      static unsigned int message_pos = 0;

      //Read the next available byte in the serial receive buffer
      char inByte = Serial.read();

      //Message coming in (check not terminating character) and guard for over message size
      if ( inByte != '\n' && (message_pos < MAX_ANGLE_BYTE_LENGTH - 1) ){
        //Add the incoming byte to our message
        message[message_pos] = inByte;
        message_pos++;
      }
      //Full message received...
      else {
        //Add null character
        message[message_pos] = '\0';
        // we need to go Char -> String -> Int
        String asString = String(message);
        Gripper.write(asString.toInt());

        message_pos = 0;
      }
    }


    //-----------------------  Button to change sensitivity with blink feedback ------------------------------------

    //check if button is pressed (HIGH)
    if (digitalRead(SENSITIVITY_BUTTON_PIN)){
      //turn off all the LEDs in LED bar
      for(int j = 0; j < NUM_LED; j++){
        digitalWrite(ledPins[j], LOW);
      }

      //increment sensitivity index
      lastSensitivitiesIndex++;
      if(lastSensitivitiesIndex==NUM_LED){
        lastSensitivitiesIndex = 0;
      }

      //get current sensitivity value
      emgSaturationValue = sensitivities[lastSensitivitiesIndex];

      //light up LED at lastSensitivitiesIndex position for visual feedback
      digitalWrite(ledPins[lastSensitivitiesIndex], HIGH);

      //wait user to release button
      while (digitalRead(SENSITIVITY_BUTTON_PIN)){
        delay(10);
      }
      //whait a bit more so that LED feedback is visible
      delay(100);
    }


    //---------------  Switch gripper default position open/close --------------------

    // TODO (CLAW): Remove this as it is not compatible with "percent closed" paradigm in Dataflow control block

    //check if enough time has passed for button contact to settle down
    if((millis() - debouncerTimer) > 50){
        gripperStateButtonValue = digitalRead(GRIPPER_STATE_BUTTON_PIN);
        //if button is pressed
        if(gripperStateButtonValue == HIGH){
          //if last time we checked button was not pressed
          if(userReleasedButton){
            debouncerTimer = millis();
            //block button events until user releases it
            userReleasedButton = 0;

            //toggle operation mode
            if(currentFunctionality == OPEN_MODE){
              currentFunctionality = CLOSED_MODE;
            }
            else {
              currentFunctionality = OPEN_MODE;
            }
          }
        }
        else {
          userReleasedButton = 1;
        }
    }

    //-----------------------------  Measure EMG -----------------------------------------------

    emgReading = analogRead(A0);                //read EMG value from analog input A0
    fsrReading = analogRead(A1);                //read FSR value from analog input A1

    //---------------- Show EMG strength on LED and Send Sensor Data ---------------------------

    //turn OFF all LEDs on LED bar
    for(int j = 0; j < NUM_LED; j++){
      digitalWrite(ledPins[j], LOW);
    }

    //calculate what LEDs should be turned ON on the LED bar
    emgReading= constrain(emgReading, 30, emgSaturationValue);
    ledbarHeight = map(emgReading, 30, emgSaturationValue, 0, NUM_LED);

    //turn ON LEDs on the LED bar
    for(int k = 0; k < ledbarHeight; k++){
      digitalWrite(ledPins[k], HIGH);
    }

    // use existing timing code to wait a little before writing sensor data out
    if (millis() - oldTime > MINIMUM_SERVO_UPDATE_TIME){
      oldTime = millis();
      oldDegrees = newDegree;

      // assemble keyed strings so Dataflow knows what is what
      emgStringOut = String(emgId + kvSeparator + emgReading);
      //fsrStringOut = String(fsrId + kvSeparator + fsrReading);

      // send data to serial where Dataflow will find it
      Serial.println(emgStringOut);
      // Serial.println(fsrStringOut);
    }
}
