# House Environment Monitor — Build Plan
### Arduino + Raspberry Pi sensor station for the AI City residency dashboard

**Written:** 2026-09-26
**Goal:** A step-by-step build plan for connecting the Arduino (with thermistor, photoresistor and HC-SR04 ultrasonic) to a Raspberry Pi, collecting environmental data into rolling JSON files, serving it through the AI City API, and displaying it on the residency dashboard.

**Reference:** The full design is in `docs/hardware-integrations.md` section 6. This plan is the executable version — what to build, in what order, with exact commands and file paths.

---

## Architecture overview

```
Sensors (analogue + digital)
    │
    ▼
Arduino Uno ── USB serial (9600 baud) ──▶ Raspberry Pi (Pi 4 or Pi Zero)
                                               │
                                               ├── Python collector (systemd service)
                                               │      ├── house-env.ndjson (raw, 1 line/sec)
                                               │      ├── house-env-latest.json (summary, 60s)
                                               │      └── door events detected from distance changes
                                               │
                                               ├── AI City API (Next.js)
                                               │      └── GET /api/residencies/[address]/environment
                                               │
                                               └── Residency page tab (Chart.js, React)
                                                      └── Temperature, light, door events
```

---

## Prerequisites

| Item | Status |
|---|---|
| Raspberry Pi (any model, Pi 4 or Pi Zero) | On the desk, Pi Zero boots to desktop |
| Arduino Uno | On the desk |
| USB cable (Arduino to Pi) | On the desk |
| HC-SR04 ultrasonic sensor | On the desk |
| Thermistor (from Freenove FNK0024 kit) | In the kit |
| Photoresistor (from Freenove FNK0024 kit) | In the kit |
| 2 × 10k resistors | In the kit |
| Breadboard + jumper wires | On the desk |
| AI City codebase (Next.js, Postgres) | `Projects/ai-city/` |
| Arduino IDE on the Mac | Installed |

---

## Step 1: Wire the sensors to the Arduino

**Time: 30 minutes**

### Circuit diagram

```
Arduino Uno
┌─────────────┐
│             │
│ A0 ────┬─── thermistor
│        │
│        └─── 10k resistor ──── 5 V
│
│ A1 ────┬─── photoresistor
│        │
│        └─── 10k resistor ──── 5 V
│
│ D9  ──── TRIG (HC-SR04)
│ D10 ──── ECHO (HC-SR04)
│ 5 V ──── VCC (HC-SR04)
│ GND ──── GND (HC-SR04)
│
│       HC-SR04
│       ┌──────────┐
│       │ VCC  TRIG│
│       │ ECHO  GND│
│       └──────────┘
└─────────────┘
```

### Wiring table

| Arduino pin | Wire colour (suggested) | Connected to |
|---|---|---|
| A0 | Orange | Thermistor leg 1 (other leg → 10k resistor → 5 V, and → GND via the other 10k resistor) |
| 5 V | Red | HC-SR04 VCC, and the top of both voltage dividers |
| GND | Black | HC-SR04 GND, and the bottom of both voltage dividers |
| D9 | Yellow | HC-SR04 Trig |
| D10 | Green | HC-SR04 Echo |
| A1 | Blue | Photoresistor leg 1 (other leg → 10k resistor → 5 V, and → GND via another 10k resistor) |

**Thermistor voltage divider:** thermistor + 10k fixed resistor in series between 5 V and GND. The junction between them goes to A0. Use a standard NTC thermistor (10k @ 25 °C).

**Photoresistor voltage divider:** same pattern — photoresistor + 10k fixed resistor. The junction goes to A1.

**HC-SR04:** no voltage divider needed here because the Arduino runs at 5 V and the sensor outputs 5 V. If you ever move this to the Pi directly, you need a voltage divider on Echo (2k + 1k resistors to drop 5 V to 3.3 V).

### Verification

- Before plugging into the Pi, power the Arduino from your Mac via USB.
- Open the Serial Monitor (Arduino IDE, 9600 baud).
- You should see lines like `T=312,L=540,D=85` every second.
- Cover the photoresistor with your finger: the `L` value drops toward 0.
- Hold the thermistor between your fingers: the `T` value rises slowly.
- Wave your hand in front of the HC-SR04: the `D` value changes.

