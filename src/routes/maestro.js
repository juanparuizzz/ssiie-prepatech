const express = require('express');
const router = express.Router();
const db = require('../db');

// Dashboard del Maestro: Ver alumnos y sus materias filtradas
router.get('/dashboard', async (req, res) => {
    try {
        const maestro = req.session.user;

        // 1. Alumnos de su grado y grupo
        const [alumnos] = await db.query(
            'SELECT id, nombre FROM usuarios WHERE rol = "alumno" AND grado = ? AND grupo = ? ORDER BY nombre',
            [maestro.grado, maestro.grupo]
        );
        
        // 2. MATERIAS SEGMENTADAS: Solo las de su grado
        const [materias] = await db.query(
            'SELECT * FROM materias WHERE grado_asignado = ? ORDER BY nombre_materia',
            [maestro.grado]
        );

        // 3. Historial Completo: Esto servirá para el script de UX que ocultará opciones
        const [historial] = await db.query(`
            SELECT c.id, u.nombre AS alumno, m.nombre_materia, c.calificacion, c.materia_id, c.alumno_id
            FROM calificaciones c
            JOIN usuarios u ON c.alumno_id = u.id
            JOIN materias m ON c.materia_id = m.id
            WHERE c.maestro_id = ? 
            ORDER BY u.nombre ASC`, 
            [maestro.id]
        );

        res.render('maestro/dashboard', { 
            alumnos, 
            materias,
            historial,
            maestro,
            title: 'Panel del Maestro',
            success: req.query.success 
        });
    } catch (err) {
        console.error('❌ Error en Dashboard Maestro:', err);
        res.status(500).send('Error al cargar el panel');
    }
});

// Guardar o Editar calificación (Mantiene la lógica unificada)
router.post('/calificar', async (req, res) => {
    const { alumno_id, materia_id, nota } = req.body;
    const maestro_id = req.session.user.id;

    try {
        // Buscamos si ya existe el registro
        const [existe] = await db.query(
            'SELECT id FROM calificaciones WHERE alumno_id = ? AND materia_id = ?',
            [alumno_id, materia_id]
        );

        if (existe.length > 0) {
            // Actualización
            await db.query(
                'UPDATE calificaciones SET calificacion = ?, maestro_id = ? WHERE id = ?',
                [nota, maestro_id, existe[0].id]
            );
        } else {
            // Nuevo Registro
            await db.query(
                'INSERT INTO calificaciones (alumno_id, materia_id, maestro_id, calificacion) VALUES (?, ?, ?, ?)',
                [alumno_id, materia_id, maestro_id, nota]
            );
        }
        res.redirect('/maestro/dashboard?success=true');
    } catch (err) {
        console.error('❌ Error al procesar calificación:', err);
        res.status(500).send('Error al procesar la calificación');
    }
});

module.exports = router;