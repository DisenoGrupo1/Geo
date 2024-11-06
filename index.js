let configData;
let map;
let marker;
let pathCoordinates = [];
let pathPolyline;
let reconnectInterval = 1000;
let socket;
let reconnectAttempts = 0;
const MAX_ATTEMPTS = 5;
let lastUpdateTime = null;
let lastLatLng;
let mapInitialized = false;
let infoWindow;

function loadConfig() {
    return fetch('config.json')
        .then(response => response.json())
        .then(config => {
            configData = config;
            document.title = configData.TITLE;
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${configData.apiKey}&callback=initMap`;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        })
        .catch(error => console.error("Error al cargar config.json:", error));
}

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 15,
        center: { lat: 0, lng: 0 }
    });

    pathPolyline = new google.maps.Polyline({
        path: pathCoordinates,
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: map
    });

    infoWindow = new google.maps.InfoWindow(); // Popup para mostrar velocidad y rpm
    initializeWebSocket();
}

function initializeWebSocket() {
    if (reconnectAttempts >= MAX_ATTEMPTS) {
        console.log("Número máximo de intentos de reconexión alcanzado");
        return;
    }

    socket = new WebSocket(`ws://${configData.AWS_IP}:20000`);

    socket.onopen = function () {
        console.log("Conectado al WebSocket");
        reconnectInterval = 1000;
        reconnectAttempts = 0;

        fetch(`http://${configData.AWS_IP}:50000/last_location`)
            .then(response => response.json())
            .then(data => {
                if (data.latitud && data.longitud) {
                    lastLatLng = new google.maps.LatLng(parseFloat(data.latitud), parseFloat(data.longitud));
                    if (!marker) {
                        marker = new google.maps.Marker({
                            position: lastLatLng,
                            map: map,
                            icon: {
                                url: "http://geotaxi.ddns.net/icon/taxi.png",
                                scaledSize: new google.maps.Size(25, 25),
                                origin: new google.maps.Point(0, 0),
                                anchor: new google.maps.Point(15, 15)
                            }
                        });

                        marker.addListener('click', () => {
                            infoWindow.open(map, marker);
                        });
                    } else {
                        marker.setPosition(lastLatLng);
                    }
                    map.setCenter(lastLatLng);
                }
            })
            .catch(error => console.error("Error al obtener la última ubicación:", error));
    };

    socket.onmessage = function (event) {
        console.log("Mensaje recibido del WebSocket:", event.data);
        let data = JSON.parse(event.data);
        //console.log(data);
        let latLng = new google.maps.LatLng(parseFloat(data.latitud), parseFloat(data.longitud));
        
        let currentTime = new Date(`${data.fecha}T${data.hora}`);
        if (!lastUpdateTime || (currentTime - lastUpdateTime) >= 1000) {
            lastUpdateTime = currentTime;

            pathCoordinates.push(latLng);
            pathPolyline.setPath(pathCoordinates);

            if (marker) {
                marker.setPosition(latLng);
            }

            map.panTo(latLng);

            // Actualizar el contenido del popup con velocidad y rpm
            infoWindow.setContent(`<div><strong>Velocidad:</strong> ${data.velocidad} km/h<br><strong>RPM:</strong> ${data.rpm}<br><strong>Combustible:</strong> ${data.combustible}%</div>`);
        }
    };

    socket.onerror = function () {
        console.error("Error de WebSocket");
    };

    socket.onclose = function () {
        console.log("WebSocket cerrado");
        reconnectAttempts++;
        console.log(`Intento de reconexión: ${reconnectAttempts}`);
        if (reconnectAttempts < MAX_ATTEMPTS) {
            setTimeout(initializeWebSocket, reconnectInterval);
            reconnectInterval = Math.min(reconnectInterval * 2, 60000);
        } else {
            console.log("No se pudo reconectar después de varios intentos.");
        }
    };
}

loadConfig();