---

## Step 2: Upload the Arduino sketch

**Time: 15 minutes**

Create a new Arduino sketch, paste the code below, select "Arduino Uno" as the board, and upload.

```cpp
/*
 * AI City House Environment Monitor
 * Reads thermistor, photoresistor and HC-SR04 ultrasonic.
 * Outputs CSV over USB serial at 9600 baud, one line per second.
 */

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
  // Read thermistor (ADC 0-1023, higher = warmer for NTC)
  int t = analogRead(THERMISTOR_PIN);

  // Read photoresistor (ADC 0-1023, higher = brighter)
  int l = analogRead(LIGHT_PIN);

  // Read ultrasonic distance
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);  // 30 ms timeout = ~5 m max range
  int d = duration == 0 ? 0 : duration * 0.034 / 2;

  // Output: one CSV line
  Serial.print("T="); Serial.print(t);
  Serial.print(",L="); Serial.print(l);
  Serial.print(",D="); Serial.println(d);

  delay(1000);
}
```

**Troubleshooting:**
- If `pulseIn` returns 0 constantly, check the HC-SR04 wiring (VCC and GND swapped is the most common mistake).
- If the Serial Monitor shows garbled characters, check the baud rate is set to 9600.
- If the thermistor reading doesn't change when you warm it, check the voltage divider resistors (should be 10k, not 220 ohm).

---

## Step 3: Write the Pi collector script

**Time: 1 hour**

This script runs on the Raspberry Pi. It reads the Arduino's serial output, timestamps it, writes raw data to NDJSON, computes a summary every 60 seconds, and detects door events.

### Create the project directory

```bash
ssh pi@secondbrain.local  # or open a terminal on the Pi directly
mkdir -p /home/pi/house-env
cd /home/pi/house-env
```

### The collector script

Create `/home/pi/house-env/collector.py`:

