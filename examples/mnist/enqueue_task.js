#!/usr/bin/env node

/*********************************************************************************************************************
* Generador de tareas de prueba.
* Encola una serie de tareas de cálculo de gradiente y cómputo de un nuevo modelo.
*********************************************************************************************************************/

var amqp = require('amqplib/callback_api');
var tf = require('@tensorflow/tfjs');
var ioh = require('./io_handler.js');
// global.Blob = require('blob');
// global.fetch = require('node-fetch');


/*********************************************************************************************************************/
const IMAGE_H = 28;
const IMAGE_W = 28;
const conv = false;

function createConvModel() {
  const model = tf.sequential();
  model.add(tf.layers.conv2d({
    inputShape: [IMAGE_H, IMAGE_W, 1],
    kernelSize: 3,
    filters: 16,
    activation: 'relu'
  }));
  model.add(tf.layers.maxPooling2d({poolSize: 2, strides: 2}));
  model.add(tf.layers.conv2d({kernelSize: 3, filters: 32, activation: 'relu'}));
  model.add(tf.layers.maxPooling2d({poolSize: 2, strides: 2}));
  model.add(tf.layers.conv2d({kernelSize: 3, filters: 32, activation: 'relu'}));
  model.add(tf.layers.flatten({}));
  model.add(tf.layers.dense({units: 64, activation: 'relu'}));
  model.add(tf.layers.dense({units: 10, activation: 'softmax'}));
  return model;
}

function createDenseModel() {
  const model = tf.sequential();
  model.add(tf.layers.flatten({inputShape: [IMAGE_H, IMAGE_W, 1]}));
  model.add(tf.layers.dense({units: 42, activation: 'relu'}));
  model.add(tf.layers.dense({units: 10, activation: 'softmax'}));
  return model;
}

async function setInitialModel(url) {
  let model;
  if( conv ) {
    model = createConvModel();
  } else {
    model = createDenseModel();
  }
  const saveResults = await model.save(ioh.webdisRequest(url)).catch(error => console.log(error));
}

async function loadModel(url) {
  let model = await tf.loadModel(ioh.webdisRequest(url)).catch(error => console.log(error));
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
  modelUrl = 'http://mallba3.lcc.uma.es:7379';
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
    let modelId = 1;
    // Guardamos una versión inicial del modelo
    setInitialModel(modelUrl + "/SET/mnist_model_id_" + modelId);
    // loadModel(modelUrl + "/GET/mnist_model_id_" + modelId);
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
      mapper.getModelUrl = modelUrl + "/GET/mnist_model_id_" + modelId; 
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
        reducer.getModelUrl = modelUrl + "/GET/mnist_model_id_" + modelId;
        modelId++;
        reducer.putModelUrl = modelUrl + "/SET/mnist_model_id_" + modelId;
        console.log(reducer);
        ch.sendToQueue(destination, new Buffer(JSON.stringify(reducer)), {persistent: true});
        awaitId.length = 0;
      }
    }
  });
  setTimeout(function() { conn.close(); process.exit(0); }, 500);
});
