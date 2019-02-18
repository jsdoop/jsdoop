import * as wsp from './stomp.js';
import * as sjs from './sockjs.min.js';
import * as tf from '@tensorflow/tfjs';
import {MnistData} from './data';


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


/*******************************************************/
//TODO: delete
/*********************************************************************************************************************/
/**
 * Creates a convolutional neural network (Convnet) for the MNIST data.
 *
 * @returns {tf.Model} An instance of tf.Model.
 */
function createConvModel() {
  // Create a sequential neural network model. tf.sequential provides an API
  // for creating "stacked" models where the output from one layer is used as
  // the input to the next layer.
  const model = tf.sequential();

  // The first layer of the convolutional neural network plays a dual role:
  // it is both the input layer of the neural network and a layer that performs
  // the first convolution operation on the input. It receives the 28x28 pixels
  // black and white images. This input layer uses 16 filters with a kernel size
  // of 5 pixels each. It uses a simple RELU activation function which pretty
  // much just looks like this: __/
  model.add(tf.layers.conv2d({
    inputShape: [IMAGE_H, IMAGE_W, 1],
    kernelSize: 3,
    filters: 16,
    activation: 'relu'
  }));

  // After the first layer we include a MaxPooling layer. This acts as a sort of
  // downsampling using max values in a region instead of averaging.
  // https://www.quora.com/What-is-max-pooling-in-convolutional-neural-networks
  model.add(tf.layers.maxPooling2d({poolSize: 2, strides: 2}));

  // Our third layer is another convolution, this time with 32 filters.
  model.add(tf.layers.conv2d({kernelSize: 3, filters: 32, activation: 'relu'}));

  // Max pooling again.
  model.add(tf.layers.maxPooling2d({poolSize: 2, strides: 2}));

  // Add another conv2d layer.
  model.add(tf.layers.conv2d({kernelSize: 3, filters: 32, activation: 'relu'}));

  // Now we flatten the output from the 2D filters into a 1D vector to prepare
  // it for input into our last layer. This is common practice when feeding
  // higher dimensional data to a final classification output layer.
  model.add(tf.layers.flatten({}));

  model.add(tf.layers.dense({units: 64, activation: 'relu'}));

  // Our last layer is a dense layer which has 10 output units, one for each
  // output class (i.e. 0, 1, 2, 3, 4, 5, 6, 7, 8, 9). Here the classes actually
  // represent numbers, but it's the same idea if you had classes that
  // represented other entities like dogs and cats (two output classes: 0, 1).
  // We use the softmax function as the activation for the output layer as it
  // creates a probability distribution over our 10 classes so their output
  // values sum to 1.
  model.add(tf.layers.dense({units: 10, activation: 'softmax'}));

  return model;
}
/*******************************************************/

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

function getModel(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.onload = function() {
    if (xhr.status === 200) {
      callback(JSON.parse(xhr.responseText));
    } else {
      setTimeout(function() { getModel(url, callback); }, 500);          
    }
  };
  xhr.send();
}

function setModel(url, json) {
    var xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function() {
        if (xhr.status === 200) {
        var userInfo = JSON.parse(xhr.responseText);
        alert(xhr.responseText);
        }
    };
    xhr.send(JSON.stringify(json));
}

// Loss function
function loss(labels, ys) {
  return tf.losses.softmaxCrossEntropy(labels, ys).mean();
} 

async function runMapper(decodedMsg) {
  console.log("Mapping");
  let data;
  data = new MnistData();
  await data.load();
  let model = createConvModel();
  //let batch = data.getTestData(2);
  let batch = data.getTrainDataStep(MINI_BATCH_SIZE, decodedMsg.batchStep);
  model.predict(batch.xs).print();
  /* getModel(decodeMsg.getModelUrl, function(model) => {
    const optimizer = tf.train.sgd(LEARNING_RATE);
    const {value, grads} = optimizer.computeGradients(() => {
	      // const batch = data.nextTrainBatchStep(MINI_BATCH_SIZE, decodedMsg.batchStep);
              let batch = data.getTrainDataStep(MINI_BATCH_SIZE, decodedMsg.batchStep);
	      return loss(batch.labels, model.predict(batch.xs, {batchSize: MINI_BATCH_SIZE}));
	    }, );
	  // console.log(JSON.stringify(grads));
	  client.send(destination, {}, JSON.stringify(grads));
	  console.log(decodedMsd.procId + " ended");   
  });
  */
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