```python
#!/usr/bin/env python3
"""
AI City House Environment Collector

Reads sensor data from an Arduino over USB serial, timestamps it,
writes rolling NDJSON files, computes a 60-second summary, and
detects door open/close events from the ultrasonic sensor.

Runs as a systemd service for auto-start on boot.
"""

import json
import os
import serial
import sys
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

# --- Configuration ---
SERIAL_PORT = "/dev/ttyACM0"  # or /dev/ttyUSB0 — check with `ls /dev/tty*`
BAUD_RATE = 9600
DATA_DIR = Path("/home/pi/house-env/data")
SUMMARY_FILE = DATA_DIR / "house-env-latest.json"
CITY_SLUG = "penang-2026"  # change to match the AI City slug

# Door detection settings
DISTANCE_THRESHOLD_CM = 30  # change from baseline = door event
BASELINE_WINDOW_SECONDS = 300  # 5-minute rolling baseline
DOOR_CLOSED_CONFIRM_SECONDS = 10  # how long distance must return to baseline

# Rolling buffers (deques for efficient sliding windows)
raw_buffer = deque(maxlen=3600)  # 1 hour of 1 Hz data
distance_window = deque(maxlen=BASELINE_WINDOW_SECONDS)  # for baseline

# Door state tracking
door_open = False
door_open_time = None
door_closed_since = None
door_events_today = []

# Summary counters
last_summary_time = 0
temp_readings = deque(maxlen=3600)
light_readings = deque(maxlen=3600)


def get_current_distance():
    """Return the rolling baseline distance (median of last 5 minutes)."""
    if len(distance_window) < 10:
        return None
    sorted_d = sorted(distance_window)
    return sorted_d[len(sorted_d) // 2]


def check_door_event(distance_cm, now):
    """Detect door open/close from distance changes against the rolling baseline."""
    global door_open, door_open_time, door_closed_since

    baseline = get_current_distance()
    if baseline is None:
        return  # not enough data yet

    delta = abs(distance_cm - baseline)

    if not door_open and delta > DISTANCE_THRESHOLD_CM:
        # Door opened
        door_open = True
        door_open_time = now
        door_closed_since = None
        print(f"[DOOR] Opened at {now.isoformat()} (delta={delta:.0f} cm)", flush=True)

    elif door_open:
        if delta < DISTANCE_THRESHOLD_CM / 2:
            # Distance returned near baseline — door may have closed
            if door_closed_since is None:
                door_closed_since = now
            elif (now - door_closed_since).total_seconds() >= DOOR_CLOSED_CONFIRM_SECONDS:
                # Confirmed closed
                duration = (now - door_open_time).total_seconds()
                door_events_today.append({
                    "at": door_open_time.isoformat(),
                    "durationSeconds": int(duration),
                })
                print(f"[DOOR] Closed after {int(duration)} s", flush=True)
                door_open = False
                door_open_time = None
                door_closed_since = None
        else:
            # Still open — reset the close timer
            door_closed_since = None


def write_summary(now):
    """Write the 60-second summary JSON file."""
    if len(temp_readings) == 0:
        return

    summary = {
        "city": CITY_SLUG,
        "updatedAt": now.isoformat(),
        "status": "online",
        "current": {
            "temperature": int(temp_readings[-1]),
            "light": int(light_readings[-1]),
            "distance": int(distance_window[-1]) if distance_window else 0,
        },
        "lastHour": {
            "temperature": {
                "min": int(min(temp_readings)),
                "max": int(max(temp_readings)),
                "avg": int(sum(temp_readings) / len(temp_readings)),
            },
            "light": {
                "min": int(min(light_readings)),
                "max": int(max(light_readings)),
                "avg": int(sum(light_readings) / len(light_readings)),
            },
        },
        "doorEvents": door_events_today[-20:],  # last 20 events
        "doorOpen": door_open,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SUMMARY_FILE.write_text(json.dumps(summary, indent=2))
    print(f"[SUMMARY] Written at {now.isoformat()}", flush=True)


def rotate_ndjson(now):
    """Rotate the raw NDJSON file at midnight."""
    today_str = now.strftime("%Y-%m-%d")
    today_file = DATA_DIR / f"house-env-{today_str}.ndjson"

    # Delete files older than 7 days
    for f in DATA_DIR.glob("house-env-*.ndjson"):
        if f == today_file:
            continue
        try:
            fdate = datetime.strptime(f.stem.replace("house-env-", ""), "%Y-%m-%d")
            if (now - fdate.replace(tzinfo=now.tzinfo)).days > 7:
                f.unlink()
                print(f"[CLEANUP] Deleted old file: {f.name}", flush=True)
        except ValueError:
            pass

    return today_file


def parse_line(line):
    """Parse a CSV line like 'T=312,L=540,D=85' into a dict or None."""
    parts = line.strip().split(",")
    if len(parts) != 3:
        return None
    try:
        return {
            "T": int(parts[0].split("=")[1]),
            "L": int(parts[1].split("=")[1]),
            "D": int(parts[2].split("=")[1]),
        }
    except (IndexError, ValueError):
        return None


def main():
    print(f"[COLLECTOR] Starting — port={SERIAL_PORT}, baud={BAUD_RATE}", flush=True)

    # Ensure data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Open serial connection
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=5)
    except serial.SerialException as e:
        print(f"[ERROR] Cannot open {SERIAL_PORT}: {e}", flush=True)
        # Write an offline status
        SUMMARY_FILE.write_text(json.dumps({
            "city": CITY_SLUG,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "status": "offline",
            "error": str(e),
        }))
        sys.exit(1)

    # Current NDJSON file
    ndjson_file = None
    last_rotate_day = None

    try:
        while True:
            now = datetime.now(timezone.utc)

            # Rotate NDJSON at midnight
            day_str = now.strftime("%Y-%m-%d")
            if day_str != last_rotate_day:
                ndjson_file = rotate_ndjson(now)
                last_rotate_day = day_str

            # Read one line from the Arduino
            try:
                raw_line = ser.readline().decode("utf-8", errors="replace").strip()
            except serial.SerialException as e:
                print(f"[ERROR] Serial read failed: {e}", flush=True)
                time.sleep(5)
                continue

            if not raw_line:
                continue

            # Parse the CSV line
            data = parse_line(raw_line)
            if data is None:
                print(f"[WARN] Unparseable line: {raw_line}", flush=True)
                continue

            # Add timestamp
            record = {
                "t": now.isoformat(),
                "T": data["T"],
                "L": data["L"],
                "D": data["D"],
            }

            # Write to NDJSON
            ndjson_file.write_text(
                json.dumps(record, separators=(",", ":")) + "\n",
                encoding="utf-8",
            )

            # Update rolling buffers
            raw_buffer.append(record)
            distance_window.append(data["D"])
            temp_readings.append(data["T"])
            light_readings.append(data["L"])

            # Check for door events (only if distance is valid)
            if data["D"] > 0:
                check_door_event(data["D"], now)

            # Write summary every 60 seconds
            if time.time() - last_summary_time >= 60:
                write_summary(now)
                last_summary_time = time.time()

    except KeyboardInterrupt:
        print("[COLLECTOR] Shutting down", flush=True)
        write_summary(datetime.now(timezone.utc))
    finally:
        ser.close()


if __name__ == "__main__":
    main()
```

