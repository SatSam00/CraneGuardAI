try:
    from mediapipe.python.solutions import face_mesh
    print("Successfully imported face_mesh from mediapipe.python.solutions")
except ImportError as e:
    print(f"ImportError: {e}")

try:
    import mediapipe.solutions.face_mesh as face_mesh
    print("Successfully imported mediapipe.solutions.face_mesh")
except ImportError as e:
    print(f"ImportError (direct): {e}")

import mediapipe as mp
print(f"MP dir: {dir(mp)}")
