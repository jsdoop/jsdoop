# JSDoop 1.0 (Map-Reduce) (deprecated version)
JSDoop Library 1.0 (Map-Reduce) - Distributed Object-Oriented Platform on the Browser.

Developed by José Ángel Morell and Andrés Caméro.
For more information please check this repository https://github.com/jsdoop/jsdoop


### EXAMPLE OF EXECUTION JSDoop 1.0 on localhost
#### Deploy rabbitmq server on Docker
- docker run -d --hostname my-rabbit --name some-rabbit -p 15672:15672 -p 5672:5672 -p 5673:5673 -p 15674:15674 rabbitmq:3

#### Enable plugins on rabbitmq server
- docker exec -it some-rabbit //bin//bash
- rabbitmq-plugins enable rabbitmq_management
- rabbitmq-plugins enable rabbitmq_stomp
- rabbitmq-plugins enable rabbitmq_web_stomp
- rabbitmq-plugins enable rabbitmq_web_stomp # Optional
- rabbitmqctl stop_app
- rabbitmqctl reset    # Be sure you really want to do this! It removes all saved data on rabbitmq server
- rabbitmqctl start_app

#### Clone JSDoop 1.0
- git clone --branch "1.0-(old-version)" https://github.com/jsdoop/jsdoop.git
- cd jsdoop
- cd scripts
- sh yarn_dev.sh 

#### Terminal 1 - DATA SERVER (Redis)
- cd jsdoop/examples/lstm-text-generation/data-server
- node data_server.js

#### Terminal 2 - Monitor
- cd jsdoop/examples/lstm-text-generation/lstm-monitor-app
- node start_monitor.js 5000 10 # 5000 is number of maps you want to perform. 10 is every how many maps you want to make a reduce.

#### Terminal 3 - Deploy web server
- cd jsdoop/examples/lstm-text-generation/lstm-worker-app
- npm run worker

#### Open browser - Each browser is a new worker. It was tested using Google Chrome.
- http://localhost:1234

- Video JSDoop 1.0: [<img src="https://i.ytimg.com/vi/MPHiLIW4pd4/hqdefault.jpg?sqp=-oaymwEcCPYBEIoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBnaDd9LLdA11lymjCxHAovMjw8qA" width="50%">](https://youtu.be/MPHiLIW4pd4)


## Citation
 https://ieeexplore.ieee.org/document/8886576:

  @article{morell2019jsdoop,
    title={JSDoop and TensorFlow. js: Volunteer Distributed Web Browser-Based Neural Network Training},
    author={Morell, Jos{\'e} {\'A} and Camero, Andr{\'e}s and Alba, Enrique},
    journal={IEEE Access},
    volume={7},
    pages={158671--158684},
    year={2019},
    publisher={IEEE}
  }

## License
This module is part of the JSDoop package (www.jsdoop.com) (https://github.com/jsdoop/jsdoop).
Copyright (c) 2019 by José Ángel Morell.

JSDoop software is available under the GNU AFFERO GENERAL 
PUBLIC LICENSE Version 3 (see below). For information about 
licensing of included parts and packages copyrighted by other authors 
please see the copyright notices within individual packages or files.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

For more information about licensing visit:
http://www.jsdoop.com/license
