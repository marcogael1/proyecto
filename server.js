const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Asegúrate de reemplazar esta URI con tu conexión real a la base de datos
const MONGODB_URI = 'tu_mongodb_uri_aquí';
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Conectado a MongoDB Atlas'))
  .catch((error) => console.error('No se pudo conectar a MongoDB Atlas:', error));

const usuarioSchema = new mongoose.Schema({
  nombre: String,
  paterno: String,
  materno: String,
  correo: String,
  contraseña: String,
  telefono: String,
  nombre_usuario: String,
  direccion: {
    calle: String,
    numero_casa: String,
    colonia: String,
    codigo_postal: String,
    municipio: String,
    pais: String
  },
  dispositivo: [
    {
      mac: String,
      modelo: String,
      fecha_compra: Date
    }
  ]
});

const Usuario = mongoose.model('Usuario', usuarioSchema);

// Rutas
app.get('/', (req, res) => {
  res.send('Servidor Express corriendo correctamente!');
});

app.get('/usuarios', (req, res) => {
  Usuario.find({})
    .then(usuarios => res.json(usuarios))
    .catch(error => res.status(500).json({ message: "Error al obtener los usuarios", error }));
});

// Ruta de login
app.post('/login', (req, res) => {
  const { nombre_usuario, contraseña } = req.body;

  Usuario.findOne({ nombre_usuario, contraseña })
    .then(usuario => {
      if (!usuario) {
        return res.status(404).json({ message: "Usuario no encontrado o contraseña incorrecta" });
      }
      // Por razones de seguridad, es mejor no enviar la contraseña
      const usuarioSinContraseña = { ...usuario._doc, contraseña: undefined };
      res.json(usuarioSinContraseña);
    })
    .catch(error => res.status(500).json({ message: "Error al buscar el usuario", error }));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
