const player = {
    host: false,
    roomId: null,
    name: "",
    socketId: "",
    win: false
};

const socket = io();

const usernameInput = document.getElementById('room-name-create');
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
            element.addEventListener('click', joinRoom);
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
    listPlayer.innerHTML = `<li class="list-group-item d-flex justify-content-between">
    <p class="p-0 m-0 flex-grow-1 fw-bold">${room.players[0].name}</p>
    </li>`;
    roomPlayers.innerHTML += listPlayer.innerHTML;
    
    hostName.innerHTML = room.players[0].name;
    
    const joinButton = listItem.querySelector('.join-room');
    joinButton.addEventListener('click', joinRoom);
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

document.getElementById('multi').addEventListener('click', function () {
    document.getElementById('page1').style.display = 'none';
    document.getElementById('page2').style.display = 'flex';
})

document.getElementsByClassName('close-modal')[0].addEventListener('click', function () {
    document.getElementById('page1').style.display = 'flex';
    document.getElementById('page2').style.display = 'none';
})

document.getElementsByClassName('leave')[0].addEventListener('click', function () {
    window.location.href = "/";
})

const joinRoom = function () {
    if (usernameInput.value !== "") {
        player.name = usernameInput.value;
        player.socketId = socket.id;
        player.roomId = this.dataset.room;
        
        socket.broadcast.emit('playerData', player);
        
        formPage.style.display = 'none';
        waitingPage.style.display = 'flex';
    }
}