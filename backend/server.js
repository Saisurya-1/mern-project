const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
const destinationRoutes = require('./routes/destinationRoutes');

const app = express();

// ✅ Connect to MongoDB
connectDB();

// ✅ Enable JSON parsing BEFORE routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ CORS setup — allow your frontend
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

// ✅ Routes
app.use('/api/destinations', destinationRoutes);

// ✅ Test route
app.get('/', (req, res) => {
  res.send('Backend is running...');
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
