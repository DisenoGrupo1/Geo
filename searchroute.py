from flask import Flask, jsonify, request
import mysql.connector
from flask_cors import CORS
import os
from dotenv import load_dotenv
from datetime import datetime

# Cargar las variables de entorno
load_dotenv()

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
    data = request.get_json()
    lat = data.get('latitud')
    lng = data.get('longitud')

    if lat is None or lng is None:
        return jsonify({'error': 'Latitud y longitud son requeridas'}), 400

    radius = 40  # Radio en metros

    # Conectar a la base de datos
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        sql = """
            SELECT
                fecha, hora, latitud, longitud
            FROM
                ubicaciones
            WHERE
                (6371000 * acos(cos(radians(%s)) * cos(radians(latitud)) *
                cos(radians(longitud) - radians(%s)) +
                sin(radians(%s)) * sin(radians(latitud)))) <= %s
            ORDER BY fecha ASC, hora ASC
        """

        cursor.execute(sql, (lat, lng, lat, radius))
        locations = cursor.fetchall()
        print(f"Resultados de la consulta: {locations}")

        if not locations:
            return jsonify({'message': 'No se encontraron ubicaciones cercanas.'}), 404

        # Devolver los resultados en formato JSON
        location_list = []
        for row in locations:
            # Asegúrate de que `fecha` y `hora` son manejados correctamente
            fecha_str = row[0].strftime('%Y-%m-%d') if isinstance(row[0], datetime) else str(row[0])
            hora_str = row[1].strftime('%H:%M:%S') if isinstance(row[1], datetime) else str(row[1])
            location_list.append({
                'fecha': fecha_str,
                'hora': hora_str,
                'latitud': row[2],
                'longitud': row[3]
            })

        return jsonify(location_list)

    except mysql.connector.Error as e:
        return jsonify({'error': 'Error de conexión a la base de datos: ' + str(e)}), 500

    finally:
        if conn:
            cursor.close()
            conn.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=50005)
