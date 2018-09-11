# E2E - Ethereum Address to Public Key API

from flask import Flask, abort, request, g
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
import psycopg2
import sha3
import re
import json
import os

# configuration 
class Config(object):
    """ Default app configuration """
    DEBUG = False
    CSRF_ENABLED = True


# App setup
app = Flask(__name__, instance_relative_config=True)
app.config.from_object(Config)
CORS(app)

# Set up postgres db variables
db_host = 'localhost'
db_port = '54321'
db_user = 'e2e_api'
db_password = ''
db_name = "e2e"

if 'DB_HOST' in os.environ:
    db_host = os.environ['DB_HOST']
if 'DB_PORT' in os.environ:
    db_port = os.environ['DB_PORT']
if 'DB_NAME' in os.environ:
    db_name = os.environ['DB_NAME']
if 'DB_USER' in os.environ:
    db_user = os.environ['DB_USER']
if 'DB_PASS' in os.environ:
    db_pass = os.environ['DB_PASS']

# Single non-session api key for adding keys to db
API_KEY = os.environ['APIKEY']

# Apply Limits
limiter = Limiter(app, key_func=get_remote_address, default_limits=["1000 per day", "1 per second"])


def get_db():
    """ Open a database connection if one doesn't exist """ 
    if not hasattr(g, 'conn'):
        (g.conn, g.cur) = connect_db()
    return g.cur


def connect_db(): 
    """ Connect to the database. Currently Postgres """
    conn = psycopg2.connect(host=db_host, dbname=db_name, user=db_user,
                            port=db_port, password=db_pass)
    cur = conn.cursor()
    return (conn, cur)


# Database functions
def db_select(cur, eth_address): 
    """ Obtains the public key for a given ethereum address """ 
    SQL = "SELECT publickey FROM publickeyMapping WHERE address = %s"
    cur.execute(SQL, [eth_address])
    result = cur.fetchone() 
    if result is not None:
        return result[0]
    else:
        return None

def db_insert(cur, eth_address, publickey): 
    """ Inserts the publickey for a given sanitized ethereum address """ 
    SQL = "INSERT INTO publickeyMapping (address, publickey)  VALUES (%s, %s)"
    cur.execute(SQL, (eth_address, publickey))
    g.conn.commit()


@app.teardown_appcontext
def close_db(error): 
    """ Close the database at the end of the request """ 
    if hasattr(g, 'conn'):
        g.cur.close()
        g.conn.close()


def clean_address(address):
    """
    Remove the 0x from the address, if it exists
    Convert to lowercase and ignore checksums
    """
    if len(address) == 42:
        return address[2:].lower()
    return address.lower()


def validate_address(value):
    """
    Simple Ethereum address validation.
    We don't bother with the check sums
    """
    if len(value) in [40, 42]:
        if re.search(r"[0-9a-fA-F]{40}", value):
            return True
    return False


def validate_publickey(address, publickey):
    """
    Validate a publickey
    """
    hashedPub = sha3.keccak_256(bytes.fromhex(publickey))
    ethAddress = hashedPub.digest()[12:].hex()
    if ethAddress == address:
        return True
    return False


@app.route('/address/<string:address>', methods=['GET'])
def address_to_publickey(address):
    cur = get_db()
    if not validate_address(address):
        return '{result: incorrect address format}'

    eth_address = clean_address(address)
    try:
        pubkey = db_select(cur, eth_address)
    except Exception as e:
        print(e)
        return json.dumps({'result': 'error'})
    if(pubkey is None):
        return json.dumps({'result': 'not found'})
    return json.dumps({'address': address, 'publickey': pubkey})


@app.route('/addkeys', methods=['PUT'])
@limiter.exempt
def add_public_key():
    cur = get_db()
    content = request.get_json(True)
    key = content['key']
    addresses = content['addresses']
    publickeys = content['pubkeys']

    # validate api key
    if key != API_KEY:
        abort(403)
        return
    if addresses is None or publickeys is None:
        return '{result: address or public key list not given}'
    if len(addresses) != len(publickeys):
        return '{result: list length mismatch}'

    for idx, raw_address in enumerate(addresses):
        address = str(raw_address)
        if not validate_address(address):
            return '{result: incorrect address format}'
        publickey = publickeys[idx]

        eth_address = clean_address(address)
        if not validate_publickey(eth_address, publickey):
            return '{result: incorrect public key}'
        try:
            db_insert(cur, eth_address, publickey)
        except Exception as e:
            print(e)
            return json.dumps({'result': 'error. failed import of address:' + address})

    return json.dumps({'result': 'success'})


if __name__ == "__main__":
    app.run(host='0.0.0.0')
