const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator'); // Importamos para sanear datos

// --- MIDDLEWARE DE VALIDACIÓN REUTILIZABLE ---
// Esto revisa si hubo errores y los manda a la consola, evitando que el servidor truene
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error('❌ Errores de validación detectados:', errors.array());
        return res.status(400).send('Datos inválidos o maliciosos detectados.');
    }
    next();
};

// 1. LISTAR USUARIOS + ESTADÍSTICAS
router.get('/usuarios', async (req, res) => {
    try {
        const [usuarios] = await db.query('SELECT id, nombre, correo, rol, grado, grupo FROM usuarios');
        const [stats] = await db.query(`
            SELECT 
                SUM(CASE WHEN rol = 'admin' THEN 1 ELSE 0 END) as totalAdmins,
                SUM(CASE WHEN rol = 'maestro' THEN 1 ELSE 0 END) as totalMaestros,
                SUM(CASE WHEN rol = 'alumno' THEN 1 ELSE 0 END) as totalAlumnos
            FROM usuarios
        `);

        res.render('admin/usuarios', { 
            usuarios, 
            stats: stats[0], 
            title: 'Gestión de Usuarios' 
        });
    } catch (err) {
        console.error('❌ Error al obtener usuarios:', err);
        res.status(500).send('Error interno del servidor');
    }
});

// 2. FORMULARIO CREAR
router.get('/usuarios/crear', (req, res) => {
    res.render('admin/crear_usuario', { title: 'Registrar Usuario' });
});

// 3. PROCESO DE GUARDADO BLINDADO (Anti-XSS y Anti-SQL)
router.post('/usuarios/guardar', [
    // --- ESCUDO ANTI-XSS: Limpiamos y escapamos caracteres ---
    body('nombre').trim().escape().notEmpty(),
    body('correo').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('rol').isIn(['admin', 'maestro', 'alumno']),
    validate
], async (req, res) => {
    const { nombre, correo, password, rol, grado, grupo } = req.body;
    
    const gradoFinal = (rol === 'admin') ? null : (grado || null);
    const grupoFinal = (rol === 'admin') ? null : (grupo || 'A');

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Uso de placeholders (?) protege 100% contra SQL Injection
        await db.query(
            'INSERT INTO usuarios (nombre, correo, password, rol, grado, grupo) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, correo, hashedPassword, rol, gradoFinal, grupoFinal]
        );
        res.redirect('/admin/usuarios');
    } catch (err) {
        console.error('❌ Error al guardar:', err);
        res.status(500).send('Error al guardar el usuario');
    }
});

// 4. FORMULARIO EDITAR
router.get('/usuarios/editar/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Placeholder (?) previene ataques vía URL
        const [rows] = await db.query('SELECT * FROM usuarios WHERE id = ?', [id]);
        if (rows.length > 0) {
            res.render('admin/editar_usuario', { 
                usuario: rows[0], 
                title: 'Editar Usuario' 
            });
        } else {
            res.status(404).send('Usuario no encontrado');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al cargar datos');
    }
});

// 5. PROCESAR ACTUALIZACIÓN BLINDADA
router.post('/usuarios/actualizar/:id', [
    body('nombre').trim().escape().notEmpty(),
    body('correo').isEmail().normalizeEmail(),
    body('rol').isIn(['admin', 'maestro', 'alumno']),
    validate
], async (req, res) => {
    const { id } = req.params;
    const { nombre, correo, rol, grado, grupo } = req.body;
    
    const gradoFinal = (rol === 'admin') ? null : (grado || null);
    const grupoFinal = (rol === 'admin') ? null : (grupo || 'A');

    try {
        await db.query(
            'UPDATE usuarios SET nombre = ?, correo = ?, rol = ?, grado = ?, grupo = ? WHERE id = ?',
            [nombre, correo, rol, gradoFinal, grupoFinal, id]
        );
        res.redirect('/admin/usuarios');
    } catch (err) {
        console.error('❌ Error al actualizar:', err);
        res.status(500).send('Error al actualizar');
    }
});

// 6. ELIMINAR (Protegido con placeholder)
router.get('/usuarios/eliminar/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
        res.redirect('/admin/usuarios');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al eliminar');
    }
});

module.exports = router;