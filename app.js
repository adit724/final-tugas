const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const multer = require('multer');
const db = require('./db'); 

const app = express();
const port = 3000;

//  MULTER CONFIG (Upload Gambar) 
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Hanya file gambar yang diperbolehkan!'));
        }
    }
});

//  MIDDLEWARE 
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(methodOverride('_method'));

// Session & Flash Message
app.use(session({
    secret: process.env.SESSION_SECRET || 'rahasia123',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000 }
}));
app.use(flash());

// Flash message global variable
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    next();
});

//  HANDLEBARS SETUP 
app.engine('hbs', engine({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials'),
    helpers: {
        eq: (a, b) => a === b,
        includes: (arr, value) => arr && arr.includes(value),
        formatDate: (date) => {
            if (!date) return '';
            const d = new Date(date);
            return d.toLocaleDateString('id-ID');
        }
    }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

//  HELPER FUNCTIONS 
const calculateDuration = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const months = Math.floor(diffDays / 30);
    const days = diffDays % 30;

    let duration = '';
    if (months > 0) duration += `${months} bulan `;
    if (days > 0) duration += `${days} hari`;
    if (duration === '') duration = '0 hari';
    return duration;
};

//  ROUTES 

// HOME
app.get('/', (req, res) => {
    res.render('home', {
        title: 'Home | Personal Web',
        name: 'Aditya Afianto',
        role: 'Web Developer',
        image: 'luffy.jpg',
        email: 'aditya@email.com',
        phone: '083877139627',
        address: 'Jakarta',
        description: 'Lulusan Teknik Komputer Jaringan dengan pengalaman 2 tahun sebagai IT Support. Terbiasa menangani troubleshooting jaringan dan perangkat keras, backup data, serta instalasi software.'
    });
});

// CONTACT
app.get('/contact', (req, res) => {
    res.render('contact', {
        title: 'Contact | Personal Web',
        email: 'aditya@email.com',
        phone: '083877139627',
        address: 'Jakarta'
    });
});

//  PROJECTS ROUTES (CRUD with pg-promise) 

// READ ALL (My Projects with Search)
app.get('/my-project', async (req, res) => {
    const { search = '' } = req.query;

    try {
        const query = `
            SELECT 
                p.id,
                p.name,
                p.start_date,
                p.end_date,
                p.description,
                p.image,
                string_agg(t.name, ', ') AS technologies
            FROM projects p
            LEFT JOIN project_technologies pt ON p.id = pt.project_id
            LEFT JOIN technologies t ON pt.technology_id = t.id
            WHERE p.name ILIKE $1
            GROUP BY p.id, p.name, p.start_date, p.end_date, p.description, p.image
            ORDER BY p.id DESC
        `;

        // pg-promise: langsung dapet array, gak perlu .rows
        const projects = await db.any(query, [`%${search}%`]);

        // Hitung durasi untuk setiap project
        const projectsWithDuration = projects.map(project => ({
            ...project,
            duration: calculateDuration(project.start_date, project.end_date)
        }));

        res.render('my-project', {
            title: 'My Projects | Personal Web',
            projects: projectsWithDuration,
            searchValue: search,
            totalResults: projectsWithDuration.length
        });
    } catch (err) {
        console.error('Error fetching projects:', err);
        req.flash('error_msg', 'Gagal mengambil data project');
        res.redirect('/my-project');
    }
});

// CREATE (Add Project Form)
app.get('/add-project', async (req, res) => {
    try {
        // pg-promise: ambil semua technologies
        const technologies = await db.any('SELECT id, name FROM technologies ORDER BY name');
        
        res.render('add-project', {
            title: 'Add Project | Personal Web',
            technologies: technologies
        });
    } catch (err) {
        console.error('Error fetching technologies:', err);
        req.flash('error_msg', 'Gagal memuat form tambah project');
        res.redirect('/my-project');
    }
});

// CREATE (Add Project Process)
app.post('/add-project', upload.single('projectImage'), async (req, res) => {
    const { name, start_date, end_date, description, technologies } = req.body;

    let techArray = [];
    if (technologies) {
        techArray = Array.isArray(technologies) ? technologies : [technologies];
    }

    const image = req.file ? req.file.filename : 'default.jpg';

    try {
        // pg-promise: insert dan return id langsung
        const newProject = await db.one(
            `INSERT INTO projects (name, start_date, end_date, description, image, author_id) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING id`,
            [name, start_date, end_date, description, image, 1]
        );

        const projectId = newProject.id;

        // Insert relasi project_technologies
        for (const techId of techArray) {
            await db.none(
                'INSERT INTO project_technologies (project_id, technology_id) VALUES ($1, $2)',
                [projectId, techId]
            );
        }

        req.flash('success_msg', 'Project berhasil ditambahkan!');
        res.redirect('/my-project');
    } catch (err) {
        console.error('Error adding project:', err);
        req.flash('error_msg', 'Gagal menambahkan project');
        res.redirect('/add-project');
    }
});

// READ DETAIL (View Project)
app.get('/my-project/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // pg-promise: oneOrNone untuk data yang mungkin kosong
        const project = await db.oneOrNone(
            `SELECT 
                p.*,
                u.name AS author_name
             FROM projects p
             LEFT JOIN users u ON p.author_id = u.id
             WHERE p.id = $1`,
            [id]
        );

        if (!project) {
            req.flash('error_msg', 'Project tidak ditemukan');
            return res.redirect('/my-project');
        }

        // Ambil technologies untuk project ini
        const technologies = await db.any(
            `SELECT t.id, t.name 
             FROM technologies t
             JOIN project_technologies pt ON t.id = pt.technology_id
             WHERE pt.project_id = $1`,
            [id]
        );

        project.technologies = technologies;
        project.duration = calculateDuration(project.start_date, project.end_date);

        res.render('detail', {
            title: `${project.name} | Detail Project`,
            project
        });
    } catch (err) {
        console.error('Error fetching project detail:', err);
        req.flash('error_msg', 'Gagal mengambil detail project');
        res.redirect('/my-project');
    }
});

