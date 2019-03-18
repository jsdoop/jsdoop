const Stomp = require('stompjs');
const SockJS = require('sockjs-client');
const request = require('request');

/**
* WORKER (JavaScript Client)
*/
class Worker {
  constructor(serverUrl, port, queueName, user, pswd, problemData) {
    //this.mapFn = mapFn;
    //this.reduceFn = reduceFn;
    this.problemData = problemData;
    this.wsConnStr = 'http://' + serverUrl + ':' + port + '/stomp';
    console.log(">>>>> this.wsConnStr = " + this.wsConnStr);
    this.user = user;
    this.pswd = pswd;
    this.queueName = queueName;
    let ws = new SockJS(this.wsConnStr);
    this.client = Stomp.over(ws);
    this.client.heartbeat.outgoing = 5000//0;
    this.client.heartbeat.incoming = 0;
    this.client.reconnect_delay = 3000;

    this.queuesObjects = {};

    this.totalMsgs = 0;
  }

  sendToQueue(msg, queueName) {
    console.log("Mensaje '" + JSON.stringify(msg).substring(0, 100) + "' encolado en " + queueName);
    this.client.send(queueName, {priority: 9}, msg);
  }

  async accumulatingReduce(decoded, self) {
    return new Promise((resolve, reject) => {
      let msgReceived = [];
      self.subscribe(decoded.queueName + "_maps_results_"+ decoded.reduceId, async (reduceMessage) => {
        if (reduceMessage.body) {
          // TODO Chequear si el mensaje recibido es para mi o no, o si es un mensaje antiguo, etc. 
          //const json = JSON.parse(reduceMessage.body); ;
          msgReceived.push(reduceMessage);
          console.log("total reduce received = " + msgReceived.length);
          //reduceMessage.ack();
          //return true; //Consumed msg
          if (msgReceived.length >= decoded.awaitId.length) { //TODO -> Esto es para probar
            resolve(msgReceived); //OUTER PROMISE
            //self.unsubscribe(decoded.queueName + "_maps_results_"+ decoded.reduceId, self); // TODO ->¿puede estar el unsubscribe antes del resolve(msgReceived)? //TODO -> Unsubscribe da el error Message with id "T_sub-2@@session-XW1xr6xd--njwHP7cDn6-w@@6" has no subscription
            //resolve(msgReceived.map(x => JSON.parse(x.body)));			//OUTER PROMISE
            //console.log("<<<<<<<<<<<  volviendo del resolve");
            //msgReceived.map(x => x.ack())
            //console.log("<<<<<<<<<<<  acks");
          }
          return true;
        } else {
          console.error("ERROR: Wrong message received on reduceFn(decodedMsg) _maps_results_");
          reduceMessage.nack();
          resolve(null); //OUTER PROMISE
          throw new Error("ERROR: Wrong message received on reduceFn(decodedMsg) _maps_results_");
          //return false;
        }
      }, self, decoded.awaitId.length);  // TODO -> decoded.awaitId.length es el número de mensajes que se esperan (prefetch-count)
    });
  }

  async procMap(undecodedMsg, decoded, self) {
    let mapResult = await self.problemData.mapFn(decoded, self.problemData);
    console.log("mapResult = " + mapResult);
    let msgResult = {}
    msgResult.procId = decoded.procId;
    msgResult.result = mapResult;
    //TODO Crear una cola para cada reduce decoded.queueName + "_maps_results_" + id
    console.log("sendToQueue Map",msgResult, (decoded.queueName + "_maps_results_"+ decoded.reduceId));
    self.sendToQueue(JSON.stringify(msgResult), decoded.queueName + "_maps_results_"+ decoded.reduceId);
    self.ack(undecodedMsg, self);
    return true;
  }

