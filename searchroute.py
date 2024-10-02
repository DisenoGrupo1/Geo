from flask import Flask, jsonify, request
import mysql.connector
from flask_cors import CORS
import os
from dotenv import load_dotenv
from datetime import datetime
import logging

# Cargar las variables de entorno
load_dotenv()

# Configurar el registro de logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuración de la base de datos
db_config = {
    'host': os.getenv('DB_HOST'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME')
}

@app.route('/location-at-place', methods=['POST'])
def location_at_place():
    logger.debug("Inicio de la función location_at_place")
    data = request.get_json()
    lat = data.get('latitud')
    lng = data.get('longitud')

    logger.debug(f"Recibidos: latitud={lat}, longitud={lng}")

    if lat is None or lng is None:
        logger.error("Latitud y longitud son requeridas")
        return jsonify({'error': 'Latitud y longitud son requeridas'}), 400

    radius = 100  # Radio en metros

    # Conectar a la base de datos
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        logger.debug("Conexión a la base de datos exitosa")

        sql = """
            SELECT
                fecha, hora, latitud, longitud
            FROM
                ubicaciones
            WHERE
                (6371000 * acos(cos(radians(%s)) * cos(radians(CAST(latitud AS CHAR))) *
                cos(radians(CAST(longitud AS CHAR)) - radians(%s)) +
                sin(radians(%s)) * sin(radians(CAST(latitud AS CHAR))))) <= %s
            ORDER BY fecha ASC, hora ASC
        """

        cursor.execute(sql, (lat, lng, lat, radius))
        locations = cursor.fetchall()
        logger.debug(f"Resultados de la consulta: {locations}")

        if not locations:
            logger.warning("No se encontraron ubicaciones cercanas.")
            return jsonify({'message': 'No se encontraron ubicaciones cercanas.'}), 404

        # Devolver los resultados en formato JSON
        location_list = []
        for row in locations:
            fecha_str = row[0].strftime('%Y-%m-%d') if isinstance(row[0], datetime) else str(row[0])
            hora_str = row[1].strftime('%H:%M:%S') if isinstance(row[1], datetime) else str(row[1])
            location_list.append({
                'fecha': fecha_str,
                'hora': hora_str,
                'latitud': row[2],
                'longitud': row[3]
            })

        logger.debug(f"Ubicaciones encontradas: {location_list}")
        return jsonify(location_list)

    except mysql.connector.Error as e:
        logger.error(f"Error de conexión a la base de datos: {e}")
        return jsonify({'error': 'Error de conexión a la base de datos: ' + str(e)}), 500

    finally:
        if conn:
            cursor.close()
            conn.close()
            logger.debug("Conexión a la base de datos cerrada")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=50005)
