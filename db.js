// db.js - Database configuration with pg-promise
const pgp = require('pg-promise')({
    // Optional: error handling
    capSQL: true,
    // Optional: untuk debugging (uncomment jika perlu)
    // query: (e) => console.log('QUERY:', e.query)
});

// Konfigurasi database
const db = pgp({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'personal_web_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5000
});

db.connect()
    .then(obj => {
        console.log(' PostgreSQL connected with pg-promise!');
        obj.done();
    })
    .catch(err => {
        console.error(' Database connection error:', err.message);
        console.error('   Please check your database configuration in .env file');
    });

module.exports = db;