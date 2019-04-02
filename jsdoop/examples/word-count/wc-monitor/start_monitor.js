#!/usr/bin/env node

/*********************************************************************************************************************
* Generador de tareas de prueba.
* Encola una serie de tareas de cálculo de gradiente y cómputo de un nuevo modelo.
*********************************************************************************************************************/

const wde = require('jsd-monitor');

const JSDLogger = require('jsd-utils/jsd-logger');
const logger = JSDLogger.logger;

const JSDDB = require('jsd-utils/jsd-db');



/*********************************************************************************************************************/
/* Parámetros de conexión
/*********************************************************************************************************************/

//TODO poner esto en un fichero de configuración
const local = true;
const taskName = 'word_count';
const queueName = taskName + '_queue';
let amqpConnOptions = {};
let webdisPort = 7379;
if(local) {
  //connStr = wde.getAmqpConnectionStr('localhost');
  // webdisPort = 3001;
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
    
  // Generación del payload específico para los mappers
  mapPayloadFn = function(ix, mapIx, reduceIx) {
    let payload = {}
    payload.getTextUrl = "http://www.emol.com";
    return payload;
  }
  
  // Generación del payload específico para los reducers
  reducePayloadFn = function(ix, mapIx, reduceIx) {
    let payload = {}
    payload.getResults = modelUrl + "/GET/" + taskName +"_count_" + reduceIx;
    let setId = reduceIx + 1;
    payload.setResults = modelUrl + "/GET/" + taskName +"_count_" + setId;
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

