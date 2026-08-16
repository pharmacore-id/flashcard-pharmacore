// ============================================================
//  KONSTANTA
// ============================================================

const DB_NAME = 'PharmaDeckDB';
const DB_VERSION = 3;
const STORE_NAME = 'user_data';
const SYNC_QUEUE_STORE = 'sync_queue';
const SHARED_DECK_STORE = 'shared_decks';
const CURRENT_SCHEMA_VERSION = 2;
const MIGRATION_VERSION = 'v2';
const ADMIN_EMAILS = ['adm.pharmacore@gmail.com'];
const ADMIN_PASSWORD = 'admin9900';
const USERS_KEY='Pharmadeck_users';
const DATA_PREFIX='Pharmadeck_data_';
const CODES_KEY='Pharmadeck_codes';
const GOAL_KEY='Pharmadeck_goal';
const STUDY_TIME_KEY='Pharmadeck_study_time';
const DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const NICKNAME_KEY='Pharmadeck_nickname_';
const PRICING = {
  book: {
    1: 10000,
    3: 25000,
    6: 48000
  },

  regular: {
    1: 20000,
    3: 55000,
    6: 100000
  }
};

// HARGA NORMAL
const NORMAL_PRICING = {
  book: {
    1: 25000,
    3: 70000,
    6: 125000
  },

  regular: {
    1: 50000,
    3: 140000,
    6: 250000
  }
};
