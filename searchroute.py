from flask import Flask, jsonify, request
import mysql.connector
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Cargar variables de entorno desde el archivo .env
load_dotenv()

# Inicializar la aplicación Flask
app = Flask(__name__)

# Habilitar CORS para la ruta '/location-at-place'
CORS(app, resources={r"/location-at-place": {"origins": "*"}})

# Configuración de la base de datos, utilizando variables de entorno
db_config = {
    'host': os.getenv('DB_HOST'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME')
}

# Ruta para obtener el historial de ubicaciones en una ubicación específica
@app.route('/location-at-place', methods=['POST'])
def get_location_at_place():
    # Depuración: Confirmar que la solicitud fue recibida
    print("Solicitud recibida")
    
    # Obtener los datos JSON enviados en la solicitud
    request_data = request.get_json()
    print("Datos recibidos:", request_data)  # Depuración: Mostrar datos recibidos
    
    # Extraer latitud y longitud de los datos
    latitud = request_data['latitud']
    longitud = request_data['longitud']

    connection = None
    cursor = None

    try:
        # Conectar a la base de datos utilizando la configuración especificada
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor(dictionary=True)

        # Consulta SQL para buscar ubicaciones cercanas a los valores de latitud y longitud proporcionados
        query = '''
        SELECT latitud, longitud
        FROM ubicaciones
        WHERE ABS(latitud - %s) < 0.01 AND ABS(longitud - %s) < 0.01
        '''
        cursor.execute(query, (latitud, longitud))

        # Obtener los resultados de la consulta
        locations = cursor.fetchall()
        #print("Ubicaciones encontradas:", locations)  # Depuración: Mostrar ubicaciones encontradas

        # Si se encuentran ubicaciones, devolverlas como respuesta JSON
        if locations:
            return jsonify(locations), 200
        else:
            # Si no se encuentran ubicaciones, devolver un mensaje con código 404
            return jsonify({"message": "No se encontraron ubicaciones para la dirección especificada."}), 404

    except mysql.connector.Error as e:
        # Depuración: Manejar errores de base de datos
        print("Error en la base de datos:", e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        # Depuración: Manejar cualquier otro error
        print("Error inesperado:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        # Cerrar el cursor y la conexión a la base de datos
        if cursor:
            cursor.close()
        if connection:
            connection.close()

# Iniciar la aplicación Flask en el puerto 50005
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=50005)
