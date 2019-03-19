#!/usr/bin/env node

/*********************************************************************************************************************
* Generador de tareas de prueba.
* Encola una serie de tareas dummy
*********************************************************************************************************************/

const request = require('request');
const wde = require('jsd-monitor');


/*********************************************************************************************************************/
/* Parámetros de conexión
/*********************************************************************************************************************/

//TODO poner esto en un fichero de configuración
const taskName = 'simple_condor_task';
const queueName = taskName + '_queue';
let amqpConnOptions = {};
let webdisPort = 7379;
amqpConnOptions.server = 'mallba3.lcc.uma.es';
amqpConnOptions.port = null;
amqpConnOptions.user = 'worker';
amqpConnOptions.pswd = 'mypassword';
modelUrl = 'http://mallba3.lcc.uma.es:' + webdisPort;


(async () => {  
  
  // Generación del payload específico para los mappers
  mapPayloadFn = function(ix, mapIx, reduceIx) {
    let payload = {}
    payload.dummyText = taskName + ' map task #' + ix;
    return payload;
  }
  
  // Generación del payload específico para los reducers
  reducePayloadFn = function(ix, mapIx, reduceIx) {
    let payload = {}
    payload.dummyText = taskName + ' reduce task #' + reduceIx;
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
  
  let conn, ch;
  
  [conn, ch] = await wde.wdeConnect(amqpConnOptions);
  await wde.enqueueTask(ch, queueName, numMaps, accumReduce, mapPayloadFn, reducePayloadFn);
  setTimeout(function(){ch.close(); conn.close(); console.log("DISCONNECTED CORRECTLY"); process.exit(0);},500);

})();

