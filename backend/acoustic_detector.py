"""
Module 3C: Acoustic Event Detection
=====================================
Listens to the site microphone in a background thread using `sounddevice`.
Classifies audio events using Google's YAMNet model (TensorFlow Hub).

If TensorFlow is not installed, falls back to a simple amplitude-threshold
detector that can flag loud bangs, alarms, and screams based on dB level.

Correlates with visual zone alerts to escalate severity.
"""

import time
import threading
import numpy as np
from collections import deque

# ── Optional TensorFlow / YAMNet ─────────────────────────────────────────────
try:
    import tensorflow as tf
    import tensorflow_hub as hub
    _YAMNET_MODEL = hub.load("https://tfhub.dev/google/yamnet/1")
    # YAMNet class map (subset of interest)
    _ALERT_CLASS_IDS = {
        # Crash / Impact
        "Crash": 427, "Glass breaking": 428, "Thud": 429,
        # Human distress
        "Screaming": 74, "Shout": 77,
        # Machine alarms
        "Alarm": 388, "Siren": 390, "Buzzer": 391,
        # Metal impacts
        "Hammer": 352, "Mechanisms": 473,
    }
    YAMNET_AVAILABLE = True
    print("[AcousticDetector] YAMNet loaded.")
except Exception:
    YAMNET_AVAILABLE = False
    print("[AcousticDetector] TensorFlow/YAMNet not available. Using amplitude fallback.")

try:
    import sounddevice as sd
    SOUNDDEVICE_AVAILABLE = True
except ImportError:
    SOUNDDEVICE_AVAILABLE = False
    print("[AcousticDetector] sounddevice not installed. Acoustic detection disabled.")

SAMPLE_RATE   = 16000    # YAMNet expected sample rate
CHUNK_SECONDS = 0.975    # YAMNet expects ~0.975s windows
CHUNK_SAMPLES = int(SAMPLE_RATE * CHUNK_SECONDS)
DB_ALERT_THRESHOLD = 80  # dB SPL equivalent for amplitude fallback


class AcousticDetector:
    """
    Runs a background thread capturing audio and classifying events.
    Call `start()` to begin, `get_latest_events()` to poll results,
    `stop()` to clean up.
    """

    def __init__(self):
        self._running   = False
        self._thread    = None
        self._buffer    = np.zeros(CHUNK_SAMPLES, dtype=np.float32)
        self._events    = deque(maxlen=50)  # Rolling event log
        self._lock      = threading.Lock()
        self._stream    = None

        # Correlation state: recent zone IDs flagged as dangerous
        self._active_zone_ids = set()
        self._last_event_time = 0
        self._cooldown = 5.0   # seconds between duplicate alerts

    def set_active_zones(self, zone_ids):
        """Call from main loop to update which zones are currently in danger."""
        self._active_zone_ids = set(zone_ids)

    def get_latest_events(self):
        """Return list of recent acoustic events. Thread-safe."""
        with self._lock:
            return list(self._events)

    def _process_chunk(self, chunk):
        """Classify a chunk of audio. Returns list of event dicts."""
        now = time.time()
        events = []

        if YAMNET_AVAILABLE:
            try:
                waveform = tf.constant(chunk, dtype=tf.float32)
                scores, embeddings, _ = _YAMNET_MODEL(waveform)
                mean_scores = tf.reduce_mean(scores, axis=0).numpy()

                for label, class_id in _ALERT_CLASS_IDS.items():
                    if class_id < len(mean_scores) and mean_scores[class_id] > 0.35:
                        is_near_danger = len(self._active_zone_ids) > 0
                        events.append({
                            "timestamp": now,
                            "label": label,
                            "confidence": float(mean_scores[class_id]),
                            "near_active_zone": is_near_danger,
                            "escalated": is_near_danger,
                            "source": "yamnet"
                        })
            except Exception as e:
                print(f"[AcousticDetector] YAMNet error: {e}")
        else:
            # Amplitude fallback: detect loud transient events
            rms = np.sqrt(np.mean(chunk ** 2))
            db  = 20 * np.log10(max(rms, 1e-10)) + 100  # rough SPL offset
            if db > DB_ALERT_THRESHOLD:
                events.append({
                    "timestamp": now,
                    "label": "LOUD_IMPACT",
                    "confidence": min(1.0, db / 120),
                    "near_active_zone": len(self._active_zone_ids) > 0,
                    "escalated": len(self._active_zone_ids) > 0,
                    "source": "amplitude_fallback"
                })

        # Cooldown dedup
        if events and (now - self._last_event_time) > self._cooldown:
            self._last_event_time = now
            with self._lock:
                for ev in events:
                    self._events.appendleft(ev)
            return events
        return []

    def _audio_callback(self, indata, frames, time_info, status):
        """Called by sounddevice for each audio chunk — runs on audio thread."""
        mono = indata[:, 0] if indata.ndim > 1 else indata.flatten()
        # Rolling buffer: append new samples
        self._buffer = np.roll(self._buffer, -len(mono))
        self._buffer[-len(mono):] = mono

        if len(self._buffer) >= CHUNK_SAMPLES:
            self._process_chunk(self._buffer[-CHUNK_SAMPLES:].copy())

    def _fallback_loop(self):
        """Polling loop when sounddevice is unavailable (stub / test mode)."""
        print("[AcousticDetector] Running in stub mode (no microphone).")
        while self._running:
            time.sleep(2)

    def start(self):
        if self._running:
            return
        self._running = True

        if SOUNDDEVICE_AVAILABLE:
            try:
                self._stream = sd.InputStream(
                    samplerate=SAMPLE_RATE,
                    channels=1,
                    dtype="float32",
                    blocksize=int(SAMPLE_RATE * 0.1),   # 100ms blocks
                    callback=self._audio_callback
                )
                self._stream.start()
                print("[AcousticDetector] Microphone stream started.")
                return
            except Exception as e:
                print(f"[AcousticDetector] Failed to open mic: {e}. Using stub mode.")

        self._thread = threading.Thread(target=self._fallback_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._stream:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception:
                pass
        if self._thread:
            self._thread.join(timeout=2)
