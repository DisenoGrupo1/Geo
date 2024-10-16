let configData;
let map;
let marker;
let pathCoordinates = []; // Array para almacenar las coordenadas del recorrido
let pathPolyline; // Variable para almacenar la línea del recorrido
let reconnectInterval = 1000; // Intervalo inicial de reconexión de 1 segundo
let socket; // Define el socket fuera de las funciones para poder reutilizarlo
let reconnectAttempts = 0; // Contador de intentos de reconexión
const MAX_ATTEMPTS = 5; // Máximo número de intentos de reconexión
let lastUpdateTime = null; // Almacena el último timestamp recibido
let lastLatLng = null; // Almacena la última posición
let mapInitialized = false; // Bandera para indicar si el mapa ha sido centrado

// Función para cargar la configuración desde el archivo config.json
function loadConfig() {
    return fetch('config.json')
        .then(response => response.json())
        .then(config => {
            configData = config;
            // Establece el título de la página
            document.title = configData.TITLE;

            // Inserta la API key de Google Maps en el script
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
        center: { lat: 0, lng: 0 } // Centro inicial (se ajustará más tarde)
    });
    pathPolyline = new google.maps.Polyline({
        path: pathCoordinates,
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: map
    });

    // Inicializa el WebSocket después de que el mapa se haya cargado
    initializeWebSocket();

    // Asocia el evento de cambio de zoom para ajustar el tamaño del ícono
    map.addListener('zoom_changed', function () {
        updateIconSize();
    });
}

function updateIconSize() {
    if (!marker) return;

    const zoomLevel = map.getZoom();
    const scaleFactor = zoomLevel / 15; // Ajusta 15 según el nivel de zoom base
    const iconSize = new google.maps.Size(30 * scaleFactor, 30 * scaleFactor); // Ajusta 30 al tamaño base

    marker.setIcon({
        url: "http://geotaxi.ddns.net/icon/taxi.png", // Ruta a tu imagen de taxi
        scaledSize: iconSize,
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(iconSize.width / 2, iconSize.height / 2)
    });
}


// Función para actualizar la posición y rotación del marcador
function updateMarker(latLng) {
    if (lastLatLng) {
        const angle = getRotationAngle(lastLatLng, latLng);

        marker.setIcon({
            url: "http://geotaxi.ddns.net/icon/taxi.png", // Ruta a tu imagen de taxi
            scaledSize: new google.maps.Size(50, 50), // Ajusta el tamaño del icono
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(25, 25),
            rotation: angle // Aplica la rotación calculada
        });
    }

    // Actualiza la última posición conocida
    lastLatLng = latLng;
}

// Función para inicializar el WebSocket y gestionar la reconexión
function initializeWebSocket() {
    if (reconnectAttempts >= MAX_ATTEMPTS) {
        console.log("Número máximo de intentos de reconexión alcanzado");
        return; // Sale si se han alcanzado los intentos máximos
    }

    socket = new WebSocket(`ws://${configData.AWS_IP}:20000`);

    socket.onopen = function (event) {
        console.log("Conectado al WebSocket");
        reconnectInterval = 1000; // Reinicia el intervalo de reconexión después de una conexión exitosa
        reconnectAttempts = 0; // Reinicia el contador de intentos al conectarse

        // Realiza una solicitud para obtener la última ubicación almacenada
        fetch(`http://${configData.AWS_IP}:50000/last_location`)
            .then(response => response.json())
            .then(data => {
                if (data.latitud && data.longitud) {
                    lastLatLng = new google.maps.LatLng(parseFloat(data.latitud), parseFloat(data.longitud));
                    // Muestra la última ubicación en el mapa
                    marker = new google.maps.Marker({
                        position: lastLatLng,
                        map: map,
                        icon: {
                            url: "http://geotaxi.ddns.net/icon/taxi.png", // Ruta a tu imagen de taxi
                            scaledSize: new google.maps.Size(50, 50), // Tamaño del icono
                            origin: new google.maps.Point(0, 0), // Origen de la imagen
                            anchor: new google.maps.Point(25, 25) // Punto de anclaje del icono
                        }   
                    });
                    map.setCenter(lastLatLng);
                }
            })
            .catch(error => console.error("Error al obtener la última ubicación:", error));
    };

    socket.onmessage = function (event) {
        console.log("Mensaje recibido del WebSocket:", event.data);
        let data = JSON.parse(event.data);
        let latLng = new google.maps.LatLng(parseFloat(data.latitud), parseFloat(data.longitud));

        let currentTime = new Date(`${data.fecha}T${data.hora}`);
        if (!lastUpdateTime || (currentTime - lastUpdateTime) >= 10000) {
            lastUpdateTime = currentTime;

            // Actualiza el trazado de la polilínea
            pathCoordinates.push(latLng);
            pathPolyline.setPath(pathCoordinates);

            // Mueve el marcador a la nueva posición
            if (marker) {
                marker.setPosition(latLng);
                updateMarker(latLng); // Actualiza la rotación del marcador
            }

            // Centra el mapa en la nueva posición
            map.panTo(latLng);
        }
    };

    socket.onerror = function (event) {
        console.error("Error de WebSocket:", event);
        alert("Error de conexión. Intentando reconectar...");
    };

    socket.onclose = function (event) {
        console.log("WebSocket cerrado:", event);
        reconnectAttempts++;
        console.log(`Intento de reconexión: ${reconnectAttempts}`);
        setTimeout(initializeWebSocket, reconnectInterval);
        reconnectInterval = Math.min(reconnectInterval * 2, 60000);
    };
}

// Carga el archivo de configuración y luego inicializa el mapa
loadConfig();
