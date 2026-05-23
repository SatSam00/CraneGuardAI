"""
Module 3B: Operator Fatigue Detection
======================================
Uses MediaPipe FaceMesh to compute:
  - EAR (Eye Aspect Ratio): Triggers alert if eyes are 70%+ closed for 2+ seconds.
  - PERCLOS: % of frames where eyes are closed per rolling 60-second window.

Designed to run on a SECONDARY camera pointed at the crane operator cabin.
Run via ThreadPoolExecutor to keep it off the main video loop.
"""

import cv2
import time
import numpy as np
from collections import deque

try:
    import mediapipe as mp
    # Check if legacy solutions are available
    MEDIAPIPE_AVAILABLE = hasattr(mp, 'solutions')
    if not MEDIAPIPE_AVAILABLE:
        # Try to import directly from the internal path if possible
        try:
            import mediapipe.python.solutions.face_mesh as face_mesh
            # If this works, we can manually attach it
            if not hasattr(mp, 'solutions'):
                class MockSolutions: pass
                mp.solutions = MockSolutions()
            mp.solutions.face_mesh = face_mesh
            MEDIAPIPE_AVAILABLE = True
            print("[FatigueDetector] mediapipe.solutions recovered via internal path.")
        except ImportError:
            print("[FatigueDetector] mediapipe.solutions not found. Fatigue detection disabled.")
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    print("[FatigueDetector] mediapipe not installed. Fatigue detection disabled.")

# ── MediaPipe landmark indices for eyes ─────────────────────────────────────
# Left Eye:  outer=33, inner=133, top=160, bottom=144
# Right Eye: outer=362, inner=263, top=387, bottom=373
LEFT_EYE_IDXS  = [33, 160, 158, 133, 153, 144]
RIGHT_EYE_IDXS = [362, 385, 387, 263, 373, 380]

EAR_THRESHOLD       = 0.22   # Below this = eye considered CLOSED
EAR_CLOSED_SEC      = 2.0    # Seconds of continuous closure to alert
PERCLOS_THRESHOLD   = 0.35   # 35%+ of frames closed per minute = fatigue
PERCLOS_WINDOW_SEC  = 60     # Rolling window in seconds


def _eye_aspect_ratio(landmarks, eye_idxs, w, h):
    """Calculate EAR from 6 landmark points."""
    pts = [(int(landmarks[i].x * w), int(landmarks[i].y * h)) for i in eye_idxs]
    # Vertical distances
    v1 = np.linalg.norm(np.array(pts[1]) - np.array(pts[5]))
    v2 = np.linalg.norm(np.array(pts[2]) - np.array(pts[4]))
    # Horizontal distance
    h1 = np.linalg.norm(np.array(pts[0]) - np.array(pts[3]))
    return (v1 + v2) / (2.0 * max(h1, 1e-6))


class FatigueDetector:
    def __init__(self):
        self._ready = False
        if not MEDIAPIPE_AVAILABLE:
            return

        try:
            self.mp_face = mp.solutions.face_mesh
            self.face_mesh = self.mp_face.FaceMesh(
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            self._ready = True
        except (AttributeError, Exception) as e:
            print(f"[FatigueDetector] Failed to initialize FaceMesh: {e}")
            self._ready = False
            return

        # State tracking
        self._eye_closed_since = None      # timestamp when eyes first closed
        self._perclos_window   = deque()   # (timestamp, is_closed) tuples
        self._last_alert_time  = 0
        self._alert_cooldown   = 30        # seconds between repeated alerts
        self._ready = True

    def analyze_frame(self, frame):
        """
        Analyze a single cabin camera frame for fatigue.

        Returns dict:
          {
            "ear": float,           # current eye aspect ratio (avg both eyes)
            "eyes_closed": bool,
            "closed_duration": float,  # seconds eyes have been continuously closed
            "perclos": float,          # 0.0–1.0 fraction
            "alert": bool,             # True if fatigue threshold exceeded
            "alert_type": str          # "EAR_CLOSURE" | "PERCLOS" | None
          }
        """
        result = {
            "ear": 1.0, "eyes_closed": False,
            "closed_duration": 0.0, "perclos": 0.0,
            "alert": False, "alert_type": None
        }

        if not self._ready:
            return result

        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mesh_result = self.face_mesh.process(rgb)

        if not mesh_result.multi_face_landmarks:
            return result

        lm = mesh_result.multi_face_landmarks[0].landmark
        left_ear  = _eye_aspect_ratio(lm, LEFT_EYE_IDXS, w, h)
        right_ear = _eye_aspect_ratio(lm, RIGHT_EYE_IDXS, w, h)
        ear = (left_ear + right_ear) / 2.0
        result["ear"] = round(ear, 3)

        now = time.time()
        is_closed = ear < EAR_THRESHOLD
        result["eyes_closed"] = is_closed

        # ── EAR continuous closure tracking ─────────────────────────────────
        if is_closed:
            if self._eye_closed_since is None:
                self._eye_closed_since = now
            closed_dur = now - self._eye_closed_since
        else:
            self._eye_closed_since = None
            closed_dur = 0.0
        result["closed_duration"] = round(closed_dur, 2)

        # ── PERCLOS rolling window ───────────────────────────────────────────
        self._perclos_window.append((now, is_closed))
        cutoff = now - PERCLOS_WINDOW_SEC
        while self._perclos_window and self._perclos_window[0][0] < cutoff:
            self._perclos_window.popleft()

        if self._perclos_window:
            closed_count = sum(1 for _, c in self._perclos_window if c)
            perclos = closed_count / len(self._perclos_window)
        else:
            perclos = 0.0
        result["perclos"] = round(perclos, 3)

        # ── Alert logic ──────────────────────────────────────────────────────
        in_cooldown = (now - self._last_alert_time) < self._alert_cooldown

        if not in_cooldown:
            if closed_dur >= EAR_CLOSED_SEC:
                result["alert"] = True
                result["alert_type"] = "EAR_CLOSURE"
                self._last_alert_time = now
            elif perclos >= PERCLOS_THRESHOLD:
                result["alert"] = True
                result["alert_type"] = "PERCLOS"
                self._last_alert_time = now

        return result

    def draw_overlay(self, frame, fatigue_data):
        """Draw EAR and PERCLOS overlay on the operator feed."""
        if not fatigue_data:
            return frame

        ear    = fatigue_data.get("ear", 1.0)
        perclos = fatigue_data.get("perclos", 0.0)
        alert  = fatigue_data.get("alert", False)
        dur    = fatigue_data.get("closed_duration", 0.0)

        color = (0, 0, 255) if alert else (0, 255, 200)
        cv2.putText(frame, f"EAR: {ear:.3f}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, color, 2)
        cv2.putText(frame, f"PERCLOS: {perclos:.1%}", (10, 60),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, color, 2)
        if dur > 0.5:
            cv2.putText(frame, f"EYES CLOSED: {dur:.1f}s", (10, 90),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 60, 255), 2)
        if alert:
            cv2.rectangle(frame, (0, 0), (frame.shape[1], frame.shape[0]),
                          (0, 0, 255), 8)
            cv2.putText(frame, "FATIGUE ALERT!", (20, frame.shape[0] // 2),
                        cv2.FONT_HERSHEY_DUPLEX, 1.4, (0, 0, 255), 3)
        return frame
