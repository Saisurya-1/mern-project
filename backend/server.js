const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const destinationRoutes = require('./routes/destinationRoutes');

const app = express();

// Connect MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS
app.use(cors());

// Routes
app.use('/api/destinations', destinationRoutes);

// Home Route
app.get('/', (req, res) => {
  res.send('Backend Running 🚀');
});

// Start Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});