// UPDATE (Edit Project Form)
app.get('/edit-project/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // pg-promise: ambil project
        const project = await db.oneOrNone('SELECT * FROM projects WHERE id = $1', [id]);

        if (!project) {
            req.flash('error_msg', 'Project tidak ditemukan');
            return res.redirect('/my-project');
        }

        // Ambil technologies yang sudah dipilih
        const selectedTechsResult = await db.any(
            'SELECT technology_id FROM project_technologies WHERE project_id = $1',
            [id]
        );
        const selectedTechs = selectedTechsResult.map(row => row.technology_id);

        // Ambil semua technologies
        const allTechnologies = await db.any('SELECT id, name FROM technologies ORDER BY name');

        res.render('edit-project', {
            title: 'Edit Project | Personal Web',
            project,
            technologies: allTechnologies,
            selectedTechs
        });
    } catch (err) {
        console.error('Error fetching edit form:', err);
        req.flash('error_msg', 'Gagal memuat form edit project');
        res.redirect('/my-project');
    }
});

// UPDATE (Edit Project Process)
app.put('/edit-project/:id', upload.single('projectImage'), async (req, res) => {
    const { id } = req.params;
    const { name, start_date, end_date, description, technologies } = req.body;

    let techArray = [];
    if (technologies) {
        techArray = Array.isArray(technologies) ? technologies : [technologies];
    }

    try {
        // Cek apakah project ada
        const projectExists = await db.oneOrNone('SELECT id FROM projects WHERE id = $1', [id]);
        if (!projectExists) {
            req.flash('error_msg', 'Project tidak ditemukan');
            return res.redirect('/my-project');
        }

        // Update project
        await db.none(
            `UPDATE projects 
             SET name = $1, start_date = $2, end_date = $3, description = $4
             WHERE id = $5`,
            [name, start_date, end_date, description, id]
        );

        // Hapus relasi technologies lama
        await db.none('DELETE FROM project_technologies WHERE project_id = $1', [id]);

        // Insert relasi technologies baru
        for (const techId of techArray) {
            await db.none(
                'INSERT INTO project_technologies (project_id, technology_id) VALUES ($1, $2)',
                [id, techId]
            );
        }

        req.flash('success_msg', 'Project berhasil diupdate!');
        res.redirect('/my-project');
    } catch (err) {
        console.error('Error updating project:', err);
        req.flash('error_msg', 'Gagal mengupdate project');
        res.redirect(`/edit-project/${id}`);
    }
});

// DELETE (Delete Project)
app.delete('/delete-project/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Cek apakah project ada
        const projectExists = await db.oneOrNone('SELECT id FROM projects WHERE id = $1', [id]);
        
        if (!projectExists) {
            req.flash('error_msg', 'Project tidak ditemukan');
            return res.redirect('/my-project');
        }

        // Delete project (cascade akan menghapus relasi otomatis)
        await db.none('DELETE FROM projects WHERE id = $1', [id]);

        req.flash('success_msg', 'Project berhasil dihapus!');
        res.redirect('/my-project');
    } catch (err) {
        console.error('Error deleting project:', err);
        req.flash('error_msg', 'Gagal menghapus project');
        res.redirect('/my-project');
    }
});

//  TEST DATABASE ROUTE 
app.get('/test-db', async (req, res) => {
    try {
        const result = await db.one('SELECT NOW() as time, current_database() as db_name');
        res.json({
            status: 'success',
            message: 'Database connected with pg-promise!',
            data: {
                server_time: result.time,
                database_name: result.db_name
            }
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: err.message
        });
    }
});

//  START SERVER 
app.listen(port, () => {
    console.log(`\n Server running at http://localhost:${port}`);
    console.log(` Home: http://localhost:${port}/`);
    console.log(` My Projects: http://localhost:${port}/my-project`);
    console.log(` Add Project: http://localhost:${port}/add-project`);
    console.log(` Contact: http://localhost:${port}/contact`);
    console.log(`\n Using pg-promise for database operations\n`);
});