const wde = require('jsd-worker');
const JSDLogger = require('jsd-utils/jsd-logger');
const JSDDB = require('jsd-utils/jsd-db');
const request = require('request');


const logger = JSDLogger.logger;


/*********************************************************************************************************************/
/* Parámetros de conexión
/* TODO: sacar de aquí
/*********************************************************************************************************************/

const local = true;
const taskName = 'word_count';
const queueName = taskName + '_queue';
let serverUrl;
let port = 15674;
let user = 'worker';
let pswd = 'mypassword';
let webdisPort = 7379;
if(local) {
  serverUrl = 'localhost';
  user = 'guest';
  pswd = 'guest';
  webdisPort = 3001;
} else {
  serverUrl = 'mallba3.lcc.uma.es';
}



/*********************************************************************************************************************/
/* Estructura de datos del problema
/* TODO: sacar de aquí
/*********************************************************************************************************************/
class WordCounter {
  constructor() {
  }

  async crawlText(url){  
    return new Promise(function(resolve, reject) {
      request.get(url, function(err, res, content) {
        resolve(content);
      });	
    });	
  }

  /*********************************************************************************************************************/
  /* Map function
  /*********************************************************************************************************************/
  async mapFn(decodedMsg, self) {
    logger.debug("Mapping");
    //TODO get the text
    const text = await this.crawlText(decodedMsg.payload.getTextUrl);
    logger.debug(text);
    let result = {}
    //TODO count the words
    return result;
  }

  /*********************************************************************************************************************/
  /* Reduce function
  /*********************************************************************************************************************/
  async reduceFn(vectorToReduce, decodedMsg, self) {
    logger.debug("Reducing");
    //TODO get the previous
    // decodedMsg.payload.getResults
    //TODO set the updated results
    // decodedMsg.payload.setResults
    return true; // Reduce completed
  }
}


(async () => {
  let problemData = new WordCounter();
  let worker = new wde.Worker(serverUrl, port, queueName, user, pswd, problemData);
  worker.start();
})();
