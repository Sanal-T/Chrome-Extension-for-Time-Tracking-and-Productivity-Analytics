// Background script for tracking time and managing data
let currentTab = null;
let startTime = null;
let isTracking = false;

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Productivity Tracker installed');
  initializeStorage();
});

// Initialize storage with default website categories
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

  chrome.storage.local.set({ categories: defaultCategories });
}

// Track active tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await handleTabChange(activeInfo.tabId);
});

// Track URL changes within the same tab
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    await handleTabChange(tabId);
  }
});

// Handle window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus
    await stopTracking();
  } else {
    // Browser gained focus
    const [activeTab] = await chrome.tabs.query({ active: true, windowId: windowId });
    if (activeTab) {
      await handleTabChange(activeTab.id);
    }
  }
});

// Handle tab changes
async function handleTabChange(tabId) {
  try {
    await stopTracking();
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.url && !tab.url.startsWith('chrome://')) {
      await startTracking(tab);
    }
  } catch (error) {
    console.error('Error handling tab change:', error);
  }
}

// Start tracking time for a website
async function startTracking(tab) {
  currentTab = tab;
  startTime = Date.now();
  isTracking = true;
  
  console.log('Started tracking:', getDomain(tab.url));
}

// Stop tracking and save data
async function stopTracking() {
  if (!isTracking || !currentTab || !startTime) {
    return;
  }

  const endTime = Date.now();
  const timeSpent = endTime - startTime;
  const domain = getDomain(currentTab.url);

  // Only save if time spent is more than 1 second
  if (timeSpent > 1000) {
    await saveTimeEntry(domain, timeSpent, currentTab.url, currentTab.title);
  }

  isTracking = false;
  currentTab = null;
  startTime = null;
}

// Save time entry to storage
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
    
    // Also send to backend if available
    await sendToBackend(domain, timeSpent, url, title);
    
  } catch (error) {
    console.error('Error saving time entry:', error);
  }
}

// Send data to backend
async function sendToBackend(domain, timeSpent, url, title) {
  try {
    const response = await fetch('http://localhost:3000/api/time-entry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain,
        timeSpent,
        url,
        title,
        timestamp: Date.now(),
        category: await getWebsiteCategory(domain)
      })
    });
    
    if (!response.ok) {
      console.warn('Failed to send data to backend');
    }
  } catch (error) {
    console.warn('Backend not available:', error.message);
  }
}

// Get website category (productive/unproductive)
async function getWebsiteCategory(domain) {
  try {
    const result = await chrome.storage.local.get(['categories']);
    const categories = result.categories || { productive: [], unproductive: [] };
    
    if (categories.productive.some(site => domain.includes(site))) {
      return 'productive';
    } else if (categories.unproductive.some(site => domain.includes(site))) {
      return 'unproductive';
    }
    
    return 'neutral';
  } catch (error) {
    console.error('Error getting category:', error);
    return 'neutral';
  }
}

// Extract domain from URL
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch (error) {
    return url;
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentStatus') {
    sendResponse({
      isTracking: isTracking,
      currentSite: currentTab ? getDomain(currentTab.url) : null,
      startTime: startTime
    });
  } else if (request.action === 'getTimeData') {
    getTimeDataForDate(request.date).then(sendResponse);
    return true;
  } else if (request.action === 'updateCategories') {
    chrome.storage.local.set({ categories: request.categories });
    sendResponse({ success: true });
  }
});

// Get time data for specific date
async function getTimeDataForDate(date) {
  try {
    const storageKey = `timeData_${date}`;
    const result = await chrome.storage.local.get([storageKey]);
    return result[storageKey] || {};
  } catch (error) {
    console.error('Error getting time data:', error);
    return {};
  }
}

// Set up periodic cleanup of old data (keep last 30 days)
chrome.alarms.create('cleanup', { periodInMinutes: 60 * 24 }); // Daily cleanup

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    cleanupOldData();
  }
});

async function cleanupOldData() {
  try {
    const allKeys = await chrome.storage.local.get(null);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const keysToRemove = Object.keys(allKeys).filter(key => {
      if (key.startsWith('timeData_')) {
        const dateStr = key.replace('timeData_', '');
        const date = new Date(dateStr);
        return date < thirtyDaysAgo;
      }
      return false;
    });
    
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      console.log('Cleaned up', keysToRemove.length, 'old data entries');
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}