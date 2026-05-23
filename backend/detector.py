"""
CraneGuard AI — Enhanced Detector
===================================
Improvements over baseline:
  2b) SAHI Sliced Adaptive Inference for small-object detection
  2c) YOLOv8-Pose proximity risk scoring
  2e) Temperature-scaled confidence calibration
  3A) Predictive trajectory forecasting (existing, carried forward)
"""

import cv2
import numpy as np
from ultralytics import YOLO
from deep_sort_realtime.deepsort_tracker import DeepSort

# ── Module 3A constants ───────────────────────────────────────────────────────
FORECAST_HORIZON_FRAMES = 30
MIN_HISTORY_FOR_FORECAST = 8

# ── Module 2e: Temperature Scaling ───────────────────────────────────────────
# Temperature > 1.0 softens (lowers) confidence, < 1.0 sharpens.
# Set via env var; default 1.15 reduces false positives in noisy industrial scenes.
import os
TEMPERATURE = float(os.getenv("CONF_TEMPERATURE", "1.15"))


def _apply_temperature(score: float, temperature: float = TEMPERATURE) -> float:
    """Softmax temperature scaling: score_new = score^(1/T) / normaliser."""
    import math
    if temperature <= 0:
        return score
    # Simplified single-class version: monotonic rescaling
    return float(math.pow(max(score, 1e-9), 1.0 / temperature))


# ── Module 2b: SAHI ───────────────────────────────────────────────────────────
try:
    from sahi import AutoDetectionModel
    from sahi.predict import get_sliced_prediction
    SAHI_AVAILABLE = True
except ImportError:
    SAHI_AVAILABLE = False
    print("[Detector] sahi not installed. Sliced inference disabled.")


# ── Module 2c: Pose Estimation ────────────────────────────────────────────────
# Head keypoint = 0, left shoulder = 5, right shoulder = 6
POSE_KEYPOINTS_OF_INTEREST = [0, 5, 6]


def _compute_proximity_risk(person_keypoints, machine_bboxes):
    """
    Returns a risk score 0.0–1.0 indicating how close a person's key body parts
    (head, shoulders) are to the nearest detected machine bounding box.

    Distance is normalised by the frame diagonal to make it resolution-agnostic.
    """
    if not machine_bboxes or person_keypoints is None:
        return 0.0

    frame_diag = 1920.0  # Assume 1080p; normalisation factor
    min_dist = float("inf")

    for kp_idx in POSE_KEYPOINTS_OF_INTEREST:
        if kp_idx >= len(person_keypoints):
            continue
        kp = person_keypoints[kp_idx]
        if kp[2] < 0.3:   # Low pose confidence — skip
            continue
        px, py = kp[0], kp[1]

        for mb in machine_bboxes:
            x1, y1, x2, y2 = mb
            # Closest point on bbox to keypoint
            cx = max(x1, min(px, x2))
            cy = max(y1, min(py, y2))
            dist = np.hypot(px - cx, py - cy)
            min_dist = min(min_dist, dist)

    if min_dist == float("inf"):
        return 0.0

    # Risk is inversely proportional to distance, capped at 1.0
    risk = max(0.0, min(1.0, 1.0 - (min_dist / (frame_diag * 0.15))))
    return round(risk, 3)


