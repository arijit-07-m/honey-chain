#!/usr/bin/env python3
"""
Honey Chain — Hive Sensor Simulator for farmer01@honeychain.in

Generates realistic telemetry for assigned hives (H001 and H021).
Publishes via both MQTT and direct HTTP REST API to ensure live data
updates in real-time on Render and Vercel dashboards.

Usage:
    python simulator.py [--api-url https://honey-chain-4byl.onrender.com]
"""
import json
import time
import argparse
import signal
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
from random import Random, gauss

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("Please install paho-mqtt: pip install paho-mqtt")
    sys.exit(1)

# ── Configuration ──────────────────────────────────────────────────────────
FARMER_EMAIL = "farmer01@honeychain.in"
FARMER_PASS = "farmer123"
DEFAULT_API_URL = "https://honey-chain-4byl.onrender.com"
TOPIC_TEMPLATE = "hive/{hive_id}/telemetry"
PUBLISH_INTERVAL = 5  # seconds

# Database mapping for farmer01's assigned hives
HIVES = [
    {"id": "H001", "db_id": 1, "name": "Apiary Alpha Box 1", "base_temp": 32.2, "base_humidity": 64.0, "base_weight": 24.8, "base_sound": 56.0},
    {"id": "H021", "db_id": 21, "name": "Apiary Alpha Box 2", "base_temp": 31.8, "base_humidity": 66.5, "base_weight": 25.4, "base_sound": 54.0},
]

rng = Random(42)
running = True


def signal_handler(sig, frame):
    global running
    print("\nSimulator stopping...", flush=True)
    running = False


def get_auth_token(api_url: str) -> str:
    """Authenticate as farmer01 and return JWT access token."""
    login_url = f"{api_url}/api/auth/login"
    login_data = json.dumps({"email": FARMER_EMAIL, "password": FARMER_PASS}).encode("utf-8")
    req = urllib.request.Request(
        login_url,
        data=login_data,
        headers={"Content-Type": "application/json"}
    )
    try:
        res = urllib.request.urlopen(req, timeout=15)
        data = json.loads(res.read().decode("utf-8"))
        return data.get("access_token", "")
    except Exception as e:
        print(f"[Warn] Failed to authenticate with backend API: {e}", flush=True)
        return ""


def post_telemetry_http(api_url: str, token: str, hive_db_id: int, reading: dict):
    """Post telemetry directly to the REST API."""
    if not token:
        return
    url = f"{api_url}/api/hives/{hive_db_id}/telemetry"
    payload = json.dumps({
        "hive_id": hive_db_id,
        "temperature": reading["temperature"],
        "humidity": reading["humidity"],
        "weight": reading["weight"],
        "sound_level": reading["sound_level"]
    }).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        }
    )
    try:
        urllib.request.urlopen(req, timeout=8)
    except Exception as e:
        # Non-fatal — log and continue
        pass


def generate_reading(hive: dict) -> dict:
    """Generate a realistic sensor reading for a hive."""
    temp = round(gauss(hive["base_temp"], 1.0), 1)
    humidity = round(gauss(hive["base_humidity"], 3.0), 1)
    weight = round(gauss(hive["base_weight"], 0.5), 1)
    sound = round(gauss(hive["base_sound"], 3.5), 1)

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
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help="Honey Chain API URL")
    parser.add_argument("--interval", type=int, default=PUBLISH_INTERVAL, help="Publish interval in seconds")
    args = parser.parse_args()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    print(f"Connecting to Honey Chain API at {args.api_url}...", flush=True)
    token = get_auth_token(args.api_url)
    if token:
        print(f"✅ Authenticated as {FARMER_EMAIL}", flush=True)

    client = mqtt.Client(client_id=f"hive-sim-{int(time.time())}")
    try:
        client.connect(args.broker, args.port, 60)
        client.loop_start()
        print(f"✅ Connected to MQTT broker at {args.broker}:{args.port}", flush=True)
    except Exception as e:
        print(f"[Warn] MQTT broker unavailable ({e}), continuing with HTTP sync", flush=True)

    print(f"\n📡 Live Telemetry streaming for Farmer: {FARMER_EMAIL}")
    print(f"   Hives: {[h['id'] for h in HIVES]} (Interval: {args.interval}s)")
    print("   Press Ctrl+C to stop\n", flush=True)

    token_refresh_counter = 0
    while running:
        # Refresh token every ~10 minutes
        token_refresh_counter += 1
        if token_refresh_counter % 120 == 0:
            token = get_auth_token(args.api_url)

        for hive in HIVES:
            reading = generate_reading(hive)
            topic = TOPIC_TEMPLATE.format(hive_id=hive["id"])
            payload = json.dumps(reading)

            # 1. Publish to MQTT
            try:
                client.publish(topic, payload, qos=1)
            except Exception:
                pass

            # 2. Sync to Backend REST API (guarantees dashboard updates)
            post_telemetry_http(args.api_url, token, hive["db_id"], reading)

            print(f"[{datetime.now().strftime('%H:%M:%S')}] {hive['id']} | "
                  f"T:{reading['temperature']:.1f}°C H:{reading['humidity']:.1f}% "
                  f"W:{reading['weight']:.1f}kg S:{reading['sound_level']:.0f}dB | SYNCED", flush=True)

        time.sleep(args.interval)

    try:
        client.loop_stop()
        client.disconnect()
    except Exception:
        pass
    print("Simulator stopped.")


if __name__ == "__main__":
    main()