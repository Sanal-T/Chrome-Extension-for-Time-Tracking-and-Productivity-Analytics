// Content script for detecting user activity
let lastActivity = Date.now();
let isUserActive = true;
let activityCheckInterval;

// Track user activity
function trackActivity() {
  lastActivity = Date.now();
  if (!isUserActive) {
    isUserActive = true;
    notifyBackgroundOfActivity(true);
  }
}

// Set up activity listeners
document.addEventListener('mousemove', trackActivity, { passive: true });
document.addEventListener('keydown', trackActivity, { passive: true });
document.addEventListener('scroll', trackActivity, { passive: true });
document.addEventListener('click', trackActivity, { passive: true });
document.addEventListener('touchstart', trackActivity, { passive: true });

// Check for inactivity every 30 seconds
activityCheckInterval = setInterval(() => {
  const timeSinceLastActivity = Date.now() - lastActivity;
  const inactiveThreshold = 30000; // 30 seconds
  
  if (timeSinceLastActivity > inactiveThreshold && isUserActive) {
    isUserActive = false;
    notifyBackgroundOfActivity(false);
  }
}, 30000);

// Notify background script of activity changes
function notifyBackgroundOfActivity(active) {
  chrome.runtime.sendMessage({
    action: 'userActivity',
    active: active,
    timestamp: Date.now()
  }).catch(() => {
    // Handle case where background script is not available
    console.log('Could not communicate with background script');
  });
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    isUserActive = false;
    notifyBackgroundOfActivity(false);
  } else {
    isUserActive = true;
    lastActivity = Date.now();
    notifyBackgroundOfActivity(true);
  }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (activityCheckInterval) {
    clearInterval(activityCheckInterval);
  }
});

// Detect single page application navigation
let currentUrl = window.location.href;

const observer = new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    chrome.runtime.sendMessage({
      action: 'urlChanged',
      url: currentUrl,
      timestamp: Date.now()
    }).catch(() => {
      console.log('Could not communicate with background script');
    });
  }
});

observer.observe(document, { 
  subtree: true, 
  childList: true 
});

// Send initial page load notification
chrome.runtime.sendMessage({
  action: 'pageLoaded',
  url: window.location.href,
  title: document.title,
  timestamp: Date.now()
}).catch(() => {
  console.log('Could not communicate with background script');
});