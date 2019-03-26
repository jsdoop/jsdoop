#!/usr/bin/env node

/*********************************************************************************************************************
* Generador de tareas de prueba.
* Encola una serie de tareas de cálculo de gradiente y cómputo de un nuevo modelo.
*********************************************************************************************************************/

const {tf, tfjsIOHandler, data, tfjsCustomModel} = require('tfjs-helper');
const wde = require('jsd-monitor');

const JSDLogger = require('jsd-utils/jsd-logger');
const logger = JSDLogger.logger;

const JSDDB = require('jsd-utils/jsd-db');



/*********************************************************************************************************************/
/* Parámetros de conexión
/*********************************************************************************************************************/

//TODO poner esto en un fichero de configuración
const local = true;
const taskName = 'lstm_text_generation';
const queueName = taskName + '_queue';
let amqpConnOptions = {};
let webdisPort = 7379;
if(local) {
  //connStr = wde.getAmqpConnectionStr('localhost');
  webdisPort = 3001;
  amqpConnOptions.server = 'localhost';
  amqpConnOptions.port = null;
  modelUrl = 'http://localhost:' + webdisPort;
  amqpConnOptions.user = 'guest';
  amqpConnOptions.pswd = 'guest';
} else {
  //connStr = wde.getAmqpConnectionStr('mallba3.lcc.uma.es', port=null, user='worker', pswd='mypassword');
  amqpConnOptions.server = 'mallba3.lcc.uma.es';
  amqpConnOptions.port = null;
  amqpConnOptions.user = 'worker';
  amqpConnOptions.pswd = 'mypassword';
  modelUrl = 'http://mallba3.lcc.uma.es:' + webdisPort;
}


/*********************************************************************************************************************/
/* Obtenemos el texto de entrenamiento
/*********************************************************************************************************************/


(async () => {
  //TODO batchSize, sampleLen y sampleStep debieran ser configurables
  const batchSize = 5;
  const sampleLen = 32; // 1024
  const sampleStep = 8; // 256
  // const textUrl = 'http://mallba3.lcc.uma.es/jamorell/deeplearning/dataset/el_quijote.txt'
  const textUrl = modelUrl + '/GET/' + taskName + '_text';
  const lstmLayerSizes = [50,50];


  const textString = await JSDDB.getText(textUrl);  
  // request.put(modelUrl + '/SET/' + taskName + '_text').form(textString);
  
  const dataset = new data.TextDataset(textString, sampleLen, sampleStep, false);
    
  let model = await tfjsCustomModel.createLstmModel(lstmLayerSizes, sampleLen, dataset.charSet.length);
  let urlSavedModel = modelUrl + "/SET/" + taskName +"_model_id_" + 1;
  logger.debug("CURRENT MODEL ID " + modelUrl + '/SET/' + taskName + "_current_model_id");
  await JSDDB.setText(modelUrl + '/SET/' + taskName + "_current_model_id", 0);
  const saveResults = await model.save(tfjsIOHandler.webdisRequest(urlSavedModel)).catch(error => logger.debug(error));
  //request.put(urlSavedModel + '_ok').form("OK");
  
  // Generación del payload específico para los mappers
  mapPayloadFn = function(ix, mapIx, reduceIx) {
    let payload = {}
    payload.getModelUrl = modelUrl + "/GET/" + taskName +"_model_id_" + reduceIx;    
    payload.beginIndex = dataset.getNextBeginIndex();
    payload.batchSize = batchSize;
    payload.optimizer = 'rmsprop';
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
  logger.debug("Name=" + taskName + ", numMaps=" + numMaps + ", accumReduce=" + accumReduce);
  
  // Finalmente encolamos las tareas
  //wde.enqueueTask(amqpConnOptions, queueName, numMaps, accumReduce, mapPayloadFn, reducePayloadFn);
  let conn, ch;
  
  [conn, ch] = await wde.wdeConnect(amqpConnOptions);
  //ch.prefetch(1); 
  await wde.enqueueTask(ch, queueName, numMaps, accumReduce, mapPayloadFn, reducePayloadFn);
  setTimeout(function(){ch.close(); conn.close(); logger.debug("DISCONNECTED CORRECTLY"); process.exit(0);},500);

})();

