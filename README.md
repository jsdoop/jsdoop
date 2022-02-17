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

### EXAMPLE OF EXECUTING IN LOCALHOST
#### TERMINAL 1
git clone --recurse-submodules https://github.com/jsdoop/jsdoop.git
cd jsdoop
cd jsdoop-stats-server
docker-compose up

#### TERMINAL 2
cd jsdoop-server
docker-compose up

#### TERMINAL 3
python3 -m venv jsdoopenv
source ./jsdoopenv/bin/activate
cd jsdoop
cd jdsoop-py
pip install -r requirements.txt 
cd scripts
sh create_topology.sh
sh init_dataset_mnist.sh
sh new_job.sh # Copy the ID of the job (last number printed in terminal)
sh aggregator.sh 1645131584358 # 1645131584358 is the ID of the job

#### TERMINAL 4
python3 -m venv jsdoopenv
source ./jsdoopenv/bin/activate
cd jsdoop
cd jdsoop-py
cd src
cd constants

- Edit constants.py with your preffer editor (e.g., vi, nano, ...). Choose host and port. For instance: JOB_HOST_REMOTE = "http://localhost" JOB_PORT_REMOTE = 5500
- Edit jobs.py and use the same values than above. For instance: REMOTEHOST = "http://localhost" REMOTEPORT = 5500 
cd ..
cd scripts
sh worker.sh 1645131584358 theusername 1 # 1 is a seed for reproducibility (you can use any number).


Use http://localhost:15672/#/queues for checking the correct performance of the system.
USER: guest
PASSWORD: guest
https://www.rabbitmq.com/documentation.html

Use http://localhost:61112/index.php for analyzing statistics:
USER: root
PASSWORD: password

Please if you use this in local be carefull because the worker is much faster than the aggreagtor. You can use a higher number of local steps before aggregating.



Later I will add how to use a worker from browser.

## Citation
If you find this work useful in your research, please cite the previous version of JSDoop (1.0) until we publish our new paper  https://ieeexplore.ieee.org/document/8886576:

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
