"""Anomaly detection service for hive sensor data.

Uses scikit-learn's Isolation Forest algorithm trained on synthetic
data for prototype/demo purposes. This is NOT a clinical or diagnostic tool.
"""
import numpy as np
from sklearn.ensemble import IsolationForest
from typing import Tuple, Optional


class HiveAnomalyDetector:
    """Detects anomalous hive conditions from sensor telemetry.

    This is a prototype/demo model. It uses synthetically generated
    training data and should not be considered a definitive diagnostic tool.
    """

    def __init__(self, contamination: float = 0.1, random_state: int = 42):
        self.model = IsolationForest(
            contamination=contamination,
            random_state=random_state,
            n_estimators=100,
        )
        self._trained = False

    def _generate_training_data(self) -> np.ndarray:
        """Generate synthetic sensor data for training.

        Returns a 2D array with columns: [temperature, humidity, weight, sound_level].
        Normal ranges approximate typical Indian hive conditions.
        """
        rng = np.random.RandomState(42)
        n_samples = 2000

        # Normal data
        temp = rng.normal(loc=32.0, scale=3.0, size=n_samples)  # 29-35°C
        humidity = rng.normal(loc=65.0, scale=8.0, size=n_samples)  # 57-73%
        weight = rng.normal(loc=25.0, scale=2.0, size=n_samples)  # 23-27 kg
        sound = rng.normal(loc=55.0, scale=10.0, size=n_samples)  # 45-65 dB

        # Inject some anomalies (about 10%)
        n_anomalies = int(n_samples * 0.1)
        idx = rng.choice(n_samples, n_anomalies, replace=False)
        temp[idx] = rng.uniform(15, 45, n_anomalies)
        humidity[idx] = rng.uniform(20, 95, n_anomalies)
        weight[idx] = rng.uniform(10, 40, n_anomalies)
        sound[idx] = rng.uniform(30, 90, n_anomalies)

        return np.column_stack([temp, humidity, weight, sound])

    def train(self):
        """Train the anomaly detection model on synthetic data."""
        X = self._generate_training_data()
        self.model.fit(X)
        self._trained = True

    def predict(
        self,
        temperature: float,
        humidity: float,
        weight: float,
        sound_level: float,
    ) -> Tuple[str, Optional[float]]:
        """Predict whether a hive reading is normal or anomalous.

        Returns:
            Tuple of (status: "NORMAL" | "ANOMALY", anomaly_score: float | None)
        """
        if not self._trained:
            self.train()

        X = np.array([[temperature, humidity, weight, sound_level]])
        pred = self.model.predict(X)[0]  # -1 = anomaly, 1 = normal
        score = self.model.score_samples(X)[0]

        status = "NORMAL" if pred == 1 else "ANOMALY"
        # Normalize score to a roughly 0-1 range where higher = more anomalous
        normalized_score = float(1.0 - (score + 0.5) / 1.5)
        normalized_score = max(0.0, min(1.0, normalized_score))

        return status, normalized_score

    def generate_explanation(
        self,
        temperature: float,
        humidity: float,
        weight: float,
        sound_level: float,
    ) -> str:
        """Generate a human-readable explanation of potential anomalies."""
        reasons = []
        if temperature < 20 or temperature > 40:
            reasons.append(f"unusual temperature ({temperature:.1f}°C)")
        if humidity < 30 or humidity > 85:
            reasons.append(f"abnormal humidity ({humidity:.1f}%)")
        if weight < 18 or weight > 32:
            reasons.append(f"unusual weight reading ({weight:.1f} kg)")
        if sound_level > 75:
            reasons.append(f"increased sound activity ({sound_level:.0f} dB)")

        if reasons:
            return "⚠ Potential hive anomaly detected: " + "; ".join(reasons) + "."
        return "⚠ Potential hive anomaly detected. Inspect the hive to verify colony health."


# Singleton instance
detector = HiveAnomalyDetector()
detector.train()