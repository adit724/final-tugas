const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const app = express();
const port = 3000;
const multer = require('multer');
const { title } = require('process');

let projects = [
    {
        id: 1,
        name: 'Dumbways Mobile Apps',
        startDate: '01/15/2024',
        endDate: '03/20/2024',
        description: 'Membangun Aplikasi Sederhana untuk pembelajaran mobile development dengan React Native. Aplikasi ini mencakup fitur login, dashboard, dan manajemen pengguna',
        image: 'luffy.jpg'
    },
    {
        id: 2,
        name: 'Dumbways Web Apps',
        startDate: '06/01/2023',
        endDate: '07/30/2023',
        description: 'Membangun website modern dengan Express.js dan Handlebars. Website ini memiliki fitur CRUD, autentikasi user, dan dashboard admin',
        image: 'luffy.jpg'
    }
];

//  UPLOAD GAMBAR
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

// Konfigurasi Handlebars
app.engine('hbs', engine({ 
    extname: '.hbs',
    defaultLayout: 'layout',
    layoutsDir: path.join(__dirname, 'views/layout'),
    partialsDir: path.join(__dirname, 'views/partials')
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));  

//  MIDDLEWARE untuk membaca data dari form
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// untuk otomatisasi NEW ID
const generateNewId = () => {
    return projects.length > 0 ? Math.max(...projects.map(p => p.id)) + 1 : 1;
};

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Route Home
app.get('/home', (req, res) => {
    res.render('home', {
        title: 'Home | MyProfile',
        image: 'luffy.jpg',
        name: 'Aditya Afianto',
        role: 'Web Developer',
        email: 'aditya@email.com',
        phone: '083877139627',
        address: 'Jakarta',
        description: 'Lulusan Teknik Komputer Jaringan dengan pengalaman 2 tahun sebagai IT Support. Terbiasa menangani troubleshooting jaringan dan perangkat keras, backup data, serta instalasi software. Menguasai PHP dasar, HTML, dan pembuatan website sederhana. Siap bekerja dalam tim maupun individu dengan kemampuan problem solving yang baik.'
    });
});

app.get('/contact', (req, res) => {
    res.render('about', {
        title: 'Contact | MyProfile',
        email: 'aditya@email.com',
        phone: '083877139627',
        address: 'Jakarta'
    });
});

// untuk Read data
app.get('/my-project', (req, res) => {
    const { search = '' } = req.query; 
    
    // ARRAY METHOD: filter
    const filteredProjects = search 
        ? projects.filter(project => 
            project.name.toLowerCase().includes(search.toLowerCase())
          )
        : projects;
    
    res.render('my-project', {
        title: 'My Projects | MyProfile',
        projects: filteredProjects,
        searchValue: search,
        totalResults: filteredProjects.length
    });
});


// ROUTE PROSES ADD PROJECT DENGAN UPLOAD GAMBAR
app.post('/add-project', upload.single('projectImage'), (req, res) => {
    const { projectName, startDate, endDate, description, technologies } = req.body;
    const techArray = technologies
        ? techArray.split(',').map(tech => tech.trim())
        : ['JavaScript', 'Node.js', 'Express'];
    
    const newProject = {
        id: generateNewId,
        name: projectName,
        startDate: startDate,
        endDate: endDate,
        description: description,
        technologies: techArray,
        image: req.file ? req.file.filename : 'default-project.png'  
    };
    
    projects.push(newProject);
    res.redirect('/my-project');
});

app.get('/delete-project/:id', (req, res) => {
    const id = parseInt(req.params.id);
    projects = projects.filter(project => project.id !== id);
    res.redirect('/my-project');
});

app.get('/my-project/:id', (req, res) => {
    const { id } = req.params; 
    const projectId = parseInt(id);
    
    
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
        return res.status(404).render('404', {
            title: 'Project Not Found',
            message: 'Project yang Anda cari tidak ditemukan'
        });
    }
    
    res.render('detail',{
        title: `${project.name} | Detail Project`,
        project
    });
});
//  ROUTE DELETE PROJECT
app.get('/delete-project/:id', (req, res) => {
    const id = parseInt(req.params.id);
    projects = projects.filter(project => project.id !== id);
    res.redirect('/my-project');
});

app.get('/my-project', (req, res) => {
    // Data dummy projects
    const projects = [
        {
            id: 1,
            name: 'E-Commerce Website',
            startDate: '01/15/2024',
            endDate: '03/20/2024',
            description: 'Membangun website e-commerce untuk UMKM lokal dengan fitur keranjang belanja dan payment gateway.'
        },
        {
            id: 2,
            name: 'Company Profile',
            startDate: '06/01/2023',
            endDate: '07/30/2023',
            description: 'Membuat company profile responsive untuk perusahaan konsultan IT.'
        },
        {
            id: 3,
            name: 'Inventory System',
            startDate: '09/10/2023',
            endDate: '12/15/2023',
            description: 'Sistem manajemen inventaris berbasis web untuk gudang penyimpanan.'
        }
    ];
    
    res.render('my-project', {
        title: 'My Projects | MyProfile',
        projects: projects
    });
});

// untuk update dari FORM
app.get('/edit-project/:id', (req, res) => {
    const { id } = req.params; 
    const projectId = parseInt(id);
    
   
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
        return res.status(404).render('404', {
            title: 'Project Not Found',
            message: 'Project yang ingin diedit tidak ditemukan'
        });
    }
    
    res.render('edit-project', {
        title: `Edit ${project.name} | MyProfile`,
        project
    });
});

app.post('/edit-project/:id', upload.single('projectImage'), (req, res) => {
    const { id } = req.params; 
    const projectId = parseInt(id);
    const { projectName, startDate, endDate, description, technologies } = req.body;
    
    
    const projectIndex = projects.findIndex(p => p.id === projectId);
    
    if (projectIndex === -1) {
        return res.status(404).send('Project not found');
    }
    
    const techArray = technologies 
        ? technologies.split(',').map(tech => tech.trim())
        : projects[projectIndex].technologies;
    
    projects[projectIndex] = {
        ...projects[projectIndex], 
        name: projectName,
        startDate: startDate,
        endDate: endDate,
        description: description,
        technologies: techArray,
        image: req.file ? req.file.filename : projects[projectIndex].image
    };
    
    res.redirect('/my-project');
});

app.get('/delete-project/:id', (req, res) => {
    const { id } = req.params; 
    const projectId = parseInt(id);
    
    const projectExists = projects.find(p => p.id === projectId);
    
    if (!projectExists) {
        return res.status(404).send('Project not found');
    }
    
    projects = projects.filter(p => p.id !== projectId);
    res.redirect('/my-project');
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`- Home: http://localhost:${port}/`);
    console.log(`- Contact: http://localhost:${port}/contact`);
    console.log(`- My Projects: http://localhost:${port}/my-project`);
});