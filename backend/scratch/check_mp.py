import mediapipe as mp
print(f"Mediapipe file: {mp.__file__}")
try:
    print(f"Mediapipe solutions: {mp.solutions}")
except AttributeError as e:
    print(f"Error: {e}")
    print(f"Attributes: {dir(mp)}")
