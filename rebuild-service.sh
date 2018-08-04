#! /bin/bash

# This is a convenience script which will pull down a single service,
# rebuild it, then bring it back up again (in the background)
#
# This is useful if you're making changes to a single container
# and don't want to have to restart the whole project.
#
# Supply the name of the service as the first argument
#
# Example:
# $ ./rebuld-service.sh actionhandler

sudo docker-compose stop $1 && sudo docker-compose build $1 && sudo docker-compose up -d $1
