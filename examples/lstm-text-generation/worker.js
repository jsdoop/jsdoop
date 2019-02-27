var wde = require('web-dist-edge');


/*********************************************************************************************************************/
/* Parámetros de conexión
/* TODO: sacar de aquí
/*********************************************************************************************************************/

const local = false;
const taskName = 'lstm_text_generation';
const queueName = taskName + '_queue';
let serverUrl;
let port = 15674;
let user = 'worker';
let pswd = 'mypassword';
if(local) {
  serverUrl = 'localhost';
} else {
  serverUrl = 'mallba3.lcc.uma.es';
}


/*********************************************************************************************************************/
/* Map function
/*********************************************************************************************************************/

function mapFn(decodedMsg) {
  console.log("Mapping");
  //TODO: implement mapper
  return "Dummy map";
}


/*********************************************************************************************************************/
/* Reduce function
/*********************************************************************************************************************/

function reduceFn(decodedMsg) {
  console.log("Reducing");
  //TODO: implement reducer
  return "Dummy reduce";
}


/*********************************************************************************************************************/
/* Init worker
/*********************************************************************************************************************/

let worker = new wde.Worker(serverUrl, port, queueName, user, pswd, mapFn, reduceFn);
worker.start();
