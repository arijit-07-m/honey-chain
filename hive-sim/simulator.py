#!/usr/bin/env python3
"""
Honey Chain — Hive Sensor Simulator

Generates realistic telemetry for multiple hives and publishes to MQTT.
This is a PROTOTYPE/DEMO tool. Data is simulated, not from real sensors.

Usage:
    python simulator.py [--broker localhost] [--port 1883]
"""
import json
import time
import argparse
import signal
import sys
from datetime import datetime, timezone
from random import Random, uniform, gauss

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("Please install paho-mqtt: pip install paho-mqtt")
    sys.exit(1)

# ── Configuration ──────────────────────────────────────────────────────────
FARMER_EMAIL = "farmer01@honeychain.in"
TOPIC_TEMPLATE = "hive/{hive_id}/telemetry"
PUBLISH_INTERVAL = 5  # seconds

# farmer01@honeychain.in owns H001 and H021 in the Honey Chain registry
HIVES = [
    {"id": "H001", "name": "Apiary Alpha Box 1", "base_temp": 32.2, "base_humidity": 64.0, "base_weight": 24.8, "base_sound": 56.0},
    {"id": "H021", "name": "Apiary Alpha Box 2", "base_temp": 31.8, "base_humidity": 66.5, "base_weight": 25.4, "base_sound": 54.0},
]

rng = Random(42)
running = True
anomaly_active = False


def signal_handler(sig, frame):
    global running
    print("\nSimulator stopping...", flush=True)
    running = False


def generate_reading(hive: dict, cycle: int) -> dict:
    """Generate a realistic sensor reading for a hive."""
    temp = round(gauss(hive["base_temp"], 1.2), 1)
    humidity = round(gauss(hive["base_humidity"], 3.5), 1)
    weight = round(gauss(hive["base_weight"], 0.6), 1)
    sound = round(gauss(hive["base_sound"], 4.0), 1)

    return {
        "hive_id": hive["id"],
        "hive_code": hive["id"],
        "farmer_email": FARMER_EMAIL,
        "temperature": temp,
        "humidity": humidity,
        "weight": weight,
        "sound_level": sound,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def main():
    global running
    parser = argparse.ArgumentParser(description="Honey Chain Hive Simulator")
    parser.add_argument("--broker", default="broker.emqx.io", help="MQTT broker address")
    parser.add_argument("--port", type=int, default=1883, help="MQTT broker port")
    parser.add_argument("--interval", type=int, default=PUBLISH_INTERVAL, help="Publish interval in seconds")
    args = parser.parse_args()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    client = mqtt.Client(client_id="hive-simulator")
    try:
        client.connect(args.broker, args.port, 60)
        client.loop_start()
        print(f"Connected to MQTT broker at {args.broker}:{args.port}", flush=True)
        print(f"Simulating telemetry for Farmer: {FARMER_EMAIL}", flush=True)
        print(f"Assigned Hives: {[h['id'] for h in HIVES]} (Interval: {args.interval}s)", flush=True)
        print("Press Ctrl+C to stop\n", flush=True)
    except Exception as e:
        print(f"Failed to connect to MQTT broker: {e}", flush=True)
        sys.exit(1)

    cycle = 0
    while running:
        for hive in HIVES:
            reading = generate_reading(hive, cycle)
            topic = TOPIC_TEMPLATE.format(hive_id=hive["id"])
            payload = json.dumps(reading)
            result = client.publish(topic, payload, qos=1)
            status = "ANOMALY" if anomaly_active and hive["id"] == "H002" else "NORMAL"
            print(f"[{datetime.now().strftime('%H:%M:%S')}] {hive['id']} | "
                  f"T:{reading['temperature']:.1f}°C H:{reading['humidity']:.1f}% "
                  f"W:{reading['weight']:.1f}kg S:{reading['sound_level']:.0f}dB | {status}", flush=True)
        cycle += 1
        time.sleep(args.interval)

    client.loop_stop()
    client.disconnect()
    print("Simulator stopped.")


if __name__ == "__main__":
    main()