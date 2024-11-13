let configData;
let map, pathPolyline;
let pathCoordinates = [];
let movingMarker; // Marcador que se movera a lo largo de la polilínea
let currentStep = 0; // Paso actual en el recorrido
let totalSteps = 0; // Total de pasos
const iconUrl = 'http://geotaxi.ddns.net/icon/titleicon3.png'; // URL del icono
let aliasPolylines = {}; // Objeto para almacenar las polilíneas de cada alias
let aliasMarkers = {};
// Generar un color único para cada alias
function getColorForAlias(alias) {
    // Usamos un hash para obtener un valor numérico único basado en el alias
    let hash = 0;
    for (let i = 0; i < alias.length; i++) {
        hash = (hash << 5) - hash + alias.charCodeAt(i);
        hash = hash & hash; // Asegura que el valor se mantenga en 32 bits
    }

    // Usamos el valor del hash para obtener un índice único dentro del rango de colores disponibles
    const colors = [
        '#FF0000',  // Rojo
        '#0000FF',  // Azul
        '#00FF00',  // Verde
        '#00FFFF'   // Cian
    ];
    
    const index = Math.abs(hash) % colors.length; // Asegura un valor positivo y dentro de los límites del array
    return colors[index];
}

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
        zoom: 12,
        center: barranquilla
    });

    // Inicializa la polilínea
    pathPolyline = new google.maps.Polyline({
        strokeColor: '#FF0000',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        map: map // Añadir la polilínea al mapa
    });

    // Agregar Autocomplete al campo de dirección
    const input = document.getElementById('address');
    const autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.setFields(['geometry', 'formatted_address']);

    autocomplete.addListener('place_changed', function () {
        const place = autocomplete.getPlace();

        if (place.geometry) {
            const location = place.geometry.location;
            searchByCoordinates(location.lat(), location.lng(), document.getElementById('radius').value);
            centerMapOnLocation(location);
        } else {
            alert('Por favor, seleccione una dirección válida de la lista desplegable.');
        }
    });
}

// Función para cargar el historial
function loadHistory() {
    const startDate = document.getElementById('start-datetime').value;
    const endDate = document.getElementById('end-datetime').value;
    const alias = document.getElementById('alias-selector').value;

    if (!alias) {
        alert("Por favor, seleccione un ID.");
        return;
    }

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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error("No existen ubicaciones para la ventana de tiempo especificada");
                }
                return response.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    pathCoordinates = data.map(loc => ({
                        latitud: loc.latitud,
                        longitud: loc.longitud
                    }));
                    updatePolyline();
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

// Actualiza la polilínea y los marcadores
function updatePolyline() {
    if (pathPolyline) { // Verifica que pathPolyline esté definido
        pathPolyline.setPath(pathCoordinates.map(coord => new google.maps.LatLng(coord.latitud, coord.longitud)));
        if (pathCoordinates.length > 0) {
            const bounds = new google.maps.LatLngBounds();
            pathCoordinates.forEach(coord => bounds.extend(new google.maps.LatLng(coord.latitud, coord.longitud)));
            map.fitBounds(bounds);
            addStartMarker();
            addEndMarker();
        }
    } else {
        console.error("pathPolyline no está definido.");
    }
}

// Agrega un marcador de inicio
function addStartMarker() {
    if (startMarker) {
        startMarker.setMap(null);
    }
    const startLocation = pathCoordinates[0];
    startMarker = new google.maps.Marker({
        position: new google.maps.LatLng(startLocation.latitud, startLocation.longitud),
        map: map,
        title: 'Inicio'
    });
    bounceMarker(startMarker);
}

// Agrega un marcador de fin
function addEndMarker() {
    if (endMarker) {
        endMarker.setMap(null);
    }
    const endLocation = pathCoordinates[pathCoordinates.length - 1];
    endMarker = new google.maps.Marker({
        position: new google.maps.LatLng(endLocation.latitud, endLocation.longitud),
        map: map,
        title: 'Fin'
    });
    bounceMarker(endMarker);
}

// Función para hacer rebotar el marcador
function bounceMarker(marker) {
    let bounceCount = 0;
    const interval = setInterval(() => {
        if (bounceCount < 10) {
            marker.setAnimation(google.maps.Animation.BOUNCE);
            bounceCount++;
            setTimeout(() => marker.setAnimation(null), 500);
        } else {
            clearInterval(interval);
            marker.setAnimation(null);
        }
    }, 1000);
}
function geocodeAddress() {
    const address = document.getElementById('address').value;
    const button = document.querySelector('button');
    const loadingText = document.querySelector('.loading');
    const radius = document.getElementById('radius').value;  // Obtener el valor del radio

    if (address) {
        button.disabled = true;
        loadingText.style.display = 'block';

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: address }, function (results, status) {
            button.disabled = false;
            loadingText.style.display = 'none';

            if (status === 'OK') {
                const location = results[0].geometry.location;
                searchByCoordinates(location.lat(), location.lng(), radius);  // Pasar el valor del radio
                centerMapOnLocation(location);
            } else {
                alert('La dirección ingresada no es válida');
            }
        });
    } else {
        alert("Por favor, ingrese una dirección válida.");
    }
}
// Función para buscar ubicaciones por coordenadas
function searchByCoordinates(lat, lng, radius) {
    const requestBody = {
        latitud: lat,
        longitud: lng,
        radio: radius
    };
    console.log("Latitud:", lat, "Longitud:", lng, "Radio:", radius);

    fetch(`http://${configData.AWS_IP}:50005/location-at-place`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })
        .then(response => response.json())
        .then(data => {
            displayResults(data);
        })
        .catch(error => {
            console.error("Error:", error);
            document.getElementById('results-body').innerHTML = '';
            document.getElementById('no-results').style.display = 'none';
        });
}

// Función para centrar el mapa y agregar un marcador
function centerMapOnLocation(location) {
    const latLng = { lat: location.lat(), lng: location.lng() };
    map.setCenter(latLng);
    map.setZoom(15);

    if (marker) {
        marker.setMap(null);
    }

    marker = new google.maps.Marker({
        position: latLng,
        map: map,
        title: 'Ubicación seleccionada'
    });

    const radius = parseInt(document.getElementById('radius').value);
    if (circle) {
        circle.setMap(null);
    }

    circle = new google.maps.Circle({
        strokeColor: '#FF0000',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#FF0000',
        fillOpacity: 0.35,
        map: map,
        center: latLng,
        radius: radius
    });
}

// Función para mostrar resultados en la tabla
function displayResults(data) {
    const resultsBody = document.getElementById('results-body');
    resultsBody.innerHTML = '';

    if (data.length > 0) {
        data.forEach(item => {
            const row = document.createElement('tr');
            const dateCell = document.createElement('td');
            const timeCell = document.createElement('td');
            dateCell.textContent = item.fecha;
            timeCell.textContent = item.hora;
            row.appendChild(dateCell);
            row.appendChild(timeCell);
            resultsBody.appendChild(row);
        });
        document.getElementById('no-results').style.display = 'none';
    } else {
        document.getElementById('no-results').style.display = 'block';
    }
}

// Actualizar el valor del radio en el HTML
function updateRadiusValue(value) {
    document.getElementById('radius-value').textContent = value + ' m';
}

// Establecer fecha máxima en el selector de fechas
function setMaxDate() {
    const today = new Date();
    const localDate = today.toLocaleDateString('en-CA');
    document.getElementById('start-datetime').setAttribute('max', `${localDate}T23:59`);
    document.getElementById('end-datetime').setAttribute('max', `${localDate}T23:59`);
}

window.onload = function () {
    loadConfig();
    setMaxDate();
};

