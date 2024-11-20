let configData;
let map, pathPolyline;
let pathCoordinates = [];
let movingMarker; // Marcador que se moverá a lo largo de la polilínea
let currentStep = 0; // Paso actual en el recorrido
let totalSteps = 0; // Total de pasos
const iconUrl = 'http://geotaxi.ddns.net/icon/titleicon3.png'; // URL del icono
let aliasPolylines = {}; // Objeto para almacenar las polilíneas de cada alias
let aliasMarkers = {};

// Generar un color único para cada alias
function getColorForAlias(alias) {
    let hash = 0;
    for (let i = 0; i < alias.length; i++) {
        hash = (hash << 5) - hash + alias.charCodeAt(i);
        hash = hash & hash; // Asegura que el valor se mantenga en 32 bits
    }

    const colors = ['#FF0000', '#0000FF', '#00FF00', '#00FFFF', '#FF00FF', '#FFFF00', '#FFA500', '#800080', '#008000', '#000080', '#FFC0CB', '#808080', '#FFD700', '#8A2BE2', '#00CED1', '#FF6347', '#4682B4', '#DC143C', '#7FFF00', '#40E0D0'];
    const index = Math.abs(hash) % colors.length;
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
        zoom: 15,
        center: barranquilla,
        scrollwheel: true
    });

    movingMarker = new google.maps.Marker({
        map: map,
        icon: {
            url: 'http://geotaxi.ddns.net/icon/taxi.png',
            scaledSize: new google.maps.Size(20, 20)
        }
    });
}

function loadAliases() {
    fetch(`http://${configData.AWS_IP}:60000/get-aliases`, {
        method: 'GET'
    })
        .then(response => {
            if (!response.ok) throw new Error('Error en la respuesta del servidor');
            return response.json();
        })
        .then(aliases => {
            const aliasSelector = document.getElementById('alias-selector');

            if (Array.isArray(aliases)) {
                aliasSelector.innerHTML = `
                    <option value="">Seleccionar ID</option>
                    <option value="todos">Todos</option>`;

                aliases.forEach(alias => {
                    const option = document.createElement('option');
                    option.value = alias;
                    option.textContent = alias;
                    aliasSelector.appendChild(option);
                });
            } else {
                console.error("Los alias no son un arreglo válido.");
            }
        })
        .catch(error => {
            console.error("Error cargando los alias:", error);
        });
}

