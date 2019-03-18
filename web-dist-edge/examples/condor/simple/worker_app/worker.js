const wde = require('web-dist-edge-worker');


/*********************************************************************************************************************/
/* Parámetros de conexión
/* TODO: sacar de aquí
/*********************************************************************************************************************/

const taskName = 'simple_condor_task';
const queueName = taskName + '_queue';
let serverUrl = 'mallba3.lcc.uma.es';;
let port = 15674;
let user = 'worker';
let pswd = 'mypassword';
let webdisPort = 7379;
let workerId = 0;

/*********************************************************************************************************************/
/* Map function
/*********************************************************************************************************************/
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


async function mapFn(decodedMsg) { 
  console.log("# Worker " + workerId + " - Map " + decodedMsg.payload );
  await sleep(300);
  return decodedMsg.payload;
}


/*********************************************************************************************************************/
/* Reduce function
/*********************************************************************************************************************/

async function reduceFn(decodedMsg) {
  console.log("# Worker " + workerId + " - Reduce " + decodedMsg.payload );
  //TODO consumir cola de map results
  await sleep(300);
  return "0 messages reduced";
}


/*********************************************************************************************************************/
/* Init worker
/*********************************************************************************************************************/

(async () => {  
  // let workingTime = parseInt(process.argv.slice(2)[0]) * 1000;
  if(process.argv.slice(2)[1]) {
    workerId = process.argv.slice(2)[1];
  }
  // console.log("# Worker " + workerId + " (working time=" + workingTime + "[ms])");
  
  let worker = new wde.Worker(serverUrl, port, queueName, user, pswd, mapFn, reduceFn);
  worker.start();
  // setTimeout(function(){console.log("# Worker " + workerId + " disconnected"); process.exit(0);}, workingTime);
})();
