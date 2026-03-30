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
        is_active = zone.get('active', True)
        
        workers_in_zone = []
        machines_in_zone = []
        movement_in_zone = False
        collision_risk = False
        
        # 1. Only process detections if zone is active
        if is_active:
            poly_np = np.array(poly, dtype=np.int32)
            for det in detections:
                # Primary check: BBox or Center
                in_zone = is_box_in_zone(det['bbox'], poly)
                
                # Secondary check: Human Body Parts (Hands, Arms)
                parts_in_zone = False
                for part_name, pt in det.get('parts', {}).items():
                    if cv2.pointPolygonTest(poly_np, tuple(pt), False) >= 0:
                        parts_in_zone = True
                        break
                
                if in_zone or parts_in_zone:
                    if det['class'] == 'person':
                        workers_in_zone.append(det)
                    elif det['class'] in ['truck', 'forklift', 'bus', 'train']:
                        machines_in_zone.append(det)
                    
                    # Detect any movement/shaking in zone, or specific hand movement
                    if det.get('movement', 0) > 1.2:
                        movement_in_zone = True
            
            # 2. Check for Proximity/Overlap (only for active zones)
            for worker in workers_in_zone:
                w_box = worker['bbox']
                for machine in machines_in_zone:
                    m_box = machine['bbox']
                    if not (w_box[2] < m_box[0] or w_box[0] > m_box[2] or 
                            w_box[3] < m_box[1] or w_box[1] > m_box[3]):
                        collision_risk = True
                        break
        
        zone_results[zone_id] = {
            "name": zone['name'],
            "active": is_active,
            "worker_count": len(workers_in_zone),
            "crane_active": len(machines_in_zone) > 0 or movement_in_zone,
            "danger": False, # Calculated in main loop
            "collision_risk": collision_risk,
            "polygon": poly,
            "movement": movement_in_zone
        }
        
    return zone_results
