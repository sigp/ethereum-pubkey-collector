#!/bin/bash

## Set up the initial database

set -e 

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE TABLE publickeyMapping ( 
    address CHAR(40) CONSTRAINT address PRIMARY KEY, 
    publickey CHAR(128) NOT NULL
    );
EOSQL
