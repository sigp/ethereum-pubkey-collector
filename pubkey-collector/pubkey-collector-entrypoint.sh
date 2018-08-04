#!/bin/sh

sleep 60 # wait for geth to load...

forever pubkey-collector.js
