
// DEPENDENCIES
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const port = 3000;

// MULTER CONFIG (Upload Gambar)
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

/// MIDDLEWARE
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(methodOverride('_method'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'rahasia123',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60 * 60 * 1000 }
}));

app.use(flash());  

// Flash message
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.user = req.session.user || null;
    next();
});

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    req.flash('error_msg', 'Silakan login terlebih dahulu');
    res.redirect('/');
};
// HANDLEBARS SETUP
app.engine('hbs', engine({
    extname: '.hbs',
    defaultLayout: 'layout',
    layoutsDir: path.join(__dirname, 'views/layout'),
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

// HELPER FUNCTIONS
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

// LANDING PAGE
app.get('/', (req, res) => {
    // Jika sudah login, redirect ke home
    if (req.session.user) {
        return res.redirect('/home');
    }
    
    res.render('landing', {
        title: 'Welcome | Personal Web',
        errors: null,
        oldInput: {}
    });
});

// CONTACT PAGE
app.get('/contact', (req, res) => {
    res.render('about', {
        title: 'Contact | Personal Web',
        email: 'aditya@email.com',
        phone: '083877139627',
        address: 'Jakarta'
    });
});

app.get('/about', (req, res) => {
    res.redirect('/contact');
});

// LOGIN ROUTES
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const errors = {};

    if (!email || email.trim() === '') {
        errors.login = 'Email harus diisi';
        return res.render('landing', {
            title: 'Welcome | Personal Web',
            errors: errors,
            oldInput: { email }
        });
    }

    if (!password) {
        errors.login = 'Password harus diisi';
        return res.render('landing', {
            title: 'Welcome | Personal Web',
            errors: errors,
            oldInput: { email }
        });
    }

    try {
        const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);

        if (!user) {
            errors.login = 'Email atau password salah';
            return res.render('landing', {
                title: 'Welcome | Personal Web',
                errors: errors,
                oldInput: { email }
            });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            errors.login = 'Email atau password salah';
            return res.render('landing', {
                title: 'Welcome | Personal Web',
                errors: errors,
                oldInput: { email }
            });
        }

        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email
        };

        console.log('Session user set to:', req.session.user);
        console.log('Session ID:', req.session.id);


        req.flash('success_msg', 'Selamat datang kembali, ' + user.name);
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                errors.login = 'Terjadi kesalahan session';
                return res.render('landing', {
                    title: 'Welcome | Personal Web',
                    errors: errors,
                    oldInput: { email }
                });
            }
            
            console.log('Session saved successfully!');
            
            res.redirect('/home');
        });

    } catch (err) {
        console.error('Login error:', err);
        errors.login = 'Terjadi kesalahan, silakan coba lagi';
        res.render('landing', {
            title: 'Welcome | Personal Web',
            errors: errors,
            oldInput: { email }
        });
    }
});
// REGISTER ROUTES
app.post('/register', async (req, res) => {
    const { name, email, password, confirm_password } = req.body;

    const errors = { register: [] };

    if (!name || name.trim() === '') {
        errors.register.push('Nama harus diisi');
    }

    if (!email || email.trim() === '') {
        errors.register.push('Email harus diisi');
    }

    if (!password || password.length < 6) {
        errors.register.push('Password minimal 6 karakter');
    }

    if (password !== confirm_password) {
        errors.register.push('Konfirmasi password tidak sesuai');
    }

    if (errors.register.length > 0) {
        return res.render('landing', {
            title: 'Welcome | Personal Web',
            errors: errors,
            oldInput: { name, reg_email: email }
        });
    }

    try {
        const existingUser = await db.oneOrNone('SELECT id FROM users WHERE email = $1', [email]);

        if (existingUser) {
            errors.register.push('Email sudah terdaftar, silakan login');
            return res.render('landing', {
                title: 'Welcome | Personal Web',
                errors: errors,
                oldInput: { name, reg_email: email }
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await db.one(
            `INSERT INTO users (name, email, password) 
             VALUES ($1, $2, $3) 
             RETURNING id, name, email`,
            [name, email, hashedPassword]
        );

        req.session.user = {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email
        };

        req.flash('success_msg', 'Registrasi berhasil! Selamat datang ' + newUser.name);
        res.redirect('/landing');

    } catch (err) {
        console.error('Register error:', err);
        errors.register.push('Terjadi kesalahan, silakan coba lagi');
        res.render('landing', {
            title: 'Welcome | Personal Web',
            errors: errors,
            oldInput: { name, reg_email: email }
        });
    }
});

// LOGOUT ROUTE
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
});

// ROUTES DENGAN PROTEKSI (Harus Login)
// HOME PAGE (Setelah Login)
app.get('/home', isAuthenticated, (req, res) => {
    console.log('===ACCESSING /home ===');
    console.log('Session user:', req.session.user);
     console.log('Session ID:', req.session.id);
      
    if (!req.session.user) {
        console.log('ERROR: No user in session!');
        return res.redirect('/');
    }
    res.render('home', {
        title: 'Home | MyProfile',
        image: 'luffy.jpg',
        name: req.session.user.name,
        role: 'Web Developer',
        email: req.session.user.email,
        phone: '083877139627',
        address: 'Jakarta',
        description: 'Lulusan Teknik Komputer Jaringan dengan pengalaman 2 tahun sebagai IT Support. Terbiasa menangani troubleshooting jaringan dan perangkat keras, backup data, serta instalasi software. Menguasai PHP dasar, HTML, dan pembuatan website sederhana. Siap bekerja dalam tim maupun individu dengan kemampuan problem solving yang baik.'
    });
});

// READ ALL (My Projects with Search)
app.get('/my-project', isAuthenticated, async (req, res) => {
    const { search = '' } = req.query;
    const userId = req.session.user.id;

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
            WHERE p.name ILIKE $1 AND p.author_id = $2
            GROUP BY p.id, p.name, p.start_date, p.end_date, p.description, p.image
            ORDER BY p.id DESC
        `;

        const projects = await db.any(query, [`%${search}%`, userId]);

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
app.get('/add-project', isAuthenticated, async (req, res) => {
    try {
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

app.post('/add-project', isAuthenticated, upload.single('projectImage'), async (req, res) => {
    const { name, start_date, end_date, description, technologies } = req.body;
    const errors = [];

    if (!name || name.trim() === '') {
        errors.push('Nama project harus diisi');
    }
    if (!start_date) {
        errors.push('Tanggal mulai harus diisi');
    }
    if (!end_date) {
        errors.push('Tanggal selesai harus diisi');
    }
    if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
        errors.push('Tanggal mulai tidak boleh lebih besar dari tanggal selesai');
    }
    if (!description || description.trim() === '') {
        errors.push('Deskripsi project harus diisi');
    }
    if (errors.length > 0) {
        const technologiesList = await db.any('SELECT id, name FROM technologies ORDER BY name');
        return res.render('add-project', {
            title: 'Add Project | Personal Web',
            technologies: technologiesList,
            errors: errors,
            oldInput: { name, start_date, end_date, description, technologies }
        });
    }
    let techArray = [];
    if (technologies) {
        techArray = Array.isArray(technologies) ? technologies : [technologies];
    }
    if (techArray.length === 0) {
        req.flash('error_msg', 'Pilih minimal 1 teknologi!');
        return res.redirect('/add-project');
    }
    const image = req.file ? req.file.filename : 'default.jpg';
    const author_id = req.session.user.id;

    try {
        const newProject = await db.one(
            `INSERT INTO projects (name, start_date, end_date, description, image, author_id) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [name, start_date, end_date, description, image, author_id]
        );
        const projectId = newProject.id;
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

// DETAIL PROJECT
app.get('/my-project/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;

    try {
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
        if (project.author_id !== req.session.user.id) {
            req.flash('error_msg', 'Anda tidak memiliki akses ke project ini');
            return res.redirect('/my-project');
        }
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

// EDIT PROJECT FORM
app.get('/edit-project/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;

    try {
        const project = await db.oneOrNone('SELECT * FROM projects WHERE id = $1', [id]);

        if (!project) {
            req.flash('error_msg', 'Project tidak ditemukan');
            return res.redirect('/my-project');
        }
        if (project.author_id !== req.session.user.id) {
            req.flash('error_msg', 'Anda tidak memiliki akses untuk mengedit project ini');
            return res.redirect('/my-project');
        }
        const selectedTechsResult = await db.any(
            'SELECT technology_id FROM project_technologies WHERE project_id = $1',
            [id]
        );
        const selectedTechs = selectedTechsResult.map(row => row.technology_id);
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

// UPDATE (Edit Project )
app.put('/edit-project/:id', isAuthenticated, upload.single('projectImage'), async (req, res) => {
    const { id } = req.params;
    const { name, start_date, end_date, description, technologies } = req.body;
    const errors = [];

    if (!name || name.trim() === '') {
        errors.push('Nama project harus diisi');
    }
    if (!start_date) {
        errors.push('Tanggal mulai harus diisi');
    }
    if (!end_date) {
        errors.push('Tanggal selesai harus diisi');
    }
    if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
        errors.push('Tanggal mulai tidak boleh lebih besar dari tanggal selesai');
    }
    if (!description || description.trim() === '') {
        errors.push('Deskripsi project harus diisi');
    }

    let techArray = [];
    if (technologies) {
        techArray = Array.isArray(technologies) ? technologies : [technologies];
    }

    if (techArray.length === 0) {
        errors.push('Pilih minimal 1 teknologi!');
    }

    if (errors.length > 0) {
        const project = await db.oneOrNull('SELECT * FROM projects WHERE id = $1', [id]);
        const allTechnologies = await db.any('SELECT id, name FROM technologies ORDER BY name');
        const selectedTechsResult = await db.any(
            'SELECT technology_id FROM project_technologies WHERE project_id = $1',
            [id]
        );
        const selectedTechs = selectedTechsResult.map(row => row.technology_id);
        return res.render('edit-project', {
            title: 'Edit Project | Personal Web',
            project: { ...project, name, start_date, end_date, description },
            technologies: allTechnologies,
            selectedTechs,
            errors: errors
        });
    }

    try {
        const projectExists = await db.oneOrNone('SELECT id FROM projects WHERE id = $1', [id]);

        if (!projectExists) {
            req.flash('error_msg', 'Project tidak ditemukan');
            return res.redirect('/my-project');
        }
        const project = await db.oneOrNone('SELECT author_id FROM projects WHERE id = $1', [id]);
        if (project.author_id !== req.session.user.id) {
            req.flash('error_msg', 'Anda tidak memiliki akses untuk mengedit project ini');
            return res.redirect('/my-project');
        }
        const image = req.file ? req.file.filename : null;
        if (image) {
            await db.none(
                `UPDATE projects 
                 SET name = $1, start_date = $2, end_date = $3, description = $4, image = $5
                 WHERE id = $6`,
                [name, start_date, end_date, description, image, id]
            );
        } else {
            await db.none(
                `UPDATE projects 
                 SET name = $1, start_date = $2, end_date = $3, description = $4
                 WHERE id = $5`,
                [name, start_date, end_date, description, id]
            );
        }

        await db.none('DELETE FROM project_technologies WHERE project_id = $1', [id]);

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
app.delete('/delete-project/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;

    try {
        const project = await db.oneOrNone('SELECT author_id FROM projects WHERE id = $1', [id]);

        if (!project) {
            req.flash('error_msg', 'Project tidak ditemukan');
            return res.redirect('/my-project');
        }

        if (project.author_id !== req.session.user.id) {
            req.flash('error_msg', 'Anda tidak memiliki akses untuk menghapus project ini');
            return res.redirect('/my-project');
        }

        await db.none('DELETE FROM projects WHERE id = $1', [id]);

        req.flash('success_msg', 'Project berhasil dihapus!');
        res.redirect('/my-project');
    } catch (err) {
        console.error('Error deleting project:', err);
        req.flash('error_msg', 'Gagal menghapus project');
        res.redirect('/my-project');
    }
});

// TEST DATABASE ROUTE (Opsional)
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

app.listen(port, () => {
    console.log(`\n Server running at http://localhost:${port}`);
    console.log(` Landing Page: http://localhost:${port}/`);
    console.log(` Home: http://localhost:${port}/home`);
    console.log(` My Projects: http://localhost:${port}/my-project`);
    console.log(` Add Project: http://localhost:${port}/add-project`);
    console.log(` Contact: http://localhost:${port}/contact`);
    console.log(`\n Sistem autentikasi aktif!`);
    console.log(`   - Register: Buat akun baru`);
    console.log(`   - Login: Masuk ke dashboard`);
    console.log(`   - Setiap user hanya bisa mengelola project sendiri\n`);
});