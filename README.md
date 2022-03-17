# JSDoop 2.0
JSDoop Library 2.0 - Distributed Object-Oriented Platform on the Browser.

JSDoop version 2.0 has been redesigned and reimplemented from scratch. This version allows performing federated learning using volunteer edge devices. 

Developed by José Ángel Morell. 
For more information please check this repository https://github.com/jsdoop/jsdoop

## Getting started
This repository is a new version of the JSDoop library. Now the library is divided into three submodules:
- JSDoop-py
- JSDoop-stats-server
- JSDoop-server

### EXAMPLE OF EXECUTION JSDoop 1.0 (deprecated) ON LOCALHOST
- <a href="https://github.com/jsdoop/jsdoop/tree/1.0-(old-version)" target="_blank">JSDoop 1.0 (Map-Reduce) (deprecated version) documentation.</a>
#### Video JSDoop 1.0
- [<img src="https://i.ytimg.com/vi/MPHiLIW4pd4/hqdefault.jpg?sqp=-oaymwEcCPYBEIoBSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBnaDd9LLdA11lymjCxHAovMjw8qA" width="50%">](https://youtu.be/MPHiLIW4pd4)

### EXAMPLE OF EXECUTION JSDoop 2.0 ON LOCALHOST
#### STEP 1 - Clone JSDoop 2.0
- git clone --recurse-submodules https://github.com/jsdoop/jsdoop.git

#### STEP 2 - Python environment
- python3 -m venv jsdoopenv
- source ./jsdoopenv/bin/activate
- cd jsdoop/jdsoop-py
- pip install -r requirements.txt 

#### STEP 3 - Stats Server, rabbitmq, and Redis 
- cd jsdoop/jsdoop-stats-server
- docker-compose up

#### STEP 4 - Logical Server
- cd jsdoop/jsdoop-server
- docker-compose up

#### STEP 5 - Store NN topology
- source ./jsdoopenv/bin/activate
- cd jsdoop/jdsoop-py/scripts
- sh create_topology.sh

#### STEP 6 - Store Dataset
- source ./jsdoopenv/bin/activate
- cd jsdoop/jdsoop-py/scripts
- sh init_dataset_mnist.sh

#### STEP 7 - Create new job
- Modify /src/constants/jobs.json if you need it
- source ./jsdoopenv/bin/activate
- cd jsdoop/jdsoop-py/scripts
- sh new_job.sh # Copy the ID of the job (last number printed in terminal)

#### STEP 8 - Aggregator
- source ./jsdoopenv/bin/activate
- cd jsdoop/jdsoop-py/scripts
- sh aggregator.sh 1647541122249 # 1647541122249 is the ID of the job

#### STEP 9 - Tester
- source ./jsdoopenv/bin/activate
- cd jsdoop/jsdoop-py/scripts
- sh tester.sh 1647541122249

#### STEP 10_A - (OPTIONAL) Run worker from Open browser. Run as many workers as you want. Each browser is a new worker. It was tested using Google Chrome.
- http://localhost:8081/jsdoop/index.html # Put your username and job ID (1647541122249 in this case).
- Enjoy playing space invaders on the web browser while collaborating :)

#### STEP 10_B - (OPTIONAL) Run worker using Python. Run as many workers as you want.
- source ./jsdoopenv/bin/activate
- cd jsdoop/jdsoop-py/scripts
- sh worker.sh 1647541122249 theusername 1 # 1 is a seed for reproducibility (you can use any number).


#### Use http://localhost:15672/#/queues for checking the correct performance of the system (Rabbitmq queue server).
- USER: guest
- PASSWORD: guest
- https://www.rabbitmq.com/documentation.html

#### Use http://localhost:61112/index.php for analyzing statistics (PHPMyAdmin - MySQL database):
- USER: root
- PASSWORD: password


Don't forget that we use REDIS to store intermediate results. Intermediate results are deleted during execution. However, when you finish working with a job, you need to delete these intermediate results to clear your RAM. To do this, you need to run: "sh delete_job.sh 1645131584358" where 1645131584358 is the job ID.

Please, be careful when running JSDoop 2.0 locally because when you use many workers they can be much faster than the aggregator (i.e. all calculations are stored and executed in the RAM memory). To work around this, you can increment local steps before aggregation (edit jsdoop-py/src/constants/jobs.py local_steps = 300 or more). Also, if you want to run everything on the same machine, I recommend at least 16 GB of RAM or more.

You can use an API REST to check that everything is stored correctly. For instance:
http://localhost:8081/get_job?id_job=1645131584358


Later I will add how to use a worker from a browser.

## Citation
If you find this work useful in your research, please cite:

https://www.sciencedirect.com/science/article/pii/S0167739X22000735

@article{morell2022dynamic,
  title={Dynamic and adaptive fault-tolerant asynchronous federated learning using volunteer edge devices},
  author={Morell, Jos{\'e} {\'A}ngel and Alba, Enrique},
  journal={Future Generation Computer Systems},
  year={2022},
  publisher={Elsevier}
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
