const amqp = require('amqplib');


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
	console.log("async function enqueueTask(ch, numMaps, accumReduce, mapPayloadFn=null, reducePayloadFn=null) {");
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
        console.log(mapper);
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
          console.log(reducer);
          ch.sendToQueue(queueName, new Buffer(JSON.stringify(reducer)), {persistent: true});
          awaitId.length = 0;
          reduceIx++;
        }
      }
}

module.exports.enqueueTask = enqueueTask;
