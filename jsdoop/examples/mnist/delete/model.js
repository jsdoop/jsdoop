/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import * as tf from '@tensorflow/tfjs';
import * as wsp from './stomp.js';
import * as sjs from './sockjs.min.js';

import {IMAGE_H, IMAGE_W, MnistData} from './data';


/****************************/
const local = false;
let url = 'mallba3.lcc.uma.es';
let port = 15674;
let destination = 'task_queue';
let user = 'worker';
let pswd = 'mypassword';
if(local) {
  url = 'localhost'
  user = 'guest';
  pswd = 'guest';
}
const connStr = 'http://' + url + ':' + port + '/stomp';
console.log(connStr);
/****************************/

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

export async function modelToJSON(model) {
  const returnString = false;
  const unusedArg = null;
  const saveResults = model.toJSON(unusedArg, returnString);
  return saveResults;
}

// Train the model.
export async function train(log) {
  let model = createConvModel();
  let ws = new SockJS(connStr);
  let client = wsp.Stomp.over(ws);
  let on_connect = async function() {
      for(let i=0; i<2; i++) {
        let msg = {};
	msg.procId = i;
        msg.modelId = 1;
        msg.batchId = i;
        console.log(msg);
        client.send(destination, {}, JSON.stringify(msg));
      }
  };
  let on_error =  function() {
      console.log('error');
  };
  client.connect(user, pswd, on_connect, on_error, '/');  
}

