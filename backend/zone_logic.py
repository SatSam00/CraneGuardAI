import cv2
import numpy as np

def is_box_in_zone(bbox, polygon_coords):
    """
    bbox: [x1, y1, x2, y2]
    polygon_coords: [[x1, y1], [x2, y2], ...]
    """
    if not polygon_coords or len(polygon_coords) < 3:
        return False
        
    poly = np.array(polygon_coords, dtype=np.int32)
    
    # Check if any of the 4 corners of the bbox are inside
    corners = [
        (bbox[0], bbox[1]), (bbox[2], bbox[1]),
        (bbox[0], bbox[3]), (bbox[2], bbox[3]),
        ((bbox[0]+bbox[2])//2, bbox[3]) # Mid-point of bottom edge (feet)
    ]
    
    for pt in corners:
        if cv2.pointPolygonTest(poly, pt, False) >= 0:
            return True
            
    # Also check if the center is inside
    center = ((bbox[0]+bbox[2])//2, (bbox[1]+bbox[3])//2)
    if cv2.pointPolygonTest(poly, center, False) >= 0:
        return True
        
    return False

def check_zones(detections, zones):
    """
    detections: list of dicts with 'bbox' and 'class'
    zones: list of dicts with 'id', 'name', 'polygon' (list of [x,y])
    
    Returns: status per zone
    """
    zone_results = {}
    
    for zone in zones:
        zone_id = zone['id']
        poly = zone['polygon']
        
        workers_in_zone = []
        cranes_in_zone = []
        movement_in_zone = False
        
        for det in detections:
            if is_box_in_zone(det['bbox'], poly):
                if det['class'] == 'person':
                    workers_in_zone.append(det['id'])
                elif det['class'] in ['truck', 'forklift']: # proxy for cranes
                    cranes_in_zone.append(det['id'])
                
                # Detect any movement/shaking in zone
                if det.get('movement', 0) > 1.2: # High sensitivity for shaking
                    movement_in_zone = True
        
        zone_results[zone_id] = {
            "name": zone['name'],
            "worker_count": len(workers_in_zone),
            "crane_active": len(cranes_in_zone) > 0 or movement_in_zone,
            "danger": False, # Will be calculated in main loop
            "polygon": poly,
            "movement": movement_in_zone
        }
        
    return zone_results
