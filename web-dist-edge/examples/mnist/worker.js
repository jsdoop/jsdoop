import * as wsp from './stomp.js';
import * as sjs from './sockjs.min.js';
import * as tf from '@tensorflow/tfjs';
import {MnistData} from './data';
import * as ioh from './io_handler';
import * as cm from './custom_model';


/***********************************************************************/
// TODO: sacar de aquí
const local = false;
let url = 'mallba3.lcc.uma.es';
let port = 15674;
let origin = 'mnist_task_queue';
let destination = 'mnist_result_queue';
let user = 'worker';
let pswd = 'mypassword';
if(local) {
  url = 'localhost'
  user = 'guest';
  pswd = 'guest';
}
let connStr = 'http://' + url + ':' + port + '/stomp';
console.log(connStr);
/***********************************************************************/


// Optimizer
const LEARNING_RATE = .1;

// Data
const MINI_BATCH_SIZE = 32;
const TRAIN_STEPS = 100;
const LABELS_SIZE = 10;
const IMAGE_H = 28;
const IMAGE_W = 28;


async function loadModel(url) {
  return cm.loadCustomModel(ioh.webdisRequest(url));
  // return await tf.loadModel(ioh.webdisRequest(url)).catch(error => console.log(error));
}


async function runMapper(decodedMsg) {
  console.log("Mapping");
  let data;
  data = new MnistData();
  await data.load();
  let model = await loadModel(decodedMsg.getModelUrl);
  model.summary();   
  const optimizer = tf.train.sgd(LEARNING_RATE);
  model.compile({optimizer: optimizer, loss: 'categoricalCrossentropy', metrics: ['accuracy']});  
  const batch = data.getTrainDataStep(MINI_BATCH_SIZE, decodedMsg.batchStep);
  // Alternativa 1
  const {value, grads} = model.getGradientsAndSaveActions(batch.xs, batch.labels);
  // Alternativa 2
  // const {value, grads} = await model.getGradsOnBatch(batch.xs, batch.labels);
  console.log("Value=" + value);
  console.log("Grads=" + JSON.stringify(grads));
  //client.send(destination, {}, JSON.stringify(grads));  
  console.log(decodedMsg.procId + " ended");
}

async function runReducer(decodedMsg) {
  console.log("Reducing");
  //TODO: implement reducer 
}


/***********************************************************************/


let ws = new SockJS(connStr);
let client = wsp.Stomp.over(ws);
let on_connect = function() {
  let sub = client.subscribe(origin, function(message) {
    procMessage(message.body);
  });
};
let on_error =  function() {
    console.log('Error connecting to ' + connStr);
};

async function procMessage(msg) {
  const decoded = JSON.parse(msg); 
  if( decoded.mapOrReduce == "map" ) {
    runMapper(decoded);
  } else if ( decoded.mapOrReduce == "reduce" ) {
    runReducer(decoded);
  } else {
    console.log("Error, task corrupted");
  }  
}

client.connect(user, pswd, on_connect, on_error, '/');
