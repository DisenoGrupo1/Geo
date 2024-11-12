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
        zoom: 15, // Aumentamos el nivel de zoom
        center: barranquilla,
        scrollwheel: true
    });

    // Inicializa el marcador que se moverá
    movingMarker = new google.maps.Marker({
        map: map,
        icon: {
            url: 'http://geotaxi.ddns.net/icon/taxi.png', // Cambiar a este icono
            scaledSize: new google.maps.Size(20, 20) // Tamaño del icono (20x20)
        }
    });
}

// Función para cargar los alias
function loadAliases() {
    fetch(`http://${configData.AWS_IP}:60000/get-aliases`, {
        method: 'GET'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }
            return response.json();
        })
        .then(aliases => {
            const aliasSelector = document.getElementById('alias-selector');

            if (Array.isArray(aliases)) {
                aliasSelector.innerHTML = `
                    <option value="">Seleccionar ID</option>
                    <option value="todos">Todos</option>`; // Añadir opción "todos"

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
        if (!acc[loc.alias]) {
            acc[loc.alias] = [];
        }
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
            alias: alias === "todos" ? null : alias  // Si es "todos", envía alias como null
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
                    clearPolylines(); // Limpiar polilíneas anteriores
                    clearMarkers(); // Limpiar marcadores anteriores

                    const aliasGroups = groupByAlias(data);
                    let globalBounds = new google.maps.LatLngBounds(); // Crear un objeto LatLngBounds para todo el historial
                    for (const alias in aliasGroups) {
                        const aliasData = aliasGroups[alias];
                        drawPolylineForAlias(alias, aliasData);

                        // Actualizar los límites globales con las ubicaciones de este alias
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
                    map.setCenter(movingMarker.getPosition());

                    addMarkerClickListener();
                    updateSlider();
                    const alias = pathCoordinates[0].alias || "Desconocido"; // Si no hay alias, muestra 'Desconocido'
                    showPopup(pathCoordinates[0].fecha, pathCoordinates[0].hora,
                        pathCoordinates[0].velocidad, pathCoordinates[0].rpm,
                        pathCoordinates[0].combustible, alias);

                    // Ajustar el mapa para mostrar todas las ubicaciones
                    map.fitBounds(globalBounds); // Ajustar la vista para todo el trazado
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
// Función para dibujar una polilínea para un alias
function drawPolylineForAlias(alias, aliasData) {
    const color = getColorForAlias(alias);

    const polyline = new google.maps.Polyline({
        path: aliasData.map(loc => new google.maps.LatLng(loc.latitud, loc.longitud)),
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        map: map
    });

    aliasPolylines[alias] = polyline; // Guardar la polilínea para cada alias

    if (aliasData.length > 0) {
        addAliasMarkers(alias, aliasData);
    }
}
function updateSlider() {
    const slider = document.getElementById('slider');
    slider.max = 100; // Mantenemos el máximo en 100
    slider.value = 0; // Reiniciamos el valor del slider
}

function setMaxDate() {
    const today = new Date();
    const localDate = today.toLocaleDateString('en-CA');
    document.getElementById('start-datetime').setAttribute('max', `${localDate}T23:59`);
    document.getElementById('end-datetime').setAttribute('max', `${localDate}T23:59`);
}
// Añadir los marcadores de inicio y fin para cada alias
function addAliasMarkers(alias, aliasData) {
    // Verificar si ya existen los marcadores para este alias, si es así, eliminarlos
    if (aliasMarkers[alias]) {
        const { startMarker, endMarker } = aliasMarkers[alias];
        if (startMarker) startMarker.setMap(null);
        if (endMarker) endMarker.setMap(null);
    }

    const startLocation = aliasData[0];
    const endLocation = aliasData[aliasData.length - 1];

    // Crear marcador de inicio
    const startMarker = new google.maps.Marker({
        position: new google.maps.LatLng(startLocation.latitud, startLocation.longitud),
        map: map,
        title: `Inicio - ${alias}`,
        icon: {
            url: iconUrl,
            scaledSize: new google.maps.Size(30, 30)
        }
    });

    // Crear marcador de fin
    const endMarker = new google.maps.Marker({
        position: new google.maps.LatLng(endLocation.latitud, endLocation.longitud),
        map: map,
        title: `Fin - ${alias}`,
        icon: {
            url: iconUrl,
            scaledSize: new google.maps.Size(30, 30)
        }
    });

    // Guardar los marcadores en aliasMarkers
    aliasMarkers[alias] = { startMarker, endMarker };
}
// Función para limpiar las polilíneas
function clearPolylines() {
    for (const alias in aliasPolylines) {
        aliasPolylines[alias].setMap(null); // Elimina la polilínea del mapa
    }
    aliasPolylines = {};  // Resetea el objeto que contiene las polilíneas
}

// Función para limpiar los marcadores
function clearMarkers() {
    // Eliminar marcadores existentes
    for (const alias in aliasMarkers) {
        const { startMarker, endMarker } = aliasMarkers[alias];
        if (startMarker) startMarker.setMap(null); // Elimina el marcador de inicio
        if (endMarker) endMarker.setMap(null); // Elimina el marcador de fin
    }
    aliasMarkers = {};  // Resetea el objeto que contiene los marcadores
}


// Agregar el listener de clic en el marcador
function addMarkerClickListener() {
    google.maps.event.addListener(movingMarker, 'click', function () {
        const position = pathCoordinates[currentStep];
        const alias = position.alias || "Desconocido"; // Obtener el alias actual
        showPopup(position.fecha, position.hora, position.velocidad, position.rpm, position.combustible, alias);
    });
}
// Muestra el popup con la fecha y hora
function showPopup(fecha, hora, velocidad, rpm, combustible, alias) {
    const popup = document.getElementById('popup');
    const popupDateTime = document.getElementById('popup-date-time');
    const popupSpeed = document.getElementById('popup-speed');
    const popupRPM = document.getElementById('popup-rpm');
    const popupFuel = document.getElementById('popup-fuel');
    const popupAlias = document.getElementById('popup-alias'); // Nuevo elemento para el alias

    // Actualiza los contenidos del popup
    popupDateTime.innerText = `Fecha: ${fecha} \nHora: ${hora}`;
    popupSpeed.innerText = `Velocidad: ${velocidad} km/h`; // Añadir velocidad
    popupRPM.innerText = `RPM: ${rpm}`; // Añadir RPM
    popupFuel.innerText = `Combustible: ${combustible} %`; // Añadir combustible
    popupAlias.innerText = `Alias: ${alias}`; // Mostrar el alias

    // Muestra el popup
    popup.style.display = 'block';
}
function updateMarkerPosition(value) {
    if (totalSteps === 0) return;

    // Convertimos el valor del slider en un índice que no supere el total de ubicaciones
    currentStep = Math.floor((value / 100) * (totalSteps - 1));

    const position = pathCoordinates[currentStep];
    movingMarker.setPosition(new google.maps.LatLng(position.latitud, position.longitud));
    map.setZoom(15); // Establecer el nivel de zoom en 20

    // Centrar el mapa en la nueva posición del marcador
    map.setCenter(movingMarker.getPosition()); 
    map.setZoom(15);
    // Suponiendo que el alias está disponible en los datos de la ubicación, 
    // puedes pasar el alias en el siguiente parámetro
    const alias = position.alias || "Desconocido"; // Usar el alias de la posición, si existe

    showPopup(position.fecha, position.hora, position.velocidad, position.rpm, position.combustible, alias);
}
function closePopup() {
    document.getElementById('popup').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function () {
    loadConfig().then(() => {
        setMaxDate();
        loadAliases(); // Solo se llama después de que loadConfig termine
    });
});
//document.getElementById('alias-selector').addEventListener('change', function () {
    //loadHistory();  // Llamamos a loadHistory cada vez que cambia el alias
//});