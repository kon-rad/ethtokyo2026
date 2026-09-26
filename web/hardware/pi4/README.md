# AI City - Pi 4 Hardware

The Pi 4 runs the status board (Chromium kiosk on the 3.5" screen) and the seat-key door (SG90 latch on GPIO 12).

## Demo: trigger the door open/close

Run from the Pi 4 over SSH:

```bash
# One open, wait 5 seconds, close
sudo /opt/aicity-door/venv/bin/python /opt/aicity-door/pi4-door.py open
sleep 5
sudo /opt/aicity-door/venv/bin/python /opt/aicity-door/pi4-door.py close
```

Or a 3-cycle demo with visual cues:

```bash
DOOR="sudo /opt/aicity-door/venv/bin/python /opt/aicity-door/pi4-door.py"
echo "=== Door demo: 3 open/close cycles ==="
for i in 1 2 3; do
  echo "--- Cycle $i: opening ---"
  $DOOR open
  sleep 5
  echo "--- Cycle $i: closing ---"
  $DOOR close
  sleep 2
done
echo "=== Demo complete ==="
```

To set the open time for a specific run without editing `door.env`:

```bash
DOOR_OPEN_SECONDS=10 sudo /opt/aicity-door/venv/bin/python /opt/aicity-door/pi4-door.py open
sleep 10
sudo /opt/aicity-door/venv/bin/python /opt/aicity-door/pi4-door.py close
```

## Files

| File | Purpose |
|---|---|
| `pi4-door.py` | Main door daemon: detects Pi Zero, challenges it, opens/closes latch |
| `aicity-door.service` | systemd unit that runs `pi4-door.py` at boot |
| `door.env.example` | Environment config template for the boot partition |
| `99-aicity-door.rules` | udev rule for instant Zero detection (optional) |