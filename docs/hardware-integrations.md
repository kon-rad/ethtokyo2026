# Hardware Integrations for AI City

### Physical bodies for pop-up cities, from the cyberdeck to the robot to the drone fleet, inside the infomorph worldview

---

## TL;DR — the five things that matter

1. **Hardware is the body layer of an infomorph.** Chislenko's infomorph treats physical bodies as temporary peripherals that can be summoned, inhabited and dismissed. AI City's hardware projects — the cyberdeck, Reachy Mini, FPV drones, Pi-powered status boards — are early implementations of that idea: transient, purpose-specific bodies that a mind (its wallet, its agents, its journal) can inhabit.
2. **The simplest integration that changes the demo: the Residency Status Board.** A Pi 4 with a 3.5" touchscreen, in Chromium kiosk mode, pointed at a live residency page. Shows staked seats, deadline countdown, Active/Failed status and treasury balance. No new contract code, no private keys on the device, about 2-3 hours to build. It was the top hardware project from ETHGlobal Tokyo and it fits Curvegrid's Digital Asset Dashboard track.
3. **"The seat is the key" — the strongest story.** A servo-latched cardboard door opens only for a wallet that's staked in an Active residency during its dates. The access rule (`getMember(addr).staked && status() == Active && startTime <= now < endTime`) is the same rule that gates a real house. A new read-only API route serves this check. This turns a smart-contract access policy into a physical object a judge can touch.
4. **The robot (Reachy / Friendly) as the city's shared body.** Reachy greets verified members at check-in, narrates the city chronicle at dinner, takes photos, and holds a conversation grounded in the city's mission and the host's notes. It's the same agent that runs on Hermes, but embodied. The robot never holds a private key; the host's wallet signs each session from a phone. This is the closest thing to an infomorph body that exists today.
5. **Drones as the city's eye and reach.** An FPV drone with a signed flight log, funded by the residency treasury. Footage hashes stored as receipt attachments. A drone budget that members vote on. The extropian vision: a body that flies, sees and returns, summoned when the group needs it and dismissed when the budget runs out.

---

## 1. Hardware as infomorph bodies

The infomorph stack has six layers: self-model (Argo), working mind (second brain + Hermes), reach (agents), bodies (hardware), grouping (pop-up cities) and continuity (backup, inheritance). Hardware is the **body** layer.

