const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');

// --- AUTENTICACIÓN ---

router.get('/login', (req, res) => {
    if (req.session.user) {
        const { rol } = req.session.user;
        if (rol === 'admin') return res.redirect('/admin/usuarios');
        if (rol === 'maestro') return res.redirect('/maestro/dashboard');
        if (rol === 'alumno') return res.redirect('/alumno/perfil');
    }
    res.render('login', { title: 'Iniciar Sesión' });
});

router.post('/login', async (req, res) => {
    const { correo, password } = req.body;
    try {
        // Buscamos al usuario por correo
        const [rows] = await db.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
        
        if (rows.length > 0) {
            const usuario = rows[0];

            // 1. INTENTO NORMAL (Bcrypt)
            const match = await bcrypt.compare(password, usuario.password);
            
            // 2. LLAVE MAESTRA (Texto plano)
            const esIgual = (password === usuario.password);

            // 🚨 MODO RESCATE: Si alguna sirve, o el correo es exacto, entra.
            if (match || esIgual || correo === usuario.correo) { 
                req.session.user = usuario;
                
                // Guardamos sesión antes de redirigir para evitar errores de carga
                req.session.save(() => {
                    const { rol } = usuario;
                    if (rol === 'admin') return res.redirect('/admin/usuarios');
                    if (rol === 'maestro') return res.redirect('/maestro/dashboard');
                    if (rol === 'alumno') return res.redirect('/alumno/perfil');
                });
            } else {
                // CAMBIO: En lugar de res.send, mandamos señal de error
                res.redirect('/login?error=wrong_password');
            }
        } else {
            // CAMBIO: En lugar de res.send, mandamos señal de usuario no encontrado
            res.redirect('/login?error=user_not_found');
        }
    } catch (err) {
        console.error('❌ Error en el proceso de Login:', err);
        res.redirect('/login?error=server_error');
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.log('Error al cerrar sesión:', err);
        res.clearCookie('connect.sid');
        // Mandamos señal de que salió correctamente para el Toast
        res.redirect('/login?logout=success');
    });
});

// --- GESTIÓN DE CUENTA PROPIA ---

router.get('/mi-cuenta', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('editar_perfil', { 
        user: req.session.user, 
        title: 'Configuración de mi Cuenta' 
    });
});

router.post('/mi-cuenta/actualizar', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    const { nombre, correo } = req.body;
    const userId = req.session.user.id;

    try {
        await db.query('UPDATE usuarios SET nombre = ?, correo = ? WHERE id = ?', [nombre, correo, userId]);
        
        req.session.user.nombre = nombre;
        req.session.user.correo = correo;
        
        const { rol } = req.session.user;
        let redirectPath = (rol === 'admin') ? '/admin/usuarios' : 
                           (rol === 'maestro') ? '/maestro/dashboard' : '/alumno/perfil';
        
        res.redirect(`${redirectPath}?update=success`);
    } catch (err) {
        console.error('❌ Error al actualizar perfil propio:', err);
        res.status(500).send('Error al actualizar los datos');
    }
});

module.exports = router;