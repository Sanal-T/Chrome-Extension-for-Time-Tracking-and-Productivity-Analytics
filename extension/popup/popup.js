// Popup script for managing the extension interface
document.addEventListener('DOMContentLoaded', function() {
    initializePopup();
});

let currentStatus = null;
let sessionTimer = null;

// Initialize popup interface
async function initializePopup() {
    try {
        // Set up tab navigation
        setupTabNavigation();
        
        // Load current status
        await loadCurrentStatus();
        
        // Load today's data
        await loadTodayData();
        
        // Load weekly data
        await loadWeeklyData();
        
        // Load settings
        await loadSettings();
        
        // Set up event listeners
        setupEventListeners();
        
        // Start session timer
        startSessionTimer();
        
    } catch (error) {
        console.error('Error initializing popup:', error);
        showError('Failed to load data');
    }
}

// Setup tab navigation
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            
            // Remove active class from all tabs and panels
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding panel
            button.classList.add('active');
            document.getElementById(targetTab + 'Panel').classList.add('active');
        });
    });
}

// Load current tracking status
async function loadCurrentStatus() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getCurrentStatus' });
        currentStatus = response;
        
        updateStatusDisplay();
    } catch (error) {
        console.error('Error loading current status:', error);
    }
}

// Update status display
function updateStatusDisplay() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const currentSite = document.getElementById('currentSite');
    
    if (currentStatus.isTracking) {
        statusDot.style.background = '#4CAF50';
        statusText.textContent = 'Tracking';
        currentSite.textContent = currentStatus.currentSite || 'Unknown';
    } else {
        statusDot.style.background = '#f44336';
        statusText.textContent = 'Idle';
        currentSite.textContent = '-';
    }
}

// Start session timer
function startSessionTimer() {
    sessionTimer = setInterval(() => {
        if (currentStatus && currentStatus.isTracking && currentStatus.startTime) {
            const elapsed = Date.now() - currentStatus.startTime;
            const sessionTime = document.getElementById('sessionTime');
            sessionTime.textContent = formatTime(elapsed);
        }
    }, 1000);
}

// Load today's data
async function loadTodayData() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const timeData = await chrome.runtime.sendMessage({ 
            action: 'getTimeData', 
            date: today 
        });
        
        displayTodayData(timeData);
    } catch (error) {
        console.error('Error loading today data:', error);
    }
}

// Display today's data
function displayTodayData(timeData) {
    let productiveTime = 0;
    let unproductiveTime = 0;
    let totalTime = 0;
    
    const websites = Object.entries(timeData).map(([domain, data]) => {
        totalTime += data.totalTime;
        
        if (data.category === 'productive') {
            productiveTime += data.totalTime;
        } else if (data.category === 'unproductive') {
            unproductiveTime += data.totalTime;
        }
        
        return {
            domain,
            ...data
        };
    });
    
    // Sort websites by time spent
    websites.sort((a, b) => b.totalTime - a.totalTime);
    
    // Update summary cards
    document.getElementById('productiveTime').textContent = formatTime(productiveTime);
    document.getElementById('unproductiveTime').textContent = formatTime(unproductiveTime);
    
    // Update productivity score
    const productivityScore = totalTime > 0 ? Math.round((productiveTime / totalTime) * 100) : 0;
    document.getElementById('productivityScore').textContent = productivityScore + '%';
    document.getElementById('scoreFill').style.width = productivityScore + '%';
    
    // Display website list
    displayWebsiteList(websites);
}

