# Project Setup Guide

This repository contains a frontend (Expo / Node.js) and a backend (Python) that communicate via **ngrok** for local development.

Follow the steps below carefully to get everything running.

---

## Prerequisites

Make sure the following are installed **before** proceeding:

- **Python 3.11 or higher**
- **Node.js** (LTS recommended)
- **Ngrok** (app + account)

---

## 1. NGROK Setup (Required)

### 1.1 Create an ngrok Account
1. Go to the ngrok website
2. Sign up or log in
3. Navigate to your dashboard
4. Copy your **Auth Token**

---

### 1.2 Install ngrok
Download and install ngrok for your operating system.

Verify installation:

```bash
ngrok version
```

---

### 1.3 Configure ngrok (Sign In via Terminal)

Run the following command and replace `YOUR_AUTH_TOKEN` with the token from your dashboard:

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

If successful, ngrok is now linked to your account.

---

## 2. Frontend Setup

Install frontend dependencies:

```bash
npm install
```

Start the Expo development server:

```bash
npx expo start
```

Keep this terminal **running**.

---

## 3. Start ngrok Tunnel

Open **a new terminal window**.

Run ngrok on port **5000**:

```bash
ngrok http 5000
```

You will see output similar to:

```bash
Forwarding https://82153db9cb99.ngrok-free.app -> http://localhost:5000
```

---

## 4. Update ngrok Configuration

1. Copy the **https forwarding URL**  
   Example:
   https://82153db9cb99.ngrok-free.app

2. Navigate to:
   
```bash
   ./backend/ngrok_config.json
```

3. Replace the existing URL value with your copied ngrok URL.

⚠️ This step must be repeated every time ngrok generates a new URL.

---

## 5. Run the Backend Server

Navigate to the backend folder:

```bash
cd backend
```

Run the server using:

```bash
run_server.bat
```

This will start the Python backend on port **5000**, exposed via ngrok.

---

## Done 🎉

- Frontend running via Expo
- Backend running via Python
- ngrok exposing the backend publicly

Make sure all required terminals remain open.
