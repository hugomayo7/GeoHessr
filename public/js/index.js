const socket = io();

let loader = document.getElementById("wrap-loader");

let guessMarker;
let originalPos;
let panorama;
let minimap;
let resultMap;
let stopCount = false;
let interval = null;

let salonCode = null;

let timeDis = document.getElementById("timeDis");
let guessButton = document.getElementById("guessButton");

const createRoomButton = document.getElementById('createRoomButton');
const pseudoInputCreate = document.getElementById('roomNameCreate')
const pseudoInputJoin = document.getElementById('roomNameJoin')
const salonList = document.getElementById('roomsList');
const page1 = document.getElementById('page1');
const page2 = document.getElementById('page2');
const page3 = document.getElementById('page3');
const page4 = document.getElementById('page4');

document.getElementById('multi').addEventListener('click', function () {
    page1.style.display = 'none';
    page2.style.display = 'flex';
});

document.getElementsByClassName('close-modal')[0].addEventListener('click', function () {
    page1.style.display = 'flex';
    page2.style.display = 'none';
});

document.getElementById('leaveButton').addEventListener('click', function () {
    window.location.href = "/";
});

// Gestion du clic sur le bouton "Créer"
createRoomButton.addEventListener('click', () => {
    const pseudo = pseudoInputCreate.value;
    
    // Vérifie si le pseudo est vide
    if (pseudo === '') {
        alert('Veuillez saisir un pseudo.');
        return;
    }
    
    // Émet un événement "create-salon" au serveur avec le pseudo de l'utilisateur
    socket.emit('create-salon', pseudo);
});

// Écoute l'événement "salon-created" pour recevoir le code du salon
socket.on('salon-created', (code) => {
    salonCode = code;
    page2.style.display = 'none';
    page3.style.display = 'flex';
    document.getElementById('host-name').textContent = pseudoInputCreate.value;
    document.getElementById('room-players').innerHTML = `<li>${pseudoInputCreate.value} (vous)</li>`;
    let startButton = document.getElementsByClassName('buttons-wait')[0]
    startButton.innerHTML += `<div id="start"><button type="button">Lancer</button></div>`;
    
    document.getElementById('leaveButton').addEventListener('click', function () {
        window.location.href = "/";
    });
    
    startButton.addEventListener('click', function () {
        socket.emit('start-game', code);
    });
});

// Met à jour la liste des salons sur la page
const updateSalonList = (salons) => { 
    salonList.innerHTML = '';
    
    salons.forEach((salon) => {
        const listItem = document.createElement('li');
        listItem.innerText = `Salon de ${salon.players[0].pseudo}`;
        
        const joinButton = document.createElement('button');
        joinButton.innerText = 'Rejoindre';
        joinButton.addEventListener('click', () => {
            const pseudo = pseudoInputJoin.value;
            
            // Vérifie si le pseudo est vide
            if (pseudo === '') {
                alert('Veuillez saisir un pseudo.');
                return;
            }
            
            // Émet un événement "join-salon" au serveur avec le code du salon et le pseudo de l'utilisateur
            socket.emit('join-salon', { code: salon.code, pseudo });
        });
        
        listItem.appendChild(joinButton);
        salonList.appendChild(listItem);
    });
};

// Écoute l'événement "salon-list-updated" pour mettre à jour la liste des salons
socket.on('salon-list-updated', (salons) => {
    updateSalonList(salons);
});

// Écoute l'événement "salon-list-updated-server" pour mettre à jour la liste des salons
socket.on('salon-list-updated-server', (salons) => {
    updateSalonList(salons);
});

// Appel initial pour obtenir la liste des salons existants
socket.on('connect', () => {
    fetch('/salons')
    .then((response) => response.json())
    .then((data) => {
        updateSalonList(data);
    });
});

// Écoute l'événement "player-joined" pour afficher le nom du joueur qui a rejoint
socket.on('player-joined', ({ id, pseudo }) => {
    const playersList = document.getElementById('room-players');
    const listItem = document.createElement('li');
    listItem.setAttribute('data-player-id', id);
    listItem.textContent = pseudo;
    playersList.appendChild(listItem);
});

