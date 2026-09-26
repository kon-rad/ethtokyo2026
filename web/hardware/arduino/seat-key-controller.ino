// Seat Key Controller for an AI City residency
// Pi 4 sends single-character commands over USB serial.
// LED bar on D2-D11, servo latch on D12.
//
// Commands:
//   '0'-'9'  — light N LEDs
//   'O'      — unlock door (servo to 90°)
//   'C'      — lock door (servo to 0°)
//   'R'      — reset (all LEDs off, door locked)
//   'S'      — status query

#include <Servo.h>

Servo latch;
const int LED_PINS[] = {2, 3, 4, 5, 6, 7, 8, 9, 10, 11};
const int LED_COUNT = 10;
const int SERVO_PIN = 12;

const int SERVO_LOCKED = 0;
const int SERVO_UNLOCKED = 90;

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < LED_COUNT; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
  }
  latch.attach(SERVO_PIN);
  latch.write(SERVO_LOCKED);
  Serial.println("OK:BOOT");
}

void loop() {
  if (Serial.available() > 0) {
    char cmd = Serial.read();

    switch (cmd) {
      case '0': case '1': case '2': case '3': case '4':
      case '5': case '6': case '7': case '8': case '9':
        setLEDs(cmd - '0');
        break;

      case 'O':  // Open door
        latch.write(SERVO_UNLOCKED);
        Serial.println("OK:UNLOCKED");
        break;

      case 'C':  // Close door
        latch.write(SERVO_LOCKED);
        Serial.println("OK:LOCKED");
        break;

      case 'R':  // Reset
        setLEDs(0);
        latch.write(SERVO_LOCKED);
        Serial.println("OK:RESET");
        break;

      case 'S':  // Status query
        Serial.print("LEDS:");
        Serial.print(currentLEDs());
        Serial.print(" DOOR:");
        Serial.println(latch.read() == SERVO_UNLOCKED ? "OPEN" : "LOCKED");
        break;

      default:
        Serial.print("ERR:UNKNOWN:");
        Serial.println(cmd);
        break;
    }
  }
}

void setLEDs(int count) {
  if (count < 0) count = 0;
  if (count > LED_COUNT) count = LED_COUNT;
  for (int i = 0; i < LED_COUNT; i++) {
    digitalWrite(LED_PINS[i], i < count ? HIGH : LOW);
  }
}

int currentLEDs() {
  int count = 0;
  for (int i = 0; i < LED_COUNT; i++) {
    if (digitalRead(LED_PINS[i]) == HIGH) count++;
  }
  return count;
}