  async procReduce(undecodedMsg, decoded, self) {
    let results = await self.accumulatingReduce(decoded, self);  
    let accumulatedReduce = results.map(x => JSON.parse(x.body));
    console.log("AFTER ACCUMULATING REDUCE accumulatedReduce = " + accumulatedReduce);
    console.log("self.problemData = " + self.problemData);
    let reduceResult = await self.problemData.reduceFn(accumulatedReduce, decoded, self.problemData);
    if (reduceResult) {
      console.log("reduceResult TRUE " + reduceResult);
      let msgResult = {}
      msgResult.procId = decoded.procId;
      msgResult.result = reduceResult;
      //TODO -> De momento solo hay 1 reduce
      //self.sendToQueue(JSON.stringify(msgResult), decoded.queueName + "_reduces_" + decoded.reduceId);	//TODO -> async? await?
      self.sendToQueue(JSON.stringify(msgResult), decoded.queueName + "_reduces_results");	//TODO -> async? await?      
      self.ack(undecodedMsg, self);
      results.map(x => self.ack(x, self));
      return true;
    } else {
      console.warn("WARNING: reduceResult FALSE " + reduceResult);
      self.nack(undecodedMsg, self);
      results.map(x => self.nack(x, self));
      return false;
    }	
  }

  async procMessage(undecodedMsg, self) {
    const decoded = JSON.parse(undecodedMsg.body); 
    if( decoded.mapOrReduce == "map" ) {
      if(self.problemData.mapFn && typeof(self.problemData.mapFn) == 'function') {
        return await self.procMap(undecodedMsg, decoded, self);
      } else {
        console.error("ERROR: Map function not found");
        self.nack(undecodedMsg, self);
        throw new Error("ERROR: Map function not found");
        return false;
      }
    } else if ( decoded.mapOrReduce == "reduce" ) {
      if(self.problemData.reduceFn && typeof(self.problemData.reduceFn) == 'function') {
        return await self.procReduce(undecodedMsg, decoded, self);      
      } else {
        console.error("ERROR: Reduce function not found");
        self.nack(undecodedMsg, self);
        throw new Error();
        return false;
      }  
    } else {
      console.error("ERROR: Task corrupted");
      self.nack(undecodedMsg, self);
      throw new Error("ERROR: Task corrupted");
    }  
  }

  receive(queueName, message, self) {
    self.totalMsgs++;
    console.log("\n\n-------------------------------------------------------");
    console.log("+++ MSG total = " + self.totalMsgs + " -> " + message.body);
    console.log("msg from queue = " + queueName);
    console.log("message.body = " + message.body);
  }

  ack(message, self) {
    message.ack();
    console.log("INFO: Msg ack() -> " + message.body);
    self.totalMsgs--;
    console.log("--- MSG total = " + self.totalMsgs + " -> " + message.body);
  }

  nack(message, self) {
    message.nack();
    console.warn("WARNING: Msg nack() -> " + message.body);
    self.totalMsgs--;
    console.log("--- MSG total = " + self.totalMsgs + " -> " + message.body);
  }

  subscribe(queueName, mypromise, self, prefetch) {
    // prefetch-count limita el número de mensajes que se reciben de la cola. Sólo después
    // de hacer ACK, se vuelve a recibir un mensaje
    //let queueObject = this.client.subscribe(queueName, callback, {ack: 'client', 'prefetch-count': 1});
    if (prefetch === undefined) prefetch = 1;

    let queueObject = self.client.subscribe(queueName, async (message) => {
      self.receive(queueName, message, self);
      console.log("mypromise result = " + await mypromise(message, self));
    }, {ack: 'client', 'prefetch-count': prefetch});
    self.queuesObjects[queueName] = queueObject;
    console.log("Subscribing to " + queueName + " queueObject = " + JSON.stringify(queueObject));
  }

  unsubscribe(queueName, self) {
    let queueObject = self.queuesObjects[queueName];
    console.log("Unsubscribing from " + queueName + " queueObject = " + JSON.stringify(queueObject));
    queueObject.unsubscribe();
  }

  start() {
    let onConnect = () => {
      this.subscribe(this.queueName, this.procMessage, this);
    }
    let onError = (e) => {
      console.error("ERROR: Error connecting to " + this.wsConnStr + " -> " + e);
    }
    this.client.connect(this.user, this.pswd, onConnect, onError, '/');
  }
}

module.exports.Worker = Worker;