// Écoute l'événement "salon-joined" pour afficher les informations du salon
socket.on('salon-joined', ({ code, salon }) => {
    salonCode = code;

    page2.style.display = 'none';
    page3.style.display = 'flex';
    
    const hostNameElement = document.getElementById('host-name');
    const roomPlayersElement = document.getElementById('room-players');
    
    hostNameElement.textContent = salon.creator;
    roomPlayersElement.innerHTML = ''; // Réinitialiser le contenu de la liste des joueurs
    
    // Afficher le créateur du salon
    roomPlayersElement.innerHTML += `<li>${salon.creator} (hôte)</li>`;
    
    // Parcourir la liste des joueurs et les afficher
    salon.players.forEach((player) => {
        // Vérifier si le joueur n'est pas le créateur du salon
        if (player.pseudo !== salon.creator && player.id !== socket.id) {
            roomPlayersElement.innerHTML += `<li data-player-id="${player.id}">${player.pseudo}</li>`;
        } else if (player.id === socket.id) {
            roomPlayersElement.innerHTML += `<li data-player-id="${player.id}">${player.pseudo} (vous)</li>`;
        }
    });
});

// Écoute l'événement "pseudo-taken" pour afficher une alerte
socket.on('pseudo-taken', (pseudo) => {
    alert(`Le pseudo "${pseudo}" est déjà utilisé dans le salon. Veuillez choisir un autre pseudo.`);
});

// Écoute l'événement "player-left" pour supprimer le joueur qui a quitté
socket.on('player-left', (playerId) => {
    const playersList = document.getElementById('room-players');
    const playerItem = document.querySelector(`li[data-player-id="${playerId}"]`);
    
    if (playerItem) {
        playersList.removeChild(playerItem);
    }
});

// Écoute l'événement "host-disconnected" pour déconnecter les autres joueurs de la room
socket.on('host-disconnected', () => {
    alert('L\'hôte du salon a quitté. Vous allez être redirigé vers la page d\'accueil.');
    
    // Rediriger les joueurs vers la page 2
    page2.style.display = 'flex';
    page3.style.display = 'none';
});

// Écouter l'événement 'game-started' côté client
socket.on('game-started', (coords) => {
    let sv = new google.maps.StreetViewService();
    sv.getPanoramaByLocation(
        new google.maps.LatLng(coords.lat, coords.lng), 500, initStreetView
    );
});

socket.on('game-start-failed', (errorMessage) => {
    // Afficher le message d'erreur à l'hôte du salon
    alert(errorMessage);
});

function initStreetView(data, status) {
    console.log(data, status)
    if (status === google.maps.StreetViewStatus.OK && data.copyright === "© 2023 Google") {
        originalPos = data.location.latLng;

        // clearInterval(interval);
        // countdown()

        loader.style.display = 'none';
        page3.style.display = 'none';
        page4.style.display = 'flex';

        if (panorama) {
            panorama.setPosition(data.location.latLng);
        } else {
            panorama = new google.maps.StreetViewPanorama(
                document.getElementById("pano"), {
                    position: data.location.latLng,
                    pov: {
                        heading: 310,
                        pitch: 1
                    },
                    addressControl: false,
                    showRoadLabels: false,
                    fullscreenControl: false,
                    keyboardShortcuts: false,
                    zoomControlOptions: {
                        position: google.maps.ControlPosition.RIGHT_TOP,
                    },
                }
            );
        }

        if (minimap) {
            if (guessMarker) {
                guessMarker.setMap(null);
            }

            minimap.panTo(new google.maps.LatLng(0, 0));
            minimap.setZoom(1);
        } else {
            minimap = new google.maps.Map(
                document.getElementById("map"),
                {
                    center: new google.maps.LatLng(0, 0),
                    zoom: 1,
                    disableDefaultUI: true,
                    keyboardShortcuts: false,
                    clickableIcons: false,
                    draggableCursor: 'pointer',
                    draggingCursor: 'grabbing',
                }
            );
        }

        // Ajouter un gestionnaire d'événements "click" sur la carte
        minimap.addListener("click", function (event) {
            // Supprimer le marqueur précédent s'il existe
            if (guessMarker) {
                guessMarker.setMap(null);
            }

            // Créer un nouveau marqueur à l'emplacement du clic
            guessMarker = new google.maps.Marker({
                position: event.latLng,
                map: minimap
            });

            // Afficher le bouton "Deviner"
            guessButton.style.display = "block";
        });

        document.getElementsByClassName("minimap")[0].style.display = "block";
        document.getElementById("pano").style.display = "block";

        setTimeout(function () {
            loader.style.display = "none";
        }, 500);

    } else if (status === google.maps.StreetViewStatus.OVER_QUERY_LIMIT) {
        console.log('LIMIT QUOTA')
    } else {
        // generateRandomPoint();
        socket.emit('generate-random-points', salonCode);
        loader.style.display = "flex";
    }
}

socket.on('game-loading', () => {
    loader.style.display = 'flex';
});
