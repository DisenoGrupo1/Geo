from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from geopy.geocoders import Nominatim

app = Flask(__name__)
CORS(app)

# Configura el geolocalizador
geolocator = Nominatim(user_agent="myGeocoder")

def get_lat_long(address):
    location = geolocator.geocode(address)
    if location:
        return (location.latitude, location.longitude)
    return None

@app.route('/dates-at-location', methods=['OPTIONS', 'POST'])
def get_dates_at_location():
    if request.method == 'OPTIONS':
        return '', 200  # Responder a la solicitud OPTIONS

    data = request.json
    address = data.get('address')

    # Convierte la dirección a latitud y longitud
    lat_long = get_lat_long(address)
    if not lat_long:
        return jsonify({"error": "Dirección no encontrada"}), 404

    latitude, longitude = lat_long

    # Conectar a la base de datos y buscar las fechas/horas
    connection = mysql.connector.connect(
        host='tu_host',
        user='tu_usuario',
        password='tu_contraseña',
        database='tu_base_de_datos'
    )
    cursor = connection.cursor(dictionary=True)

    # Consulta para encontrar fechas/horas cercanas a la latitud y longitud
    query = """
    SELECT fecha_hora FROM tu_tabla 
    WHERE ABS(latitud - %s) < 0.01 AND ABS(longitud - %s) < 0.01
    """
    cursor.execute(query, (latitude, longitude))
    results = cursor.fetchall()

    cursor.close()
    connection.close()

    return jsonify(results)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=50005)
