let configData;
let map;
let markers = {};  // Objeto para almacenar los marcadores por client_id
let pathCoordinates = {};
let pathPolylines = {};
let reconnectInterval = 1000;
let socket;
let reconnectAttempts = 0;
const MAX_ATTEMPTS = 5;

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
        center: { lat: 10.9878, lng: -74.7889 }
    });

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

        // Obtener la última ubicación de cada cliente al iniciar conexión
        fetch(`http://${configData.AWS_IP}:50000/last_location`)
            .then(response => response.json())
            .then(data => {
                // Asegurar que `data` sea un arreglo
                let cars = Array.isArray(data) ? data : [data];

                cars.forEach(car => {
                    let clientId = car.client_id;
                    let alias=car.alias;
                    let lastLatLng = new google.maps.LatLng(parseFloat(car.latitud), parseFloat(car.longitud));

                    // Crea un marcador y línea de trayectoria para cada cliente
                    if (!markers[clientId]) {
                        markers[clientId] = new google.maps.Marker({
                            position: lastLatLng,
                            map: map,
                            icon: {
                                url: "http://geotaxi.ddns.net/icon/taxi.png",
                                scaledSize: new google.maps.Size(25, 25),
                                origin: new google.maps.Point(0, 0),
                                anchor: new google.maps.Point(15, 15)
                            }
                        });

                        pathCoordinates[clientId] = [lastLatLng];
                        pathPolylines[clientId] = new google.maps.Polyline({
                            path: pathCoordinates[clientId],
                            geodesic: true,
                            strokeColor: '#FF0000',
                            strokeOpacity: 1.0,
                            strokeWeight: 2,
                            map: map
                        });

                        // Crear InfoWindow y añadir listener para mostrarlo al hacer clic
                        markers[clientId].infoWindow = new google.maps.InfoWindow();
                        markers[clientId].infoWindow.setContent(`
                            <div>
                                <strong>ID:</strong> ${alias}<br>
                            </div>
                        `);
                        markers[clientId].addListener('click', () => {
                            markers[clientId].infoWindow.open(map, markers[clientId]);
                        });
                    } else {
                        // Actualiza posición si el marcador ya existe
                        markers[clientId].setPosition(lastLatLng);
                    }
                    
                    // Centra el mapa en la última ubicación del cliente
                    map.setCenter(lastLatLng);
                });
            })
            .catch(error => console.error("Error al obtener la última ubicación:", error));
    };

    socket.onmessage = function (event) {
        console.log("Mensaje recibido del WebSocket:", event.data);
        let data = JSON.parse(event.data);
        let alias = data.alias;  // Obtén el alias del cliente

        // Verifica si el mensaje tiene el client_id
        if (!data.client_id) {
            console.error("Mensaje sin client_id, no se puede procesar.");
            return;
        }

        let clientId = data.client_id;
        let latLng = new google.maps.LatLng(parseFloat(data.latitud), parseFloat(data.longitud));

        // Inicializa el array de coordenadas si no existe para el cliente
        if (!pathCoordinates[clientId]) {
            pathCoordinates[clientId] = [];
        }
        pathCoordinates[clientId].push(latLng);

        // Crea un marcador y una línea de trayectoria para el cliente si no existen
        if (!markers[clientId]) {
            markers[clientId] = new google.maps.Marker({
                position: latLng,
                map: map,
                icon: {
                    url: "http://geotaxi.ddns.net/icon/taxi.png",
                    scaledSize: new google.maps.Size(25, 25),
                    origin: new google.maps.Point(0, 0),
                    anchor: new google.maps.Point(15, 15)
                }
            });

            pathPolylines[clientId] = new google.maps.Polyline({
                path: pathCoordinates[clientId],
                geodesic: true,
                strokeColor: '#FF0000',
                strokeOpacity: 1.0,
                strokeWeight: 2,
                map: map
            });

            // Crea un InfoWindow para mostrar información adicional
            markers[clientId].infoWindow = new google.maps.InfoWindow();
            markers[clientId].addListener('click', () => {
                markers[clientId].infoWindow.open(map, markers[clientId]);
            });
        } else {
            // Actualiza la posición del marcador existente
            markers[clientId].setPosition(latLng);
            pathPolylines[clientId].setPath(pathCoordinates[clientId]);
        }

        // Actualiza el contenido del InfoWindow con velocidad, rpm, y combustible
        markers[clientId].infoWindow.setContent(`
            <div>
                <strong>ID:</strong> ${alias}<br>
                <strong>Velocidad:</strong> ${data.velocidad} km/h<br>
                <strong>RPM:</strong> ${data.rpm}<br>
                <strong>Combustible:</strong> ${data.fuel}%
            </div>
        `);

       //map.panTo(latLng); 
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
