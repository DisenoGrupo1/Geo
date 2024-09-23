from flask import Flask, jsonify
import mysql.connector
from datetime import datetime
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/last_location": {"origins": "*"}})

# Configuración de la base de datos
db_config = {
    'host': 'ENDPOINT',  # Cambia por tu host de MySQL
    'user': 'USER',  # Cambia por tu usuario de MySQL
    'password': 'PASSWORD',  # Cambia por tu contraseña de MySQL
    'database': 'DATABASE_NAME'  # Cambia por tu nombre de base de datos
}

# Ruta para obtener la última ubicación
@app.route('/last_location', methods=['GET'])
def get_last_location():
    try:
        # Crear una nueva conexión para esta solicitud
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor(dictionary=True)

        # Ejecutar la consulta para obtener la última ubicación
        cursor.execute('''SELECT latitud, longitud, fecha, hora
                          FROM ubicaciones
                          ORDER BY fecha DESC, hora DESC
                          LIMIT 1''')

        last_location = cursor.fetchone()

        if last_location:
            last_location['fecha'] = last_location['fecha'].strftime('%Y-%m-%d')  # Formato de fecha
            # Asegurarse de que 'hora' sea un objeto datetime
            if isinstance(last_location['hora'], datetime):
                last_location['hora'] = last_location['hora'].strftime('%H:%M:%S')  # Formato de hora
            else:
                last_location['hora'] = str(last_location['hora'])  # Convertir a cadena si es timedelta
            return jsonify(last_location), 200
        else:
            return jsonify({"message": "No location found"}), 404
    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        # Cerrar el cursor y la conexión
        cursor.close()
        connection.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=50000)  # Ejecuta el servidor en el puerto 50000