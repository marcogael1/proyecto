const express = require('express');
const mongoose = require('mongoose');
const app = express();
const cors = require('cors');
const PORT = process.env.PORT || 3000;
const nodemailer = require('nodemailer');
const mqtt = require('mqtt');
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const crypto = require('crypto'); // Importa el módulo crypto
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
      producto: String,
      mac: String,
      modelo: String,
      fecha_compra: Date,
      pin: String
    }
  ],
  tipo: String,
  pregunta: String,
  respuesta: String
});

const Usuario = mongoose.model('Usuario', usuarioSchema);

const cajaFuerteSchema = new mongoose.Schema({
  nombre: String,
  precio: Number,
  descripcion: String,
  caracteristicas: [String],
  material: String,
  imagen: String,
  macs: [
    {
      mac: String,
      asignado: { type: Boolean, default: false },
      codigo: String,
    }
  ]
});


const CajaFuerte = mongoose.model('productos', cajaFuerteSchema);

const politicaSchema = new mongoose.Schema({
  titulo: String,
  contenido: String,
});

const Politica = mongoose.model('empresa', politicaSchema);

const faqSchema = new mongoose.Schema({
  pregunta: String,
  respuesta: String
});

const FAQ = mongoose.model('FAQ', faqSchema);

const mqttClient = mqtt.connect('mqtt://broker.emqx.io', {
  port: 1883
});

app.post('/registro-pin', (req, res) => {
  const { producto } = req.body;
  console.log("producto recibida:", producto);
  Usuario.findOne({ 'dispositivo.producto': producto })
    .then(usuario => {
      console.log("Usuario encontrado:", usuario);
      if (!usuario || !usuario.dispositivo || !usuario.dispositivo[0].pin) {
        return res.status(404).json({ message: "No se encontró un PIN registrado para la mac proporcionada" });
      }
      res.json({ message: "Pin encontrado", pin: usuario.dispositivo[0].pin });
    })
    .catch(error => {
      console.error("Error al buscar el pin:", error);
      res.status(500).json({ message: "Error al buscar el pin", error });
    });
});

app.post('/asignar-producto', async (req, res) => {
  const { userId, codigo } = req.body;
  console.log(codigo);
  try {
    const producto = await CajaFuerte.findOne({ "macs.codigo": codigo });

    if (!producto) {
      return res.status(404).json({ message: "Producto no encontrado con ese código: " + codigo + "usuario: "+userId});
    }    

    const macEncontrada = producto.macs.find(mac => mac.codigo === codigo);

    if (!macEncontrada || macEncontrada.asignado) {
      // Si el producto no existe o ya está asignado a otro usuario, retornar un error
      return res.status(400).json({ message: "El producto no está disponible para asignar" });
    }

    // Marcar el producto como asignado en la colección CajaFuerte
    macEncontrada.asignado = true;
    await producto.save();

    // Verificar si el usuario ya tiene un producto asignado
    const usuario = await Usuario.findById(userId);
    if (usuario.dispositivo.length > 0) {
      // Si el usuario ya tiene un producto asignado, actualizar el primer elemento del arreglo
      usuario.dispositivo[0].producto = codigo;
      usuario.dispositivo[0].mac = macEncontrada.mac;
    } else {
      // Si el usuario no tiene un producto asignado, agregar uno nuevo al arreglo
      usuario.dispositivo.push({ producto: codigo, mac: macEncontrada.mac });
    }
    await usuario.save();

    return res.status(200).json({ success: true, message: "Producto asignado correctamente" });    

  } catch (error) {
    console.error('Error al asignar el producto:', error);
    res.status(500).json({ message: "Error al asignar el producto", error });
  }
});










