from flask import Flask, request, send_file, jsonify, url_for
from flask_cors import CORS
import os
import cv2
import time
import json
import numpy as np
from ultralytics import YOLO
from supabase import create_client, Client

app = Flask(__name__)
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "OPTIONS"],
)
UPLOAD_FOLDER = 'uploads'
PROCESSED_FOLDER = 'processed'
VIDEO_NAME = "processed.mp4"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

SUPABASE_URL = "https://tyiiawylacwgxproemzc.supabase.co"
SUPABASE_KEY = "sb_secret_FojsYWzigjRrieh0k6VAEw_LgjFTw-6"
SUPABASE_BUCKET = "video_violation"
USE_SUPABASE_UPLOAD = False  # Set to True if you want to keep uploading to Supabase

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
NGROK_CONFIG_PATH = os.path.join(BASE_DIR, "ngrok_config.json")


def load_ngrok_url() -> str:
    """Load ngrok url from config file to keep mobile + backend in sync."""
    try:
        with open(NGROK_CONFIG_PATH, "r", encoding="utf-8") as f:
            config = json.load(f)
            return config.get("ngrok_url", "").rstrip("/")
    except FileNotFoundError:
        print("ngrok_config.json not found. Update backend/ngrok_config.json with your tunnel url.")
        return ""
    except json.JSONDecodeError:
        print("Unable to parse ngrok_config.json, falling back to empty url.")
        return ""


NGROK_URL = load_ngrok_url()

# Load YOLOv8 model
model = YOLO(os.path.join(BASE_DIR, "vehicle_model.pt"))

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---- Time threshold in seconds ----
STAY_THRESHOLD = 20


@app.route('/upload', methods=['POST'])
def upload_video():
    try:
        # Accept both "video" (expected) and fallback "file" key for flexibility.
        video_file = request.files.get("video") or request.files.get("file")
        if not video_file:
            print("[upload] No file found. content_type=", request.content_type)
            print("[upload] request.files keys:", list(request.files.keys()))
            print("[upload] request.form keys:", list(request.form.keys()))
            return jsonify({
                "error": "No video file provided",
                "received_keys": list(request.files.keys()),
                "content_type": request.content_type,
            }), 400

        input_path = os.path.join(UPLOAD_FOLDER, 'input.mp4')
        output_path = os.path.join(PROCESSED_FOLDER, VIDEO_NAME)

        video_file.save(input_path)

        # ---- Initialize Video I/O ----
        cap = cv2.VideoCapture(input_path)
        current_frame = 0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        object_times = {}
        registered_objects = set()

        snapshot_frame = None

        while True:
            ret, frame = cap.read()
            current_frame += 1
            progress = (current_frame / total_frames) * 100.0
            print(f"Processing progress: {progress:.2f}%")
            if not ret:
                break

            results = model.track(frame, persist=True, verbose=False)

            if results and results[0].boxes.id is not None:
                ids = results[0].boxes.id.cpu().numpy()
                boxes = results[0].boxes.xyxy.cpu().numpy()
                current_timestamp = time.time()

                for box, track_id in zip(boxes, ids):
                    x1, y1, x2, y2 = map(int, box)

                    if track_id not in object_times:
                        object_times[track_id] = {
                            "first_seen": current_timestamp,
                            "last_seen": current_timestamp
                        }
                    else:
                        object_times[track_id]["last_seen"] = current_timestamp

                    duration = object_times[track_id]["last_seen"] - object_times[track_id]["first_seen"]

                    if duration >= STAY_THRESHOLD:
                        color = (0, 0, 255)
                        registered_objects.add(track_id)
                    else:
                        color = (0, 255, 0)

                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                    cv2.putText(frame, f"ID {track_id} | {duration:.1f}s", (x1, y1 - 8),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

                    # Keep a snapshot frame with boxes (last one seen)
                    snapshot_frame = frame.copy()

            out.write(frame)

        cap.release()
        out.release()

        # Save a single annotated snapshot image if we have one
        snapshot_url = None
        if snapshot_frame is not None:
            snapshot_name = "snapshot.jpg"
            snapshot_path = os.path.join(PROCESSED_FOLDER, snapshot_name)
            cv2.imwrite(snapshot_path, snapshot_frame)
            base = NGROK_URL or "http://localhost:5000"
            snapshot_url = f"{base}/processed_snapshot"

        # --- Where the processed video lives ---
        if USE_SUPABASE_UPLOAD:
            # Upload to Supabase (original behaviour)
            print("Uploading processed video to Supabase...")
            existing_files = supabase.storage.from_(SUPABASE_BUCKET).list()
            for file in existing_files:
                if file['name'] == VIDEO_NAME:
                    supabase.storage.from_(SUPABASE_BUCKET).remove([VIDEO_NAME])
                    print("Deleted previous video from Supabase.")
                    break

            with open(output_path, "rb") as f:
                supabase.storage.from_(SUPABASE_BUCKET).upload(VIDEO_NAME, f.read())
            print("Upload complete!")

            video_url = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(VIDEO_NAME)
        else:
            # Serve directly from this backend (faster, fully local)
            base = NGROK_URL or "http://localhost:5000"
            video_url = f"{base}/processed_video_file"

        return jsonify({
            "tracked_objects": len(registered_objects),
            "video_url": video_url,
            "snapshot_url": snapshot_url
        })

    except Exception as e:
        print("Error:", str(e))
        return jsonify({"error": str(e)}), 500


@app.get("/ngrok-url")
def get_ngrok_url():
    """Expose current ngrok url so the client can fetch it."""
    url = load_ngrok_url()
    if not url:
        return jsonify({"error": "ngrok url not configured"}), 500
    return jsonify({"ngrok_url": url})


@app.route('/processed_video_file')
def get_processed_video_file():
    """Serve the latest processed video file directly from disk."""
    output_path = os.path.join(PROCESSED_FOLDER, VIDEO_NAME)
    if not os.path.exists(output_path):
        return jsonify({"error": "No processed video found"}), 404
    return send_file(output_path, mimetype="video/mp4")


@app.route('/processed_snapshot')
def get_processed_snapshot():
    """Serve the last annotated snapshot image with bounding boxes."""
    snapshot_path = os.path.join(PROCESSED_FOLDER, "snapshot.jpg")
    if not os.path.exists(snapshot_path):
        return jsonify({"error": "No snapshot found"}), 404
    return send_file(snapshot_path, mimetype="image/jpeg")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
