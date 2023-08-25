const socket = io();

let loader = document.getElementById("wrap-loader");

let guessMarker;
let originalPos;
let panorama;
let minimap;
let resultMap;
let stopCount = false;
let interval = null;
let isHost = false;

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
    isHost = true;

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
            socket.emit('join-salon', {code: salon.code, pseudo});
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
socket.on('player-joined', ({id, pseudo}) => {
    const playersList = document.getElementById('room-players');
    const listItem = document.createElement('li');
    listItem.setAttribute('data-player-id', id);
    listItem.textContent = pseudo;
    playersList.appendChild(listItem);
});

// Écoute l'événement "salon-joined" pour afficher les informations du salon
socket.on('salon-joined', ({code, salon}) => {
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
    page4.style.display = 'none';
    document.getElementById("endRound").style.display = "none";

});

// Écouter l'événement 'game-started' côté client
socket.on('game-started', (coords) => {
    resultMap = null;
    originalPos = null;
    stopCount = false;
    timeDis.innerHTML = "02:30";

    let sv = new google.maps.StreetViewService();
    sv.getPanoramaByLocation(new google.maps.LatLng(coords.lat, coords.lng), 500, initStreetView);
});

socket.on('game-start-failed', (errorMessage) => {
    // Afficher le message d'erreur à l'hôte du salon
    alert(errorMessage);
});

socket.on('game-loading', () => {
    document.getElementById("endRound").style.display = "none";

    loader.style.display = 'flex';
});

socket.on('round-ended', (salon) => {
    clearInterval(interval);
    stopCount = true;

    salon.players.forEach((player) => {
        if (player.id === socket.id) {
            // Afficher la distance du joueur actuel
            if (player.distance) {
                document.getElementById('guessDistance').textContent = `${player.distance.toFixed(1)} km`;
            } else {
                document.getElementById('guessDistance').previousSibling.previousSibling.textContent = 'Vous n\'avez pas deviné la distance';
            }
        }

        if (player.host && player.id === socket.id && !document.getElementById('nextRound')) {
            let modalContent = document.querySelector('.modal-content');
            let nextRoundButton = document.createElement('button');
            nextRoundButton.id = 'nextRound';
            nextRoundButton.textContent = 'Round suivant';
            nextRoundButton.classList.add('next-round-button');

            nextRoundButton.addEventListener('click', function () {
                socket.emit('next-round', salon);
            });

            modalContent.appendChild(nextRoundButton);
        }
    });

    document.getElementById("endRound").style.display = "flex";
    document.getElementById("endRound").style.zIndex = "99999999";
    document.getElementsByClassName("minimap")[0].style.display = "none";

    resultMap = new google.maps.Map(document.getElementById("resultMap"),
        {
            center: new google.maps.LatLng(0, 0),
            zoom: 1,
            disableDefaultUI: true,
            keyboardShortcuts: false,
            clickableIcons: false,
            draggableCursor: 'cursor',
            draggingCursor: 'grabbing',
        }
    );

    // créer marker original
    let originalMarker = new google.maps.Marker({
        position: {
            lat: originalPos.lat(),
            lng: originalPos.lng()
        },
        map: resultMap,
    });

    // afficher le marker de chaque joueur
    salon.players.forEach((player) => {
        if (player.guess) {
            new google.maps.Marker({
                position: player.guessPos,
                map: resultMap,
                icon: {
                    url: `https://ui-avatars.com/api/?name=${player.pseudo}&rounded=true&background=${player.color}&color=fff`,
                    scaledSize: new google.maps.Size(35, 38),
                }
            });

            drawLine(resultMap, player.guessPos)
        }
    });

    zoomOnResult(resultMap, salon.players)
})