app.post('/encontrar-mqtt', async (req, res) => {
  const { producto, pin } = req.body;
  Usuario.findOne({ 'dispositivo.producto': producto, 'dispositivo.pin': pin })
    .then(usuario => {
      if (!usuario) {
        return res.status(404).json({ message: "Pin no encontrado" });
      }
      mqttClient.publish('cajafuerte/comandos', "abrir", { qos: 1 }, error => {
        if (error) {
          console.error('Error publicando mensaje: ', error);
        }
      });
      res.json({ message: "Pin encontrado", usuario: { nombre: usuario.nombre, nombre_usuario: usuario.nombre_usuario } });
    })
    .catch(error => {
      console.error("Error al buscar el pin:", error);
      res.status(500).json({ message: "Error al buscar el pin", error });
    });
});

app.get('/preguntas-frecuentes', async (req, res) => {
  try {
    const preguntasFrecuentes = await FAQ.find({});
    res.json(preguntasFrecuentes);
  } catch (error) {
    console.error('Error al obtener las preguntas frecuentes:', error);
    res.status(500).json({ message: "Error al obtener las preguntas frecuentes" });
  }
});

app.post('/preguntas-frecuentes', async (req, res) => {
  const { pregunta, respuesta } = req.body;

  const nuevaPreguntaFrecuente = new FAQ({
    pregunta,
    respuesta
  });

  try {
    await nuevaPreguntaFrecuente.save();
    res.status(201).json({ message: "Pregunta frecuente agregada exitosamente", data: nuevaPreguntaFrecuente });
  } catch (error) {
    console.error('Error al agregar la pregunta frecuente:', error);
    res.status(500).json({ message: "Error al agregar la pregunta frecuente" });
  }
});

app.put('/preguntas-frecuentes/:id', async (req, res) => {
  const { id } = req.params;
  const { pregunta, respuesta } = req.body;

  try {
    const preguntaFrecuenteActualizada = await FAQ.findByIdAndUpdate(id, { pregunta, respuesta }, { new: true });
    if (!preguntaFrecuenteActualizada) {
      return res.status(404).json({ message: "Pregunta frecuente no encontrada" });
    }
    res.json({ message: "Pregunta frecuente actualizada exitosamente", data: preguntaFrecuenteActualizada });
  } catch (error) {
    console.error('Error al actualizar la pregunta frecuente:', error);
    res.status(500).json({ message: "Error al actualizar la pregunta frecuente" });
  }
});

app.delete('/preguntas-frecuentes/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const preguntaFrecuenteEliminada = await FAQ.findByIdAndDelete(id);
    if (!preguntaFrecuenteEliminada) {
      return res.status(404).json({ message: "Pregunta frecuente no encontrada" });
    }
    res.status(200).json({ message: "Pregunta frecuente eliminada exitosamente" });
  } catch (error) {
    console.error('Error al eliminar la pregunta frecuente:', error);
    res.status(500).json({ message: "Error al eliminar la pregunta frecuente" });
  }
});


app.get('/codigos-disponibles', async (req, res) => {
  try {
    const productos = await CajaFuerte.find({});
    const codigosDisponibles = productos
      .map(producto => producto.macs.filter(mac => !mac.asignado).map(mac => mac.codigo)) 
      .flat();
    res.json(codigosDisponibles);
  } catch (error) {
    console.error('Error al obtener los códigos disponibles:', error);
    res.status(500).json({ message: "Error al obtener los códigos disponibles", error });
  }
});

