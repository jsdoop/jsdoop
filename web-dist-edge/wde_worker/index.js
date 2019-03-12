//const stw = require('../libs/stompws.js');
const Stomp = require('stompjs');
const SockJS = require('sockjs-client');
const request = require('request');


/**
* WORKER (JavaScript Client)
*/
class Worker {
  constructor(serverUrl, port, queueName, user, pswd, mapFn, reduceFn) {
    this.mapFn = mapFn;
    this.reduceFn = reduceFn;
    this.wsConnStr = 'http://' + serverUrl + ':' + port + '/stomp';
    console.log(">>>>> this.wsConnStr = " + this.wsConnStr);
    this.user = user;
    this.pswd = pswd;
    this.queueName = queueName;
    let ws = new SockJS(this.wsConnStr);
    this.client = Stomp.over(ws);
    this.client.heartbeat.outgoing = 0;
    this.client.heartbeat.incoming = 0;

    this.queuesObjects = {};
    this.currentModelId = -1;
    this.currentModel = null;
  }

  sendToQueue(msg, queueName) {
    // console.log("Mensaje '" + JSON.stringify(msg).substring(0, 20) + "' encolado en " + queueName);
    this.client.send(queueName, {priority: 9}, msg);
  }

  async procMessage(msg, self) {
    console.log("msg received = " + msg);
    const decoded = JSON.parse(msg); 
    if( decoded.mapOrReduce == "map" ) {
      if(self.mapFn && typeof(self.mapFn) == 'function') {
        let mapResult = await self.mapFn(decoded);
	console.log("mapResult = " + mapResult);
        let msgResult = {}
        msgResult.procId = decoded.procId;
        msgResult.result = mapResult;
	console.log("sendToQueue Map",msgResult, (decoded.queueName + "_maps"));
        self.sendToQueue(JSON.stringify(msgResult), decoded.queueName + "_maps");
      } else {
        console.log("Map function not found");
      }
    } else if ( decoded.mapOrReduce == "reduce" ) {
      if(self.reduceFn && typeof(self.reduceFn) == 'function') {
        //TODO gestionar la espera, i.e., ocultamos al usuario el
        // bloqueo a la espera de que las tareas en "await" hayan acabado,
        // e incluir los resultados de las tareas
        let reduceResult = await self.reduceFn(decoded);
        let msgResult = {}
        msgResult.procId = decoded.procId;
        msgResult.result = reduceResult;
        self.sendToQueue(JSON.stringify(msgResult), decoded.queueName + "_reduces");
      } else {
        console.log("Reduce function not found");
      }
    } else {
      console.log("Error, task corrupted");
    }  
  }

  subscribe(queueName, callback) {
    // prefetch-count limita el número de mensajes que se reciben de la cola. Sólo después
    // de hacer ACK, se vuelve a recibir un mensaje
    let queueObject = this.client.subscribe(queueName, callback, {ack: 'client', 'prefetch-count': 1});
    this.queuesObjects[queueName] = queueObject;
  }

  unsubscribe(queueName) {
    let queueObject = this.queuesObjects[queueName];
    queueObject.unsubscribe();
  }

  start() {
    let onConnect = () => {
      this.subscribe(this.queueName, async (message) => {
	await self.procMessage(message.body, this);
        message.ack();
      });
    }
    let onError = () => {
      console.log("Error connecting to " + this.wsConnStr);
    }
    this.client.connect(this.user, this.pswd, onConnect, onError, '/');
  }
}

module.exports.Worker = Worker;
