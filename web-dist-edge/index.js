const amqp = require('amqplib/callback_api');
const stw = require('./stompws.js');
const SockJS = require('sockjs-client');
const request = require('request');


/**
* Generates an AMQP connection string
*/
function getAmqpConnectionStr(serverUrl, port=null, user=null, pswd=null) {
	console.log("example");
  let connStr = 'amqp://';
  if(user != null && pswd != null) {
    connStr = connStr + user + ':' + pswd + '@';
  }
  connStr = connStr + serverUrl;
  if(port != null) {
    connStr = connStr + ':' + port;
  }
  return connStr;
}

module.exports.getAmqpConnectionStr = getAmqpConnectionStr;


/**
* connStr: ampq style connection string
* queueName         name of the destination queue
* numMaps           total number of map tasks
* accumReduce       number of map tasks to accumulate before reducing
* mapPayloadFn      [optional] user-defined function that receives the map task index, the relative order of the
*                   mapper inside the batch (i.e., before a new reduce is performed), and the reduce index,
*                   and returns an object (payload) to be included in the task
* reducePayloadFn   [optional] idem as mapPayloadFn, but added to the reducer
*/
function enqueueTask(connStr, queueName, numMaps, accumReduce, mapPayloadFn=null, reducePayloadFn=null) {
  amqp.connect(connStr, function(err, conn) {
    conn.createChannel(function(err, ch) {
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
          if(reducePayloadFn && typeof(reducePayloadFn) == 'function') {
            reducer.payload = reducePayloadFn(i, mapIx, reduceIx);
          }
          console.log(reducer);
          ch.sendToQueue(queueName, new Buffer(JSON.stringify(reducer)), {persistent: true});
          awaitId.length = 0;
          reduceIx++;
        }
      }
    });
    //TODO is this necesary?
    setTimeout(function() { conn.close(); process.exit(0); }, 500);
  });
}

module.exports.enqueueTask = enqueueTask;


/**
*
*/
class Worker {
  constructor(serverUrl, port, queueName, user, pswd, mapFn, reduceFn) {
    this.mapFn = mapFn;
    this.reduceFn = reduceFn;
    this.wsConnStr = 'http://' + serverUrl + ':' + port + '/stomp';
    this.user = user;
    this.pswd = pswd;
    this.queueName = queueName;
    let ws = new SockJS(this.wsConnStr);
    this.client = stw.Stomp.over(ws);
  }

  sendToQueue(msg, queueName) {
    //TODO poner el mensaje en la cola
    console.log("Mensaje '" + JSON.stringify(msg) + "' encolado en " + queueName);
  }

  procMessage(msg, self) {
    const decoded = JSON.parse(msg); 
    if( decoded.mapOrReduce == "map" ) {
      if(self.mapFn && typeof(self.mapFn) == 'function') {
        let mapResult = self.mapFn(decoded);
        let msgResult = {}
        msgResult.procId = decoded.procId;
        msgResult.result = mapResult;
        self.sendToQueue(msgResult, decoded.queueName + "_maps");
      } else {
        console.log("Map function not found");
      }
    } else if ( decoded.mapOrReduce == "reduce" ) {
      if(self.reduceFn && typeof(self.reduceFn) == 'function') {
        //TODO gestionar la espera, i.e., ocultamos al usuario el
        // bloqueo a la espera de que las tareas en "await" hayan acabado,
        // e incluir los resultados de las tareas
        let reduceResult = self.reduceFn(decoded);
        let msgResult = {}
        msgResult.procId = decoded.procId;
        msgResult.result = reduceResult;
        self.sendToQueue(msgResult, decoded.queueName + "_reduces");
      } else {
        console.log("Reduce function not found");
      }
    } else {
      console.log("Error, task corrupted");
    }  
  }

  start() {
    let self = this;
    let onConnect = () => {
      let sub = this.client.subscribe(self.queueName, function(message) {
        self.procMessage(message.body, self);
      });
    }
    let onError = () => {
      console.log("Error connecting to " + self.wsConnStr);
    }
    this.client.connect(this.user, this.pswd, onConnect, onError, '/');
  }
}

module.exports.Worker = Worker;


/**
*
*/
function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf));
}


/**
*
*/
function str2ab(str) {
  var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
  var bufView = new Uint16Array(buf);
  for (var i=0, strLen=str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}


/**
* JS Tensorflow IOHandler implementation to get a model from a webdis server
* TODO: move the class and the function to a different file
*/
class WebdisRequest {   
  constructor(path) {
    this.path = path;
  }

  async save(modelArtifacts) {
    request.put(this.path).form(
       JSON.stringify([modelArtifacts.modelTopology, ab2str(modelArtifacts.weightData), modelArtifacts.weightSpecs])
    );
  }

  async load(){ 
    let self = this; 
    return new Promise(function(resolve, reject) {
      request.get(self.path, function(err, res, body) {
        let jsonBody = JSON.parse(body);
        jsonBody = JSON.parse(jsonBody.GET);                
        let modelTopology = jsonBody[0];
        let weightData = str2ab(jsonBody[1]);
        let weightSpecs = jsonBody[2];
        resolve({modelTopology, weightSpecs, weightData}); 
      });	
    });	
  }
}


/**
*
*/
function webdisRequest(path) {
  return new WebdisRequest(path);
}

module.exports.webdisRequest = webdisRequest;

