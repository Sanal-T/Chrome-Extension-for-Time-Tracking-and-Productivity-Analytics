const mongoose = require('mongoose');

const timeEntrySchema = new mongoose.Schema({
  hostname: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    trim: true
  },
  title: {
    type: String,
    trim: true
  },
  duration: {
    type: Number, // in seconds
    required: true,
    min: 1
  },
  category: {
    type: String,
    enum: ['productive', 'unproductive', 'neutral'],
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  userId: {
    type: String, // You can change this to ObjectId and link to a User model later
    default: null
  },
  updatedAt: {
    type: Date
  }
}, {
  collection: 'time_entries',
  timestamps: true
});

module.exports = mongoose.model('TimeEntry', timeEntrySchema);
