from flask import Flask, jsonify, request
import mysql.connector
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/location-at-place": {"origins": "*"}})

# Configuración de la base de datos
db_config = {
    'host': os.getenv('DB_HOST'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME')
}

# Ruta para obtener el historial en una ubicación específica (latitud/longitud)
@app.route('/location-at-place', methods=['POST'])
def get_location_at_place():
    request_data = request.get_json()
    latitud = request_data['latitud']
    longitud = request_data['longitud']

    connection = None
    cursor = None

    try:
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor(dictionary=True)

        # Consulta para buscar ubicaciones cercanas
        query = '''SELECT latitud, longitud
                   FROM ubicaciones
                   WHERE ABS(latitud - %s) < 0.01 AND ABS(longitud - %s) < 0.01'''
        cursor.execute(query, (latitud, longitud))

        locations = cursor.fetchall()

        if locations:
            return jsonify(locations), 200
        else:
            return jsonify({"message": "No se encontraron ubicaciones para la dirección especificada."}), 404

    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=50005)  # Puerto para la API de búsqueda por ubicación
