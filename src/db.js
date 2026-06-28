const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const dbPath = path.resolve(__dirname, '..', process.env.DATABASE_FILE || 'kisaan_sahyog_db.json');

// Memory store structure
let store = {
  farmers: {},
  chat_sessions: {},
  messages: [],
  weather_alerts: [],
  api_cache: {}
};

// Initialize DB from file or seed it
function initDb() {
  console.log(`Initializing JSON File Database at: ${dbPath}`);
  try {
    if (fs.existsSync(dbPath)) {
      const fileData = fs.readFileSync(dbPath, 'utf8');
      store = JSON.parse(fileData);
      console.log('Database loaded successfully from file.');
    } else {
      console.log('Database file not found. Creating a new one...');
      saveToDisk();
    }
  } catch (error) {
    console.error('Error loading database file. Initializing empty database.', error);
    saveToDisk();
  }

  // Seed default farmer profile if not exists
  const defaultFarmerId = 'farmer_default_123';
  if (!store.farmers[defaultFarmerId]) {
    console.log('Seeding default farmer profile...');
    store.farmers[defaultFarmerId] = {
      farmer_id: defaultFarmerId,
      name: 'Ramesh Yadav',
      phone: '+919876543210',
      district: 'Varanasi',
      state: 'Uttar Pradesh',
      gps_lat: 25.3176,
      gps_lon: 82.9739,
      primary_crop: 'Wheat',
      land_bigha: 3.5,
      irrigation: 'borewell',
      language: 'en',
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString()
    };
    saveToDisk();
  }
}

// Persist memory store to JSON file
function saveToDisk() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(store, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing database to disk:', error);
  }
}

// ==========================================
// Database Queries Helper functions
// ==========================================

const db = {
  // Farmers
  farmers: {
    get: (id) => {
      return store.farmers[id] || null;
    },
    save: (profile) => {
      const id = profile.farmer_id;
      const existing = store.farmers[id] || {};
      store.farmers[id] = {
        ...existing,
        ...profile,
        last_active: new Date().toISOString()
      };
      saveToDisk();
      return store.farmers[id];
    }
  },

  // Sessions
  sessions: {
    get: (id) => {
      return store.chat_sessions[id] || null;
    },
    create: (sessionId, farmerId) => {
      store.chat_sessions[sessionId] = {
        session_id: sessionId,
        farmer_id: farmerId,
        started_at: new Date().toISOString(),
        ended_at: null
      };
      saveToDisk();
      return store.chat_sessions[sessionId];
    }
  },

  // Messages
  messages: {
    getBySession: (sessionId) => {
      return store.messages.filter(m => m.session_id === sessionId);
    },
    save: (msg) => {
      const message_id = msg.message_id || 'msg_' + Math.random().toString(36).substr(2, 9);
      const newMsg = {
        message_id,
        created_at: new Date().toISOString(),
        ...msg
      };
      store.messages.push(newMsg);
      saveToDisk();
      return newMsg;
    }
  },

  // Weather Alerts
  alerts: {
    getActiveForFarmer: (farmerId) => {
      const now = new Date();
      return store.weather_alerts.filter(a => 
        a.farmer_id === farmerId && 
        new Date(a.valid_until) > now && 
        a.seen === 0
      );
    },
    save: (alert) => {
      const alert_id = 'alert_' + Math.random().toString(36).substr(2, 9);
      const newAlert = {
        alert_id,
        created_at: new Date().toISOString(),
        seen: 0,
        ...alert
      };
      store.weather_alerts.push(newAlert);
      saveToDisk();
      return newAlert;
    },
    markAsSeen: (farmerId) => {
      let updated = false;
      store.weather_alerts = store.weather_alerts.map(a => {
        if (a.farmer_id === farmerId && a.seen === 0) {
          updated = true;
          return { ...a, seen: 1 };
        }
        return a;
      });
      if (updated) {
        saveToDisk();
      }
    }
  },

  // Cache
  cache: {
    get: (key) => {
      const entry = store.api_cache[key];
      if (!entry) return null;
      if (new Date(entry.expires_at) < new Date()) {
        delete store.api_cache[key];
        saveToDisk();
        return null;
      }
      return JSON.parse(entry.response);
    },
    set: (key, responseObj, ttlSeconds) => {
      const expires_at = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      store.api_cache[key] = {
        response: JSON.stringify(responseObj),
        expires_at,
        created_at: new Date().toISOString()
      };
      saveToDisk();
    }
  }
};

initDb();

module.exports = db;
