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

let codigosTemporales = {}; 
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
      fecha_compra: Date,
      pin: String
    }
  ],
  tipo: String
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

app.get('/', (req, res) => {
  res.send('Servidor Express corriendo correctamente!');
});

app.get('/usuarios', (req, res) => {
  Usuario.find({})
    .then(usuarios => res.json(usuarios))
    .catch(error => res.status(500).json({ message: "Error al obtener los usuarios", error }));
});

app.post('/login', (req, res) => {
  const { nombre_usuario, contraseña } = req.body;
  
  Usuario.findOne({ nombre_usuario: nombre_usuario, contraseña: contraseña })
    .then(usuario => {
      if (!usuario) {
        return res.status(404).json({ message: "Usuario no encontrado o contraseña incorrecta" });
      }
      
      res.json({
        message: "Usuario encontrado",
        tipo: usuario.tipo
      }); 
    })
    .catch(error => {
      console.error("Error al buscar el usuario:", error);
      res.status(500).json({ message: "Error al buscar el usuario", error });
    });
});


const datosHistoricosSchema = new mongoose.Schema({
  sensor: String,
  dato: String,
  fecha: { type: Date, default: Date.now }
});

const DatosHistoricos = mongoose.model('device_historic', datosHistoricosSchema);

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

app.post('/encontrar-pin', (req, res) => {
  const { mac, pin } = req.body;
  Usuario.findOne({ 'dispositivo.mac': mac, 'dispositivo.pin': pin })
    .then(usuario => {
      if (!usuario) {
        return res.status(404).json({ message: "Pin no encontrado" });
      }
      res.json({ message: "Pin encontrado", usuario: { nombre: usuario.nombre, nombre_usuario: usuario.nombre_usuario } });
    })
    .catch(error => {
      console.error("Error al buscar el pin:", error);
      res.status(500).json({ message: "Error al buscar el pin", error });
    });
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

app.post('/send-email', (req, res) => {
  const { nombre, email, asunto, mensaje } = req.body;

  const mailOptions = {
      from: 'ironsafe3@gmail.com', 
      to: 'ironsafe3@gmail.com', 
      subject: asunto,
      html: `<p>Nombre: ${nombre}</p>
      <p>Email: ${email}</p><p>Mensaje: ${mensaje}</p>`, 
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

app.get('/estados-dispositivos', (req, res) => {
  DeviceState.find({})
    .then(estados => res.json(estados))
    .catch(error => res.status(500).json({ message: "Error al obtener los estados de los dispositivos", error }));
});

app.post('/registro', (req, res) => {
  const { nombre, nombre_usuario, correo, contraseña } = req.body;

  const nuevoUsuario = new Usuario({
    nombre: nombre,
    paterno: '', 
    materno: '', 
    correo: correo,
    contraseña: contraseña,
    telefono: '', 
    nombre_usuario: nombre_usuario,
    direccion: { 
      calle: '',
      numero_casa: '',
      colonia: '',
      codigo_postal: '',
      municipio: '',
      pais: ''
    },
    dispositivo: [], 
    tipo: 'cliente' 
  });

  nuevoUsuario.save()
    .then(usuario => res.status(201).json({ message: "Usuario registrado con éxito", usuarioId: usuario._id }))
    .catch(error => res.status(500).json({ message: "Error al registrar el usuario", error }));
});

function generarCodigo() {
  return Math.floor(100000 + Math.random() * 900000); 
}

app.post('/solicitar-recuperacion', async (req, res) => {
  const { correo } = req.body;
  const codigo = generarCodigo();

  const usuarioExiste = await Usuario.findOne({ correo: correo });
  if (!usuarioExiste) {
    return res.status(404).send('Usuario no encontrado');
  }

  codigosTemporales[correo] = codigo;

  setTimeout(() => {
    delete codigosTemporales[correo];
  }, 15 * 60 * 1000); 

  const mailOptions = {
      from: 'ironsafe3@gmail.com',
      to: correo,
      subject: 'Código de Verificación para Recuperar Contraseña',
      html: `<p>Su código de verificación es: ${codigo}</p>`,
  };

  transporter.sendMail(mailOptions, function(error, info){
      if (error) {
          console.log(error);
          return res.status(500).send('Error al enviar el correo');
      } else {
          console.log('Email enviado: ' + info.response);
          return res.status(200).send('Correo enviado con éxito');
      }
  });
});

app.post('/verificar-codigo', (req, res) => {
  const { correo, codigo } = req.body;

  if (codigosTemporales[correo] === codigo) {
    delete codigosTemporales[correo];

    return res.status(200).send('Código verificado correctamente.');
  } else {
    return res.status(400).send('Código de verificación incorrecto.');
  }
});

app.post('/cambiar-contrasena', async (req, res) => {
  const { correo, nuevaContrasena } = req.body;
  try {
    await Usuario.findOneAndUpdate(
      { correo: correo },
      { contraseña: nuevaContrasena },
      { new: true }
    );

    res.status(200).send('Contraseña actualizada correctamente.');
  } catch (error) {
    console.error('Error al actualizar la contraseña:', error);
    res.status(500).send('Error al actualizar la contraseña.');
  }
});


app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});