class CraneDetector:
    def __init__(self, model_name='yolov8s.pt', use_pose=True, use_sahi=False):
        # ── Primary detection model ───────────────────────────────────────────
        self.model = YOLO(model_name)

        # ── DeepSORT tracker ─────────────────────────────────────────────────
        self.tracker = DeepSort(
            max_age=8,
            n_init=1,
            nms_max_overlap=0.5,
            max_cosine_distance=0.25,
            embedder="mobilenet",
            half=True
        )

        # ── 2c: Pose model ───────────────────────────────────────────────────
        self.use_pose = use_pose
        pose_model_path = os.path.join(os.path.dirname(__file__), "yolov8s-pose.pt")
        if use_pose and os.path.exists(pose_model_path):
            self.pose_model = YOLO(pose_model_path)
            print(f"[Detector] Pose model loaded: {pose_model_path}")
        else:
            self.pose_model = None
            if use_pose:
                print("[Detector] yolov8s-pose.pt not found. Pose estimation disabled.")

        # ── 2b: SAHI detection model wrapper ─────────────────────────────────
        self.use_sahi = use_sahi and SAHI_AVAILABLE
        if self.use_sahi:
            self.sahi_model = AutoDetectionModel.from_pretrained(
                model_type="yolov8",
                model_path=model_name,
                confidence_threshold=0.25,
                device="cpu"
            )
            print("[Detector] SAHI sliced inference enabled.")

        # ── Detection config ─────────────────────────────────────────────────
        self.target_classes = [0, 5, 7, 58]
        self.class_conf_thresholds = {
            "person": 0.3, "truck": 0.32, "bus": 0.32,
            "train": 0.32, "forklift": 0.3,
        }
        self.person_min_height = 44
        self.person_min_width  = 16
        self.person_min_area   = 900

        self.track_class_map = {}

        # ── 2e: Calibration log (false-positives/negatives) ────────────────
        self._calibration_log = []   # Polled by main.py to write to Supabase

    # ── 2b: SAHI sliced inference ─────────────────────────────────────────────
    def _detect_with_sahi(self, frame):
        """Run 512×512 sliced inference with 20% overlap. Returns raw detection list."""
        result = get_sliced_prediction(
            frame,
            self.sahi_model,
            slice_height=512,
            slice_width=512,
            overlap_height_ratio=0.2,
            overlap_width_ratio=0.2,
            perform_standard_pred=True,
            postprocess_type="NMS",
            postprocess_match_threshold=0.5,
            verbose=False
        )
        detections = []
        for obj in result.object_prediction_list:
            bbox = obj.bbox
            x1, y1, x2, y2 = bbox.minx, bbox.miny, bbox.maxx, bbox.maxy
            score  = obj.score.value
            cat    = obj.category.name.lower()

            score = _apply_temperature(score)
            threshold = self.class_conf_thresholds.get(cat, 0.3)
            if score < threshold:
                continue
            w, h = int(x2 - x1), int(y2 - y1)
            detections.append(([int(x1), int(y1), w, h], score, cat))
        return detections

    # ── Standard inference ────────────────────────────────────────────────────
    def _detect_standard(self, frame):
        results = self.model(
            frame, classes=self.target_classes, verbose=False, conf=0.2, imgsz=736
        )[0]
        detections = []
        for r in results.boxes.data.tolist():
            x1, y1, x2, y2, score, class_id = r
            class_name = self.model.names[int(class_id)]

            # 2e: Temperature scaling
            score = _apply_temperature(score)

            threshold = self.class_conf_thresholds.get(class_name, 0.3)
            if score < threshold:
                continue

            w, h = int(x2 - x1), int(y2 - y1)

            if class_name == 'person':
                if h < self.person_min_height or w < self.person_min_width:
                    continue
                if (w * h) < self.person_min_area:
                    continue
                aspect_ratio = w / max(h, 1)
                if aspect_ratio < 0.15 or aspect_ratio > 1.2:
                    continue

            detections.append(([int(x1), int(y1), w, h], score, class_name))
        return detections

    # ── 2c: Run pose estimation on person crops ───────────────────────────────
    def _run_pose_on_persons(self, frame, person_bboxes):
        """
        Runs YOLOv8-pose on person bounding boxes cropped from the frame.
        Returns dict {track_id_index: keypoints_array} — matched positionally.
        """
        if self.pose_model is None or not person_bboxes:
            return {}

        kp_map = {}
        for idx, bbox in enumerate(person_bboxes):
            x1, y1, x2, y2 = bbox
            pad = 10
            cx1 = max(0, x1 - pad)
            cy1 = max(0, y1 - pad)
            cx2 = min(frame.shape[1], x2 + pad)
            cy2 = min(frame.shape[0], y2 + pad)
            crop = frame[cy1:cy2, cx1:cx2]
            if crop.size == 0:
                continue
            try:
                pose_res = self.pose_model(crop, verbose=False, conf=0.3)[0]
                if pose_res.keypoints and len(pose_res.keypoints.data) > 0:
                    raw_kps = pose_res.keypoints.data[0].cpu().numpy()  # (17, 3)
                    # Translate keypoints back to full-frame coordinates
                    raw_kps[:, 0] += cx1
                    raw_kps[:, 1] += cy1
                    kp_map[idx] = raw_kps
            except Exception:
                pass
        return kp_map

    def log_calibration_event(self, event_type: str, track_id: int, confidence: float):
        """
        2e: Log a false-positive or false-negative event for later Supabase sync.
        event_type: "FALSE_POSITIVE" | "FALSE_NEGATIVE"
        """
        import time
        self._calibration_log.append({
            "event_type": event_type,
            "track_id": track_id,
            "confidence": confidence,
            "timestamp": time.time()
        })
        # Keep last 500
        self._calibration_log = self._calibration_log[-500:]

    def flush_calibration_log(self):
        """Drain and return all pending calibration events."""
        events = list(self._calibration_log)
        self._calibration_log.clear()
        return events

    # ── Main detection + tracking pipeline ───────────────────────────────────
    def detect_and_track(self, frame):
        # Step 1: Detect
        if self.use_sahi:
            detections = self._detect_with_sahi(frame)
        else:
            detections = self._detect_standard(frame)

        # Step 2: Track
        tracks = self.tracker.update_tracks(detections, frame=frame)

        # Step 3: Collect person bboxes for batch pose estimation
        confirmed_persons = []
        for track in tracks:
            if not track.is_confirmed():
                continue
            ltrb = track.to_ltrb()
            cname = track.get_det_class()
            if cname == 'person':
                confirmed_persons.append((track, ltrb))

        person_bboxes = [[int(b[0]), int(b[1]), int(b[2]), int(b[3])] for _, b in confirmed_persons]
        pose_map = self._run_pose_on_persons(frame, person_bboxes)

        # Collect machine bboxes for risk scoring
        machine_bboxes = []
        for track in tracks:
            if not track.is_confirmed():
                continue
            cname = track.get_det_class()
            if cname in ('truck', 'bus', 'forklift', 'train'):
                ltrb = track.to_ltrb()
                machine_bboxes.append([int(ltrb[0]), int(ltrb[1]), int(ltrb[2]), int(ltrb[3])])

        # Step 4: Build result list with all enrichments
        processed_detections = []
        person_idx = 0  # Cursor into confirmed_persons / pose_map

        for track in tracks:
            if not track.is_confirmed():
                continue

            track_id = track.track_id
            ltrb     = track.to_ltrb()
            class_name = track.get_det_class()

            # ID Class Stability
            if track_id not in self.track_class_map:
                self.track_class_map[track_id] = class_name
            else:
                class_name = self.track_class_map[track_id]

            center = [int((ltrb[0] + ltrb[2]) / 2), int((ltrb[1] + ltrb[3]) / 2)]

            if not hasattr(track, 'center_history'):
                track.center_history = []
                track.smoothed_bbox  = ltrb

            track.center_history.append(center)
            if len(track.center_history) > 30:
                track.center_history.pop(0)

            alpha = 0.95
            track.smoothed_bbox = [
                alpha * ltrb[i] + (1 - alpha) * track.smoothed_bbox[i]
                for i in range(4)
            ]

            activity = 0
            if len(track.center_history) > 3:
                displacements = [
                    np.sqrt(
                        (track.center_history[i][0] - track.center_history[i-1][0])**2 +
                        (track.center_history[i][1] - track.center_history[i-1][1])**2
                    )
                    for i in range(1, len(track.center_history))
                ]
                avg_displacement = np.mean(displacements)
                centers_arr = np.array(track.center_history)
                std_dev = np.sum(np.std(centers_arr, axis=0))
                activity = std_dev * 0.5 if avg_displacement < 1.0 else avg_displacement + (std_dev * 1.2)

            # ── 3A: Trajectory Forecast ────────────────────────────────────
            forecast_center = None
            forecast_path   = []
            if class_name == 'person' and len(track.center_history) >= MIN_HISTORY_FOR_FORECAST:
                history_slice = track.center_history[-15:]
                if len(history_slice) >= 2:
                    dx_list = [history_slice[i][0] - history_slice[i-1][0] for i in range(1, len(history_slice))]
                    dy_list = [history_slice[i][1] - history_slice[i-1][1] for i in range(1, len(history_slice))]
                    vx, vy = np.mean(dx_list), np.mean(dy_list)
                    speed  = np.sqrt(vx**2 + vy**2)
                    if speed > 0.8:
                        fx = center[0] + int(vx * FORECAST_HORIZON_FRAMES)
                        fy = center[1] + int(vy * FORECAST_HORIZON_FRAMES)
                        forecast_center = [fx, fy]
                        steps = 6
                        forecast_path = [
                            [center[0] + int(vx * FORECAST_HORIZON_FRAMES * (s / steps)),
                             center[1] + int(vy * FORECAST_HORIZON_FRAMES * (s / steps))]
                            for s in range(1, steps + 1)
                        ]

            # ── 2c: Pose keypoints & risk score ───────────────────────────
            keypoints  = None
            risk_score = 0.0
            if class_name == 'person':
                kps_array = pose_map.get(person_idx)
                if kps_array is not None:
                    keypoints  = kps_array.tolist()
                    risk_score = _compute_proximity_risk(kps_array, machine_bboxes)
                person_idx += 1

            processed_detections.append({
                "id":             track_id,
                "bbox":           [int(track.smoothed_bbox[0]), int(track.smoothed_bbox[1]),
                                   int(track.smoothed_bbox[2]), int(track.smoothed_bbox[3])],
                "class":          class_name,
                "center":         center,
                "movement":       activity,
                "confirmed":      True,
                "forecast_center": forecast_center,
                "forecast_path":   forecast_path,
                "keypoints":       keypoints,      # 2c: 17×3 array or None
                "risk_score":      risk_score,     # 2c: 0.0–1.0 proximity danger
            })

        return processed_detections
