"""
Module 2a: Custom Dataset Fine-Tuning Script
=============================================
Steps:
  1. Collect 1000+ labeled frames from Roboflow or CVAT (persons, cranes, forklifts, hard negatives).
  2. Export as YOLOv8 format (data.yaml + images/labels folders).
  3. Place the dataset root in the same folder as this script (or set DATASET_PATH).
  4. Run: python train.py

The script auto-applies augmentations via Ultralytics built-ins:
  - Mosaic (4-image collage), Copy-Paste, HSV shifts
  - Motion blur, lighting simulation (albumentations)
  - Cosine LR schedule (cos_lr=True)

Model: YOLOv8m for best accuracy/speed trade-off.
       Switch to yolov8l for maximum accuracy if GPU VRAM > 8GB.
"""

import os
from ultralytics import YOLO

# ── Config ───────────────────────────────────────────────────────────────────
DATASET_PATH = os.getenv("DATASET_PATH", "./dataset/data.yaml")
BASE_MODEL   = os.getenv("BASE_MODEL", "yolov8m.pt")   # or yolov8l.pt
EPOCHS       = int(os.getenv("EPOCHS", "50"))
IMGSZ        = int(os.getenv("IMGSZ", "736"))
BATCH        = int(os.getenv("BATCH", "16"))            # Reduce to 8 if OOM
DEVICE       = os.getenv("DEVICE", "0")                 # 0 = first GPU, "cpu" for CPU
PROJECT_DIR  = os.getenv("PROJECT_DIR", "./runs")
RUN_NAME     = os.getenv("RUN_NAME", "craneguard_v1")


def train():
    print(f"""
    ┌──────────────────────────────────────────┐
    │  CraneGuard AI — Model Fine-Tuning       │
    │  Base:    {BASE_MODEL:<30s}│
    │  Dataset: {DATASET_PATH:<30s}│
    │  Epochs:  {EPOCHS:<30d}│
    │  Device:  {DEVICE:<30s}│
    └──────────────────────────────────────────┘
    """)

    if not os.path.exists(DATASET_PATH):
        print(f"ERROR: Dataset not found at {DATASET_PATH}")
        print("""
HOW TO PREPARE YOUR DATASET (Module 2a steps):
═══════════════════════════════════════════════
1. Collect 1000+ labeled frames using Roboflow or CVAT.
   - Label classes: person, crane, forklift
   - Include HARD NEGATIVES: shadows, warning tape, machinery parts
     (labeled as negatives / background class)

2. Apply augmentations in Roboflow export (or add to augmentations.yaml):
   - Mosaic: ✓  (built-in Ultralytics)
   - Copy-Paste: ✓
   - HSV-Hue shift: ±30°, HSV-Saturation: ±50%, HSV-Value: ±50%
   - Motion blur: kernel 3–9
   - Random brightness/contrast (industrial lighting sim)

3. Export in YOLOv8 format. Your directory should look like:
   dataset/
   ├── data.yaml
   ├── images/
   │   ├── train/ (*.jpg)
   │   └── val/   (*.jpg)
   └── labels/
       ├── train/ (*.txt)
       └── val/   (*.txt)

4. Set DATASET_PATH env var and re-run this script.
        """)
        return

    model = YOLO(BASE_MODEL)

    results = model.train(
        data     = DATASET_PATH,
        epochs   = EPOCHS,
        imgsz    = IMGSZ,
        batch    = BATCH,
        device   = DEVICE,
        project  = PROJECT_DIR,
        name     = RUN_NAME,

        # Optimiser
        optimizer = "AdamW",
        lr0       = 0.001,
        lrf       = 0.01,
        cos_lr    = True,          # Cosine annealing LR schedule
        warmup_epochs = 3,

        # Loss weights (tuned for industrial scene small objects)
        box   = 7.5,
        cls   = 0.5,
        dfl   = 1.5,

        # Built-in Augmentations
        mosaic      = 1.0,         # Mosaic (4 images)
        copy_paste  = 0.3,         # Copy-paste augmentation
        hsv_h       = 0.015,
        hsv_s       = 0.7,
        hsv_v       = 0.4,
        degrees     = 10,          # Rotation ±10°
        translate   = 0.1,
        scale       = 0.5,
        shear       = 2.0,
        perspective = 0.0005,
        flipud      = 0.0,
        fliplr      = 0.5,
        bgr         = 0.1,
        mixup       = 0.15,
        erasing     = 0.4,

        # Validation
        val     = True,
        plots   = True,
        save    = True,
        verbose = True,
    )

    best_model_path = os.path.join(PROJECT_DIR, RUN_NAME, "weights", "best.pt")
    print(f"\n✓ Training complete! Best model: {best_model_path}")
    print(f"  Copy it to the backend folder and set DETECTOR_MODEL={best_model_path} in .env")
    return results


if __name__ == "__main__":
    train()
