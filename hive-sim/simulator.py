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
TOPIC_TEMPLATE = "hive/{hive_id}/telemetry"
PUBLISH_INTERVAL = 5  # seconds

HIVES = [
    {"id": "H001", "base_temp": 32.0, "base_humidity": 65.0, "base_weight": 26.0, "base_sound": 55.0},
    {"id": "H002", "base_temp": 31.5, "base_humidity": 68.0, "base_weight": 24.5, "base_sound": 58.0},
    {"id": "H003", "base_temp": 33.0, "base_humidity": 62.0, "base_weight": 27.0, "base_sound": 52.0},
    {"id": "H004", "base_temp": 30.5, "base_humidity": 70.0, "base_weight": 25.0, "base_sound": 60.0},
    {"id": "H005", "base_temp": 32.5, "base_humidity": 64.0, "base_weight": 26.5, "base_sound": 54.0},
]

rng = Random(42)
running = True
anomaly_active = False


def signal_handler(sig, frame):
    global running
    print("\nSimulator stopping...")
    running = False


def generate_reading(hive: dict, cycle: int) -> dict:
    """Generate a realistic sensor reading for a hive."""
    temp = round(gauss(hive["base_temp"], 1.5), 1)
    humidity = round(gauss(hive["base_humidity"], 4.0), 1)
    weight = round(gauss(hive["base_weight"], 0.8), 1)
    sound = round(gauss(hive["base_sound"], 5.0), 1)

    # Inject anomalies for H002 after ~30 cycles
    global anomaly_active
    if hive["id"] == "H002" and cycle > 30 and cycle % 10 == 0:
        anomaly_active = True
        weight = round(uniform(14.0, 19.0), 1)  # weight drop
        sound = round(uniform(75, 88), 1)  # high sound
        temp = round(uniform(36, 40), 1)  # higher temp
    elif hive["id"] == "H002" and cycle % 10 == 5:
        anomaly_active = False

    return {
        "hive_id": hive["id"],
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
        print(f"Connected to MQTT broker at {args.broker}:{args.port}")
        print(f"Publishing every {args.interval}s to {len(HIVES)} hives")
        print("Press Ctrl+C to stop\n")
    except Exception as e:
        print(f"Failed to connect to MQTT broker: {e}")
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
                  f"W:{reading['weight']:.1f}kg S:{reading['sound_level']:.0f}dB | {status}")
        cycle += 1
        time.sleep(args.interval)

    client.loop_stop()
    client.disconnect()
    print("Simulator stopped.")


if __name__ == "__main__":
    main()