class ProductivityDashboard {
    constructor() {
        this.charts = {};
        this.currentTimeRange = 'today';
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderCharts();
        this.updateStats();
        this.populateActivityTable();
    }

    setupEventListeners() {
        document.getElementById('timeRangeSelector').addEventListener('change', (e) => {
            this.currentTimeRange = e.target.value;
            this.loadData();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('generateReportBtn').addEventListener('click', () => {
            this.generateWeeklyReport();
        });

        document.getElementById('clearDataBtn').addEventListener('click', () => {
            this.clearAllData();
        });

        document.getElementById('dateFilter').addEventListener('change', () => {
            this.filterTable();
        });

        document.getElementById('typeFilter').addEventListener('change', () => {
            this.filterTable();
        });
    }

    async loadData() {
        try {
            const result = await chrome.storage.local.get(['timeEntries', 'websiteCategories']);
            this.timeEntries = result.timeEntries || [];
            this.websiteCategories = result.websiteCategories || this.getDefaultCategories();

            this.filteredEntries = this.filterEntriesByTimeRange(this.timeEntries);

            this.updateStats();
            this.renderCharts();
            this.populateActivityTable();
            this.updateWebsiteLists();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    getDefaultCategories() {
        return {
            'github.com': 'productive',
            'stackoverflow.com': 'productive',
            'developer.mozilla.org': 'productive',
            'docs.google.com': 'productive',
            'codepen.io': 'productive',
            'medium.com': 'productive',
            'linkedin.com': 'productive',
            'coursera.org': 'productive',
            'udemy.com': 'productive',
            'khan-academy.org': 'productive',
            'w3schools.com': 'productive',
            'freecodecamp.org': 'productive',
            'facebook.com': 'unproductive',
            'instagram.com': 'unproductive',
            'twitter.com': 'unproductive',
            'youtube.com': 'unproductive',
            'netflix.com': 'unproductive',
            'tiktok.com': 'unproductive',
            'reddit.com': 'unproductive',
            'twitch.tv': 'unproductive',
            'pinterest.com': 'unproductive',
            'snapchat.com': 'unproductive'
        };
    }

    filterEntriesByTimeRange(entries) {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfDay);
        startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        return entries.filter(entry => {
            const entryDate = new Date(entry.date);
            switch (this.currentTimeRange) {
                case 'today':
                    return entryDate >= startOfDay;
                case 'week':
                    return entryDate >= startOfWeek;
                case 'month':
                    return entryDate >= startOfMonth;
                default:
                    return true;
            }
        });
    }

    categorizeWebsite(hostname) {
        if (this.websiteCategories[hostname]) {
            return this.websiteCategories[hostname];
        }

        const productiveKeywords = ['docs', 'learn', 'education', 'tutorial', 'course', 'study', 'work'];
        const unproductiveKeywords = ['social', 'entertainment', 'game', 'video', 'stream'];

        const lowerHostname = hostname.toLowerCase();

        if (productiveKeywords.some(keyword => lowerHostname.includes(keyword))) {
            return 'productive';
        }

        if (unproductiveKeywords.some(keyword => lowerHostname.includes(keyword))) {
            return 'unproductive';
        }

        return 'neutral';
    }

    updateStats() {
        let totalProductiveTime = 0;
        let totalUnproductiveTime = 0;
        const uniqueWebsites = new Set();

        this.filteredEntries.forEach(entry => {
            const category = this.categorizeWebsite(entry.hostname);
            if (category === 'productive') {
                totalProductiveTime += entry.duration;
            } else if (category === 'unproductive') {
                totalUnproductiveTime += entry.duration;
            }
            uniqueWebsites.add(entry.hostname);
        });

        const totalTime = totalProductiveTime + totalUnproductiveTime;
        const productivityScore = totalTime > 0 ? Math.round((totalProductiveTime / totalTime) * 100) : 0;

        document.getElementById('totalProductiveTime').textContent = this.formatTime(totalProductiveTime);
        document.getElementById('totalUnproductiveTime').textContent = this.formatTime(totalUnproductiveTime);
        document.getElementById('productivityScore').textContent = `${productivityScore}%`;
        document.getElementById('uniqueWebsites').textContent = uniqueWebsites.size;
    }

    renderCharts() {
        this.renderPieChart();
        this.renderLineChart();
    }

    renderPieChart() {
        const ctx = document.getElementById('pieChart').getContext('2d');
        if (this.charts.pie) this.charts.pie.destroy();

        let productiveTime = 0, unproductiveTime = 0, neutralTime = 0;

        this.filteredEntries.forEach(entry => {
            const category = this.categorizeWebsite(entry.hostname);
            if (category === 'productive') productiveTime += entry.duration;
            else if (category === 'unproductive') unproductiveTime += entry.duration;
            else neutralTime += entry.duration;
        });

        this.charts.pie = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Productive', 'Unproductive', 'Neutral'],
                datasets: [{
                    data: [productiveTime, unproductiveTime, neutralTime],
                    backgroundColor: ['#4CAF50', '#ff6b6b', '#ffa726']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    renderLineChart() {
        const ctx = document.getElementById('lineChart').getContext('2d');
        if (this.charts.line) this.charts.line.destroy();

        const dailyData = {};
        this.filteredEntries.forEach(entry => {
            const date = new Date(entry.date).toDateString();
            if (!dailyData[date]) dailyData[date] = { productive: 0, unproductive: 0 };
            const category = this.categorizeWebsite(entry.hostname);
            if (category === 'productive') dailyData[date].productive += entry.duration;
            else if (category === 'unproductive') dailyData[date].unproductive += entry.duration;
        });

        const dates = Object.keys(dailyData).sort();
        const productiveData = dates.map(date => dailyData[date].productive / 3600);
        const unproductiveData = dates.map(date => dailyData[date].unproductive / 3600);

        this.charts.line = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates.map(date => new Date(date).toLocaleDateString()),
                datasets: [
                    {
                        label: 'Productive Hours',
                        data: productiveData,
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Unproductive Hours',
                        data: unproductiveData,
                        borderColor: '#ff6b6b',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Hours'
                        }
                    }
                }
            }
        });
    }

    updateWebsiteLists() {
        const websiteStats = {};
        this.filteredEntries.forEach(entry => {
            if (!websiteStats[entry.hostname]) {
                websiteStats[entry.hostname] = {
                    duration: 0,
                    category: this.categorizeWebsite(entry.hostname)
                };
            }
            websiteStats[entry.hostname].duration += entry.duration;
        });

        const productiveWebsites = Object.entries(websiteStats)
            .filter(([, stats]) => stats.category === 'productive')
            .sort(([, a], [, b]) => b.duration - a.duration)
            .slice(0, 5);

        const unproductiveWebsites = Object.entries(websiteStats)
            .filter(([, stats]) => stats.category === 'unproductive')
            .sort(([, a], [, b]) => b.duration - a.duration)
            .slice(0, 5);

        this.renderWebsiteList('productiveWebsites', productiveWebsites, 'productive');
        this.renderWebsiteList('unproductiveWebsites', unproductiveWebsites, 'unproductive');
    }

    renderWebsiteList(containerId, websites, type) {
        const container = document.getElementById(containerId);
        container.innerHTML = websites.length === 0
            ? '<div class="no-data">No data available</div>'
            : websites.map(([hostname, stats]) => `
                <div class="website-item ${type}">
                    <span class="website-name">${hostname}</span>
                    <span class="website-time">${this.formatTime(stats.duration)}</span>
                </div>
              `).join('');
    }

    populateActivityTable() {
        const tbody = document.getElementById('activityTableBody');
        tbody.innerHTML = '';

        if (this.filteredEntries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-data">No activity data available</td></tr>';
            return;
        }

        this.filteredEntries.forEach((entry, index) => {
            const category = this.categorizeWebsite(entry.hostname);
            const formattedTime = this.formatTime(entry.duration);
            const entryDate = new Date(entry.date).toLocaleDateString();

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${entry.hostname}</td>
                <td><span class="type-badge ${category}">${category}</span></td>
                <td>${formattedTime}</td>
                <td>${entryDate}</td>
                <td><button class="btn btn-danger" onclick="dashboard.deleteEntry(${index})">Delete</button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    filterTable() {
        const dateValue = document.getElementById('dateFilter').value;
        const typeValue = document.getElementById('typeFilter').value;

        this.filteredEntries = this.filterEntriesByTimeRange(this.timeEntries).filter(entry => {
            const matchesDate = !dateValue || new Date(entry.date).toDateString() === new Date(dateValue).toDateString();
            const matchesType = typeValue === 'all' || this.categorizeWebsite(entry.hostname) === typeValue;
            return matchesDate && matchesType;
        });

        this.updateStats();
        this.renderCharts();
        this.updateWebsiteLists();
        this.populateActivityTable();
    }

    exportData() {
        const blob = new Blob([JSON.stringify(this.filteredEntries, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'productivity_data.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    generateWeeklyReport() {
        const total = this.filteredEntries.reduce((acc, entry) => {
            const type = this.categorizeWebsite(entry.hostname);
            acc[type] = (acc[type] || 0) + entry.duration;
            return acc;
        }, {});

        const totalTime = (total.productive || 0) + (total.unproductive || 0);
        const score = totalTime > 0 ? Math.round((total.productive || 0) / totalTime * 100) : 0;

        document.getElementById('reportSummary').innerHTML = `
            <p>You spent <strong>${this.formatTime(total.productive || 0)}</strong> on productive sites and 
            <strong>${this.formatTime(total.unproductive || 0)}</strong> on unproductive sites this week.</p>
            <p>Your productivity score: <strong>${score}%</strong></p>
        `;
    }

    clearAllData() {
        if (confirm('Are you sure you want to clear all activity data?')) {
            chrome.storage.local.set({ timeEntries: [] }, () => {
                this.loadData();
            });
        }
    }

    deleteEntry(index) {
        this.timeEntries.splice(index, 1);
        chrome.storage.local.set({ timeEntries: this.timeEntries }, () => {
            this.loadData();
        });
    }

    formatTime(seconds) {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hrs}h ${mins}m`;
    }
}

// Global instance
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new ProductivityDashboard();
});
