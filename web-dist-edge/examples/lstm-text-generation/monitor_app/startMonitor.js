#!/usr/bin/env node

/*********************************************************************************************************************
* Generador de tareas de prueba.
* Encola una serie de tareas de cálculo de gradiente y cómputo de un nuevo modelo.
*********************************************************************************************************************/

const {tf, tfjsIOHandler, data} = require('tfjs-helper');
const request = require('request');


const wde = require('web-dist-edge-monitor');



/*********************************************************************************************************************/
/* Parámetros de conexión
/*********************************************************************************************************************/

//TODO poner esto en un fichero de configuración
const local = true;
const taskName = 'lstm_text_generation';
const queueName = taskName + '_queue';
let amqpConnOptions = {};
if(local) {
  //connStr = wde.getAmqpConnectionStr('localhost');
  amqpConnOptions.server = 'localhost';
  modelUrl = 'http://localhost:7379';
} else {
  //connStr = wde.getAmqpConnectionStr('mallba3.lcc.uma.es', port=null, user='worker', pswd='mypassword');
  amqpConnOptions.server = 'mallba3.lcc.uma.es';
  amqpConnOptions.port = null;
  amqpConnOptions.user = 'worker';
  amqpConnOptions.pswd = 'mypassword';
  modelUrl = 'http://mallba3.lcc.uma.es:7379';
}


/*********************************************************************************************************************/
/* Obtenemos el texto de entrenamiento
/*********************************************************************************************************************/

//TODO batchSize, sampleLen y sampleStep debieran ser configurables
const batchSize = 32;
const sampleLen = 4;//1024;
const sampleStep = 1;//256;



async function getText(url){
  // read text from URL location
  return new Promise(function(resolve, reject) {
    request.get(url, function(err, res, content) {
      resolve(content); 
    });	
  });	
}


(async () => {
  const textString = await getText('http://mallba3.lcc.uma.es/jamorell/deeplearning/dataset/el_quijote.txt');
  //const textString = "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.";
 //const textString = "abcabcabcabcabcabcabcabcabcabcabc";

  const dataset = new data.TextDataset(textString, sampleLen, sampleStep, false);

  const charSetSize = dataset.charSetSize;
  
  
  /*********************************************************************************************************************/
  /* Generamos una versión inicial del modelo
  /*********************************************************************************************************************/
  
  const lstmLayerSizes = [10,10];
  
  function createModel(lstmLayerSizes, sampleLen, charSetSize) {
    if (!Array.isArray(lstmLayerSizes)) {
      lstmLayerSizes = [lstmLayerSizes];
    }
    let model = tf.sequential();
    for (let i = 0; i < lstmLayerSizes.length; ++i) {
      const lstmLayerSize = lstmLayerSizes[i];
      model.add(tf.layers.lstm({
          units: lstmLayerSize,
          returnSequences: i < lstmLayerSizes.length - 1,
          inputShape: i === 0 ? [sampleLen, charSetSize] : undefined
      }));
    }
    model.add(tf.layers.dense({units: charSetSize, activation: 'softmax'}));
    return model;
  }
  
  async function setInitialModel(url, lstmLayerSizes, sampleLen, charSetSize) {
    let model = createModel(lstmLayerSizes, sampleLen, charSetSize);
    const saveResults = await model.save(tfjsIOHandler.webdisRequest(url)).catch(error => console.log(error));
  }
  
  setInitialModel(modelUrl + "/SET/" + taskName +"_model_id_" + 1, lstmLayerSizes, sampleLen, charSetSize);
  
  
  /*********************************************************************************************************************/
  /* Generación del payload específico para los mappers
  /*********************************************************************************************************************/
  
  mapPayloadFn = function(ix, mapIx, reduceIx) {
    let payload = {}
    payload.getModelUrl = modelUrl + "/GET/" + taskName +"_model_id_" + reduceIx;
    //const [xs, ys] = dataset.nextDataBatch(batchSize);
    let batchIndex = 3; //Index of the batch
    const [xs, ys] = dataset.getDataBatch(batchSize, batchIndex);
    //TODO copy the tensor or put the text...
    payload.xs = xs.arraySync();
    payload.ys = ys.arraySync();
    return payload;
  }
  
  reducePayloadFn = function(ix, mapIx, reduceIx) {
    let payload = {}
    payload.getModelUrl = modelUrl + "/GET/" + taskName +"_model_id_" + reduceIx;
    let setId = reduceIx + 1;
    payload.putModelUrl = modelUrl + "/SET/" + taskName +"_model_id_" + setId;
    return payload;
  }
  
  
  /*********************************************************************************************************************/
  /* Parámetros de la tarea (i.e., node enqueue_task.js <taskName> <numMaps> <accumReduce>)
  /*   numMaps
  /*   accumReduce
  /*********************************************************************************************************************/
  
  let numMaps = parseInt(process.argv.slice(2)[0]);
  let accumReduce = parseInt(process.argv.slice(2)[1]);
  if(isNaN(numMaps) || numMaps == null) {
    numMaps = 10;
  }
  if(isNaN(accumReduce) || accumReduce == null) {
    accumReduce = 3;
  }
  if(accumReduce > numMaps) {
    accumReduce = numMaps;
  }
  console.log("Name=" + taskName + ", numMaps=" + numMaps + ", accumReduce=" + accumReduce);
  
  // Finalmente encolamos las tareas
  //wde.enqueueTask(amqpConnOptions, queueName, numMaps, accumReduce, mapPayloadFn, reducePayloadFn);
  let conn, ch;
  
  [conn, ch] = await wde.wdeConnect(amqpConnOptions);
  await wde.enqueueTask(ch, queueName, numMaps, accumReduce, mapPayloadFn, reducePayloadFn);
  setTimeout(function(){ch.close(); conn.close(); console.log("DISCONNECTED CORRECTLY"); process.exit(0);},500);

})();

