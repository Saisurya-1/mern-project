const express = require('express');
const router = express.Router();
const Destination = require('../models/Destination');

// ✅ GET all destinations
router.get('/', async (req, res) => {
  try {
    const destinations = await Destination.find();
    res.json(destinations);
  } catch (error) {
    console.error('❌ Error fetching destinations:', error);
    res.status(500).json({ message: 'Failed to fetch destinations' });
  }
});

// ✅ POST a new destination
router.post('/', async (req, res) => {
  console.log('📥 Incoming POST data:', req.body);

  const { name, location, description } = req.body;

  if (!name || !location || !description) {
    console.warn('⚠️ Missing required fields:', req.body);
    return res.status(400).json({
      message: 'All fields (name, location, description) are required',
    });
  }

  try {
    const newDestination = new Destination({ name, location, description });
    const saved = await newDestination.save();

    console.log('✅ Saved to MongoDB:', saved);
    res.status(201).json(saved);
  } catch (error) {
    console.error('❌ MongoDB Save Error:', error);
    res.status(500).json({ message: 'Server error while saving destination', error: error.message });
  }
});

// ✅ DELETE a destination by ID
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Destination.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Destination not found' });
    }
    console.log('🗑️ Deleted destination:', req.params.id);
    res.json({ message: 'Destination deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting destination:', error);
    res.status(500).json({ message: 'Failed to delete destination' });
  }
});

module.exports = router;
