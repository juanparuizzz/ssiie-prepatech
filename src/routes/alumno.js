const express = require('express');
const router = express.Router();
const db = require('../db');

// Perfil del Alumno: Con analíticas de promedio
router.get('/perfil', async (req, res) => {
    try {
        const alumnoId = req.session.user.id;

        // 1. Obtener los datos del alumno
        const [datos] = await db.query('SELECT nombre, correo, grado, grupo FROM usuarios WHERE id = ?', [alumnoId]);

        // 2. Obtener calificaciones
        const [calificaciones] = await db.query(`
            SELECT m.nombre_materia, c.calificacion, u.nombre AS maestro
            FROM calificaciones c
            JOIN materias m ON c.materia_id = m.id
            JOIN usuarios u ON c.maestro_id = u.id
            WHERE c.alumno_id = ?`, 
            [alumnoId]
        );

        // 3. Calcular promedio
        let promedio = 0;
        let estado = "Sin calificaciones";
        let colorEstado = "secondary";

        if (calificaciones.length > 0) {
            const suma = calificaciones.reduce((acc, item) => acc + parseFloat(item.calificacion), 0);
            promedio = (suma / calificaciones.length).toFixed(1);

            if (promedio >= 9) {
                estado = "Excelente";
                colorEstado = "success";
            } else if (promedio >= 7) {
                estado = "Regular";
                colorEstado = "warning";
            } else {
                estado = "En Riesgo";
                colorEstado = "danger";
            }
        }

        res.render('alumno/perfil', { 
            alumno: datos[0], 
            calificaciones,
            stats: {
                promedio,
                estado,
                colorEstado,
                totalMaterias: calificaciones.length
            },
            title: 'Mi Perfil Escolar',
            user: req.session.user, // Importante para el layout
            update: req.query.update 
        });
    } catch (err) {
        console.error('❌ Error en Perfil Alumno:', err);
        res.status(500).send('Error al cargar tu perfil');
    }
});

// NUEVA RUTA: Generar vista de impresión para la boleta
router.get('/boleta', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    try {
        const alumnoId = req.session.user.id;
        
        // Traemos datos y calificaciones (puedes reutilizar la lógica anterior)
        const [datos] = await db.query('SELECT nombre, grado, grupo FROM usuarios WHERE id = ?', [alumnoId]);
        const [calificaciones] = await db.query(`
            SELECT m.nombre_materia, c.calificacion 
            FROM calificaciones c
            JOIN materias m ON c.materia_id = m.id
            WHERE c.alumno_id = ?`, [alumnoId]);

        res.render('alumno/boleta_imprimir', {
            alumno: datos[0],
            calificaciones,
            title: `Boleta_${datos[0].nombre}`,
            layout: false // Esto evita que cargue la navbar y el footer en la boleta
        });
    } catch (err) {
        console.error('❌ Error al generar boleta:', err);
        res.redirect('/alumno/perfil?error=1');
    }
});

module.exports = router;