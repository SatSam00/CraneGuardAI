import cv2
import numpy as np
from ultralytics import YOLO
from deep_sort_realtime.deepsort_tracker import DeepSort

class CraneDetector:
    def __init__(self, model_name='yolov8m.pt'):
        # Upgraded to yolov8m.pt (Medium) for significantly better accuracy
        self.model = YOLO(model_name)
        
        # Optimized DeepSORT parameters for industrial environments
        # max_age: reduced to 5 frames to quickly clear tracks when person leaves
        # n_init: reduced to 1 for instant detection response
        # nms_max_overlap: standard 0.5 for better overlap handling
        self.tracker = DeepSort(
            max_age=5, 
            n_init=1, 
            nms_max_overlap=0.5, 
            max_cosine_distance=0.25, # Stricter feature matching for better accuracy
            embedder="mobilenet", # Efficient and robust for real-time
            half=True # Precision vs speed trade-off
        )
        
        # Expanded classes to include more industrial-looking vehicles
        # 0: person, 5: bus (large machinery), 7: truck (cranes), 58: forklift
        self.target_classes = [0, 5, 7, 58]
        
        # Track-to-Class mapping to ensure ID stability
        self.track_class_map = {}

    def detect_and_track(self, frame):
        # Increased conf threshold to 0.45 for higher precision and accuracy
        results = self.model(frame, classes=self.target_classes, verbose=False, conf=0.45)[0]
        
        detections = []
        for r in results.boxes.data.tolist():
            x1, y1, x2, y2, score, class_id = r
            # Additional layer of filtering
            if score > 0.45:
                # Format for DeepSORT: [([x, y, w, h], confidence, class_name), ...]
                w = int(x2 - x1)
                h = int(y2 - y1)
                detections.append(([int(x1), int(y1), w, h], score, self.model.names[int(class_id)]))

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
            
            # Advanced Movement Analysis: Variance over last 20 frames
            if not hasattr(track, 'center_history'):
                track.center_history = []
                track.smoothed_bbox = ltrb
            
            track.center_history.append(center)
            if len(track.center_history) > 20: # Slightly longer window
                track.center_history.pop(0)
            
            # Bbox Smoothing (EMA) to reduce jitter in the UI
            alpha = 0.9 # Higher alpha = more responsive, less delay
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
