const player = {
    host: false,
    roomId: null,
    name: "",
    socketId: "",
    win: false
};

const socket = io();

const usernameInput = document.getElementById('room-name-create');
const usernameInputJoin = document.getElementById('room-name-join');
const formPage = document.getElementById('page2');
const waitingPage = document.getElementById('page3');
const roomsCard = document.getElementById('rooms-card');
const roomsList = document.getElementById('rooms-list');
const hostName = document.getElementById('host-name');
const roomPlayers = document.getElementById('room-players');

socket.emit('getRooms');
socket.on('listRooms', (rooms) => {
    let html = '';
    
    if (rooms.length > 0) {
        rooms.forEach(room => {
            const roomId = room.id;
            
            html += `<li class="list-group-item d-flex justify-content-between" id="room${room.id}">
            <p class="p-0 m-0 flex-grow-1 fw-bold">Salon de ${room.players[0].name}</p>
            <button class="btn btn-sm btn-success join-room" data-room="${roomId}">Rejoindre</button>
            </li>`;            
        });
    }
    
    if (html !== '') {
        roomsList.innerHTML = html;
        
        for (const element of document.getElementsByClassName('join-room')) {
            element.addEventListener('click', joinRoom(element.dataset.room));
        }
    }
});


socket.on('roomCreated', (room) => {
    const listItem = document.createElement('li');
    listItem.innerHTML = `<li class="list-group-item d-flex justify-content-between" id="room${room.id}">
    <p class="p-0 m-0 flex-grow-1 fw-bold">Salon de ${room.players[0].name}</p>
    <button class="btn btn-sm btn-success join-room" data-room="${room.id}">Rejoindre</button>
    </li>`;
    roomsList.innerHTML += listItem.innerHTML;
    
    const listPlayer = document.createElement('li');
    listPlayer.innerHTML = `<li class="list-group-item d-flex justify-content-between" id="player${room.players[0].name}">
    <p class="p-0 m-0 flex-grow-1 fw-bold">${room.players[0].name}</p>
    </li>`;
    roomPlayers.innerHTML += listPlayer.innerHTML;
    
    hostName.innerHTML = room.players[0].name;
    
    const joinButton = listItem.querySelector('.join-room');
    joinButton.addEventListener('click', joinRoom(joinButton.dataset.room));
});

socket.on('roomRemoved', (roomId) => {
    console.log('roomRemoved', roomId);
    const roomElement = document.getElementById(`room${roomId}`);
    console.log(roomElement);
    if (roomElement) {
        roomElement.remove(); 
    }
});

document.getElementById('create-room-form').addEventListener('submit', function (e) {
    e.preventDefault();
    
    player.name = usernameInput.value;
    player.host = true;
    player.socketId = socket.id;
    
    formPage.style.display = 'none';
    waitingPage.style.display = 'flex';
    
    socket.emit('createRoom', player);
});

function joinRoom(roomId) {
    console.log('joinRoom', roomId);
    if (usernameInputJoin.value !== "") {
        player.name = usernameInputJoin.value;
        player.socketId = socket.id;
        player.roomId = this.dataset.room;
        
        socket.broadcast.emit('createRoom', player);
        
        formPage.style.display = 'none';
        waitingPage.style.display = 'flex';
    }
}

//////////////////////////////////////////////////////////////////////////////////////////
// app.js
//////////////////////////////////////////////////////////////////////////////////////////

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