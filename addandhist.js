let configData;
let map, pathPolyline;
let pathCoordinates = [];
let startMarker;
let endMarker;
let movingMarker; // Marcador que se moverá a lo largo de la polilínea
let currentStep = 0; // Paso actual en el recorrido
let totalSteps = 0; // Total de pasos
const iconUrl = 'http://geotaxi.ddns.net/icon/titleicon3.png'; // URL del icono

// Cargar config.json y obtener la clave API
function loadConfig() {
    return fetch('config.json')
        .then(response => response.json())
        .then(config => {
            configData = config;
            document.getElementById('page-title').innerText = configData.TITLE;
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${configData.apiKey}&libraries=places&callback=initMap`;
            script.defer = true;
            document.head.appendChild(script);
        })
        .catch(error => console.error("Error al cargar config.json:", error));
}

// Inicializa el mapa
function initMap() {
    const barranquilla = { lat: 10.9878, lng: -74.7889 };
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 15, // Aumentamos el nivel de zoom
        center: barranquilla
    });

    // Inicializa la polilínea
    pathPolyline = new google.maps.Polyline({
        strokeColor: '#FF0000',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        map: map 
    });

    // Inicializa el marcador que se moverá
    movingMarker = new google.maps.Marker({
        map: map,
        icon: {
            url: iconUrl,
            scaledSize: new google.maps.Size(30, 30) // Tamaño del icono (30x30)
        }
    });
}

// Función para cargar el historial
function loadHistory() {
    const startDate = document.getElementById('start-datetime').value;
    const endDate = document.getElementById('end-datetime').value;

    if (startDate && endDate) {
        const startDateTime = new Date(startDate);
        const endDateTime = new Date(endDate);

        if (endDateTime <= startDateTime) {
            alert("La fecha y hora final debe ser posterior a la fecha y hora inicial.");
            return;
        }

        const requestBody = {
            start: startDate,
            end: endDate
        };

        fetch(`http://${configData.AWS_IP}:60000/location-history`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        })
            console.log(data)
            .then(response => {
                if (!response.ok) {
                    throw new Error("No existen ubicaciones para la ventana de tiempo especificada");
                }
                return response.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    pathCoordinates = data.map(loc => ({
                        latitud: parseFloat(loc.latitud),
                        longitud: parseFloat(loc.longitud),
                        fecha: loc.fecha, // Asumiendo que tienes fecha en la respuesta
                        hora: loc.hora // Asumiendo que tienes hora en la respuesta
                    }));
                    totalSteps = pathCoordinates.length; // Total de puntos en el recorrido

                    // Inicializamos los marcadores de inicio y fin
                    addStartMarker();
                    addEndMarker();
                    
                    // Colocamos el marcador en la primera ubicación
                    movingMarker.setPosition(new google.maps.LatLng(pathCoordinates[0].latitud, pathCoordinates[0].longitud));
                    map.setCenter(movingMarker.getPosition());
                    
                    // Añadimos el listener al marcador para mostrar el popup al hacer clic
                    addMarkerClickListener();

                    updatePolyline();
                    updateSlider();
                    showPopup(pathCoordinates[0].fecha, pathCoordinates[0].hora); // Mostrar popup inicialmente
                } else {
                    alert(data.message || "No se encontraron ubicaciones para el rango de fechas especificado.");
                }
            })
            .catch(error => {
                console.error("Error fetching location history:", error);
                alert("Error al consultar los históricos de ubicación: " + error.message);
            });
    } else {
        alert("Por favor, seleccione fechas y horas válidas.");
    }
}

// Agregar el listener de clic en el marcador
function addMarkerClickListener() {
    google.maps.event.addListener(movingMarker, 'click', function() {
        const position = pathCoordinates[currentStep];
        showPopup(position.fecha, position.hora);
    });
}

// Actualiza la polilínea y los marcadores
function updatePolyline() {
    if (pathPolyline) {
        pathPolyline.setPath(pathCoordinates.map(coord => new google.maps.LatLng(coord.latitud, coord.longitud)));

        if (pathCoordinates.length > 0) {
            const bounds = new google.maps.LatLngBounds();
            pathCoordinates.forEach(coord => bounds.extend(new google.maps.LatLng(coord.latitud, coord.longitud)));
            map.fitBounds(bounds);
            addStartMarker();
            addEndMarker();
        }
    }
}

// Agregar marcadores de inicio y fin
function addStartMarker() {
    if (startMarker) startMarker.setMap(null);
    startMarker = new google.maps.Marker({
        position: pathCoordinates[0],
        map: map,
        title: 'Inicio',
        label: 'A'
    });
}

function addEndMarker() {
    if (endMarker) endMarker.setMap(null);
    endMarker = new google.maps.Marker({
        position: pathCoordinates[pathCoordinates.length - 1],
        map: map,
        title: 'Fin',
        label: 'B'
    });
}

// Actualiza la posición del marcador basado en el slider
function updateMarkerPosition(value) {
    if (totalSteps === 0) return; 

    // Convertimos el valor del slider en un índice que no supere el total de ubicaciones
    currentStep = Math.floor((value / 100) * (totalSteps - 1));
    
    const position = pathCoordinates[currentStep];
    movingMarker.setPosition(new google.maps.LatLng(position.latitud, position.longitud));
        map.setZoom(15); // Establecer el nivel de zoom en 15

    // Centrar el mapa en la nueva posición del marcador
    map.setCenter(movingMarker.getPosition());
    map.setZoom(15); // Establecer el nivel de zoom en 15

    showPopup(position.fecha, position.hora);
}

// Actualiza el slider basado en la cantidad de ubicaciones
function updateSlider() {
    const slider = document.getElementById('slider');
    slider.max = 100; // Mantenemos el máximo en 100
    slider.value = 0; // Reiniciamos el valor del slider
}

// Muestra el popup con la fecha y hora
function showPopup(fecha, hora) {
    const popup = document.getElementById('popup');
    const popupDateTime = document.getElementById('popup-date-time');
    popupDateTime.innerText = `Fecha: ${fecha} \nHora: ${hora}`;
    popup.style.display = 'block';
}

// Cierra el popup
function closePopup() {
    document.getElementById('popup').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', loadConfig);
