#!/usr/bin/env bash
while :
do

        #url="https://middleware-api.potres2020.repl.co/css/style.css"
        #url='http://localhost:3000/status'
        url="https://middleware-api.potres2020.repl.co/status"
        printf "####################################################################\n"
        printf "Status check: $url\n";
        echo -n `date -Iseconds`
        printf " "
        curl -s -i $url | egrep 'X-Origin|OK'
        printf "\n"
        printf "Press [CTRL+C] to stop..\n"
        sleep $1
done