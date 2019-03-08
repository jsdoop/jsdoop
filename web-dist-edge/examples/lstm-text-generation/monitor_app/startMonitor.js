#!/usr/bin/env node

/*********************************************************************************************************************
* Generador de tareas de prueba.
* Encola una serie de tareas de cálculo de gradiente y cómputo de un nuevo modelo.
*********************************************************************************************************************/

const {tf, tfjsIOHandler, data, tfjsCustomModel} = require('tfjs-helper');
const request = require('request');
const wde = require('web-dist-edge-monitor');


/*********************************************************************************************************************/
/* Parámetros de conexión
/*********************************************************************************************************************/

//TODO poner esto en un fichero de configuración
const local = false;
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


async function getText(url){
  // read text from URL location
  return new Promise(function(resolve, reject) {
    request.get(url, function(err, res, content) {
      resolve(content); 
    });	
  });	
}


(async () => {
  //TODO batchSize, sampleLen y sampleStep debieran ser configurables
  const batchSize = 32;
  const sampleLen = 1024;
  const sampleStep = 256;
  const textUrl = 'http://mallba3.lcc.uma.es/jamorell/deeplearning/dataset/el_quijote.txt'
  const lstmLayerSizes = [10,10];

  const textString = await getText(textUrl);  
  const dataset = new data.TextDataset(textString, sampleLen, sampleStep, false);
    
  let model = await tfjsCustomModel.createLstmModel(lstmLayerSizes, sampleLen, dataset.charSet.length);
  let urlSavedModel = modelUrl + "/SET/" + taskName +"_model_id_" + 1;
  const saveResults = await model.save(tfjsIOHandler.webdisRequest(urlSavedModel)).catch(error => console.log(error));
  
  // Generación del payload específico para los mappers
  mapPayloadFn = function(ix, mapIx, reduceIx) {
    let payload = {}
    payload.getModelUrl = modelUrl + "/GET/" + taskName +"_model_id_" + reduceIx;    
    payload.beginIndex = dataset.getNextBeginIndex();
    payload.batchSize = batchSize;
    return payload;
  }
  
  // Generación del payload específico para los reducers
  reducePayloadFn = function(ix, mapIx, reduceIx) {
    let payload = {}
    payload.getModelUrl = modelUrl + "/GET/" + taskName +"_model_id_" + reduceIx;
    let setId = reduceIx + 1;
    payload.putModelUrl = modelUrl + "/SET/" + taskName +"_model_id_" + setId;
    return payload;
  }  
  
  /*********************************************************************************************************************/
  /* Parámetros de la tarea (i.e., node enqueue_task.js <numMaps> <accumReduce>)
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

