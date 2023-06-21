const { Socket } = require('socket.io');

const express = require('express');

const app = express();
const http = require('http').createServer(app);
const path = require('path');
const { emit } = require('process');
const port = 8080;

require('dotenv').config();

/**
* @type {Socket}
*/
const io = require('socket.io')(http, {
    cors: {
        origin: '*',
    }
});

const apiKey = process.env.GOOGLE_MAPS_API_KEY;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates'));

app.use('/bootstrap/css', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css')));
app.use('/bootstrap/js', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js')));
app.use('/jquery', express.static(path.join(__dirname, 'node_modules/jquery/dist')));
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/game', (req, res) => {
    res.render('game', { apiKey });
});

// obtenir les salons existants
app.get('/salons', (req, res) => {
    res.json(salons);
});

http.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Tableau pour stocker les salons
const salons = [];

io.on('connection', (socket) => {
    
    // Génère un code de salon aléatoire
    const generateSalonCode = () => {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            const randomIndex = Math.floor(Math.random() * characters.length);
            code += characters.charAt(randomIndex);
        }
        return code;
    };
    
    // Écoute l'événement "create-salon" lorsqu'un utilisateur clique sur "Créer"
    socket.on('create-salon', (pseudo) => {
        // Génère un nouveau code de salon
        const code = generateSalonCode();
        
        // Crée un objet pour représenter le salon
        const salon = {
            code,
            creator: pseudo,
            players: [{ id: socket.id, pseudo }],
        };
        
        // Ajoute le salon à la liste des salons
        salons.push(salon);
        
        // Envoie le code du salon au client
        socket.emit('salon-created', code);
        
        // Informe tous les clients qu'un nouveau salon a été créé
        io.emit('salon-list-updated-server', salons);
    });
    
    // Écoute l'événement "join-salon" lorsqu'un utilisateur clique sur "Rejoindre"
    socket.on('join-salon', (data) => {
        const { code, pseudo } = data;
        
        // Vérifie si le salon existe
        const salon = salons.find((s) => s.code === code);
        if (!salon) {
            console.log(`Salon ${code} non trouvé`);
            // Salon non trouvé, tu peux gérer cette situation comme tu le souhaites
            return;
        }
        
        // Vérifie si le pseudo est déjà utilisé dans le salon
        const isPseudoTaken = salon.players.some((player) => player.pseudo === pseudo);
        if (isPseudoTaken) {
            // Le pseudo est déjà pris, envoie une alerte au client
            socket.emit('pseudo-taken', pseudo);
            return;
        }
        
        // Ajoute le joueur au salon
        salon.players.push({ id: socket.id, pseudo });
        
        // Informe les joueurs du salon qu'un joueur a rejoint (sauf le joueur qui rejoint)
        salon.players.forEach((player) => {
            if (player.id !== socket.id) {
                const participantSocket = io.sockets.sockets.get(player.id);
                participantSocket.emit('player-joined', pseudo);
            }
        });
        
        // Envoie les informations du salon au joueur qui a rejoint
        socket.emit('salon-joined', { code, salon });
        
        // Informe tous les clients que le salon a été mis à jour
        io.emit('salon-list-updated', salons);
    });
    
});