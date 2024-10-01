from flask import Flask, render_template, request
import mysql.connector

app = Flask(__name__)

# Configura la conexión a la base de datos
db = mysql.connector.connect(
    host='localhost',
    user='tu_usuario',
    password='tu_contraseña',
    database='tu_base_de_datos'
)

@app.route('/', methods=['GET', 'POST'])
def index():
    dates = []
    address = ""

    if request.method == 'POST':
        address = request.form['address']
        
        # Aquí debes convertir la dirección en latitud y longitud (puedes usar geopy o una API)
        latitude, longitude = get_lat_long(address)

        cursor = db.cursor()
        query = "SELECT fecha_hora FROM tu_tabla WHERE latitud = %s AND longitud = %s"
        cursor.execute(query, (latitude, longitude))
        results = cursor.fetchall()

        dates = [result[0] for result in results]
        cursor.close()

    return render_template('searchroute.html', dates=dates, address=address)

def get_lat_long(address):
    # Aquí va tu lógica para obtener latitud y longitud
    return 10.0, -74.0  # Ejemplo: debes reemplazar esto con la lógica real

if __name__ == '__main__':
    app.run(debug=True)
