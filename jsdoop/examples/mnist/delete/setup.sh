sudo apt-get install rabbitmq-server
sudo rabbitmq-plugins enable rabbitmq_stomp
sudo rabbitmq-plugins enable rabbitmq_web_stomp
sudo rabbitmqctl add_user worker mypassword
sudo rabbitmqctl set_permissions -p / worker ".*" ".*" ".*"

# delete all queues
rabbitmqadmin -f tsv -q list queues name | while read queue; do rabbitmqadmin -q delete queue name=${queue}; done

sudo apt-get install redis-server
sudo apt-get install webdis
