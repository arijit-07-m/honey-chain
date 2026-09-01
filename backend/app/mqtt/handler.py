import json
import asyncio
import logging
from datetime import datetime
from typing import Callable
import paho.mqtt.client as mqtt
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings

logger = logging.getLogger(__name__)


class MQTTHandler:
    """Handles MQTT subscription and message processing."""

    def __init__(self, on_message_callback: Callable):
        self.broker = settings.MQTT_BROKER_URL
        self.port = settings.MQTT_BROKER_PORT
        self.username = settings.MQTT_USERNAME
        self.password = settings.MQTT_PASSWORD
        self.topic = f"{settings.MQTT_TOPIC_PREFIX}/+/telemetry"
        self.callback = on_message_callback
        self.client = mqtt.Client(client_id="honeychain-backend", protocol=mqtt.MQTTv311)
        self._connected = False

        if self.username:
            self.client.username_pw_set(self.username, self.password)

        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info(f"Connected to MQTT broker at {self.broker}:{self.port}")
            self._connected = True
            client.subscribe(self.topic, qos=1)
            logger.info(f"Subscribed to {self.topic}")
        else:
            logger.error(f"MQTT connection failed with code {rc}")

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            logger.debug(f"MQTT received: {payload}")
            # Extract hive_id from topic: hive/{hive_id}/telemetry
            topic_parts = msg.topic.split("/")
            if len(topic_parts) >= 2:
                payload["hive_code"] = topic_parts[1]
            asyncio.run(self.callback(payload))
        except Exception as e:
            logger.error(f"Error processing MQTT message: {e}")

    def start(self):
        """Start the MQTT client in a separate thread."""
        self.client.connect_async(self.broker, self.port, keepalive=60)
        self.client.loop_start()
        logger.info("MQTT client started")

    def stop(self):
        """Stop the MQTT client."""
        self.client.loop_stop()
        self.client.disconnect()
        logger.info("MQTT client stopped")