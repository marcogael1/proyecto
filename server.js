const express = require('express');
const mongoose = require('mongoose');
const app = express();
const cors = require('cors');
const PORT = process.env.PORT || 3000;
const nodemailer = require('nodemailer');
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'ironsafe3@gmail.com',
        pass: 'hujl dnfy inqk vuui'
    }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  Usuario.findOne({ nombre_usuario: nombre_usuario, contraseña: contraseña })
    .then(usuario => {
      if (!usuario) {
        return res.status(404).json({ message: "Usuario no encontrado o contraseña incorrecta" });
      }
      // Incluir el tipo de usuario en la respuesta
      res.json({ message: "Usuario encontrado", tipo: usuario.tipo }); 
    })
    .catch(error => {
      console.error("Error al buscar el usuario:", error);
      res.status(500).json({ message: "Error al buscar el usuario", error });
    });
});


// Esquema para los datos de device_historic
const datosHistoricosSchema = new mongoose.Schema({
  sensor: String,
  dato: String,
  fecha: { type: Date, default: Date.now }
});

// Modelo para los datos de device_historic
const DatosHistoricos = mongoose.model('device_historic', datosHistoricosSchema);

// Ruta para enviar datos a device_historic
app.post('/datos', (req, res) => {
  const { sensor, dato } = req.body;
  const nuevosDatos = new DatosHistoricos({
    sensor: sensor,
    dato: dato
  });
  nuevosDatos.save()
    .then(() => res.status(200).send('Datos guardados correctamente en device_historic'))
    .catch(error => res.status(500).send('Error al guardar los datos en device_historic: ' + error));
});

const deviceStateSchema = new mongoose.Schema({
  sensor: String,
  dato: String,
  fecha: { type: Date, default: Date.now }
});

const DeviceState = mongoose.model('device_state', deviceStateSchema);

app.post('/actualizarEstado', (req, res) => {
  const { sensor, dato } = req.body;

  DeviceState.findOneAndUpdate(
    { sensor: sensor },
    { 
      sensor: sensor,
      dato: dato,
      fecha: new Date()
    },
    {
      new: true, 
      upsert: true 
    }
  )
  .then(estadoActualizado => res.status(200).json(estadoActualizado))
  .catch(error => res.status(500).json({ message: "Error al actualizar el estado del dispositivo", error }));
});

// Ruta para enviar correo electrónico
app.post('/send-email', (req, res) => {
  const { nombre, email, asunto, mensaje } = req.body;

  const mailOptions = {
      from: 'ironsafe3@gmail.com', // Remitente
      to: 'ironsafe3@gmail.com', // Tu correo de empresa
      subject: asunto,
      html: `<p>Nombre: ${nombre}</p>
      <p>Email: ${email}</p><p>Mensaje: ${mensaje}</p>`, // HTML body
  };

  transporter.sendMail(mailOptions, function(error, info){
      if (error) {
          console.log(error);
          res.status(500).send('Error al enviar el correo');
      } else {
          console.log('Email enviado: ' + info.response);
          res.status(200).send('Correo enviado con éxito');
      }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});