app.post('/asignar-codigo', async (req, res) => {
  const { userId, codigo } = req.body;

  try {
    const producto = await CajaFuerte.findOne({ "macs.codigo": codigo });
    if (!producto) {
      return res.status(404).json({ message: "Producto no encontrado con ese código" });
    }
    const macEncontrada = producto.macs.find(mac => mac.codigo === codigo);
    macEncontrada.asignado = true;
    await producto.save();
    await Usuario.findByIdAndUpdate(
      userId,
      { $push: { dispositivo: { producto: codigo, mac: macEncontrada.mac } } },
      { new: true }
    );

    res.status(200).json({ message: "Código asignado correctamente" });
  } catch (error) {
    console.error('Error al asignar el código:', error);
    res.status(500).json({ message: "Error al asignar el código", error });
  }
});




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

  const contraseñaMD5 = crypto.createHash('md5').update(contraseña).digest('hex');

  Usuario.findOne({ nombre_usuario: nombre_usuario, contraseña: contraseñaMD5 })
    .then(usuario => {
      if (!usuario) {
        return res.status(404).json({ message: "Usuario no encontrado o contraseña incorrecta" });
      }

      const mac = usuario.dispositivo.length > 0 ? usuario.dispositivo[0].mac : null;
      const codigo = usuario.dispositivo.length > 0 ? usuario.dispositivo[0].producto : null;

      res.json({
        message: "Usuario encontrado",
        id: usuario._id,
        tipo: usuario.tipo,
        mac: mac,
        codigo: codigo,
        correo: usuario.correo  
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
  producto: String,
  fecha: { type: Date, default: Date.now }
});

const DatosHistoricos = mongoose.model('device_historic', datosHistoricosSchema);

app.post('/datos', (req, res) => {
  const { sensor, dato, producto } = req.body;
  const nuevosDatos = new DatosHistoricos({
    sensor: sensor,
    dato: dato,
    producto: producto
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

app.get('/cajas-fuertes', (req, res) => {
  CajaFuerte.find({})
    .then(cajasFuertes => res.json(cajasFuertes))
    .catch(error => res.status(500).json({ message: "Error al obtener las cajas fuertes", error }));
});

app.get('/cajas-fuertes/:id', async (req, res) => {
  try {
    const producto = await CajaFuerte.findById(req.params.id);
    res.json(producto);
  } catch (error) {
    res.status(404).send("Producto no encontrado");
  }
});

const deviceStateSchema = new mongoose.Schema({
  sensor: String,
  dato: String,
  producto: String,
  fecha: { type: Date, default: Date.now }
});

const DeviceState = mongoose.model('device_state', deviceStateSchema);

app.post('/actualizarEstado', (req, res) => {
  const { sensor, dato, producto } = req.body;

  DeviceState.findOneAndUpdate(
    { sensor: sensor },
    {
      sensor: sensor,
      dato: dato,
      producto: producto,
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

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
      res.status(500).send('Error al enviar el correo');
    } else {
      console.log('Email enviado: ' + info.response);
      res.status(200).send('Correo enviado con éxito');
    }
  });
});

app.post('/verificar-producto-pin', async (req, res) => {
  const { userId } = req.body;

  try {
    const usuario = await Usuario.findById(userId);

    if (!usuario || !usuario.dispositivo || usuario.dispositivo.length === 0 || !usuario.dispositivo[0].pin) {
      return res.json({ success: false, message: "No se encontró un PIN registrado para este usuario." });
    }

    res.json({ success: true, message: "Usuario tiene un PIN registrado.", pin: usuario.dispositivo[0].pin });
  } catch (error) {
    console.error('Error al verificar el PIN del producto:', error);
    res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
});



app.get('/estados-dispositivos', (req, res) => {
  DeviceState.find({})
    .then(estados => res.json(estados))
    .catch(error => res.status(500).json({ message: "Error al obtener los estados de los dispositivos", error }));
});

app.post('/registro', (req, res) => {
  const { nombre, nombre_usuario, correo, contraseña, pregunta, respuesta, tipo } = req.body;
  const contraseñaMD5 = crypto.createHash('md5').update(contraseña).digest('hex');
  const nuevoUsuario = new Usuario({
    nombre: nombre,
    paterno: '',
    materno: '',
    correo: correo,
    contraseña: contraseñaMD5,
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
    tipo: tipo,
    pregunta: pregunta,
    respuesta: respuesta
  });

  nuevoUsuario.save()
    .then(usuario => res.status(201).json({ message: "Usuario registrado con éxito", usuarioId: usuario._id }))
    .catch(error => res.status(500).json({ message: "Error al registrar el usuario", error }));
});

app.delete('/usuarios/:id', async (req, res) => {
  const usuarioId = req.params.id;

  try {
    const usuarioEliminado = await Usuario.findByIdAndDelete(usuarioId);
    if (!usuarioEliminado) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.status(200).json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    console.error('Error al eliminar el usuario:', error);
    res.status(500).json({ message: "Error al eliminar el usuario", error });
  }
});

app.get('/usuarios/:correo', (req, res) => {
  const { correo } = req.params;
  Usuario.findOne({ correo: correo })
    .then(usuario => {
      if (!usuario) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      res.json(usuario); // Omitir enviar información sensible como contraseñas
    })
    .catch(error => {
      console.error('Error al buscar al usuario:', error);
      res.status(500).json({ message: "Error al buscar al usuario", error });
    });
});

app.get('/usuarios/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    res.json(usuario); // Asegúrate de omitir enviar información sensible como contraseñas
  } catch (error) {
    console.error('Error al obtener el usuario:', error);
    res.status(500).json({ message: "Error al obtener el usuario" });
  }
});


app.put('/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const datosActualizados = req.body;

  try {
    const usuarioActualizado = await Usuario.findByIdAndUpdate(id, datosActualizados, { new: true });
    if (!usuarioActualizado) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    res.json(usuarioActualizado);
  } catch (error) {
    console.error('Error al actualizar el usuario:', error);
    res.status(500).json({ message: "Error al actualizar el usuario", error });
  }
});


function generarCodigo() {
  return Math.floor(100000 + Math.random() * 900000);
}

function generarMacCodigo() {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numeros = '0123456789';
  let codigo = '';

  for (let i = 0; i < 2; i++) {
    codigo += letras.charAt(Math.floor(Math.random() * letras.length));
  }

  for (let i = 0; i < 3; i++) {
    codigo += numeros.charAt(Math.floor(Math.random() * numeros.length));
  }

  let mac = '';
  for (let i = 0; i < 6; i++) {
    mac += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    if (i < 5) mac += ':';
  }

  return { codigo, mac };
}


app.post('/solicitar-recuperacion', async (req, res) => {
  const { correo } = req.body;
  const codigo = generarCodigo();

  const usuarioExiste = await Usuario.findOne({ correo: correo });
  if (!usuarioExiste) {
    return res.status(404).send('Usuario no encontrado');
  }

  codigosTemporales[correo] = codigo.toString();

  setTimeout(() => {
    delete codigosTemporales[correo];
  }, 15 * 60 * 1000);

  const mailOptions = {
    from: 'ironsafe3@gmail.com',
    to: correo,
    subject: 'Código de Verificación para Recuperar Contraseña',
    html: `<p>Su código de verificación es: ${codigo}</p>`,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
      return res.status(500).send('Error al enviar el correo');
    } else {
      console.log('Email enviado: ' + info.response);
      return res.status(200).send('Correo enviado con éxito');
    }
  });
});

app.post('/verificar-producto', async (req, res) => {
  const { userid } = req.body;

  try {
    const usuario = await Usuario.findById(userid);
    if (!usuario || !usuario.dispositivo || usuario.dispositivo.length === 0) {
      return res.json({ success: false, message: "No se encontró un producto registrado para este usuario." });
    }
    res.json({ success: true, message: "Usuario tiene un producto registrado.", producto: usuario.dispositivo[0] });
  } catch (error) {
    console.error('Error al verificar código de producto:', error);
    res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
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

    const nuevaContrasenaMD5 = crypto.createHash('md5').update(nuevaContrasena).digest('hex');
    await Usuario.findOneAndUpdate(
      { correo: correo },
      { contraseña: nuevaContrasenaMD5 },
      { new: true }
    );

    res.status(200).send('Contraseña actualizada correctamente.');
  } catch (error) {
    console.error('Error al actualizar la contraseña:', error);
    res.status(500).send('Error al actualizar la contraseña.');
  }
});

app.get('/datos-empresa', async (req, res) => {
  try {
    const politicas = await Politica.find({});
    res.json(politicas);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.put('/datos-empresa/:id', async (req, res) => {
  const { id } = req.params;
  const { titulo, contenido } = req.body;

  try {
    const resultado = await Politica.findByIdAndUpdate(id, { titulo, contenido }, { new: true });
    if (!resultado) {
      return res.status(404).send('No se encontró el documento con el ID proporcionado.');
    }
    res.json(resultado);
  } catch (error) {
    console.error('Error al actualizar el documento:', error);
    res.status(500).send('Error interno del servidor.');
  }
});

app.get('/obtener-pregunta-seguridad/:correo', async (req, res) => {
  const { correo } = req.params;

  try {
    const usuario = await Usuario.findOne({ correo: correo });
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }
    res.json({ pregunta: usuario.pregunta });
  } catch (error) {
    console.error('Error al obtener la pregunta de seguridad:', error);
    res.status(500).json({ message: "Error al obtener la pregunta de seguridad." });
  }
});


app.post('/verificar-respuesta-seguridad', async (req, res) => {
  const { correo, respuesta } = req.body;

  try {
    const usuario = await Usuario.findOne({ correo: correo });
    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    if (usuario.respuesta === respuesta) {
      res.json({ esCorrecta: true });
    } else {
      res.json({ esCorrecta: false });
    }
  } catch (error) {
    console.error('Error al verificar la respuesta a la pregunta de seguridad:', error);
    res.status(500).json({ message: "Error al verificar la respuesta." });
  }
});

app.delete('/cajas-fuertes/:id', async (req, res) => {
  try {
    const productoEliminado = await CajaFuerte.findByIdAndDelete(req.params.id);
    if (!productoEliminado) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }
    res.status(200).json({ message: "Producto eliminado correctamente" });
  } catch (error) {
    console.error('Error al eliminar el producto:', error);
    res.status(500).json({ message: "Error al eliminar el producto", error });
  }
});

app.put('/cajas-fuertes/:id', async (req, res) => {
  const { id } = req.params;
  const datosActualizados = req.body;

  try {
    const productoActualizado = await CajaFuerte.findByIdAndUpdate(id, datosActualizados, { new: true });
    if (!productoActualizado) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }
    res.json(productoActualizado);
  } catch (error) {
    console.error('Error al actualizar el producto:', error);
    res.status(500).json({ message: "Error al actualizar el producto", error });
  }
});

app.post('/cajas-fuertes', async (req, res) => {
  try {
    const { nombre, precio, descripcion, caracteristicas, material, imagen } = req.body;
    const { codigo, mac } = generarMacCodigo(); 

    const macsConReferencia = [{ mac, asignado: false, codigo: codigo }];

    const nuevoProducto = new CajaFuerte({
      nombre,
      precio,
      descripcion,
      caracteristicas, 
      material,
      imagen,
      macs: macsConReferencia 
    });

    await nuevoProducto.save();
    res.status(201).json({ message: "Producto agregado con éxito", productoId: nuevoProducto._id });
  } catch (error) {
    console.error('Error al agregar el producto:', error);
    res.status(500).json({ message: "Error al agregar el producto", error });
  }
});


app.post('/asignar-pin', async (req, res) => {
  const { producto, pin } = req.body;

  try {
    const usuarioExistente = await Usuario.findOne({ 'dispositivo.producto': producto });

    if (usuarioExistente) {
      if (usuarioExistente.dispositivo && usuarioExistente.dispositivo[0].pin) {
        return res.status(400).json({ message: "Ya hay un PIN registrado para la MAC proporcionada" });
      } else {
        usuarioExistente.dispositivo[0].pin = pin;
        await usuarioExistente.save();
        return res.status(200).json({ message: "PIN registrado exitosamente" });
      }
    } 
  } catch (error) {
    console.error("Error al registrar el PIN:", error);
    return res.status(500).json({ message: "Error al registrar el PIN", error });
  }
});


app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});