// Project: Food Price Aggregator
// Purpose: Full-stack example (React frontend + Node/Express backend + MongoDB) that ingests price data from multiple delivery apps
// Files included (paste into folders as shown):

--- backend/package.json ---
{
  "name": "fpa-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "seed": "node seed.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "express": "^4.18.2",
    "mongoose": "^7.0.0",
    "morgan": "^1.10.0",
    "body-parser": "^1.20.2"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}

--- backend/.env.example ---
MONGO_URI=mongodb://localhost:27017/fpa_db
PORT=5000

--- backend/server.js ---
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json({ limit: '1mb' }));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fpa_db';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error', err));

// Mongoose models
const { Schema } = mongoose;

const PriceSchema = new Schema({
  itemId: String,           // canonical id for the food item
  name: String,             // display name
  app: String,              // 'zomato' | 'swiggy' | 'uber-eats' | etc
  basePrice: Number,        // price before fees/discounts
  deliveryFee: { type: Number, default: 0 },
  coupon: {
    type: { type: String, enum: ['fixed','percent','none'], default: 'none' },
    value: { type: Number, default: 0 }
  },
  lastUpdated: { type: Date, default: Date.now }
});

PriceSchema.methods.effectivePrice = function() {
  let price = this.basePrice + (this.deliveryFee || 0);
  if (this.coupon && this.coupon.type !== 'none') {
    if (this.coupon.type === 'fixed') price -= this.coupon.value;
    else if (this.coupon.type === 'percent') price *= (1 - this.coupon.value / 100);
  }
  return Math.max(0, Math.round(price * 100) / 100); // round to 2 decimals
};

const Price = mongoose.model('Price', PriceSchema);

// Routes
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Ingest price data (POST an array of price objects) -- secure this in production!
app.post('/api/ingest', async (req, res) => {
  try {
    const list = req.body; // expect array
    if (!Array.isArray(list)) return res.status(400).json({ error: 'expecting array' });

    const docs = list.map(p => ({
      itemId: p.itemId || p.name.toLowerCase().replace(/\s+/g,'-'),
      name: p.name,
      app: p.app,
      basePrice: p.basePrice,
      deliveryFee: p.deliveryFee || 0,
      coupon: p.coupon || { type: 'none', value: 0 },
      lastUpdated: p.lastUpdated ? new Date(p.lastUpdated) : new Date()
    }));

    await Price.insertMany(docs);
    res.json({ inserted: docs.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ingest failed' });
  }
});

// Get comparisons for a single item (by itemId or name)
app.get('/api/compare', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: 'query param q required (itemId or name)' });

    // search by itemId or case-insensitive name
    const docs = await Price.find({ $or: [{ itemId: q }, { name: new RegExp(q, 'i') }] });
    if (!docs.length) return res.json({ item: q, results: [] });

    const results = docs.map(d => ({
      id: d._id,
      app: d.app,
      name: d.name,
      basePrice: d.basePrice,
      deliveryFee: d.deliveryFee,
      coupon: d.coupon,
      effectivePrice: d.effectivePrice(),
      lastUpdated: d.lastUpdated
    }))
    .sort((a,b) => a.effectivePrice - b.effectivePrice);

    res.json({ item: q, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'compare failed' });
  }
});

// Compare all items (group by itemId, get lowest app per item)
app.get('/api/compareAll', async (req, res) => {
  try {
    const docs = await Price.find();
    // group by itemId
    const map = new Map();
    docs.forEach(d => {
      const e = d.effectivePrice ? d.effectivePrice() : (d.basePrice + (d.deliveryFee||0));
      const prev = map.get(d.itemId);
      const payload = { app: d.app, name: d.name, effectivePrice: d.effectivePrice(), basePrice: d.basePrice, deliveryFee: d.deliveryFee, coupon: d.coupon };
      if (!prev || payload.effectivePrice < prev.effectivePrice) map.set(d.itemId, payload);
    });
    const results = Array.from(map.entries()).map(([itemId, best]) => ({ itemId, ...best }));
    res.json({ count: results.length, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'compareAll failed' });
  }
});

