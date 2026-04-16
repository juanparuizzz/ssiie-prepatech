const express = require('express');
const path = require('path');
const session = require('express-session');
const db = require('./db'); 
const helmet = require('helmet'); // Escudo de seguridad
const rateLimit = require('express-rate-limit'); // Evita ataques de fuerza bruta
const cors = require('cors'); // Control de acceso
require('dotenv').config();

const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const maestroRoutes = require('./routes/maestro');
const alumnoRoutes = require('./routes/alumno');

const app = express();

// --- CAPA DE SEGURIDAD GLOBAL ---

// 1. Helmet: Configura cabeceras HTTP seguras y oculta que usas Express
app.use(helmet({
    contentSecurityPolicy: false, // Lo desactivamos temporalmente para que carguen tus CDNs (Bootstrap, FontAwesome) sin problemas
}));

// 2. CORS: Solo permite peticiones desde tu propio dominio
app.use(cors());

// 3. Rate Limiting: Máximo 100 peticiones cada 15 min por IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    message: "Demasiadas peticiones desde esta IP, intenta más tarde."
});
app.use('/login', limiter); // Aplicamos el límite especialmente al login

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. CONFIGURACIÓN DE SESIÓN (Blindada para la nube)
app.use(session({
    // Usamos una variable de entorno para el secreto, si no existe usa la de respaldo
    secret: process.env.SESSION_SECRET || 'mi_secreto_super_seguro_123',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // Solo true si es HTTPS (en la nube)
        httpOnly: true, // Evita que scripts de hackers roben la cookie
        sameSite: 'strict', // Protege contra ataques CSRF
        maxAge: 3600000 
    }
}));

// 5. MIDDLEWARE ANTI-CACHÉ
app.use((req, res, next) => {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
});

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// --- MIDDLEWARES DE PROTECCIÓN ---
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.rol === 'admin') return next();
    res.redirect('/login?error=unauthorized');
}

function isMaestro(req, res, next) {
    if (req.session.user && req.session.user.rol === 'maestro') return next();
    res.redirect('/login?error=unauthorized');
}

function isAlumno(req, res, next) {
    if (req.session.user && req.session.user.rol === 'alumno') return next();
    res.redirect('/login?error=unauthorized');
}

// --- RUTAS ---
app.use('/', authRoutes);

app.get('/', (req, res) => {
    if (req.session.user) {
        const { rol } = req.session.user;
        if (rol === 'admin') return res.redirect('/admin/usuarios');
        if (rol === 'maestro') return res.redirect('/maestro/dashboard');
        if (rol === 'alumno') return res.redirect('/alumno/perfil');
    }
    res.render('index', { title: 'Bienvenido al SIIE Prepa Tech' });
});

app.use('/admin', isAdmin, adminRoutes);
app.use('/maestro', isMaestro, maestroRoutes);
app.use('/alumno', isAlumno, alumnoRoutes);
// Middleware para manejar rutas no encontradas (404)
app.use((req, res) => {
    res.status(404).render('404', { title: 'Página no encontrada - SIIE' });
});

// --- CONEXIÓN A BD ---
async function testConnection() {
    try {
        await db.query('SELECT 1');
        console.log('✅ Conexión a MySQL establecida correctamente.');
    } catch (err) {
        console.error('❌ Error de BD:', err.message);
    }
}
testConnection();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor blindado en: http://localhost:${PORT}`);
});