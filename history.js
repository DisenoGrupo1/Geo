let configData;

function loadConfig() {
    return fetch('config.json')
        .then(response => response.json())
        .then(config => {
            configData = config;
            document.getElementById('page-title').innerText = configData.TITLE;

            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${configData.apiKey}&callback=initMap`;
            script.defer = true;
            document.head.appendChild(script);
        })
        .catch(error => console.error("Error al cargar config.json:", error));
}

let map, pathPolyline;
let pathCoordinates = [];
let startMarker; 
let endMarker;

function initMap() {
    const barranquilla = { lat: 10.9878, lng: -74.7889 };
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        center: barranquilla
    });

    pathPolyline = new google.maps.Polyline({
        path: pathCoordinates,
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: map
    });
}

function updatePolyline() {
    pathPolyline.setPath(pathCoordinates.map(coord => new google.maps.LatLng(coord.latitud, coord.longitud)));
    if (pathCoordinates.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        pathCoordinates.forEach(coord => bounds.extend(new google.maps.LatLng(coord.latitud, coord.longitud)));
        map.fitBounds(bounds);
        addStartMarker(); 
        addEndMarker();
    }
}

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
    bounceMarker(startMarker); // Inicia la animación de rebote
}

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
    bounceMarker(endMarker); // Inicia la animación de rebote
}

function bounceMarker(marker) {
    let bounceCount = 0; // Contador de rebotes
    const interval = setInterval(() => {
        if (bounceCount < 10) {
            marker.setAnimation(google.maps.Animation.BOUNCE);
            bounceCount++;
            setTimeout(() => marker.setAnimation(null), 500); // Detener el rebote después de 500ms
        } else {
            clearInterval(interval); // Detener el intervalo después de 10 rebotes
            marker.setAnimation(null); // Asegurarse de que la animación esté detenida
        }
    }, 1000); 
}

function loadHistory() {
    const startDate = document.getElementById('start-datetime').value;
    const endDate = document.getElementById('end-datetime').value;

    if (startDate && endDate) {
        const startDateTime = new Date(startDate);
        const endDateTime = new Date(endDate);

        if (endDateTime <= startDateTime) {
            alert("La fecha y hora final debe ser posterior a la fecha y hora de inicial.");
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

function setMaxDate() {
    const today = new Date();
    const localDate = today.toLocaleDateString('en-CA'); 
    document.getElementById('start-datetime').setAttribute('max', `${localDate}T23:59`);
    document.getElementById('end-datetime').setAttribute('max', `${localDate}T23:59`);
}

loadConfig();
setMaxDate();
