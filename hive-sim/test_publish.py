"""One-shot MQTT test publisher.

Publishes 2 readings (normal + anomaly) for a hive to the SAME public
broker the ESP32 firmware uses. Used to verify the full chain:

  Publisher (simulating ESP32) -> broker.emqx.io -> FastAPI -> PostgreSQL/SQLite

Run:  python test_publish.py [HIVE_CODE]
"""
import json
import sys
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

BROKER = "broker.emqx.io"
PORT = 1883
HIVE_ID = sys.argv[1] if len(sys.argv) > 1 else "H001"
TOPIC = f"hive/{HIVE_ID}/telemetry"

readings = [
    # Normal reading
    {"temperature": 32.5, "humidity": 65.0, "weight": 24.2, "sound_level": 58},
    # Anomalous reading (hot + heavy sound + weight drop)
    {"temperature": 39.8, "humidity": 91.0, "weight": 14.1, "sound_level": 85},
]

c = mqtt.Client(client_id="hc-test-publisher", protocol=mqtt.MQTTv311)
c.connect(BROKER, PORT, keepalive=30)
c.loop_start()
time.sleep(2)  # allow connection

for r in readings:
    payload = {
        "hive_id": HIVE_ID,
        **r,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    info = c.publish(TOPIC, json.dumps(payload), qos=1)
    info.wait_for_publish()
    print(f"Published to {TOPIC}: {json.dumps(payload)}")
    time.sleep(3)

c.loop_stop()
c.disconnect()
print("DONE")
