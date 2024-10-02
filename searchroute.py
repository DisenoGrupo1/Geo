from flask import Flask, jsonify, request
import mysql.connector
from flask_cors import CORS
import os
from dotenv import load_dotenv

radius = 50 

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

# Ruta para obtener el historial en una ubicación específica
@app.route('/location-at-place', methods=['POST'])
def get_location_at_place():
    print("Solicitud recibida")  # Mensaje de depuración
    request_data = request.get_json()
    print("Datos recibidos:", request_data)  # Muestra los datos recibidos
    latitud = request_data['latitud']
    longitud = request_data['longitud']

    connection = None
    cursor = None

    try:
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor(dictionary=True)

        # Consulta ajustada para utilizar fecha_completa
        query = '''
            SELECT 
                DATE_FORMAT(CONCAT(fecha, ' ', hora), '%%Y-%%m-%%d %%H:%%i:%%s') AS fecha_completa, 
                latitud, 
                longitud,
                COUNT(DISTINCT id) AS cantidad
            FROM ubicaciones
            WHERE 
                (6371000 * acos(cos(radians(%s)) * cos(radians(latitud)) * 
                cos(radians(longitud) - radians(%s)) + 
                sin(radians(%s)) * sin(radians(latitud)))) <= %s
            GROUP BY fecha_completa, latitud, longitud
            ORDER BY fecha_completa ASC;
        '''

        cursor.execute(query, (latitud, longitud, latitud, radius))

        locations = cursor.fetchall()
        print("Ubicaciones encontradas:", locations)  # Mensaje de depuración
        
        if locations:
            return jsonify(locations), 200
        else:
            return jsonify({"message": "No se encontraron ubicaciones para la dirección especificada."}), 404

    except mysql.connector.Error as e:
        print("Error en la base de datos:", e)  # Mensaje de depuración
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print("Error inesperado:", e)  # Mensaje de depuración
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=50005)  # Asegúrate de que el puerto sea 50005
