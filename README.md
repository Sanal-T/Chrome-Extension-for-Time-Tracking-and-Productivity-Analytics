# ⏱ Productivity Tracker - Chrome Extension with Backend

This project is a full-stack Chrome extension that tracks how much time you spend on various websites and visualizes your productivity with real-time charts. It uses a background script to log your active tab activity and a backend to store and analyze the data.

---

## 🚀 Features

- ⏳ **Automatic tab time tracking**
- 📊 **Interactive dashboard** with pie & line charts
- 🔄 **Classifies websites** as productive/unproductive/neutral
- ☁️ **Syncs with MongoDB** via Express backend
- 🧠 **Weekly productivity summaries**
- 📁 **Stores data locally and remotely**
- 🧼 **Auto-cleans data older than 30 days**

---

## 🏗 Project Structure

productivity-tracker/
├── backend/ # Express + MongoDB API
│ ├── server.js
│ ├── .env
│ ├── models/
│ │ └── timeEntry.js
│ ├── routes/
│ │ └── api.js
├── extension/ # Chrome Extension Frontend
│ ├── manifest.json
│ ├── background/
│ │ └── background.js
│ ├── popup/
│ │ ├── popup.html
│ │ ├── popup.js
│ │ └── popup.css
│ ├── dashboard/
│ │ ├── dashboard.html
│ │ ├── dashboard.js
│ │ └── dashboard.css
│ └── icons/
│ ├── icon16.png
│ ├── icon48.png
│ └── icon128.png

---

## ⚙️ Setup Instructions

### 📦 1. Backend (Express + MongoDB)

1. Navigate to `backend/`:
   ```bash
   cd backend

PORT=3000
MONGODB_URI=mongodb://localhost:27017/productivity-tracker
NODE_ENV=development

npm install

mongod    # in a separate terminal
node server.js

2. Chrome Extension
Go to chrome://extensions in your browser

Enable Developer Mode

Click "Load Unpacked"

Select the extension/ folder