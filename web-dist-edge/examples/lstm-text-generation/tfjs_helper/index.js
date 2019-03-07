//import webdisRequest from './tfjsIOHandler.js';
//import TextDataset from './data.js';
const tfjsIOHandler = require('./tfjsIOHandler.js');
const data = require('./data.js');
const tf = require('@tensorflow/tfjs');


module.exports = {
  tf,
  tfjsIOHandler,
  data
};
