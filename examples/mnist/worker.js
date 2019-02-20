import * as wsp from './stomp.js';
import * as sjs from './sockjs.min.js';
import * as tf from '@tensorflow/tfjs';
import {MnistData} from './data';
import * as ioh from './io_handler';


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



let ws = new SockJS(connStr);
let client = wsp.Stomp.over(ws);
let on_connect = function() {
  let sub = client.subscribe(origin, function(message) {
    // console.log(message); 
    //... unsubscribe from the destination
    //sub.unsubscribe();
    //... and disconnect from the server
    //client.disconnect();   
    procMessage(message.body);
  });
};
let on_error =  function() {
    console.log('Error connecting to ' + connStr);
};

// Loss function
function loss(labels, ys) {
  return tf.losses.softmaxCrossEntropy(labels, ys).mean();
} 

async function loadModel(url) {
  return await tf.loadModel(ioh.webdisRequest(url)).catch(error => console.log(error));
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
  model.myTrainFunction = async (x,y) => {    
    console.log("Nueva funcionalidad");
    const totalLossFunction = () => {    
      const batch = data.getTrainDataStep(MINI_BATCH_SIZE, decodedMsg.batchStep);
      return loss(batch.labels, model.predict(batch.xs));
    }
    model.optimizer.minimize(totalLossFunction, true );
  }
  const batch = data.getTrainDataStep(MINI_BATCH_SIZE, decodedMsg.batchStep);
  model.myTrainFunction(batch.xs, batch.labels);
  /*const {value, grads} = optimizer.computeGradients(() => {    
    const batch = data.getTrainDataStep(MINI_BATCH_SIZE, decodedMsg.batchStep);
    return loss(batch.labels, model.predict(batch.xs));
  } );
  client.send(destination, {}, JSON.stringify(grads));
  console.log(decodedMsd.procId + " ended");*/
}

async function runReducer(decodedMsg) {
  console.log("Reducing");
  
}


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
