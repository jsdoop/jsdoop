#!/usr/bin/env node

/*********************************************************************************************************************
* Generador de tareas de prueba.
* Encola una serie de tareas de cálculo de gradiente y cómputo de un nuevo modelo.
*********************************************************************************************************************/

var amqp = require('amqplib/callback_api');

/*********************************************************************************************************************/
/**
 * Creates a convolutional neural network (Convnet) for the MNIST data.
 *
 * @returns {tf.Model} An instance of tf.Model.
 */
function createConvModel() {
  // Create a sequential neural network model. tf.sequential provides an API
  // for creating "stacked" models where the output from one layer is used as
  // the input to the next layer.
  const model = tf.sequential();

  // The first layer of the convolutional neural network plays a dual role:
  // it is both the input layer of the neural network and a layer that performs
  // the first convolution operation on the input. It receives the 28x28 pixels
  // black and white images. This input layer uses 16 filters with a kernel size
  // of 5 pixels each. It uses a simple RELU activation function which pretty
  // much just looks like this: __/
  model.add(tf.layers.conv2d({
    inputShape: [IMAGE_H, IMAGE_W, 1],
    kernelSize: 3,
    filters: 16,
    activation: 'relu'
  }));

  // After the first layer we include a MaxPooling layer. This acts as a sort of
  // downsampling using max values in a region instead of averaging.
  // https://www.quora.com/What-is-max-pooling-in-convolutional-neural-networks
  model.add(tf.layers.maxPooling2d({poolSize: 2, strides: 2}));

  // Our third layer is another convolution, this time with 32 filters.
  model.add(tf.layers.conv2d({kernelSize: 3, filters: 32, activation: 'relu'}));

  // Max pooling again.
  model.add(tf.layers.maxPooling2d({poolSize: 2, strides: 2}));

  // Add another conv2d layer.
  model.add(tf.layers.conv2d({kernelSize: 3, filters: 32, activation: 'relu'}));

  // Now we flatten the output from the 2D filters into a 1D vector to prepare
  // it for input into our last layer. This is common practice when feeding
  // higher dimensional data to a final classification output layer.
  model.add(tf.layers.flatten({}));

  model.add(tf.layers.dense({units: 64, activation: 'relu'}));

  // Our last layer is a dense layer which has 10 output units, one for each
  // output class (i.e. 0, 1, 2, 3, 4, 5, 6, 7, 8, 9). Here the classes actually
  // represent numbers, but it's the same idea if you had classes that
  // represented other entities like dogs and cats (two output classes: 0, 1).
  // We use the softmax function as the activation for the output layer as it
  // creates a probability distribution over our 10 classes so their output
  // values sum to 1.
  model.add(tf.layers.dense({units: 10, activation: 'softmax'}));

  return model;
}

/*********************************************************************************************************************/

// Parámetros de conexión
let local = false;
const destination = 'mnist_task_queue';
let connStr;
let modelUrl;
if(local) {
  connStr = 'amqp://localhost';
  modelUrl = 'localhost:7379';
} else {
  connStr = 'amqp://worker:mypassword@mallba3.lcc.uma.es';
  modelUrl = 'mallba3.lcc.uma.es:7379';
}
console.log(connStr);

// Número de pasos (cálculo de gradientes a encolar) y número de
// pasos a acumular
let numSteps = parseInt(process.argv.slice(2)[0]);
let numAccum = parseInt(process.argv.slice(2)[1]);
if(isNaN(numSteps) || numSteps == null) {
  numSteps = 10;
}
if(isNaN(numAccum) || numAccum == null) {
  numAccum = 3;
}
if(numAccum > numSteps) {
  numAccum = numSteps;
}
console.log("Steps=" + numSteps + " Accum=" + numAccum);

amqp.connect(connStr , function(err, conn) {
  conn.createChannel(function(err, ch) {    
    ch.assertQueue(destination, {durable: true});
    // Se encolan los mensajes en orden
    // TODO: guardar versión inicial del modelo
    let modelId = 1;
    let awaitId = [];
    for(let i=1; i <= numSteps; i++) {
    // TODO: incluir tolerancia a fallos
      let mapper = {};
      // El worker necesita recibir un mensaje que contenga:
      //  procId = identificador único de la tarea
      //  payloadUrl = URL válida desde donde se obtiene el código a ejecutar
      // El resto de los parámetros del mensaje son optativos y corresponden a
      // la necesidad de la tarea (payload). A su vez, el 'payload' recibe el
      // contenido del mensaje.
      mapper.procId = "mapper_" + i;
      mapper.mapOrReduce = "map";
      mapper.getModelUrl = modelUrl + "/model/id/" + modelId; 
      mapper.batchStep = i;
      console.log(mapper);
      ch.sendToQueue(destination, new Buffer(JSON.stringify(mapper)), {persistent: true});
      awaitId.push(mapper.procId);
      if( i%numAccum == 0 || i == numSteps ) {
        // Reducimos el resultado
        let reducer = {};
        reducer.procId = "reducer_" + i;
        reducer.mapOrReduce = "reduce";
        reducer.awaitId = awaitId;
        reducer.getModelUrl = modelUrl + "/model/id/" + modelId;
        modelId++;
        reducer.putModelUrl = modelUrl + "/model/id/" + modelId;
        console.log(reducer);
        ch.sendToQueue(destination, new Buffer(JSON.stringify(reducer)), {persistent: true});
        awaitId.length = 0;
      }
    }
  });
  setTimeout(function() { conn.close(); process.exit(0) }, 500);
});