### Test the collector

```bash
# First, find the Arduino's serial port
ls /dev/ttyACM* /dev/ttyUSB*

# Run the collector manually (stop with Ctrl+C)
python3 /home/pi/house-env/collector.py

# In another terminal, check the output
cat /home/pi/house-env/data/house-env-latest.json
```

**Troubleshooting:**
- If no `/dev/ttyACM*` or `/dev/ttyUSB*` appears: the Arduino isn't detected. Check the USB cable (some cables are charge-only). Try a different USB port.
- If permission denied on the serial port: `sudo usermod -a -G dialout pi` then log out and back in.
- If the collector runs but `house-env-latest.json` stays empty: wait at least 60 seconds for the first summary to write.

---

## Step 4: Install the collector as a systemd service

**Time: 30 minutes**

This makes the collector start automatically on boot and restart if it crashes.

### Create the service file

```bash
sudo nano /etc/systemd/system/house-env.service
```

Paste:

```ini
[Unit]
Description=AI City House Environment Collector
After=multi-user.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/house-env
ExecStart=/usr/bin/python3 /home/pi/house-env/collector.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### Enable and start

```bash
sudo systemctl daemon-reload
sudo systemctl enable house-env.service
sudo systemctl start house-env.service

# Check it's running
sudo systemctl status house-env.service

# Follow the logs
sudo journalctl -u house-env.service -f
```

### udev rule for reliable port naming (optional but recommended)

If the Arduino occasionally shows up as a different `/dev/tty*` after a reboot, create a udev rule to pin it:

```bash
# Find the Arduino's serial number
udevadm info -a -n /dev/ttyACM0 | grep -i serial

# Create a udev rule
sudo nano /etc/udev/rules.d/99-arduino.rules
```

Paste (replace `YOUR_SERIAL` with the actual serial from above):

```
SUBSYSTEM=="tty", ATTRS{serial}=="YOUR_SERIAL", SYMLINK+="tty-arduino-env"
```

Then update the collector to use `/dev/tty-arduino-env` instead of `/dev/ttyACM0`. Reload udev:

```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

---

## Step 5: Add the API route to AI City

**Time: 30 minutes**

This route serves the latest environment data to the web app and external callers.

### File: `web/app/api/residencies/[address]/environment/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { readFile } from "fs/promises";
import { join } from "path";

