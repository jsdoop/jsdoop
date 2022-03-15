#!/bin/bash

docker exec -it some-rabbit //bin//bash &
sleep 1
rabbitmqctl stop_app &
sleep 1
rabbitmqctl reset &
sleep 1
rabbitmqctl start_app &
sleep 1
exit
