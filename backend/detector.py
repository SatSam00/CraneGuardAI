import cv2
import numpy as np
from ultralytics import YOLO
from deep_sort_realtime.deepsort_tracker import DeepSort

class CraneDetector:
    def __init__(self, model_name='yolov8s.pt'):
        # Use yolov8s by default for better real-time performance on CPU.
        self.model = YOLO(model_name)
        
        # Optimized DeepSORT parameters for industrial environments
        # max_age: increased to 8 frames for smoother tracks and longer history
        # n_init: reduced to 1 for instant detection response
        # nms_max_overlap: standard 0.5 for better overlap handling
        self.tracker = DeepSort(
            max_age=8, 
            n_init=1, 
            nms_max_overlap=0.5, 
            max_cosine_distance=0.25, # Stricter feature matching for better accuracy
            embedder="mobilenet", # Efficient and robust for real-time
            half=True # Precision vs speed trade-off
        )
        
        # Expanded classes to include more industrial-looking vehicles
        # 0: person, 5: bus (large machinery), 7: truck (cranes), 58: forklift
        self.target_classes = [0, 5, 7, 58]
        self.class_conf_thresholds = {
            "person": 0.3,
            "truck": 0.32,
            "bus": 0.32,
            "train": 0.32,
            "forklift": 0.3,
        }
        self.person_min_height = 44
        self.person_min_width = 16
        self.person_min_area = 900
        
        # Track-to-Class mapping to ensure ID stability
        self.track_class_map = {}

    def detect_and_track(self, frame):
        # Run with low global threshold, then apply class-specific filtering below.
        results = self.model(frame, classes=self.target_classes, verbose=False, conf=0.2, imgsz=736)[0]
        
        detections = []
        for r in results.boxes.data.tolist():
            x1, y1, x2, y2, score, class_id = r
            class_name = self.model.names[int(class_id)]
            class_threshold = self.class_conf_thresholds.get(class_name, 0.3)
            if score < class_threshold:
                continue

            # Format for DeepSORT: [([x, y, w, h], confidence, class_name), ...]
            w = int(x2 - x1)
            h = int(y2 - y1)

            if class_name == 'person':
                if h < self.person_min_height or w < self.person_min_width:
                    continue
                if (w * h) < self.person_min_area:
                    continue
                aspect_ratio = w / max(h, 1)
                if aspect_ratio < 0.15 or aspect_ratio > 1.2:
                    continue

            detections.append(([int(x1), int(y1), w, h], score, class_name))

        # DeepSORT magic: Associating detections with existing tracks
        tracks = self.tracker.update_tracks(detections, frame=frame)
        
        processed_detections = []
        for track in tracks:
            # We skip tentative tracks to prevent flickering IDs
            if not track.is_confirmed():
                continue
            
            # Predict position even if occlusion occurs (DeepSORT internal Kalman Filter)
            track_id = track.track_id
            ltrb = track.to_ltrb() # Left, Top, Right, Bottom
            class_name = track.get_det_class()
            
            # ID Class Stability: Keep the first confirmed class for this ID
            if track_id not in self.track_class_map:
                self.track_class_map[track_id] = class_name
            else:
                class_name = self.track_class_map[track_id]
            
            center = [int((ltrb[0] + ltrb[2]) / 2), int((ltrb[1] + ltrb[3]) / 2)]
            
            # Advanced Movement Analysis: Variance over last 30 frames for smoother motion
            if not hasattr(track, 'center_history'):
                track.center_history = []
                track.smoothed_bbox = ltrb
            
            track.center_history.append(center)
            if len(track.center_history) > 30: # Longer window for better motion prediction
                track.center_history.pop(0)
            
            # Bbox Smoothing (EMA) to reduce jitter in the UI
            alpha = 0.95 # Higher alpha = more aggressive smoothing, less jitter
            track.smoothed_bbox = [
                alpha * ltrb[i] + (1 - alpha) * track.smoothed_bbox[i]
                for i in range(4)
            ]
            
            # Calculate activity (shaking/movement)
            activity = 0
            if len(track.center_history) > 3:
                # Average displacement between consecutive frames
                displacements = [np.sqrt((track.center_history[i][0] - track.center_history[i-1][0])**2 + 
                                       (track.center_history[i][1] - track.center_history[i-1][1])**2)
                                for i in range(1, len(track.center_history))]
                
                avg_displacement = np.mean(displacements)
                
                # Position variance (StDev): High variance means the object is jittering/shaking
                centers_arr = np.array(track.center_history)
                std_dev = np.sum(np.std(centers_arr, axis=0))
                
                # Penalize small random noise below 1.0 pixel movement
                if avg_displacement < 1.0:
                    activity = std_dev * 0.5
                else:
                    activity = avg_displacement + (std_dev * 1.2)

            processed_detections.append({
                "id": track_id,
                "bbox": [int(track.smoothed_bbox[0]), int(track.smoothed_bbox[1]), 
                         int(track.smoothed_bbox[2]), int(track.smoothed_bbox[3])],
                "class": class_name,
                "center": center,
                "movement": activity,
                "confirmed": True
            })
            
        return processed_detections
