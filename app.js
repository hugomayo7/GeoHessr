const { Socket } = require('socket.io');

const express = require('express');

const app = express();
const http = require('http').createServer(app);
const path = require('path');
const axios = require('axios');
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

app.get('/favicon.ico', (req, res) => res.status(204));

app.get('/', (req, res) => {
    res.render('index', { apiKey });
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
            players: [{ id: socket.id, pseudo, host: true, guess: false, distance: null, guessPos: null, color: generatePlayerColor() }],
            inProgress: false,
        };
        
        // Rejoindre la room correspondant au code du salon
        socket.join(code);
        
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
            // Salon non trouvé
            return;
        }
        
        // Vérifie si le pseudo est déjà utilisé dans le salon
        const isPseudoTaken = salon.players.some((player) => player.pseudo === pseudo);
        if (isPseudoTaken) {
            // Le pseudo est déjà pris, envoie une alerte au client
            socket.emit('pseudo-taken', pseudo);
            return;
        }
        
        // Rejoindre la room correspondant au code du salon
        socket.join(code);
        
        // Ajoute le joueur au salon
        salon.players.push({ id: socket.id, pseudo, guess: false, distance: null, guessPos: null, host: false, color: generatePlayerColor() });
        
        // Informe les joueurs du salon qu'un joueur a rejoint (sauf le joueur qui rejoint)
        salon.players.forEach((player) => {
            if (player.id !== socket.id) {
                const participantSocket = io.sockets.sockets.get(player.id);
                participantSocket.emit('player-joined', { id: socket.id, pseudo });
            }
        });
        
        // Envoie les informations du salon au joueur qui a rejoint
        socket.emit('salon-joined', { code, salon });
        
        // Informe tous les clients que le salon a été mis à jour
        io.emit('salon-list-updated', salons);
    });
    
    // Écoute l'événement de déconnexion de la socket
    socket.on('disconnect', () => {
        // Recherche le salon auquel le joueur est associé
        const salon = salons.find((s) => s.players.some((player) => player.id === socket.id));
        
        // Si le joueur est associé à un salon
        if (salon) {
            // Vérifier si le joueur est l'hôte du salon
            if (salon.creator === salon.players.find(player => player.id === socket.id).pseudo) {
                // Supprimer le salon
                const salonIndex = salons.indexOf(salon);
                salons.splice(salonIndex, 1);
                
                // Informer les autres joueurs du salon que l'hôte s'est déconnecté
                socket.to(salon.code).emit('host-disconnected');
                
                // Informer tous les clients que la liste des salons a été mise à jour
                io.emit('salon-list-updated', salons);
            } else {
                // Supprimer le joueur du salon
                const updatedPlayers = salon.players.filter((player) => player.id !== socket.id);
                
                // Informer les autres joueurs du salon qu'un joueur a quitté
                socket.broadcast.to(salon.code).emit('player-left', socket.id);
                
                // Mettre à jour la liste des joueurs dans le salon
                salon.players = updatedPlayers;
                
                // Informer tous les clients que le salon a été mis à jour
                io.emit('salon-list-updated', salons);
            }
        }
    });
    
    // Écoute de l'événement "start-game" émis par l'hôte du salon
    socket.on('start-game', (salonCode) => {
        const salon = salons.find((s) => s.code === salonCode);
        const joueur = salon.players.find((player) => player.id === socket.id);
        
        if (joueur && joueur.pseudo === salon.creator) {
            if (salon.players.length <= 1) {
                // Envoi d'un message d'erreur à l'hôte du salon
                socket.emit('game-start-failed', 'Vous ne pouvez pas lancer la partie car vous êtes seul dans le salon.');
            } else {
                // Marquer le salon comme étant en cours de jeu
                salon.inProgress = true;
                
                // Générer des coordonnées et les renvoyer à tous les joueurs du salon
                const coords = generateCoords().then((coords) => {
                    io.to(salonCode).emit('game-started', coords)
                });
                
                io.to(salonCode).emit('game-loading');
            }
        }
    });
    
    socket.on('player-guess', (distance, salonCode, guessPos) => {
        
        const salon = salons.find((s) => s.code === salonCode);
        const joueur = salon.players.find((player) => player.id === socket.id);
        joueur.guess = true;
        joueur.distance = distance;
        joueur.guessPos = guessPos;

        if (salon.players.every((player) => player.guess)) {
            io.to(salonCode).emit('round-ended', salon);
        }
    });

    socket.on('timerDown', (salonCode) => {
        const salon = salons.find((s) => s.code === salonCode);

        io.to(salonCode).emit('round-ended', salon);
    });

    socket.on('next-round', (salon) => {
        salon.players.forEach((player) => {
            player.guess = false;
            player.distance = null;
            player.guessPos = null;
        });

        const coords = generateCoords().then((coords) => {
            io.to(salon.code).emit('game-started', coords)
        });

        io.to(salon.code).emit('game-loading');
    });
});

async function generateCoords() {
    let lat, lng;
    let validCoords = false;
    
    do {
        lat = Math.random() * 180 - 90;
        lng = Math.random() * 360 - 180;
        
        const streetViewURL = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${apiKey}`;
        
        const response = await axios.get(streetViewURL);
        const data = response.data;
        
        if (data.status === 'OK' && data.copyright === '© Google') {
            validCoords = true;
        }
    } while (!validCoords);
    
    return { lat, lng };
}

function generatePlayerColor() {
    // Générer trois valeurs RGB aléatoires entre 0 et 255
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
  
    // Convertir les valeurs RGB en une couleur hexadécimale
    const color = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  
    return color;
  }
  