// Simple delete route for testing -- WARNING: destructive
app.delete('/api/clear', async (req, res) => {
  try { await Price.deleteMany({}); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'clear failed' }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

--- backend/seed.js ---
// Seed script: creates sample prices across multiple 'apps'
const mongoose = require('mongoose');
require('dotenv').config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fpa_db';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const PriceSchema = new mongoose.Schema({ itemId: String, name: String, app: String, basePrice: Number, deliveryFee: Number, coupon: Object, lastUpdated: Date });
const Price = mongoose.model('PriceSeed', PriceSchema);

async function run(){
  await Price.deleteMany({});
  const data = [
    { itemId: 'butter-chicken', name: 'Butter Chicken', app: 'zomato', basePrice: 320, deliveryFee: 30, coupon: { type: 'percent', value: 10 } },
    { itemId: 'butter-chicken', name: 'Butter Chicken', app: 'swiggy', basePrice: 299, deliveryFee: 35, coupon: { type: 'fixed', value: 20 } },
    { itemId: 'butter-chicken', name: 'Butter Chicken', app: 'uber-eats', basePrice: 340, deliveryFee: 20, coupon: { type: 'none', value: 0 } },
    { itemId: 'paneer-tikka', name: 'Paneer Tikka', app: 'zomato', basePrice: 220, deliveryFee: 25, coupon: { type: 'fixed', value: 30 } },
    { itemId: 'paneer-tikka', name: 'Paneer Tikka', app: 'swiggy', basePrice: 210, deliveryFee: 35, coupon: { type: 'percent', value: 5 } }
  ];
  await Price.insertMany(data);
  console.log('seeded');
  process.exit(0);
}
run();

--- frontend/package.json ---
{
  "name": "fpa-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "axios": "^1.4.0",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "react-scripts": "5.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test"
  }
}

--- frontend/src/index.js ---
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
createRoot(document.getElementById('root')).render(<App />);

--- frontend/public/index.html ---
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Food Price Aggregator</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>

--- frontend/src/App.jsx ---
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API || 'http://localhost:5000';

export default function App(){
  const [q, setQ] = useState('butter-chicken');
  const [results, setResults] = useState([]);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ fetchAll(); }, []);

  async function fetchAll(){
    try{
      setLoading(true);
      const r = await axios.get(`${API_BASE}/api/compareAll`);
      setAll(r.data.results || []);
    }catch(e){ console.error(e); }
    finally{ setLoading(false); }
  }

  async function search(e){
    e && e.preventDefault();
    try{
      setLoading(true);
      const r = await axios.get(`${API_BASE}/api/compare?q=${encodeURIComponent(q)}`);
      setResults(r.data.results || []);
    }catch(e){ console.error(e); }
    finally{ setLoading(false); }
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 20 }}>
      <h1>Food Price Aggregator</h1>
      <p>Compare effective prices across apps (base price + fees - coupons)</p>

      <form onSubmit={search} style={{ marginBottom: 12 }}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="enter itemId or name" />
        <button type="submit">Search</button>
        <button type="button" onClick={fetchAll} style={{ marginLeft: 8 }}>Refresh all</button>
      </form>

      {loading && <div>Loading…</div>}

      {results.length>0 && (
        <div>
          <h2>Comparisons for "{q}"</h2>
          <table border="1" cellPadding="6">
            <thead><tr><th>App</th><th>Base</th><th>Fee</th><th>Coupon</th><th>Effective</th></tr></thead>
            <tbody>
            {results.map(r=> (
              <tr key={r.id}>
                <td>{r.app}</td>
                <td>{r.basePrice}</td>
                <td>{r.deliveryFee}</td>
                <td>{r.coupon.type==='none' ? '-' : (r.coupon.type==='fixed' ? `₹${r.coupon.value}` : `${r.coupon.value}%`)}</td>
                <td>{r.effectivePrice}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <h2>Best per item (sample)</h2>
        <table border="1" cellPadding="6">
          <thead><tr><th>Item</th><th>App</th><th>Effective Price</th></tr></thead>
          <tbody>
            {all.map(r=> (
              <tr key={r.itemId}>
                <td>{r.name} <div style={{fontSize:12,color:'#666'}}>({r.itemId})</div></td>
                <td>{r.app}</td>
                <td>{r.effectivePrice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 18, fontSize: 13, color: '#555' }}>
        <strong>Notes:</strong>
        <ul>
          <li>This demo expects you to ingest data (POST /api/ingest) or run the seed script.</li>
          <li>Do not scrape live sites without permission — use official APIs or partner feeds.</li>
        </ul>
      </div>
    </div>
  );
}

--- frontend/.env.example ---
REACT_APP_API=http://localhost:5000

--- README.md ---
# Food Price Aggregator (demo)

## Overview
This repository demonstrates a simple system to ingest price offers for food items from multiple delivery apps and compare which app offers the lowest effective price (base price + delivery fee - coupon).

## Quick start
1. Install MongoDB and make sure it's running locally, or use a MongoDB Atlas URI.
2. Backend:
   - cd backend
   - copy .env.example to .env and set MONGO_URI
   - npm install
   - npm run seed (optional, creates sample data)
   - npm run dev (or npm start)
3. Frontend:
   - cd frontend
   - npm install
   - npm start

API endpoints:
- POST /api/ingest -> ingest array of price objects
- GET /api/compare?q=butter-chicken -> compare a single item
- GET /api/compareAll -> get best per item
- DELETE /api/clear -> clear DB (dangerous)

## Data format for /api/ingest
POST JSON array of objects like:
[
  { "itemId": "butter-chicken", "name": "Butter Chicken", "app": "zomato", "basePrice": 320, "deliveryFee": 30, "coupon": { "type": "percent", "value": 10 } }
]

## Legal / production notes
- Respect the Terms of Service of aggregator apps. Scraping them may violate TOS and local law.
- For production, obtain partner APIs / official feeds and secure ingestion endpoints.
- Add authentication, rate limiting, validation.

--- END ---
