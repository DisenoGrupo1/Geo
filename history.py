from flask import Flask, jsonify, request
import mysql.connector
from datetime import datetime, time
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/location-history": {"origins": "*"}, r"/location-route": {"origins": "*"}})

# Configuración de la base de datos
db_config = {
    'host': 'ENDPOINT',  # Cambia esto por tu endpoint
    'user': 'USER',      # Cambia esto por tu usuario
    'password': 'PASSWORD',  # Cambia esto por tu contraseña
    'database': 'DATABASE'  # Cambia esto por tu base de datos
}

# Ruta para obtener el historial de ubicaciones
@app.route('/location-history', methods=['POST'])
def get_location_history():
    request_data = request.get_json()
    start_date = request_data.get('start_date')
    end_date = request_data.get('end_date')
    start_time = request_data.get('start_time')
    end_time = request_data.get('end_time')
    address = request_data.get('address')

    # Inicializa las variables para evitar errores en el bloque 'finally'
    connection = None
    cursor = None

    try:
        # Si se ingresó solo la dirección
        if address and not start_date and not end_date and not start_time and not end_time:
            connection = mysql.connector.connect(**db_config)
            cursor = connection.cursor(dictionary=True)

            # Consulta para obtener las fechas y horas en las que el vehículo pasó por la dirección
            query = '''SELECT DISTINCT fecha, hora
                       FROM ubicaciones
                       WHERE direccion = %s'''
            cursor.execute(query, (address,))
            locations = cursor.fetchall()

            for loc in locations:
                loc['fecha'] = loc['fecha'].strftime('%Y-%m-%d')  # Formato de fecha
                if isinstance(loc['hora'], time):
                    loc['hora'] = loc['hora'].strftime('%H:%M:%S')  # Formato de hora

            return jsonify(locations), 200

        # Combina fecha y hora en un solo datetime
        start_datetime = datetime.strptime(f"{start_date} {start_time}", '%Y-%m-%d %H:%M')
        end_datetime = datetime.strptime(f"{end_date} {end_time}", '%Y-%m-%d %H:%M')

        # Validación: si la fecha de finalización es anterior a la fecha de inicio
        if end_datetime < start_datetime:
            return jsonify({"error": "La fecha y hora de finalización no puede ser anterior a la fecha y hora de inicio"}), 400

        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor(dictionary=True)

        # Modificación de la consulta SQL para manejar fecha y hora por separado
        query = '''SELECT latitud, longitud, fecha, hora
                   FROM ubicaciones
                   WHERE (fecha > %s OR (fecha = %s AND hora >= %s)) AND
                         (fecha < %s OR (fecha = %s AND hora <= %s))'''
        cursor.execute(query, (start_datetime.date(), start_datetime.date(), start_datetime.time(),
                               end_datetime.date(), end_datetime.date(), end_datetime.time()))

        locations = cursor.fetchall()

        for loc in locations:
            loc['fecha'] = loc['fecha'].strftime('%Y-%m-%d')  # Formato de fecha
            if isinstance(loc['hora'], time):
                loc['hora'] = loc['hora'].strftime('%H:%M:%S')  # Formato de hora

        if locations:
            return jsonify(locations), 200
        else:
            return jsonify({"message": "No se encontraron ubicaciones para el rango especificado"}), 404

    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        # Verifica que el cursor y la conexión existan antes de cerrarlos
        if cursor:
            cursor.close()
        if connection:
            connection.close()

# Ruta para obtener el recorrido por fecha
@app.route('/location-route', methods=['GET'])
def get_location_route():
    date = request.args.get('date')  # Obtener la fecha de los parámetros de consulta

    if not date:
        return jsonify({"error": "La fecha es necesaria."}), 400

    # Inicializa las variables para evitar errores en el bloque 'finally'
    connection = None
    cursor = None

    try:
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor(dictionary=True)

        # Consulta para obtener el recorrido en la fecha específica
        query = '''SELECT latitud, longitud, fecha, hora
                   FROM ubicaciones
                   WHERE DATE(fecha) = %s'''  # Asegúrate de que 'fecha' sea el nombre de la columna
        cursor.execute(query, (date,))

        locations = cursor.fetchall()

        for loc in locations:
            loc['fecha'] = loc['fecha'].strftime('%Y-%m-%d')  # Formato de fecha
            if isinstance(loc['hora'], time):
                loc['hora'] = loc['hora'].strftime('%H:%M:%S')  # Formato de hora

        if locations:
            return jsonify(locations), 200
        else:
            return jsonify({"message": "No se encontraron ubicaciones para la fecha especificada."}), 404

    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        # Verifica que el cursor y la conexión existan antes de cerrarlos
        if cursor:
            cursor.close()
        if connection:
            connection.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=60000)
