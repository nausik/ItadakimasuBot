const Keys = require('./keys'),
    then_redis = require('then-redis');

class Session {
    constructor() {
        this._redis_client = then_redis.createClient(Keys.REDIS_URL);
    }

    setBotState(id, new_state) {
        return this._redis_client.hset(id, 'state', new_state);
    }

    getBotState(id) {
        return this._redis_client.hget(id, 'state');
    }

    setTemporaryInfo(id, field, value) {
        if (typeof field === 'string') {
            return this._redis_client.hset(id, field, value);
        } else if (typeof field === 'object') {
            //Since redis HMSET requires object-like array (i.e. ['key1', 'value1', 'key2', 'value2', ...]), we have to convert our object
            let keys = Object.keys(field),
                object_array = keys.reduce((acc, key) => {
                    return acc.concat([key, field[key]]);
                }, [id]);


            return this._redis_client.hmset(object_array);
        }
    }

    getAllTemporaryInfo(id) {
        return this._redis_client.hgetall(id);
    }

    clearSession(id){
        return this._redis_client.del(id);
    }

    clearFields(id, fields){
        let arr = [id];
        arr = arr.concat(fields);

        return this._redis_client.hdel(arr);
    }
}

module.exports = Session;