// Path where Pi collectors write their data
const ENV_DATA_ROOT = process.env.ENV_DATA_ROOT || "/data/cities";

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    // Get the city slug for this residency
    const result = await sql`
      SELECT r.address, r.city_id, c.slug
      FROM residencies r
      JOIN cities c ON c.id = r.city_id
      WHERE r.address = ${params.address}
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { status: "not_found", error: "Residency not found" },
        { status: 404 }
      );
    }

    const { slug } = result[0];

    // Read the latest environment summary
    const envPath = join(ENV_DATA_ROOT, slug, "environment", "house-env-latest.json");

    try {
      const content = await readFile(envPath, "utf-8");
      const data = JSON.parse(content);
      return NextResponse.json(data);
    } catch {
      // File doesn't exist yet — collector hasn't written anything
      return NextResponse.json({
        city: slug,
        status: "not_available",
        message: "Environment monitor not yet installed for this city.",
      });
    }
  } catch (error) {
    console.error("Environment route error:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### Environment variable

Add to `.env.local` (or Vercel environment variables):

```
ENV_DATA_ROOT=/data/cities
```

In production, this path would be a mounted volume or an S3-compatible bucket. For local dev, create the path and symlink or copy the Pi's data directory:

```bash
mkdir -p /data/cities/penang-2026/environment
# On the dev machine, or set up rsync from the Pi
```

### Test the route

```bash
curl http://localhost:3000/api/residencies/0x.../environment
# → {"city": "penang-2026", "status": "online", "current": {...}, ...}
```

---

## Step 6: Add the House Environment tab to the residency page

**Time: 1.5 hours**

### File: `web/components/residency/environment-tab.tsx`

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler
);

interface EnvData {
  city: string;
  updatedAt: string;
  status: string;
  current: {
    temperature: number;
    light: number;
    distance: number;
  };
  lastHour: {
    temperature: { min: number; max: number; avg: number };
    light: { min: number; max: number; avg: number };
  };
  doorEvents: Array<{ at: string; durationSeconds: number }>;
  doorOpen: boolean;
}

export function EnvironmentTab({ address }: { address: string }) {
  const { data, isLoading, error } = useQuery<EnvData>({
    queryKey: ["environment", address],
    queryFn: () =>
      fetch(`/api/residencies/${address}/environment`).then((r) => r.json()),
    refetchInterval: 60_000, // refresh every 60 seconds
  });

  if (isLoading) return <div className="p-4 text-gray-500">Loading environment data...</div>;
  if (error || data?.status === "not_available") {
    return (
      <div className="p-4 text-gray-500">
        <p>House environment monitor is not installed for this city.</p>
        <p className="text-sm mt-2">
          Plug in the Arduino sensor station to start collecting temperature,
          light and door activity data.
        </p>
      </div>
    );
  }

  const tempMin = data!.lastHour.temperature.min;
  const tempMax = data!.lastHour.temperature.max;
  const lightMin = data!.lastHour.light.min;
  const lightMax = data!.lastHour.light.max;

  // Convert ADC readings to rough values for display
  const tempC = adcToTemperature(data!.current.temperature);
  const lightPct = Math.round((data!.current.light / 1023) * 100);

  return (
    <div className="space-y-6 p-4">
      {/* Current readings row */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          label="Temperature"
          value={`${tempC}°C`}
          subtitle={`Min ${adcToTemperature(tempMin)}°C · Max ${adcToTemperature(tempMax)}°C`}
        />
        <MetricCard
          label="Light Level"
          value={`${lightPct}%`}
          subtitle={`Range ${Math.round(lightMin / 10.23)}% - ${Math.round(lightMax / 10.23)}%`}
        />
        <MetricCard
          label="Door"
          value={data!.doorOpen ? "Open" : "Closed"}
          subtitle={`${data!.doorEvents.length} events today`}
          highlight={data!.doorOpen}
        />
      </div>

      {/* Temperature chart placeholder — replace with Chart.js or Recharts */}
      <div className="bg-gray-50 rounded-lg p-4 h-48 flex items-center justify-center text-gray-400">
        Temperature trend (last 6 hours) — chart library to be wired
      </div>

      {/* Door events */}
      {data!.doorEvents.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Door Events Today
          </h3>
          <div className="space-y-1">
            {data!.doorEvents.slice(-10).reverse().map((evt, i) => {
              const time = new Date(evt.at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              const dur =
                evt.durationSeconds < 120
                  ? `${evt.durationSeconds}s`
                  : `${Math.round(evt.durationSeconds / 60)} min`;
              return (
                <div key={i} className="text-sm text-gray-600">
                  <span className="font-mono">{time}</span> — opened for {dur}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Last updated: {new Date(data!.updatedAt).toLocaleString()}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtitle,
  highlight,
}: {
  label: string;
  value: string;
  subtitle: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-amber-400 bg-amber-50" : "border-gray-200"}`}>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{subtitle}</div>
    </div>
  );
}

// Rough NTC thermistor ADC-to-temperature conversion
// ADC = 1023 * R_thermistor / (R_thermistor + R_fixed)
// For a 10k NTC at 25°C with 10k fixed: ADC ≈ 512 at 25°C
function adcToTemperature(adc: number): number {
  if (adc <= 0 || adc >= 1023) return 25; // fallback
  const r = (1023 / adc - 1) * 10000; // thermistor resistance
  // Simplified Steinhart-Hart for a common 10k NTC (B=3950)
  const steinhart = Math.log(r / 10000) / 3950 + 1 / (25 + 273.15);
  const tempK = 1 / steinhart;
  return Math.round((tempK - 273.15) * 10) / 10;
}
```

### Add the tab to the residency page

In `web/app/r/[address]/page.tsx`, add the Environment tab alongside Overview, Rooms, Treasury:

```tsx
import { EnvironmentTab } from "@/components/residency/environment-tab";

