#!/usr/bin/env bash
while :
do

	#url="https://middleware-api.potres2020.repl.co/css/style.css"
	#url='http://localhost:3000/status'
	url="https://middleware-api.potres2020.repl.co/status"
	printf "::::::::::::::::::::::::::::::\n"
	printf "Status check: $url\n";
	curl -s "$url"
	printf "\n"
	printf "Press [CTRL+C] to stop.."
	sleep 60
done