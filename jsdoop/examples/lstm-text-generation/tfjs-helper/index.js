const tfjsIOHandler = require('./tfjs_io_handler.js');
const data = require('./data.js');
const tfjsCustomModel = require('./tfjs_custom_model.js');
const tf = require('@tensorflow/tfjs');


module.exports = {
  tf,
  tfjsIOHandler,
  data,
  tfjsCustomModel
};
