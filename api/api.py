# E2E - Ethereum Address to Public Key API

from flask import Flask, g, abort, request
from flask_restful import Resource, Api  # , fields, reqparse
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import rocksdb
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
api = Api(app)

# Configure rocksdb
db_opts = rocksdb.Options()
db_opts.create_if_missing = True
db_opts.max_open_files = 300000
db_opts.write_buffer_size = 67108864
db_opts.max_write_buffer_number = 3
db_opts.target_file_size_base = 67108864
db_opts.table_factory = rocksdb.BlockBasedTableFactory(
    filter_policy=rocksdb.BloomFilterPolicy(10),
    block_cache=rocksdb.LRUCache(5 * (1024 ** 3)),
    block_cache_compressed=rocksdb.LRUCache(5000 * (1024 ** 2)))

try: 
    db_dir = os.environ['ROCKSDB']
except:
    db_dir = '/var/e2e'
# Single non-session api key for adding keys to db
API_KEY = os.environ['API_KEY']

# Apply Limits
limiter = Limiter(app, key_func=get_remote_address, default_limits=["100 per day", "1 per second"])
limiter = Limiter(app, default_limits=["1000 per day"])


def connect_db():
    """
    Connects to the rocksdb database
    """
    db = rocksdb.DB(db_dir + '/pkcollector.ldb', db_opts)
    return db

def get_db():
    """
    Opens a new database connection if one currently
    doesn't exist. Otherwise return the current database connection.
    """
    if not hasattr(g,'db'):
        g.db = connect_db()
    return g.db

@app.teardown_appcontext
def close_db(error):
    """
    Closes the database at the end of the app context
    """
    # not needed for rocksdb 
    #if hasattr(g,'db'):
    # g.db.close()

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

class address_to_publickey(Resource):
    """
    The main class to handle ethereum address requests
    """
    def get(self, address):
        if not validate_address(address):
            return '{result: Incorrect address format}'

        db = get_db()
        eth_address = clean_address(address)
        try:
            pubkey = db.get(bytes.fromhex(eth_address))
        except Exception as e:
            print(e);
            return '{result: Not Found}'
        if(pubkey is None):
            return "{}"
        return json.dumps({'address': '0x' + address, 'publickey': pubkey.hex()})

class add_public_key(Resource): 
    """ Allow authenticated users to upload public keys 
        Expects lists for batch processing of addresses
    """ 
    def put(self): 
        key = request.form.get('key', None)
        addresses = eval(request.form.get('address', None))
        publickeys = eval(request.form.get('pubkey', None))
        print(addresses)
        print(addresses[1])
        ## validate api key
        if key != API_KEY: 
            abort(403)
            return
        if addresses == None or publickeys == None: 
            return '{result: address or public key list not given}'
        if len(addresses) != len(publickeys):
            return '{result: list length mismatch}'
        
        db = get_db()
        for idx, raw_address in enumerate(addresses):
            address = str(raw_address)
            if not validate_address(address):
                return '{result: incorrect address format}'
            publickey = publickeys[idx]

            eth_address = clean_address(address)
            if not validate_publickey(eth_address,publickey):
                return '{result: incorrect public key}'

            try:
                db.put(bytes.fromhex(eth_address), bytes.fromhex(publickey))
            except Exception as e:
                print(e)
                return '{result: error. Failed import of address:' + address + '}'

        return '{result: success}'

api.add_resource(address_to_publickey, '/address/<string:address>')
api.add_resource(add_public_key, '/addkeys')

if __name__ == "__main__":
    app.run(host='0.0.0.0')