| Body | What it does for the infomorph | When it's summoned | Transient? |
|---|---|---|---|
| Cyberdeck (Pi 4 + 3.5") | Personal terminal: offline capture, hive slice, agent host | Daily use | No (personal device) |
| Reachy Mini (Friendly) | Shared city body: greeter, narrator, photo taker, conversation partner | Residency hours | Yes (summoned for sessions) |
| FPV drone | City's eye: aerial footage, signed flight log, treasury-funded | As the group decides | Yes (per-flight budget) |
| Pi Zero | Portable key: signed messages, offline wallet, hardware attestation | When the main deck is away | Yes (pocket body) |
| Status Board (Pi 4 + screen) | City's public face: live onchain state, visible in the common room | 24/7 during a residency | Yes (fixed to a city) |
| Arduino peripherals | Tactile sensors and actuators: LED bar, servo latch, buzzer, ultrasonic | Per interaction | Yes (peripheral to a body) |

The transhumanist idea of **morphological freedom** (the right to choose and change your body) becomes **authorisation freedom**: you give a body your authority and take it back. That's the wallet-signed `DeviceCert` with an expiry, and it's the pattern that connects every row in the table above.

---

## 2. Current hardware state

### 2.1 What exists and works

| Device | Status | Role |
|---|---|---|
| Pi 4 + 3.5" SPI touchscreen | Boots to desktop, tested 2026-09-26 | Cyberdeck, potential status board |
| Arduino Uno | Working, on the desk with breadboard | Peripheral controller (LEDs, servos, sensors) |
| 10-segment LED bar | On hand | Seat count, status indicators |
| 8x8 LED matrix | On hand | Icons, initials, mode display |
| SG90 servo | On hand | Latch, needle, flag |
| 28BYJ-48 stepper + ULN2003 driver | On hand | Dial, wheel, gauge |
| HC-SR04 ultrasonic | On hand | Presence, distance, queue |
| I2C 16x2 LCD + backpack | On hand | Text display |
| 7-segment digit | On hand | Counters |
| Buzzer | On hand | Alerts |
| Potentiometers, joystick | On hand (via Arduino ADC) | Input |
| Freenove car kit | Existing | Agent body experiment |
| Reachy Mini (Friendly) | Working, runs Hermes agent | City robot |
| FPV drone fleet (various) | Existing, flown regularly | Aerial platform |

### 2.2 What's missing or uncertain

| Item | Status |
|---|---|
| Edimax Wi-Fi dongle | Not in current inventory photo |
| GPS board | Not usable (missing converter) |
| AR glasses | Not usable (missing converter) |
| TO-92 parts | Unconfirmed: transistors or DS18B20 sensors? |
| Wireless Qi pad on power bank | Exists, untested for payment flow |

---

## 3. Hardware project catalogue

Ranked by feasibility and impact. All builds use parts on hand and read from the existing API (no new contract code).

### 3.1 Immediate (hours, no new API)

| # | Project | What it does | Parts | Time |
|---|---|---|---|---|
| 1 | **Residency Status Board** | Live view of one residency: seats staked, countdown, status, treasury. Chromium kiosk on the Pi. | Pi 4 + 3.5" screen | 2-3 h |
| 2 | **"City Is Go" Chime** | Each staked event lights one more LED. Active status triggers a buzzer melody. Failed shows an X on the matrix. | Pi 4, Arduino, LED bar, matrix, buzzer | 2-3 h |
| 3 | **Bed Map** | 8x8 matrix = house floor plan. Lit = staked, blinking = approved, off = open. | Arduino, 8x8 matrix | 2 h |
| 4 | **Receipt Bell** | Every host withdrawal rings the buzzer and shows amount + note on the LCD. | Arduino, buzzer, I2C 16x2 | 1-2 h |
| 5 | **Funding Needle** | Servo swings a cardboard needle from 0 to 100% of minimum seats. | SG90 | 1 h |
| 6 | **House Mode Dial** | Stepper turns a paper dial to Talk / Build / Dinner / Quiet as the schedule changes. | Stepper + ULN2003 | 2 h |

### 3.2 Short-term (half a day, one new read-only API route)

| # | Project | What it does | Parts | Time |
|---|---|---|---|---|
| 7 | **The Seat Is the Key** | Servo latch opens only for staked members of an Active residency during its dates. | Arduino, SG90, cardboard box | 3-4 h |
| 8 | **Shower Queue** | Joystick takes the next slot. LCD shows queue. 7-segment counts down minutes left. | Arduino, joystick, I2C 16x2, 7-segment | 2 h |
| 9 | **Open-to-Chat Beacon** | Each desk gets an LED. Flip it on when you're open to conversation. Board shows who's open. | Arduino, LEDs, switches | 2 h |
| 10 | **Double Opt-In Handshake** | Two people each press within 10 s. Both press = matrix shows a heart and concierge reveals the intro. | Arduino, buttons, 8x8 matrix | 2 h |

### 3.3 Goa-ready (weeks, deeper integration)

| # | Project | What it does | Dependencies |
|---|---|---|---|
| 11 | **House robot (Reachy)** | Greeter for verified members, chronicle narrator, photo taker, conversation partner grounded in city context. | Friendly server, Hermes agent integration, wallet-signed sessions |
| 12 | **City drone budget** | FPV flights funded by treasury. Footage hash as receipt, signed flight log. | Treasury integration, flight logging API |
| 13 | **Concierge kiosk** | House terminal: type a question, get an answer from the city guide agent. | Concierge agent, city context |
| 14 | **Common-Room Counter** | Ultrasonic at the doorway counts people. LCD shows "people in the common room now." | Arduino, HC-SR04, I2C 16x2 |

### 3.4 Longer-term (2027)

| # | Project | What it does | Dependencies |
|---|---|---|---|
| 15 | **City compute box** | Shared GPU that runs every member's private model with per-member encryption. | Treasury, per-member encryption |
| 16 | **Hardware witness** | A device signs "this talk happened here at this time." Social signal, not proof. | Device cert, signing key |
| 17 | **Portable infomorph** | Journal, vault, agents and device certs move with you from city to city. Fresh persona per city. | Argo export, multi-key management |

---

## 4. How hardware connects to the infomorph worldview

### 4.1 Chislenko's functional grouping

Hardware isn't personal in a pop-up city. The status board belongs to the city, not to any one member. The drone is summoned by the group. Reachy is the city's body for its duration. This matches Chislenko's prediction that in an infomorph society, bodies and tools are summoned for a purpose and dismissed, rather than owned for a lifetime.

### 4.2 Extropian self-transformation

Each hardware project is an exercise in building the environment you want to live in. The shower queue solves a real shared-house annoyance. The open-to-chat beacon builds the hallway effect. The receipt bell makes financial transparency audible. These aren't demos — they're prototypes of the kind of physical space an extropian community would design for itself.

### 4.3 Morphological freedom as authorisation freedom

The pattern that connects all hardware: no device holds a private key. Every device is inert until a wallet signs a session for it. The cyberdeck unlocks when your phone signs. Reachy wakes when the host's wallet approves. The drone flies when the treasury's multisig signs the flight budget. This is morphological freedom implemented through crypto: you can inhabit any body, and you can leave it behind.

### 4.4 The d/acc hardware principle

All hardware projects are **defensive**:

- They **read** the chain, they never write from a device key
- They **serve** the people in the room, they don't surveil them
- They have **visible state**: a lit LED, a moving needle, a buzzing bell
- They can be **unplugged** without affecting the residency's onchain state
- The robot has an **LED consent light** when its camera is on
- Sensors count presence, never identity

This is d/acc for hardware: build things that amplify human coordination without replacing human judgement.

---

## 5. Recommended build order

### For a residency demo (any city, any weekend)

1. **Residency Status Board** (#1) — the city's public face. 2 hours.
2. **Bed Map** (#3) — shows the money visually. 2 hours.
3. **Open-to-Chat Beacon** (#9) — builds the hallway effect. 2 hours.

### For Edge City Goa (Oct-Nov 2026)

4. **House robot (Reachy)** (#11) — the city's shared body. 1-2 weeks of integration.
5. **City drone budget** (#12) — the city's eye. 1 week of integration.
6. **The Seat Is the Key** (#7) — the best demo story. 4 hours.

### For a permanent city hub

7. **Concierge kiosk** (#13) — always-on information point.
8. **Common-Room Counter** (#14) — ambient awareness.
9. **Receipt Bell** (#4) — financial transparency as a physical sensation.

---

## 6. House Environment Monitor
### An Arduino that records temperature, light and presence data from a residency house, feeds it to the city page, and signs snapshots for onchain verification

**Added:** 2026-09-26
**Goal:** A zero-new-parts environmental monitor that turns a residency house into a verifiable physical space. The Arduino reads three onboard sensors and streams data to the Pi, which rolls it into a rolling JSON file and serves it on the city page. A periodic signed snapshot lets anyone verify "the house was at X temperature during the residency."

---

### 6.1 What the sensors measure

| Sensor | What it measures | How it connects | Accuracy |
|---|---|---|---|
| **Thermistor** (Freenove kit) | Temperature (relative) | Analogue pin on the Arduino via voltage divider | Uncalibrated: good enough to see "it's hotter than an hour ago" but not "it's 24.3 °C." Add a DHT22 or BME280 (under $5) for calibrated readings. |
| **Photoresistor** (Freenove kit) | Ambient light level | Analogue pin on the Arduino via voltage divider | Relative brightness from dark (0) to bright (1023). Good enough to detect "the living room lights are on" or "quiet hours dimming is working." |
| **HC-SR04 ultrasonic** (on the desk) | Distance / presence | Digital trigger + echo pins on the Arduino | 2 cm to 400 cm. Detects a person walking past, a door opening, or a parcel in the box. Needs a voltage divider if used directly on a Pi, but the Arduino handles it at 5 V natively. |

**What's not on hand:** humidity (no DHT/BME), air quality/CO2 (no MQ sensor), sound/noise (no microphone). A DHT22 ($3) or a BME280 ($5) added to the next parts order fills the humidity gap.

---

### 6.2 The Arduino sketch

The Arduino runs a loop that reads all three sensors once per second and writes a CSV line to the USB serial port:

```
T=312,L=540,D=85
```

Where:
- `T` = thermistor ADC reading (0-1023, higher = warmer on a standard NTC thermistor with a 10k pull-up)
- `L` = photoresistor ADC reading (0-1023, higher = brighter)
- `D` = ultrasonic distance in cm (0 = out of range or no echo)

The Arduino has no RTC, so it doesn't add a timestamp. The Pi adds one when it receives each line.

**Key design choices:**
- One line per second: fine enough to catch a door opening, coarse enough to not overwhelm serial or storage. The Pi decimates to one line per minute for the rolling file.
- No JSON on the Arduino: CSV keeps the sketch under 50 lines and avoids dynamic allocation on the Uno's 2 KB of RAM.
- The Arduino runs headless: plug it into USB power (the Pi, a power bank, or a wall adapter) and it starts streaming immediately. No setup, no config.

**Full sketch (Arduino IDE, ~40 lines):**
```
#define THERMISTOR_PIN A0
#define LIGHT_PIN      A1
#define TRIG_PIN       9
#define ECHO_PIN       10

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}

void loop() {
  // Read thermistor
  int t = analogRead(THERMISTOR_PIN);
  // Read photoresistor
  int l = analogRead(LIGHT_PIN);
  // Read ultrasonic
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);  // 30 ms timeout = ~5 m max
  int d = duration == 0 ? 0 : duration * 0.034 / 2;

  Serial.print("T="); Serial.print(t);
  Serial.print(",L="); Serial.print(l);
  Serial.print(",D="); Serial.println(d);

  delay(1000);
}
```

**Wiring:**
| Arduino pin | Connected to |
|---|---|
| A0 | Thermistor + 10k resistor (voltage divider to 5 V / GND) |
| A1 | Photoresistor + 10k resistor (voltage divider to 5 V / GND) |
| D9 | HC-SR04 Trig |
| D10 | HC-SR04 Echo |
| 5 V | HC-SR04 VCC, sensor power rail |
| GND | HC-SR04 GND, sensor ground rail |

---

### 6.3 The Pi collector

The Pi runs a Python script (systemd service, auto-start) that:

1. Opens the Arduino's USB serial port (`/dev/ttyACM0` or `/dev/ttyUSB0`, 9600 baud).
2. Reads each CSV line and adds an ISO 8601 timestamp.
3. Appends to a rolling JSON lines file: `house-env.ndjson` — one JSON object per line, rotated at midnight and kept for 7 days.
4. Every 60 seconds, writes a summary JSON file that the city page reads: `house-env-latest.json`.

**File structure:**

`house-env-latest.json` (updated every 60 seconds):
```json
{
  "city": "penang-2026",
  "updatedAt": "2026-09-26T14:23:00+08:00",
  "current": { "temperature": 312, "light": 540, "distance": 85 },
  "lastHour": {
    "temperature": { "min": 298, "max": 320, "avg": 310 },
    "light": { "min": 200, "max": 880, "avg": 510 }
  },
  "doorEvents": [
    { "at": "2026-09-26T14:15:00+08:00", "durationSeconds": 240 },
    { "at": "2026-09-26T13:42:00+08:00", "durationSeconds": 60 }
  ]
}
```

`house-env.ndjson` (one JSON object per second, ~86k lines/day, ~3 MB/day uncompressed):
```json
{"t":"2026-09-26T14:23:00+08:00","T":312,"L":540,"D":85}
{"t":"2026-09-26T14:23:01+08:00","T":312,"L":540,"D":85}
```

**Door event detection:** The collector marks a "door open" event when the ultrasonic distance changes by more than 30 cm from the baseline (measured over the last 5 minutes). The baseline recalibrates slowly (rolling average over 5 minutes), so the sensor can be moved or the door can be left open without false alarms. A "door closed" event fires when the distance returns to baseline for more than 10 seconds.

**Edge cases the collector handles:**
- Arduino disconnected: the serial read times out and the collector logs "sensor offline" every minute. The city page shows "House environment: offline."
- Arduino reconnects: udev rules pin `/dev/ttyACM0` to the Arduino's serial number, so it reappears at the same path.
- First run with no data: `house-env-latest.json` shows `"status": "collecting"` instead of numbers.
- Midnight rotation: the collector renames `house-env.ndjson` to `house-env-2026-09-26.ndjson` and starts a fresh file. Old files are auto-deleted after 7 days.

---

### 6.4 The API route

One new read-only route in the existing AI City API:

| Route | Auth | Returns |
|---|---|---|
| `GET /api/residencies/[address]/environment` | Any visitor | The `house-env-latest.json` for the residency's city, or `{"status": "not_available"}` |

The route checks the residency's `city_id` from the database, reads `house-env-latest.json` from the city's data directory (a path like `data/cities/penang-2026/environment/`), and returns it.

No auth required for the current snapshot — it's environmental data, not member data. The signed snapshot route below is separate.

---

### 6.5 The dapp tab

The residency page (`/r/[address]`) gets a new **House Environment** tab, shown after the Treasury tab:

```
┌──────────────────────────────────────────────────┐
│  Overview  │  Rooms  │  Treasury  │  Environment  │
├──────────────────────────────────────────────────┤
│                                                  │
│  House Environment  (live from the Arduino)      │
│                                                  │
│  ┌───────────────────────────┐                    │
│  │  Temperature (last 6h)    │                    │
│  │  ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁  (line)  │                    │
│  │  Now: 24°C · Min: 22°C    │                    │
│  │  Max: 26°C · Avg: 24°C    │                    │
│  └───────────────────────────┘                    │
│                                                  │
│  ┌───────────────────────────┐                    │
│  │  Light (last 6h)          │                    │
│  │  ▁▁▁▁▃▆█▇▅▃▂▁▁▁  (line)   │                    │
│  │  Status: Bright (daytime)  │                    │
│  └───────────────────────────┘                    │
│                                                  │
│  ┌───────────────────────────┐                    │
│  │  Door Events (today)      │                    │
│  │  • 09:23 — opened 3 min   │                    │
│  │  • 12:15 — opened 1 min   │                    │
│  │  • 14:42 — opened 4 min   │                    │
│  └───────────────────────────┘                    │
│                                                  │
│  ═══════════════════════════════════════════════  │
│  Onchain Snapshot: Last signed at 14:00 UTC      │
│  [View on Etherscan]  [Verify signature]          │
│                                                  │
└──────────────────────────────────────────────────┘
```

The chart is rendered client-side with a lightweight library (Chart.js or a simple SVG). Only the last 6 hours of data is fetched for the charts; the full 7-day NDJSON is available for download by the host.

---

### 6.6 The crypto hook: signed snapshots

This is what turns a thermistor into an onchain witness.

**The flow:**

1. Every hour, the Pi collector:
   - Reads the last hour of sensor data from the NDJSON file
   - Computes a hash: `keccak256(abi.encodePacked(citySlug, startTime, endTime, tempAvg, lightAvg, doorCount))`
   - The city's host wallet (or a designated signing key) signs an EIP-712 message with this hash
   - Posts the signed snapshot to the API: `POST /api/residencies/[address]/environment/snapshot`

2. The API stores the signed snapshot in the database:

| Table | Columns |
|---|---|
| `env_snapshots` | `id`, `residency_address`, `start_time`, `end_time`, `temp_avg`, `light_avg`, `door_count`, `data_hash` BYTEA, `signer` BYTEA, `signature` BYTEA, `tx_hash` BYTEA NULL, `created_at` |

3. Optionally, the host anchors the data hash onchain by calling the residency contract with it (a new function `recordEnvironment(bytes32 dataHash)` that emits an `EnvironmentRecorded(dataHash)` event). This is not required — the EIP-712 signature alone is verifiable off-chain — but anchoring it in the contract's event log makes it undeniable.

**Verification (anyone can do this without asking the host):**

```python
from eth_account.messages import encode_typed_data
from eth_account import Account

# Read the snapshot from the API
snapshot = api.get(f"/api/residencies/{address}/environment/snapshot/latest")

# Reconstruct the EIP-712 message
msg = encode_typed_data(
    domain={"name": "AI City", "version": "1", "chainId": 1},
    types={"EnvironmentSnapshot": [
        {"name": "city", "type": "string"},
        {"name": "startTime", "type": "uint256"},
        {"name": "endTime", "type": "uint256"},
        {"name": "tempAvg", "type": "uint16"},
        {"name": "lightAvg", "type": "uint16"},
        {"name": "doorCount", "type": "uint8"},
    ]},
    primary_type="EnvironmentSnapshot",
    message={
        "city": snapshot["city"],
        "startTime": snapshot["startTime"],
        "endTime": snapshot["endTime"],
        "tempAvg": snapshot["tempAvg"],
        "lightAvg": snapshot["lightAvg"],
        "doorCount": snapshot["doorCount"],
    },
)

# Recover the signer
signer = Account.recover_message(msg, signature=snapshot["signature"])
assert signer == snapshot["signer"], "Invalid signature!"

# Check the signer is the residency host
residency = api.get(f"/api/residencies/{address}")
assert signer == residency["host"], "Signer is not the host!"
```

**What this proves:**
- The house was within a temperature range during the residency period
- The door was opened N times (useful for proving "the common room was used")
- The data was signed by the residency host, not fabricated
- If anchored onchain: the data existed before a certain block, making it timestamped and immutable

**What it doesn't prove:**
- That the temperature reading is accurate (a cheap thermistor can drift; calibration is the host's responsibility)
- That the Arduino wasn't tampered with (the sensor is in the house; physical access means physical trust)
- That the data wasn't gapped (a host could unplug the Arduino for an hour and the gap wouldn't show in the hourly snapshot)

The framing on stage: "this is a cheap, honest witness. It doesn't replace a calibrated BMS system. But for $3 in parts, a residency house can prove 'we were here, the temperature was comfortable, and people were in the common room' — and anyone can verify that signature without asking us."

---

### 6.7 Build order

| # | Step | Effort | Depends on |
|---|---|---|---|
| 1 | **Arduino sketch** — write, upload, verify the CSV output on a serial monitor | 30 min | Arduino IDE, USB cable |
| 2 | **Wire the sensors** — breadboard the thermistor, photoresistor and HC-SR04 to the Arduino | 30 min | Breadboard, jumper wires, resistors (220 + 10k) |
| 3 | **Pi collector script** — Python script that reads serial, timestamps, writes NDJSON and the latest-summary JSON | 1 h | Pi, Arduino connected over USB |
| 4 | **systemd service** — auto-start the collector on Pi boot, handle disconnect/reconnect | 30 min | Step 3 working |
| 5 | **API route** — `GET /api/residencies/[address]/environment` | 30 min | Existing AI City API |
| 6 | **Dapp tab** — House Environment tab on the residency page with Chart.js charts | 1-2 h | Step 5, frontend work |
| 7 | **Signed snapshots** — hourly signing script, EIP-712 verification, API endpoint to store and serve snapshots | 2 h | Step 3, a signing wallet |
| 8 | **Onchain anchoring** — optional `recordEnvironment` function on the Residency contract, deploy | 1 h | Contract access, Foundry |

**Total: 5-7 hours for the full stack (sensors + API + dapp + crypto hook).**

**If you only have 2 hours:** build steps 1-4 (Arduino + Pi collector) and point a raw JSON viewer at the collector's output. You can demo the live stream without the dapp tab.

---

### 6.8 How it fits the infomorph worldview

| Layer | What this project adds |
|---|---|
| **Bodies** | The Arduino is a peripheral that senses, not just acts. The house itself becomes a sensing body in the infomorph stack. |
| **Transparency** | The Treasury shows money moving. The environment tab shows the physical conditions the money bought. Together they make the residency's life verifiable: "42 USDC for groceries, and the house was at 24 °C when they arrived." |
| **d/acc hardware** | The sensor array counts presence, never identity. It measures temperature, not who set it. The door sensor logs open/close events, not who walked through. It's defensive by design. |
| **Verifiable physical space** | The signed snapshot bridges the gap between onchain state and physical reality. A smart contract can prove "X USDC was in the treasury," and now the same host can prove "the house was comfortable while it was active." |

---

### 6.9 Open questions

- Should the hourly snapshot be signed by the host wallet (requires the host to be online) or by a device key that the host certified at setup?
- Is a DHT22 or BME280 worth adding before Goa, or is the thermistor good enough for a demo?
- Does the HC-SR04's 30 ms timeout (5 m max range) miss the front door if the sensor is more than 5 m from the door frame?
- Should door events be posted to the city chat as concierge notifications (\"front door opened at 14:23\"), or kept on the environment tab only?

---

## 7. Tensions and open questions

| Tension | Risk | Position |
|---|---|---|
| **Surveillance by bodies** | Robots and drones with cameras in shared living space | Opt-in spaces, visible indicators (LED consent light), local processing, wiping at close |
| **Hardware excludes remote participants** | A physical board only helps people in the room | The web app is the primary interface; hardware is a supplement |
| **Maintenance burden** | Every device needs updates, charging, and a person who knows how to fix it | Build for zero-maintenance during a residency; fix between cities |
| **Cost** | A drone budget or a GPU box costs real USDC | Funded by the treasury, approved by members, transparent onchain |

---

## Sources

- `Research/hackathons/ethtokyo2026/ai-city-hardware-projects.md` — five hardware projects for AI City
- `Research/hackathons/ethtokyo2026/cyber-hive/hardware-build-ideas.md` — twenty hardware builds
- `Research/hackathons/ethtokyo2026/infomorph-stack-vision.md` — the infomorph stack vision
- `Research/hackathons/ethtokyo2026/infomorph-stack-bodies-brainstorm.md` — robot and drone integration
- `Research/hackathons/ethtokyo2026/pi-zero-offline-ethereum-wallet-brainstorm.md` — Pi Zero as portable key
- `Research/hackathons/ethtokyo2026/fpv-autonomous-ai-flight.md` — autonomous drone flight
- `Research/transhumanism/infomorph.md` — Chislenko's infomorph theory
- `Areas/robotics/friendly/` — Reachy Mini / Friendly integration
- `Areas/Drones/fpv/equipment.md` — FPV drone inventory