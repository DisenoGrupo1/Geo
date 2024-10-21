let configData;
let map;
let marker;
let circle; // Variable global para el círculo
let autocompleteService; // Variable global para el servicio de autocompletado

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
    initAutocomplete(); // Inicializa el servicio de autocompletado
}

// Inicializa el servicio de autocompletado
function initAutocomplete() {
    autocompleteService = new google.maps.places.AutocompleteService();
}

// Función para convertir dirección en coordenadas
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

// Función para autocompletar dirección
function autocompleteAddress() {
    const input = document.getElementById('address');
    const query = input.value;

    if (query.length > 2) { // Solo buscar si el input tiene más de 2 caracteres
        autocompleteService.getPlacePredictions({ input: query }, displaySuggestions);
    } else {
        document.getElementById('suggestions').style.display = 'none'; // Ocultar sugerencias si la longitud es menor
    }
}

// Muestra las sugerencias en el contenedor
function displaySuggestions(predictions, status) {
    const suggestionsContainer = document.getElementById('suggestions');
    suggestionsContainer.innerHTML = ''; // Limpiar sugerencias anteriores

    if (status === google.maps.places.PlacesServiceStatus.OK) {
        predictions.forEach(prediction => {
            const suggestionItem = document.createElement('div');
            suggestionItem.textContent = prediction.description;
            suggestionItem.className = 'suggestion-item';
            suggestionItem.onclick = () => selectSuggestion(prediction); // Al hacer clic en una sugerencia
            suggestionsContainer.appendChild(suggestionItem);
        });
        suggestionsContainer.style.display = 'block'; // Mostrar sugerencias
    } else {
        suggestionsContainer.style.display = 'none'; // Ocultar si no hay sugerencias
    }
}

// Función para seleccionar una sugerencia
function selectSuggestion(prediction) {
    document.getElementById('address').value = prediction.description; // Completar el campo de dirección
    document.getElementById('suggestions').style.display = 'none'; // Ocultar sugerencias
}

// Función para buscar por coordenadas
function searchByCoordinates(lat, lng, radius) {
    const requestBody = {
        latitud: lat,
        longitud: lng,
        radio: radius  // Incluir el radio en el cuerpo de la solicitud
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

    // Crear círculo de búsqueda
    const radius = parseInt(document.getElementById('radius').value);

    // Si ya existe un círculo, elimínalo
    if (circle) {
        circle.setMap(null); // Eliminar el círculo anterior
    }

    // Crear un nuevo círculo
    circle = new google.maps.Circle({
        strokeColor: '#FF0000',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#FF0000',
        fillOpacity: 0.35,
        map: map,
        center: latLng,
        radius: radius // Establecer el radio
    });
}

// Función para mostrar resultados en la tabla
function displayResults(data) {
    const resultsBody = document.getElementById('results-body');
    resultsBody.innerHTML = ''; // Limpiar resultados anteriores

    if (data.length > 0) {
        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${item.fecha}</td><td>${item.hora}</td>`;
            resultsBody.appendChild(row);
        });
        document.getElementById('no-results').style.display = 'none';
    } else {
        document.getElementById('no-results').style.display = 'block'; // Mostrar mensaje si no hay resultados
    }
}

// Actualiza el valor mostrado del radio
function updateRadiusValue(value) {
    document.getElementById('radius-value').innerText = `${value} m`;
}

// Cargar la configuración al cargar la página
window.onload = loadConfig;
