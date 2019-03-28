const amqp = require('amqplib');

const JSDLogger = require('jsd-utils/jsd-logger');
const logger = JSDLogger.logger;


/**
* Generates an AMQP connection string
*/
function getAmqpConnectionStr(connJSON) {
  let connStr = 'amqp://';
  if(connJSON.user && connJSON.pswd) {
    connStr = connStr + connJSON.user + ':' + connJSON.pswd + '@';
  }
  connStr = connStr + connJSON.server;
  if(connJSON.port) {
    connStr = connStr + ':' + connJSON.port;
  }
  return connStr;
}




//module.exports.getAmqpConnectionStr = getAmqpConnectionStr;


/**
* connJSON: ampq style connection string
*/
async function wdeConnect(connJSON){
  let connStr = getAmqpConnectionStr(connJSON);
  let conn = await amqp.connect(connStr);
  let ch = await conn.createChannel();
  return [conn, ch];	
}
module.exports.wdeConnect = wdeConnect;




/**
* ch: 		    channel of the connection
* queueName         name of the destination queue
* task	            JSON object with necessary information to solve the task
*/
async function sendTask(ch, queueName, task) {
  //ch.sendToQueue(queueName, new Buffer(JSON.stringify(task)), {persistent: true});
  ch.sendToQueue(queueName, new Buffer(task), {persistent: true});
}


/**
* ch: 		    channel of the connection
* queueName         name of the destination queue
* numMaps           total number of map tasks
* accumReduce       number of map tasks to accumulate before reducing
* mapPayloadFn      [optional] user-defined function that receives the map task index, the relative order of the
*                   mapper inside the batch (i.e., before a new reduce is performed), and the reduce index,
*                   and returns an object (payload) to be included in the task
* reducePayloadFn   [optional] idem as mapPayloadFn, but added to the reducer
*/
async function enqueueTask(ch, queueName, numMaps, accumReduce, mapPayloadFn=null, reducePayloadFn=null) {
  logger.debug("async function enqueueTask(ch, numMaps, accumReduce, mapPayloadFn=null, reducePayloadFn=null) {");
  //let conn = await amqp.connect(connStr);
  //let ch = await conn.createChannel();
  ch.assertQueue(queueName, {durable: true});    
  let awaitId = [];
  let reduceIx = 1;
  for(let i=1; i <= numMaps; i++) {
    let mapIx = ((i-1) % accumReduce) + 1;
    // TODO: incluir tolerancia a fallos
    let mapper = {};
    mapper.procId = "mapper_" + reduceIx + "_" + mapIx; // TODO: improve id
    mapper.mapOrReduce = "map";
    mapper.queueName = queueName;
    mapper.reduceId = reduceIx;
    if(mapPayloadFn && typeof(mapPayloadFn) == 'function') {
      mapper.payload = mapPayloadFn(i, mapIx, reduceIx);
    }
    logger.debug(mapper);
    ch.sendToQueue(queueName, new Buffer(JSON.stringify(mapper)), {persistent: true});
    awaitId.push(mapper.procId);
    if( i%accumReduce == 0 || i == numMaps ) {
      let reducer = {};
      reducer.procId = "reducer_" + reduceIx;
      reducer.mapOrReduce = "reduce";
      reducer.awaitId = awaitId;
      reducer.queueName = queueName;
      reducer.reduceId = reduceIx;
      if(reducePayloadFn && typeof(reducePayloadFn) == 'function') {
        reducer.payload = reducePayloadFn(i, mapIx, reduceIx);
      }
      logger.debug(reducer);
      ch.sendToQueue(queueName, new Buffer(JSON.stringify(reducer)), {persistent: true});
      awaitId.length = 0;
      reduceIx++;
    }
  }
}

module.exports.enqueueTask = enqueueTask;


async function asyncDeleteQueue(q, ch) {
  return new Promise(function(resolve, reject) {
    logger.debug("Ready to delete " + q);    
    ch.purgeQueue(q , function(err, ok) {
      logger.debug(err ? err:ok);
      if(err) resolve(false);
      resolve(true); 
    });	
  });
}


async function purgeQueuesTask(taskName, ch, maxTask) {
  let base = taskName + '_queue';
  await asyncDeleteQueue(base, ch)
  for(let i=1; i < maxTask; i++) {
    let isQueue = await asyncDeleteQueue(base + "maps_results_" + i, ch);
    if(!isQueue) break;
  }
  for(let i=1; i < maxTask; i++) {
    let isQueue = await asyncDeleteQueue(base + "reduces_results_" + i, ch);
    if(!isQueue) break;
  }
}

module.exports.purgeQueuesTask = purgeQueuesTask;
