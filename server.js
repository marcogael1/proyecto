const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Asegúrate de reemplazar esta URI con tu conexión real a la base de datos
const MONGODB_URI = 'mongodb+srv://marco:marco@cluster0.7b1khsh.mongodb.net/cajaInteligente?retryWrites=true&w=majority&appName=Cluster0';
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
  console.log(`Intentando iniciar sesión con usuario: ${nombre_usuario} y contraseña: ${contraseña}`);

  Usuario.findOne({ nombre_usuario: nombre_usuario, contraseña: contraseña })
    .then(usuario => {
      if (!usuario) {
        console.log("No se encontró el usuario o la contraseña es incorrecta.");
        return res.status(404).json({ message: "Usuario no encontrado o contraseña incorrecta" });
      }
    })
    .catch(error => {
      console.error("Error al buscar el usuario:", error);
      res.status(500).json({ message: "Error al buscar el usuario", error });
    });
});


// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
