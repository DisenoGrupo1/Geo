from flask import Flask, request, jsonify
import mysql.connector

app = Flask(__name__)

# Conexión a la base de datos
def get_db_connection():
    return mysql.connector.connect(
        host='tu_host',
        user='tu_usuario',
        password='tu_contraseña',
        database='dbbuscataxi'
    )

@app.route('/dates-at-location', methods=['POST'])
def get_dates_at_location():
    data = request.json
    direccion = data.get('direccion')

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT DISTINCT fecha, hora FROM ubicaciones WHERE direccion LIKE %s", (direccion,))
    dates = cursor.fetchall()

    cursor.close()
    conn.close()

    return jsonify(dates)

@app.route('/trace-route', methods=['POST'])
def trace_route():
    data = request.json
    fecha = data.get('fecha')
    hora = data.get('hora')

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT latitud, longitud FROM ubicaciones WHERE fecha = %s AND hora = %s", (fecha, hora))
    locations = cursor.fetchall()

    cursor.close()
    conn.close()

    return jsonify(locations)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=50005)
