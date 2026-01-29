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
# Enable CORS for all routes and origins
CORS(app, resources={r"/*": {"origins": "*"}})

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
PROCESSED_FOLDER = os.path.join(BASE_DIR, 'processed')
NGROK_CONFIG_PATH = os.path.join(BASE_DIR, "ngrok_config.json")

VIDEO_NAME = "processed.mp4"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

SUPABASE_URL = "https://qmcztjtbqgzusvupqrcb.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY3p0anRicWd6dXN2dXBxcmNiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2OTM5MywiZXhwIjoyMDg1MjQ1MzkzfQ.rNda4MmizFCkxJD2yGpd_Xg-LQ_haMbQgPwIxSQGs7w"
SUPABASE_BUCKET = "video_violation"
USE_SUPABASE_UPLOAD = False

# Global variable to store progress
processing_status = {
    "progress": 0,
    "current_frame": 0,
    "total_frames": 0,
    "status": "idle"
}

def load_ngrok_url() -> str:
    try:
        with open(NGROK_CONFIG_PATH, "r", encoding="utf-8") as f:
            config = json.load(f)
            return config.get("ngrok_url", "").rstrip("/")
    except:
        return ""

NGROK_URL = load_ngrok_url()

model = YOLO(os.path.join(BASE_DIR, "vehicle_model.pt"))
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

STAY_THRESHOLD = 20
FRAME_SKIP = 5 

@app.route('/progress', methods=['GET'])
def get_progress():
    return jsonify(processing_status)

@app.route('/upload', methods=['POST'])
def upload_video():
    global processing_status
    try:
        video_file = request.files.get("video") or request.files.get("file")
        if not video_file:
            return jsonify({"error": "No video file provided"}), 400

        input_path = os.path.join(UPLOAD_FOLDER, 'input.mp4')
        output_path = os.path.join(PROCESSED_FOLDER, VIDEO_NAME)
        video_file.save(input_path)

        cap = cv2.VideoCapture(input_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        processing_status["total_frames"] = total_frames
        processing_status["status"] = "processing"
        processing_status["progress"] = 0
        processing_status["current_frame"] = 0

        # Try H.264 (avc1) first for browser compatibility
        fourcc = cv2.VideoWriter_fourcc(*'avc1')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        if not out.isOpened():
            print("WARNING: 'avc1' codec failed. Falling back to 'mp4v'.")
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        object_times = {}
        registered_objects = set()
        current_frame = 0
        snapshot_frame = None
        last_detections = [] 

        print(f"Starting processing: {total_frames} frames. Skip rate: {FRAME_SKIP}")

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            current_frame += 1
            processing_status["current_frame"] = current_frame
            processing_status["progress"] = round((current_frame / total_frames) * 100, 2)
            
            current_timestamp = time.time()

            if current_frame % FRAME_SKIP == 0 or current_frame == 1:
                results = model.track(frame, persist=True, verbose=False)
                last_detections = [] 
                
                if results and results[0].boxes.id is not None:
                    ids = results[0].boxes.id.cpu().numpy()
                    boxes = results[0].boxes.xyxy.cpu().numpy()
                    
                    for box, track_id in zip(boxes, ids):
                        x1, y1, x2, y2 = map(int, box)
                        
                        if track_id not in object_times:
                            object_times[track_id] = { "first_seen": current_timestamp, "last_seen": current_timestamp }
                        else:
                            object_times[track_id]["last_seen"] = current_timestamp
                        
                        duration = object_times[track_id]["last_seen"] - object_times[track_id]["first_seen"]
                        
                        is_violation = False
                        if duration >= STAY_THRESHOLD:
                            is_violation = True
                            registered_objects.add(track_id)
                        
                        last_detections.append({
                            "coords": (x1, y1, x2, y2),
                            "id": track_id,
                            "duration": duration,
                            "violation": is_violation
                        })
                    
                    snapshot_frame = frame.copy()

            for det in last_detections:
                x1, y1, x2, y2 = det["coords"]
                color = (0, 0, 255) if det["violation"] else (0, 255, 0)
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                label = f"ID {int(det['id'])} | {det['duration']:.1f}s"
                cv2.putText(frame, label, (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

            out.write(frame)

            if current_frame % 30 == 0:
                print(f"Processed {current_frame}/{total_frames} frames...")

        cap.release()
        out.release()
        
        processing_status["status"] = "completed"
        processing_status["progress"] = 100

        snapshot_url = None
        if snapshot_frame is not None:
            snapshot_path = os.path.join(PROCESSED_FOLDER, "snapshot.jpg")
            cv2.imwrite(snapshot_path, snapshot_frame)
            base = NGROK_URL or "http://localhost:5000"
            snapshot_url = f"{base}/processed_snapshot"

        base = NGROK_URL or "http://localhost:5000"
        video_url = f"{base}/processed_video_file"

        return jsonify({
            "tracked_objects": len(registered_objects),
            "video_url": video_url,
            "snapshot_url": snapshot_url
        })

    except Exception as e:
        processing_status["status"] = "error"
        print("Error:", str(e))
        return jsonify({"error": str(e)}), 500

@app.get("/ngrok-url")
def get_ngrok_url():
    url = load_ngrok_url()
    return jsonify({"ngrok_url": url})

@app.route('/processed_video_file')
def get_processed_video_file():
    output_path = os.path.join(PROCESSED_FOLDER, VIDEO_NAME)
    if not os.path.exists(output_path):
        return jsonify({"error": "No processed video found"}), 404
    
    # -------------------------------------------------------------
    # CRITICAL FIX FOR "net err_blocked_by_orb"
    # -------------------------------------------------------------
    response = send_file(output_path, mimetype="video/mp4")
    
    # Allow any origin (browser/mobile) to access this resource
    response.headers["Access-Control-Allow-Origin"] = "*"
    
    # Tell the browser this is a safe cross-origin resource
    # 'cross-origin' allows it to be served to pages from different origins (like your frontend)
    response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    
    # Disable sniffing to force browser to respect video/mp4 mimetype
    response.headers["X-Content-Type-Options"] = "nosniff"
    
    return response

@app.route('/processed_snapshot')
def get_processed_snapshot():
    snapshot_path = os.path.join(PROCESSED_FOLDER, "snapshot.jpg")
    if not os.path.exists(snapshot_path):
        return jsonify({"error": "No snapshot found"}), 404
    
    response = send_file(snapshot_path, mimetype="image/jpeg")
    
    # Same headers for images to prevent ORB blocking
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    response.headers["X-Content-Type-Options"] = "nosniff"
    
    return response

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)