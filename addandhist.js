let configData;
let map, pathPolyline;
let pathCoordinates = [];
let startMarker;
let endMarker;
let marker;
let circle; // Variable global para el círculo

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

// Inicializa el mapa y la funcionalidad de Autocomplete
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

// Función para geocodificar una dirección ingresada manualmente
function geocodeAddress() {
    const address = document.getElementById('address').value;
    if (!address) {
        alert("Por favor, ingrese una dirección.");
        return;
    }

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ 'address': address }, function (results, status) {
        if (status === 'OK') {
            const location = results[0].geometry.location;
            searchByCoordinates(location.lat(), location.lng(), document.getElementById('radius').value);
            centerMapOnLocation(location);
        } else {
            alert('No se pudo encontrar la dirección: ' + status);
        }
    });
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

// Función para buscar ubicaciones por coordenadas
function searchByCoordinates(lat, lng, radius) {
    const requestBody = {
        latitud: lat,
        longitud: lng,
        radio: radius
    };
    console.log("Latitud:", lat, "Longitud:", lng, "Radio:", radius);

    fetch(`http://${configData.AWS_IP}:60000/search`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })
        .then(response => response.json())
        .then(data => {
            updateResults(data);
        })
        .catch(error => console.error("Error buscando ubicaciones:", error));
}

// Actualiza la tabla de resultados
function updateResults(data) {
    const resultsBody = document.getElementById('results-body');
    resultsBody.innerHTML = ''; // Limpiar resultados anteriores

    if (data && data.length > 0) {
        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${item.fecha}</td><td>${item.hora}</td>`;
            resultsBody.appendChild(row);
        });
        document.getElementById('no-results').style.display = 'none';
    } else {
        document.getElementById('no-results').style.display = 'block';
    }
}

// Centrar el mapa en la ubicación proporcionada
function centerMapOnLocation(location) {
    map.setCenter(location);
    if (marker) {
        marker.setMap(null);
    }
    marker = new google.maps.Marker({
        position: location,
        map: map,
        title: 'Ubicación seleccionada'
    });
    if (circle) {
        circle.setMap(null); // Elimina el círculo anterior
    }
    circle = new google.maps.Circle({
        strokeColor: '#FF0000',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#FF0000',
        fillOpacity: 0.35,
        map: map,
        center: location,
        radius: parseFloat(document.getElementById('radius').value) // Usar el valor del radio
    });
}

// Actualiza el valor del radio mostrado
function updateRadiusValue(value) {
    document.getElementById('radius-value').innerText = `${value} m`;
}

// Cargar la configuración al inicio
loadConfig();
