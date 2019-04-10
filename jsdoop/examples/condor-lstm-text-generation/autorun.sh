#!/bin/bash

unzip -q lstm-worker-app.zip

# Timeout (seconds).
timeout="$1"
proc="$2"
# Interval between checks if the process is still alive (seconds).
interval=10
# Delay between posting the SIGTERM signal and destroying the process by SIGKILL (seconds).
delay=10

(
    ((t = timeout))

    while ((t > 0)); do
        sleep $interval
        kill -0 $$ || exit 0
        ((t -= interval))
    done

    # Be nice, post SIGTERM first.
    # The 'exit 0' below will be executed if any preceeding command fails.
    kill -s SIGTERM $$ && kill -0 $$ || exit 0
    sleep $delay
    kill -s SIGKILL $$
) 2> /dev/null &

exec node lstm-worker-app/worker.js $proc
