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

## 6. Tensions and open questions

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