function drawLine(map, playerPos) {
    // Création de la ligne entre les deux points
    let line = new google.maps.Polyline({
        path: [playerPos, originalPos],
        strokeColor: "transparent",
        strokeOpacity: 0,
        icons: [{
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillOpacity: 1,
                fillColor: "#000000",
                strokeOpacity: 1,
                strokeColor: "#000000",
                strokeWeight: 2,
                scale: 2
            },
            offset: "0",
            repeat: "10px"
        }],
        map: map
    });

    // Animation du tracé de la ligne
    let lineAnimation = 0;
    let lineAnimationInterval = setInterval(function () {
        line.setOptions({
            strokeOpacity: lineAnimation
        });
        lineAnimation += 0.1;
        if (lineAnimation >= 1) {
            clearInterval(lineAnimationInterval);
        }
    }, 500);

    line.setMap(map);
}

function zoomOnResult(map, players) {
    let bounds = new google.maps.LatLngBounds();
    players.forEach(player => {
        if (player.guess) {
            bounds.extend(player.guessPos);
        }
    });
    bounds.extend(originalPos);

    map.fitBounds(bounds);

    let zoomLevel = map.getZoom() - 8;

    let zoomAnimationInterval = setInterval(function () {
        if (map.getZoom() >= zoomLevel) {
            clearInterval(zoomAnimationInterval);
            return;
        }

        let currentZoom = map.getZoom();
        let newZoom = currentZoom + 0;

        map.setZoom(newZoom);

        let bounds = map.getBounds();
        let ne = bounds.getNorthEast();
        let sw = bounds.getSouthWest();
        let center = new google.maps.LatLng(
            (ne.lat() + sw.lat()) / 2,
            (ne.lng() + sw.lng()) / 2
        );

        map.panTo(center);
    }, 1000);
}

function initStreetView(data) {
    originalPos = data.location.latLng;

    clearInterval(interval);
    countdown()

    loader.style.display = 'none';
    page3.style.display = 'none';
    page4.style.display = 'flex';
    document.getElementById("guessButton").style.display = "none";

    resultMap = null;

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
}

async function countdown() {
    let seconds = 5; // 3 minutes en secondes

    return new Promise((resolve, reject) => {
        interval = setInterval(() => {
            if (seconds === 0) {
                clearInterval(interval)
                if (isHost) {
                    socket.emit('timerDown', salonCode)
                }
                stopCount = true;
            } else if (stopCount) {
                clearInterval(interval)
                resolve();
            }

            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;

            timeDis.innerHTML = "<span class='time' style='color: white;'>" +
                (minutes < 10 ? "0" : "") +
                minutes +
                ":" +
                (remainingSeconds < 10 ? "0" : "") +
                remainingSeconds +
                "</span>";

            seconds--;
        }, 1000);
    });
}

function calcDistance(lat1, lat2, lon1, lon2) {
    lon1 = lon1 * Math.PI / 180;
    lon2 = lon2 * Math.PI / 180;
    lat1 = lat1 * Math.PI / 180;
    lat2 = lat2 * Math.PI / 180;

    let dlon = lon2 - lon1;
    let dlat = lat2 - lat1;
    let a = Math.pow(Math.sin(dlat / 2), 2)
        + Math.cos(lat1) * Math.cos(lat2)
        * Math.pow(Math.sin(dlon / 2), 2);

    let c = 2 * Math.asin(Math.sqrt(a));

    let r = 6371;

    return c * r;
}

function validGuess(guessPos, originalPos) {
    let distance = calcDistance(guessPos.lat(), originalPos.lat(), guessPos.lng(), originalPos.lng());

    socket.emit('player-guess', distance, salonCode, guessPos);
}

// guess position
guessButton.addEventListener("click", function () {
    if (guessMarker) {
        const markerPosition = guessMarker.getPosition();

        validGuess(markerPosition, originalPos);
    }
});

document.getElementsByClassName('exit')[0].addEventListener('click', function () {
    if (window.confirm('Voulez-vous vraiment quitter la partie ?')) {
        window.location.href = '/';
    }
})
        