// In the tab switcher, add:
{activeTab === "environment" && <EnvironmentTab address={params.address} />}
```

### Install chart library (optional, for the line chart)

```bash
cd web
npm install chart.js react-chartjs-2
```

---

## Step 7: Wire it into the residency page navigation

**Time: 30 minutes**

Add "Environment" to the tab bar in the residency detail page. It should appear after Treasury, with a small dot indicator showing green (online) or gray (offline).

In `web/app/r/[address]/page.tsx`, find the tab navigation and add:

```tsx
const tabs = [
  { id: "overview", label: "Overview" },
  { id: "rooms", label: "Rooms" },
  { id: "treasury", label: "Treasury" },
  { id: "environment", label: "Environment" },
];
```

For the online/offline indicator, use a small query to `/api/residencies/[address]/environment` in a parent component, or just show the tab unconditionally (the EnvironmentTab component handles the "not available" state gracefully).

---

## Testing the full stack

| Step | Test | Expected result |
|---|---|---|
| 1 | Power the Arduino from the Pi's USB port | Serial output appears in the collector logs |
| 2 | `sudo journalctl -u house-env.service -f` | Lines like `T=312,L=540,D=85` every second |
| 3 | `cat /home/pi/house-env/data/house-env-latest.json` | Valid JSON with `current`, `lastHour`, `doorEvents` |
| 4 | `curl http://localhost:3000/api/residencies/0x.../environment` | Returns the same JSON |
| 5 | Open `/r/[address]` in the browser, click Environment tab | Shows temperature, light, door events |
| 6 | Wave your hand in front of the HC-SR04 | Distance changes on the dashboard |
| 7 | Cover the photoresistor | Light level drops toward 0 |
| 8 | Unplug the Arduino USB | After 60s, status shows "offline" |
| 9 | Plug the Arduino back in | Data resumes, status returns to "online" |

---

## Files created

| File | Location | Purpose |
|---|---|---|
| Arduino sketch | Arduino IDE, upload to the Uno | Reads sensors, writes CSV over USB serial |
| `collector.py` | Pi: `/home/pi/house-env/collector.py` | Reads serial, timestamps, writes NDJSON + summary |
| `house-env.service` | Pi: `/etc/systemd/system/house-env.service` | Auto-start collector on boot |
| `route.ts` | `web/app/api/residencies/[address]/environment/route.ts` | Serves latest data to the web app |
| `environment-tab.tsx` | `web/components/residency/environment-tab.tsx` | Dashboard tab with metrics and charts |

---

## What's next after this works

| Priority | Addition | Effort |
|---|---|---|
| 1 | Hourly signed EIP-712 snapshots (the crypto hook) | 2 h |
| 2 | Chart.js line chart for temperature trend (last 6 hours) | 1 h |
| 3 | Concierge notification on door events ("front door opened") | 1 h |
| 4 | Add a DHT22 or BME280 for calibrated temp + humidity | 30 min + $5 |
| 5 | Onchain anchoring: `recordEnvironment` on the Residency contract | 1 h |

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| No `/dev/ttyACM*` | USB cable is charge-only | Try a known data cable |
| Permission denied on serial port | User not in `dialout` group | `sudo usermod -a -G dialout pi` then re-login |
| Collector runs but summary file is empty | Haven't waited 60 seconds | Wait, or check logs with `journalctl` |
| `T` reading always 1023 | Thermistor voltage divider wired wrong | Check the 10k resistor is between A0 and GND, not 5 V |
| `D` reading always 0 | HC-SR04 not getting echoes | Check wiring, or the sensor may be too far from any surface |
| API returns 404 | City slug doesn't match | Update `CITY_SLUG` in `collector.py` |
| Environment tab shows "not available" | `ENV_DATA_ROOT` path mismatch | Check the path in `route.ts` matches where the Pi writes files |