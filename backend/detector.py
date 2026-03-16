import cv2
import numpy as np
from ultralytics import YOLO
from deep_sort_realtime.deepsort_tracker import DeepSort

class CraneDetector:
    def __init__(self, model_name='yolov8s.pt'):
        # Upgraded to yolov8s.pt (Small) for significantly better accuracy than Nano
        self.model = YOLO(model_name)
        self.tracker = DeepSort(max_age=30, n_init=2, nms_max_overlap=1.0, max_cosine_distance=0.2)
        
        # Expanded classes to include more industrial-looking vehicles
        # 0: person, 5: bus (large machinery), 7: truck (cranes), 58: forklift
        self.target_classes = [0, 5, 7, 58]

    def detect_and_track(self, frame):
        # Increased conf threshold to 0.4 for higher precision
        results = self.model(frame, classes=self.target_classes, verbose=False, conf=0.4)[0]
        
        detections = []
        for r in results.boxes.data.tolist():
            x1, y1, x2, y2, score, class_id = r
            # Additional layer of filtering
            if score > 0.4:
                # Format for DeepSORT: [([x, y, w, h], confidence, class_name), ...]
                w = x2 - x1
                h = y2 - y1
                detections.append(([x1, y1, w, h], score, self.model.names[int(class_id)]))

        tracks = self.tracker.update_tracks(detections, frame=frame)
        
        processed_detections = []
        for track in tracks:
            if not track.is_confirmed():
                continue
            
            track_id = track.track_id
            ltrb = track.to_ltrb() # Left, Top, Right, Bottom
            class_name = track.get_det_class()
            
            center = [int((ltrb[0] + ltrb[2]) / 2), int((ltrb[1] + ltrb[3]) / 2)]
            
            # Shaking detection: Analyze variance over last 15 frames
            if not hasattr(track, 'center_history'):
                track.center_history = []
            
            track.center_history.append(center)
            if len(track.center_history) > 15:
                track.center_history.pop(0)
            
            # Calculate activity (shaking/movement)
            activity = 0
            if len(track.center_history) > 2:
                # Average displacement between consecutive frames
                displacements = [np.sqrt((track.center_history[i][0] - track.center_history[i-1][0])**2 + 
                                       (track.center_history[i][1] - track.center_history[i-1][1])**2)
                                for i in range(1, len(track.center_history))]
                
                avg_displacement = np.mean(displacements)
                
                # Position variance (StDev): High variance means the object is jittering/shaking
                centers_arr = np.array(track.center_history)
                std_dev = np.sum(np.std(centers_arr, axis=0))
                
                # Combined score: Shaking creates high StDev even if avg_displacement is low
                activity = avg_displacement + (std_dev * 1.5)

            processed_detections.append({
                "id": track_id,
                "bbox": [int(ltrb[0]), int(ltrb[1]), int(ltrb[2]), int(ltrb[3])],
                "class": class_name,
                "center": center,
                "movement": activity
            })
            
        return processed_detections
