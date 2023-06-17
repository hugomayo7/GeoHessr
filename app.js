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


http.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

let rooms = [];

io.on('connection', (socket) => {
    
    socket.on('createRoom', (player) => {
        let room = null;
        
        if (!player.roomId) {
            room = createRoom(player);
        } else {
            room = rooms.find((r) => r.id === player.roomId);
            
            if (room === undefined) {
                return;
            }
            
            player.roomId = room.id;
            room.players.push(player);
        }
        
        socket.join(room.id);
        
        io.emit('roomCreated', room);
    });
    
    socket.on('getRooms', () => {
        io.emit('listRooms', rooms);
    });
    
    socket.on('disconnect', () => {
        let roomIndex = -1;
      
        for (let i = 0; i < rooms.length; i++) {
          const room = rooms[i];
      
          for (let j = 0; j < room.players.length; j++) {
            const player = room.players[j];
      
            if (player.socketId === socket.id && player.host) {
              roomIndex = i;
              break;
            }
          }
      
          if (roomIndex !== -1) {
            break;
          }
        }
      
        if (roomIndex !== -1) {
          const room = rooms[roomIndex];
          rooms.splice(roomIndex, 1);
          io.emit('roomRemoved', room.id); // Envoyer à tous les sockets
          io.in(room.id).socketsLeave(room.id); // Faire quitter tous les sockets de la salle
        }
      });
});

function createRoom(player) {
    const room = { id: roomId(), players: [] };
    
    player.roomId = room.id;
    
    room.players.push(player);
    rooms.push(room);
    
    return room;
}

function roomId() {
    return Math.random().toString(36).substr(2, 9);
}