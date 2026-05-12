import React, { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [destinations, setDestinations] = useState([]);
  const [form, setForm] = useState({
    name: '',
    location: '',
    description: ''
  });

  const API_BASE = 'http://localhost:5000/api/destinations';

  // ✅ Fetch all destinations from backend
  const fetchDestinations = async () => {
    try {
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDestinations(data);
    } catch (err) {
      console.error('❌ Error fetching destinations:', err);
      alert('Could not connect to backend. Please make sure the server is running.');
    }
  };

  useEffect(() => {
    fetchDestinations();
  }, []);

  // ✅ Add a new destination
  const handleAdd = async () => {
    console.log('📤 Sending data to backend:', form);

    if (!form.name.trim() || !form.location.trim() || !form.description.trim()) {
      alert('⚠️ Please fill all fields before submitting.');
      return;
    }

    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name.trim(),
          location: form.location.trim(),
          description: form.description.trim(),
        }),
      });

      const data = await res.json();
      console.log('📥 Backend response:', data);

      if (!res.ok) {
        throw new Error(data.message || 'Failed to add destination');
      }

      alert('✅ Destination added successfully!');
      setForm({ name: '', location: '', description: '' });
      fetchDestinations(); // Refresh list
    } catch (err) {
      console.error('❌ Error adding destination:', err);
      alert(`Failed to add destination: ${err.message}`);
    }
  };

  // ✅ Delete a destination
  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDestinations(destinations.filter(dest => dest._id !== id));
    } catch (err) {
      console.error('❌ Error deleting destination:', err);
      alert('Failed to delete destination.');
    }
  };

  return (
    <div className="App">
      <h1>🌍 Travel Destinations</h1>

      <div className="form">
        <input
          type="text"
          placeholder="Destination Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          type="text"
          placeholder="Location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <button onClick={handleAdd}>Add Destination</button>
      </div>

      {destinations.length === 0 ? (
        <p>No destinations found.</p>
      ) : (
        <ul className="list">
          {destinations.map((dest) => (
            <li key={dest._id} className="card">
              <h2>{dest.name}</h2>
              <p><strong>Location:</strong> {dest.location}</p>
              <p>{dest.description}</p>
              <button
                className="delete-btn"
                onClick={() => handleDelete(dest._id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
