const mysql = require('mysql2');
require('dotenv').config();

// --- VALIDACIÓN DE SEGURIDAD ---
// Si falta una variable crítica, el sistema se detiene antes de ser vulnerable
const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
requiredEnv.forEach(env => {
    if (!process.env[env]) {
        console.error(`❌ ERROR CRÍTICO: Falta la variable de entorno ${env} en el archivo .env`);
        process.exit(1); // Detiene el servidor
    }
});

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306, // Puerto por defecto de MySQL
    waitForConnections: true,
    connectionLimit: 10, // Máximo de conexiones simultáneas
    queueLimit: 0,
    
    // --- CAPA DE ENCRIPTACIÓN ---
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : null,
    
    // --- CAPA DE RENDIMIENTO ---
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 10000 // Si no conecta en 10s, abortar (evita fugas de memoria)
});

// Convertimos a promesas para usar async/await
const promisePool = pool.promise();

// Log de estado (Solo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
    console.log('📡 Pool de conexiones MySQL configurado.');
}

module.exports = promisePool;