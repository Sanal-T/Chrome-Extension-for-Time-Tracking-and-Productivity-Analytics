const express = require('express');
const { body, validationResult, query } = require('express-validator');
const TimeEntry = require('../models/timeEntry');
const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// GET /api/time-entries - Retrieve entries with filtering and pagination
router.get('/time-entries', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('hostname').optional().isString(),
  query('category').optional().isIn(['productive', 'unproductive', 'neutral'])
], handleValidationErrors, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      hostname,
      category,
      userId
    } = req.query;

    const filter = {};
    if (userId) filter.userId = userId;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }
    if (hostname) filter.hostname = { $regex: hostname, $options: 'i' };
    if (category) filter.category = category;

    const skip = (page - 1) * limit;
    const [entries, total] = await Promise.all([
      TimeEntry.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      TimeEntry.countDocuments(filter)
    ]);

    res.json({
      entries,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalEntries: total,
        hasNext: skip + entries.length < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching time entries:', error);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
});

// POST /api/time-entries - Create a new entry
router.post('/time-entries', [
  body('hostname').isString().notEmpty().trim(),
  body('duration').isInt({ min: 1 }),
  body('category').isIn(['productive', 'unproductive', 'neutral']),
  body('userId').optional().isString(),
  body('url').optional().isURL(),
  body('title').optional().isString().trim()
], handleValidationErrors, async (req, res) => {
  try {
    const timeEntry = new TimeEntry({
      ...req.body,
      timestamp: new Date()
    });
    await timeEntry.save();
    res.status(201).json({ message: 'Time entry created successfully', entry: timeEntry });
  } catch (error) {
    console.error('Error creating time entry:', error);
    res.status(500).json({ error: 'Failed to create time entry' });
  }
});

// POST /api/time-entries/bulk - Bulk create
router.post('/time-entries/bulk', [
  body('entries').isArray({ min: 1, max: 100 }),
  body('entries.*.hostname').isString().notEmpty().trim(),
  body('entries.*.duration').isInt({ min: 1 }),
  body('entries.*.category').isIn(['productive', 'unproductive', 'neutral']),
  body('entries.*.userId').optional().isString(),
  body('entries.*.timestamp').optional().isISO8601()
], handleValidationErrors, async (req, res) => {
  try {
    const { entries } = req.body;
    const timeEntries = entries.map(entry => ({
      ...entry,
      timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date()
    }));
    const savedEntries = await TimeEntry.insertMany(timeEntries);
    res.status(201).json({
      message: `${savedEntries.length} time entries created successfully`,
      entries: savedEntries
    });
  } catch (error) {
    console.error('Error creating bulk entries:', error);
    res.status(500).json({ error: 'Failed to create entries' });
  }
});

// PUT /api/time-entries/:id - Update entry
router.put('/time-entries/:id', [
  body('hostname').optional().isString().notEmpty().trim(),
  body('duration').optional().isInt({ min: 1 }),
  body('category').optional().isIn(['productive', 'unproductive', 'neutral']),
  body('title').optional().isString().trim()
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const timeEntry = await TimeEntry.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!timeEntry) return res.status(404).json({ error: 'Time entry not found' });
    res.json({ message: 'Updated successfully', entry: timeEntry });
  } catch (error) {
    console.error('Error updating entry:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// DELETE /api/time-entries/:id - Delete entry
router.delete('/time-entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const timeEntry = await TimeEntry.findByIdAndDelete(id);
    if (!timeEntry) return res.status(404).json({ error: 'Time entry not found' });
    res.json({ message: 'Deleted successfully', entry: timeEntry });
  } catch (error) {
    console.error('Error deleting entry:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// GET /api/analytics/summary - Summary stats
router.get('/analytics/summary', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('userId').optional().isString()
], handleValidationErrors, async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const summary = await TimeEntry.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$category',
          totalTime: { $sum: '$duration' },
          entryCount: { $sum: 1 },
          uniqueWebsites: { $addToSet: '$hostname' }
        }
      },
      {
        $project: {
          category: '$_id',
          totalTime: 1,
          entryCount: 1,
          uniqueWebsiteCount: { $size: '$uniqueWebsites' }
        }
      }
    ]);

    let totalTime = 0;
    let productiveTime = 0;
    const categoryBreakdown = {};

    summary.forEach(item => {
      totalTime += item.totalTime;
      if (item.category === 'productive') productiveTime = item.totalTime;
      categoryBreakdown[item.category] = {
        totalTime: item.totalTime,
        entryCount: item.entryCount,
        uniqueWebsiteCount: item.uniqueWebsiteCount
      };
    });

    const productivityScore = totalTime > 0 ? Math.round((productiveTime / totalTime) * 100) : 0;

    const topWebsites = await TimeEntry.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { hostname: '$hostname', category: '$category' },
          totalTime: { $sum: '$duration' },
          entryCount: { $sum: 1 }
        }
      },
      { $sort: { totalTime: -1 } },
      { $limit: 10 },
      {
        $project: {
          hostname: '$_id.hostname',
          category: '$_id.category',
          totalTime: 1,
          entryCount: 1
        }
      }
    ]);

    res.json({
      summary: {
        totalTime,
        productiveTime,
        productivityScore,
        categoryBreakdown,
        topWebsites
      },
      period: {
        startDate: startDate || 'All time',
        endDate: endDate || 'All time'
      }
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// GET /api/analytics/daily - Daily breakdown
router.get('/analytics/daily', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('userId').optional().isString()
], handleValidationErrors, async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const dailyData = await TimeEntry.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
            },
            category: '$category'
          },
          totalTime: { $sum: '$duration' },
          entryCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } },
      {
        $group: {
          _id: '$_id.date',
          categories: {
            $push: {
              category: '$_id.category',
              totalTime: '$totalTime',
              entryCount: '$entryCount'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          categories: 1
        }
      }
    ]);

    res.json({ dailyData });
  } catch (error) {
    console.error('Error generating daily analytics:', error);
    res.status(500).json({ error: 'Failed to generate daily analytics' });
  }
});

module.exports = router;
