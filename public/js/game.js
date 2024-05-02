let loader = document.getElementById("wrap-loader");

let guessMarker;
let originalPos;
let panorama;
let minimap;
let resultMap;
let stopCount = false;
let interval = null;

let timeDis = document.getElementById("timeDis");
let guessButton = document.getElementById("guessButton");

async function loadGeoJSON(url) {
    const response = await fetch(url);
    const data = await response.json();
    return data;
}

function calculateBBox(polygon) {
    const coords = polygon.geometry.coordinates;
    let minX, minY, maxX, maxY;

    coords.forEach((coord) => {
        coord[0].forEach((point) => {
            if (minX === undefined || minX > point[0]) minX = point[0];
            if (maxX === undefined || maxX < point[0]) maxX = point[0];
            if (minY === undefined || minY > point[1]) minY = point[1];
            if (maxY === undefined || maxY < point[1]) maxY = point[1];
        });
    });

    return [minX, minY, maxX, maxY];
}

async function generateRandomPoint() {
    const geojsonData = await loadGeoJSON('../land.geojson');

    // Sélectionnez un polygone terrestre aléatoire
    const randomIndex = Math.floor(Math.random() * geojsonData.features.length);
    const randomPolygon = geojsonData.features[randomIndex];

    // Générez un point aléatoire à l'intérieur du polygone sélectionné
    let point = turf.randomPoint(1, { bbox: turf.bbox(randomPolygon) }).features[0].geometry.coordinates;

    let sv = new google.maps.StreetViewService();
    sv.getPanoramaByLocation(
        new google.maps.LatLng(point[1], point[0]), 500, function(data, status) {
            initStreetView(data, status);
        }
    );
}

function initStreetView(data, status) {
    if (status === google.maps.StreetViewStatus.OK && (
        data.copyright === "© 2020 Google" ||
        data.copyright === "© 2021 Google" ||
        data.copyright === "© 2022 Google" ||
        data.copyright === "© 2023 Google" ||
        data.copyright === "© 2024 Google")) {
        originalPos = data.location.latLng;

        clearInterval(interval);
        countdown();

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
        generateRandomPoint();
        loader.style.display = "flex";
    }
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

    endRoundScreen(distance);
}

function endRoundScreen(distance) {
    document.getElementById("endRound").style.display = "flex";
    document.getElementById("endRound").style.zIndex = "99999999";
    document.getElementById("guessDistance").innerHTML = distance.toFixed(1) + " km";
    document.getElementsByClassName("minimap")[0].style.display = "none";

    resultMap = new google.maps.Map(
        document.getElementById("resultMap"),
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
        icon: {
            url: '../images/green-pin.png',
            scaledSize: new google.maps.Size(38, 40),
        },
    });

    // créer marker guess
    let userMarker = new google.maps.Marker({
        position: guessMarker.getPosition(),
        map: resultMap,
    });

    drawLine(resultMap)
    zoomOnResult(resultMap)
}

function loseRoundScreen() {
    document.getElementById("loseRound").style.display = "flex";
    document.getElementById("loseRound").style.zIndex = "99999999";
    document.getElementsByClassName("minimap")[0].style.display = "none";

    resultMap = new google.maps.Map(
        document.getElementById("resultMapLose"),
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
        icon: {
            url: '../images/green-pin.png',
            scaledSize: new google.maps.Size(38, 40),
        },
    });

    zoomOnLoseResult(resultMap)
}

function nextRound() {
    loader.style.display = "flex";
    document.getElementById("endRound").style.display = "none";
    document.getElementById("loseRound").style.display = "none";
    document.getElementById("guessButton").style.display = "none";
    document.getElementById("pano").style.display = "none";
    stopCount = false;
    timeDis.innerHTML = "02:30";

    generateRandomPoint();
}

function drawLine(map) {
    // Création de la ligne entre les deux points
    let line = new google.maps.Polyline({
        path: [guessMarker.getPosition(), originalPos],
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

function zoomOnResult(map) {
    let bounds = new google.maps.LatLngBounds();
    bounds.extend(guessMarker.getPosition());
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

function zoomOnLoseResult(map) {
    map.setZoom(3.5);
    map.panTo(originalPos);
}

async function countdown() {
    let seconds = 150; // 2mn30 minutes en secondes

    return new Promise((resolve, reject) => {
        interval = setInterval(() => {
            if (seconds === 0) {
                clearInterval(interval)
                loseRoundScreen()
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

// next round when lost
document.getElementById("nextRoundLose").addEventListener("click", function () {
    nextRound()
})

// next round
document.getElementById("nextRound").addEventListener("click", function () {
    nextRound()
})

// guess position
guessButton.addEventListener("click", function () {
    if (guessMarker) {
        stopCount = true;
        const markerPosition = guessMarker.getPosition();

        validGuess(markerPosition, originalPos);
    }
});

const exitElements = document.getElementsByClassName('exit');

for (let i = 0; i < exitElements.length; i++) {
    exitElements[i].addEventListener('click', function () {
        if (window.confirm('Voulez-vous vraiment quitter la partie ?')) {
            window.location.href = '/';
        }
    });
}

const exitButtonsModal = document.getElementsByClassName('modalExit');

for (let i = 0; i < exitButtonsModal.length; i++) {
    exitButtonsModal[i].addEventListener('click', function () {
        window.location.href = '/';
    });
}
