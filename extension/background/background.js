// background.js – Productivity Tracker Extension

let currentTab = null;
let startTime = null;
let isTracking = false;

// Initial setup
chrome.runtime.onInstalled.addListener(() => {
  console.log('Productivity Tracker installed');
  initializeStorage();
});

// Default categories
async function initializeStorage() {
  const defaultCategories = {
    productive: [
      'github.com',
      'stackoverflow.com',
      'docs.google.com',
      'notion.so',
      'trello.com',
      'asana.com',
      'slack.com',
      'zoom.us',
      'figma.com',
      'codepen.io',
      'developer.mozilla.org',
      'w3schools.com'
    ],
    unproductive: [
      'facebook.com',
      'twitter.com',
      'instagram.com',
      'youtube.com',
      'reddit.com',
      'tiktok.com',
      'netflix.com',
      'twitch.tv',
      'pinterest.com',
      'snapchat.com'
    ]
  };
  await chrome.storage.local.set({ categories: defaultCategories });
}

// Event Listeners
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await handleTabChange(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    await handleTabChange(tabId);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await stopTracking(); // browser lost focus
  } else {
    const [activeTab] = await chrome.tabs.query({ active: true, windowId });
    if (activeTab) await handleTabChange(activeTab.id);
  }
});

// Handle tab switch
async function handleTabChange(tabId) {
  try {
    await stopTracking();
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.url && !tab.url.startsWith('chrome://')) {
      await startTracking(tab);
    }
  } catch (err) {
    console.error('Tab change error:', err);
  }
}

// Start tracking
async function startTracking(tab) {
  currentTab = tab;
  startTime = Date.now();
  isTracking = true;
  console.log('🔵 Tracking started:', getDomain(tab.url));
}

// Stop tracking and save time
async function stopTracking() {
  if (!isTracking || !currentTab || !startTime) return;

  const endTime = Date.now();
  const timeSpentMs = endTime - startTime;
  const timeSpent = Math.floor(timeSpentMs / 1000); // convert ms → seconds
  const domain = getDomain(currentTab.url);

  if (timeSpent > 1) {
    await saveTimeEntry(domain, timeSpent, currentTab.url, currentTab.title);
  }

  isTracking = false;
  currentTab = null;
  startTime = null;
}

// Save to local + backend
async function saveTimeEntry(domain, timeSpent, url, title) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `timeData_${today}`;
    const result = await chrome.storage.local.get([storageKey]);
    const timeData = result[storageKey] || {};

    if (!timeData[domain]) {
      timeData[domain] = {
        totalTime: 0,
        visits: 0,
        category: await getWebsiteCategory(domain),
        lastVisit: Date.now(),
        title: title || domain
      };
    }

    timeData[domain].totalTime += timeSpent;
    timeData[domain].visits += 1;
    timeData[domain].lastVisit = Date.now();

    await chrome.storage.local.set({ [storageKey]: timeData });

    // Send to backend
    await sendToBackend({
      hostname: domain,
      duration: timeSpent,
      url,
      title,
      category: await getWebsiteCategory(domain)
    });
  } catch (err) {
    console.error('Save error:', err);
  }
}

// Send to backend API
async function sendToBackend(entry) {
  try {
    const response = await fetch('http://localhost:3000/api/time-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });

    if (!response.ok) {
      console.warn('❗Backend rejected time entry');
    } else {
      console.log('✅ Synced with backend:', entry.hostname, entry.duration);
    }
  } catch (err) {
    console.warn('❌ Could not reach backend:', err.message);
  }
}

// Category checker
async function getWebsiteCategory(domain) {
  try {
    const result = await chrome.storage.local.get(['categories']);
    const categories = result.categories || { productive: [], unproductive: [] };

    if (categories.productive.some(site => domain.includes(site))) return 'productive';
    if (categories.unproductive.some(site => domain.includes(site))) return 'unproductive';
    return 'neutral';
  } catch (err) {
    console.error('Category check failed:', err);
    return 'neutral';
  }
}

// Extract domain from URL
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Listen to messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentStatus') {
    sendResponse({
      isTracking,
      currentSite: currentTab ? getDomain(currentTab.url) : null,
      startTime
    });
  } else if (request.action === 'getTimeData') {
    getTimeDataForDate(request.date).then(sendResponse);
    return true;
  } else if (request.action === 'updateCategories') {
    chrome.storage.local.set({ categories: request.categories });
    sendResponse({ success: true });
  }
});

// Get all time data by date
async function getTimeDataForDate(date) {
  try {
    const result = await chrome.storage.local.get([`timeData_${date}`]);
    return result[`timeData_${date}`] || {};
  } catch (err) {
    console.error('Failed to get date data:', err);
    return {};
  }
}

// Clean up older than 30 days
chrome.alarms.create('cleanup', { periodInMinutes: 1440 }); // Daily
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    cleanupOldData();
  }
});

async function cleanupOldData() {
  try {
    const all = await chrome.storage.local.get(null);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const toRemove = Object.keys(all).filter(key => {
      if (key.startsWith('timeData_')) {
        const date = new Date(key.replace('timeData_', ''));
        return date < cutoff;
      }
      return false;
    });

    if (toRemove.length) {
      await chrome.storage.local.remove(toRemove);
      console.log('🧹 Removed old data:', toRemove.length);
    }
  } catch (err) {
    console.error('Cleanup error:', err);
  }
}
