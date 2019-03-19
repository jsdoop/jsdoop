const wde = require('jsd-worker');


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


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/*********************************************************************************************************************/
/* Problem
/*********************************************************************************************************************/


class SimpleProblem {
  constructor() {
  }
  async mapFn(decodedMsg) { 
    console.log("# Worker " + workerId + " - Map " + decodedMsg.payload );
    await sleep(300);
    return decodedMsg.payload;
  }

  async reduceFn(decodedMsg) {
    console.log("# Worker " + workerId + " - Reduce " + decodedMsg.payload );
    //TODO consumir cola de map results
    await sleep(300);
    return "0 messages reduced";
  }
}

/*********************************************************************************************************************/
/* Init worker
/*********************************************************************************************************************/

(async () => {  
  if(process.argv.slice(2)[0]) {
    workerId = process.argv.slice(2)[0];
  }
  let workingTime = false;
  if(process.argv.slice(2)[1]) {
    workingTime = parseInt(process.argv.slice(2)[1]) * 1000;
  }
  console.log("# Worker " + workerId + " (working time=" + workingTime + "[ms])");
  let problem = new SimpleProblem()
  let worker = new wde.Worker(serverUrl, port, queueName, user, pswd, problem);
  worker.start();
  if(workingTime) {
    setTimeout(function(){console.log("# Worker " + workerId + " disconnected"); process.exit(0);}, workingTime);
  }
})();