// Display website list
function displayWebsiteList(websites) {
    const websiteList = document.getElementById('websiteList');
    
    if (websites.length === 0) {
        websiteList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <div class="empty-state-text">No data yet</div>
                <div class="empty-state-subtext">Start browsing to see your productivity stats</div>
            </div>
        `;
        return;
    }
    
    websiteList.innerHTML = websites.slice(0, 5).map(website => `
        <div class="website-item ${website.category}">
            <div class="website-info">
                <div class="website-name">${website.domain}</div>
                <div class="website-category">${website.category}</div>
            </div>
            <div class="website-time">${formatTime(website.totalTime)}</div>
        </div>
    `).join('');
}

// Load weekly data
async function loadWeeklyData() {
    try {
        const weekData = await getWeeklyData();
        displayWeeklyData(weekData);
    } catch (error) {
        console.error('Error loading weekly data:', error);
    }
}

// Get weekly data
async function getWeeklyData() {
    const weekData = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayData = await chrome.runtime.sendMessage({ 
            action: 'getTimeData', 
            date: dateStr 
        });
        
        let productiveTime = 0;
        let unproductiveTime = 0;
        
        Object.values(dayData).forEach(data => {
            if (data.category === 'productive') {
                productiveTime += data.totalTime;
            } else if (data.category === 'unproductive') {
                unproductiveTime += data.totalTime;
            }
        });
        
        weekData.push({
            date: dateStr,
            day: date.toLocaleDateString('en-US', { weekday: 'short' }),
            productiveTime,
            unproductiveTime,
            totalTime: productiveTime + unproductiveTime
        });
    }
    
    return weekData;
}

// Display weekly data
function displayWeeklyData(weekData) {
    const weekStats = document.getElementById('weekStats');
    
    const totalProductiveTime = weekData.reduce((sum, day) => sum + day.productiveTime, 0);
    const totalUnproductiveTime = weekData.reduce((sum, day) => sum + day.unproductiveTime, 0);
    const totalTime = totalProductiveTime + totalUnproductiveTime;
    const avgProductivityScore = totalTime > 0 ? Math.round((totalProductiveTime / totalTime) * 100) : 0;
    
    weekStats.innerHTML = `
        <div class="week-stat">
            <div class="week-stat-value">${formatTime(totalProductiveTime)}</div>
            <div class="week-stat-label">Productive</div>
        </div>
        <div class="week-stat">
            <div class="week-stat-value">${formatTime(totalUnproductiveTime)}</div>
            <div class="week-stat-label">Unproductive</div>
        </div>
        <div class="week-stat">
            <div class="week-stat-value">${avgProductivityScore}%</div>
            <div class="week-stat-label">Avg Score</div>
        </div>
        <div class="week-stat">
            <div class="week-stat-value">${formatTime(totalTime)}</div>
            <div class="week-stat-label">Total Time</div>
        </div>
    `;
    
    // Draw simple chart
    drawWeeklyChart(weekData);
}

// Draw weekly chart
function drawWeeklyChart(weekData) {
    const canvas = document.getElementById('weeklyChart');
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const maxTime = Math.max(...weekData.map(day => day.totalTime));
    if (maxTime === 0) return;
    
    const barWidth = canvas.width / weekData.length;
    const chartHeight = canvas.height - 40;
    
    weekData.forEach((day, index) => {
        const x = index * barWidth;
        const productiveHeight = (day.productiveTime / maxTime) * chartHeight;
        const unproductiveHeight = (day.unproductiveTime / maxTime) * chartHeight;
        
        // Draw unproductive bar (bottom)
        ctx.fillStyle = '#f44336';
        ctx.fillRect(x + 10, canvas.height - 20 - unproductiveHeight, barWidth - 20, unproductiveHeight);
        
        // Draw productive bar (top)
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(x + 10, canvas.height - 20 - unproductiveHeight - productiveHeight, barWidth - 20, productiveHeight);
        
        // Draw day label
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(day.day, x + barWidth / 2, canvas.height - 5);
    });
}

// Load settings
async function loadSettings() {
    try {
        const result = await chrome.storage.local.get(['categories']);
        const categories = result.categories || { productive: [], unproductive: [] };
        
        displayCategories(categories);
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Display categories
function displayCategories(categories) {
    const productiveList = document.getElementById('productiveList');
    const unproductiveList = document.getElementById('unproductiveList');
    
    productiveList.innerHTML = categories.productive.map(site => `
        <div class="category-item">
            <span>${site}</span>
            <button class="remove-btn" data-category="productive" data-site="${site}">Remove</button>
        </div>
    `).join('');
    
    unproductiveList.innerHTML = categories.unproductive.map(site => `
        <div class="category-item">
            <span>${site}</span>
            <button class="remove-btn" data-category="unproductive" data-site="${site}">Remove</button>
        </div>
    `).join('');
    
    // Add event listeners for remove buttons
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            removeWebsiteFromCategory(btn.dataset.category, btn.dataset.site);
        });
    });
}

// Setup event listeners
function setupEventListeners() {
    // Add productive website
    document.getElementById('addProductive').addEventListener('click', () => {
        const input = document.getElementById('productiveInput');
        const website = input.value.trim();
        if (website) {
            addWebsiteToCategory('productive', website);
            input.value = '';
        }
    });
    
    // Add unproductive website
    document.getElementById('addUnproductive').addEventListener('click', () => {
        const input = document.getElementById('unproductiveInput');
        const website = input.value.trim();
        if (website) {
            addWebsiteToCategory('unproductive', website);
            input.value = '';
        }
    });
    
    // Export data
    document.getElementById('exportData').addEventListener('click', exportData);
    
    // Clear data
    document.getElementById('clearData').addEventListener('click', clearAllData);
    
    // Open dashboard
    document.getElementById('openDashboard').addEventListener('click', openDashboard);
    
    // Handle Enter key in inputs
    document.getElementById('productiveInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('addProductive').click();
        }
    });
    
    document.getElementById('unproductiveInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('addUnproductive').click();
        }
    });
}

// Add website to category
async function addWebsiteToCategory(category, website) {
    try {
        const result = await chrome.storage.local.get(['categories']);
        const categories = result.categories || { productive: [], unproductive: [] };
        
        // Remove from other category if exists
        const otherCategory = category === 'productive' ? 'unproductive' : 'productive';
        categories[otherCategory] = categories[otherCategory].filter(site => site !== website);
        
        // Add to specified category if not already present
        if (!categories[category].includes(website)) {
            categories[category].push(website);
        }
        
        await chrome.runtime.sendMessage({ action: 'updateCategories', categories });
        displayCategories(categories);
    } catch (error) {
        console.error('Error adding website to category:', error);
    }
}

// Remove website from category
async function removeWebsiteFromCategory(category, website) {
    try {
        const result = await chrome.storage.local.get(['categories']);
        const categories = result.categories || { productive: [], unproductive: [] };
        
        categories[category] = categories[category].filter(site => site !== website);
        
        await chrome.runtime.sendMessage({ action: 'updateCategories', categories });
        displayCategories(categories);
    } catch (error) {
        console.error('Error removing website from category:', error);
    }
}

// Export data
async function exportData() {
    try {
        const allData = await chrome.storage.local.get(null);
        const exportData = {
            exportDate: new Date().toISOString(),
            data: allData
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `productivity-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting data:', error);
        showError('Failed to export data');
    }
}

// Clear all data
async function clearAllData() {
    if (confirm('Are you sure you want to clear all tracking data? This cannot be undone.')) {
        try {
            await chrome.storage.local.clear();
            await initializePopup();
            showSuccess('All data cleared successfully');
        } catch (error) {
            console.error('Error clearing data:', error);
            showError('Failed to clear data');
        }
    }
}

// Open dashboard
function openDashboard() {
    chrome.tabs.create({
        url: chrome.runtime.getURL('dashboard/dashboard.html')
    });
}

// Utility functions
function formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

function showError(message) {
    // Simple error display - you could enhance this with a proper notification system
    console.error(message);
    alert('Error: ' + message);
}

function showSuccess(message) {
    // Simple success display - you could enhance this with a proper notification system
    console.log(message);
    alert('Success: ' + message);
}

// Cleanup on popup close
window.addEventListener('beforeunload', () => {
    if (sessionTimer) {
        clearInterval(sessionTimer);
    }
});