// Agrupa los datos por alias
function groupByAlias(data) {
    return data.reduce((acc, loc) => {
        if (!acc[loc.alias]) acc[loc.alias] = [];
        acc[loc.alias].push({
            latitud: loc.latitud,
            longitud: loc.longitud,
            fecha: loc.fecha,
            hora: loc.hora,
            velocidad: loc.velocidad,
            rpm: loc.rpm,
            combustible: loc.combustible
        });
        return acc;
    }, {});
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
            end: endDate,
            alias: alias === "todos" ? null : alias
        };

        fetch(`http://${configData.AWS_IP}:60000/location-history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        })
        .then(response => {
            if (!response.ok) throw new Error("No existen ubicaciones para la ventana de tiempo especificada");
            return response.json();
        })
        .then(data => {
            if (Array.isArray(data)) {
                clearPolylines();
                clearMarkers();

                const aliasGroups = groupByAlias(data);
                let globalBounds = new google.maps.LatLngBounds();

                for (const alias in aliasGroups) {
                    const aliasData = aliasGroups[alias];
                    drawPolylineForAlias(alias, aliasData);

                    aliasData.forEach(loc => {
                        globalBounds.extend(new google.maps.LatLng(loc.latitud, loc.longitud));
                    });
                }

                pathCoordinates = data.map(loc => ({
                    latitud: loc.latitud,
                    longitud: loc.longitud,
                    fecha: loc.fecha,
                    hora: loc.hora,
                    velocidad: loc.velocidad,
                    rpm: loc.rpm,
                    combustible: loc.combustible,
                    alias: loc.alias
                }));
                totalSteps = pathCoordinates.length;

                movingMarker.setPosition(new google.maps.LatLng(pathCoordinates[0].latitud, pathCoordinates[0].longitud));
                addMarkerClickListener();
                updateSlider();

                // Ajustar los límites del mapa para que se ajusten a las ubicaciones cargadas
                map.fitBounds(globalBounds);

                if (alias === "todos") {
                    map.fitBounds(globalBounds);
                }
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


function drawPolylineForAlias(alias, aliasData) {
    const color = getColorForAlias(alias);
    const polyline = new google.maps.Polyline({
        path: aliasData.map(loc => new google.maps.LatLng(loc.latitud, loc.longitud)),
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        map: map
    });

    aliasPolylines[alias] = polyline;

    if (aliasData.length > 0) {
        addAliasMarkers(alias, aliasData);
    }
}

function updateSlider() {
    const slider = document.getElementById('slider');
    slider.max = 100;
    slider.value = 0;
}

function setMaxDate() {
    const today = new Date();
    const localDate = today.toLocaleDateString('en-CA');
    document.getElementById('start-datetime').setAttribute('max', `${localDate}T23:59`);
    document.getElementById('end-datetime').setAttribute('max', `${localDate}T23:59`);
}

// Añadir los marcadores de inicio y fin para cada alias
function addAliasMarkers(alias, aliasData) {
    if (aliasMarkers[alias]) {
        const { startMarker, endMarker } = aliasMarkers[alias];
        if (startMarker) startMarker.setMap(null);
        if (endMarker) endMarker.setMap(null);
    }

    const startLocation = aliasData[0];
    const endLocation = aliasData[aliasData.length - 1];

    const startMarker = new google.maps.Marker({
        position: new google.maps.LatLng(startLocation.latitud, startLocation.longitud),
        map: map,
        title: `Inicio - ${alias}`,
        icon: { url: iconUrl, scaledSize: new google.maps.Size(30, 30) }
    });

    const endMarker = new google.maps.Marker({
        position: new google.maps.LatLng(endLocation.latitud, endLocation.longitud),
        map: map,
        title: `Fin - ${alias}`,
        icon: { url: iconUrl, scaledSize: new google.maps.Size(30, 30) }
    });

    aliasMarkers[alias] = { startMarker, endMarker };
}

// Función para limpiar las polilíneas
function clearPolylines() {
    for (const alias in aliasPolylines) {
        aliasPolylines[alias].setMap(null);
    }
    aliasPolylines = {};
}

// Función para limpiar los marcadores
function clearMarkers() {
    for (const alias in aliasMarkers) {
        const { startMarker, endMarker } = aliasMarkers[alias];
        if (startMarker) startMarker.setMap(null);
        if (endMarker) endMarker.setMap(null);
    }
    aliasMarkers = {};
}

// Agregar el listener de clic para el marcador de movimiento
function addMarkerClickListener() {
    google.maps.event.addListener(movingMarker, 'click', () => {
        const position = pathCoordinates[currentStep];
        showPopup(position.fecha, position.hora, position.velocidad, position.rpm, position.combustible, position.alias);
    });
}

// Función para actualizar la posición del marcador en movimiento
function updateMarkerPosition(value) {
    if (totalSteps === 0) return;

    currentStep = Math.floor((value / 100) * (totalSteps - 1));

    const position = pathCoordinates[currentStep];
    movingMarker.setPosition(new google.maps.LatLng(position.latitud, position.longitud));

    const aliasSelector = document.getElementById('alias-selector');
    if (aliasSelector.value !== "todos") {
        map.setCenter(movingMarker.getPosition());
    }

    const alias = position.alias || "Desconocido";
    showPopup(position.fecha, position.hora, position.velocidad, position.rpm, position.combustible, alias);
}

// Muestra un popup con los datos de la ubicación
function showPopup(fecha, hora, velocidad, rpm, combustible, alias) {
    const popup = document.getElementById("popup");
    popup.innerHTML = `
        <p>Alias: ${alias}</p>
        <p>Fecha: ${fecha}</p>
        <p>Hora: ${hora}</p>
        <p>Velocidad: ${velocidad} km/h</p>
        <p>RPM: ${rpm}</p>
        <p>Combustible: ${combustible}%</p>
    `;
    popup.style.display = "block";
}

// Ocultar el popup
function hidePopup() {
    const popup = document.getElementById("popup");
    popup.style.display = "none";
}

// Iniciar configuración y carga de alias
loadConfig().then(() => {
    setMaxDate();
    loadAliases();
});
document.getElementById('alias-selector').addEventListener('change', function () {
    loadHistory();  // Llamamos a loadHistory cada vez que cambia el alias
});