const tfjsIOHandler = require('./tfjsIOHandler.js');
const data = require('./data.js');
const tfjsCustomModel = require('./tfjsCustomModel.js');
const tf = require('@tensorflow/tfjs');


module.exports = {
  tf,
  tfjsIOHandler,
  data,
  tfjsCustomModel
};
