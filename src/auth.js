const connect = require ('./db.js');
const jwt = require('jsonwebtoken');
const bcrypt = require ('bcrypt');

// Kreiranje indeksa pri pokretanju aplikacije (ukoliko već ne postoji)
(async () => {
    let db = await connect();
    db.collection('users').createIndex({ username: 1 }, { unique: true });
})();

module.exports = {
    async registerUser(userData) {
        let db = await connect();

        let result;
        console.log(userData)
        try {
            let doc = {
                username: userData.username,
                // lozinku ćemo hashirati pomoću bcrypta
                password: await bcrypt.hash(userData.password, 8),
                name: userData.name,
                category: userData.selected,
                wins: 0
            };

            result = await db.collection('users').insertOne(doc);
        } catch (e) {
            if (e.name == 'MongoError') {
                if (e.code == 11000) {
                    throw new Error('Username already exists');
                }
            }
        }

        if (result && result.insertedCount == 1) {
            return result.insertedId;
        } else {
            throw new Error('Cannot register user');
        }
    },
    async authenticateUser(username, password) {
        let db = await connect();
        let user = await db.collection('users').findOne({ username: username });
        if (user && user.password && (await bcrypt.compare(password, user.password))) {
            delete user.password; // ne želimo u tokenu, token se sprema na klijentu
            let token = jwt.sign(user, 'tajna_env', {
                algorithm: 'HS512',
                expiresIn: '1 day',
            });
            console.log(token)
           
            return {
                token,
                username: user.username,
            };
        } else {
            throw new Error('Cannot authenticate');
        }
    },
    async changeUserPassword(username, old_password, new_password) {
        let db = await connect();
        let user = await db.collection('users').findOne({ username: username });

        if (user && user.password && (await bcrypt.compare(old_password, user.password))) {
            let new_password_hashed = await bcrypt.hash(new_password, 8);

            let result = await db.collection('users').updateOne(
                { _id: user._id },
                {
                    $set: {
                        password: new_password_hashed,
                    },
                }
            );
            console.log(new_password_hashed)
            return result.modifiedCount == 1;
        }
    },
    // express.js middleware function
    verify(req, res, next) {
        if (req.headers['authorization']) {
            try {
                let authorization = req.headers['authorization'].split(' ');
                if (authorization[0] !== 'Bearer') {
                    return res.status(401).send(); // HTTP invalid requets
                } else {
                    let token = authorization[1];
                    // spremi uz upit, verify baca grešku(exception) ako ne uspije
                    req.jwt = jwt.verify(token, 'tajna_env');
                    return next();
                }
            } catch (err) {
                return res.status(401).send(); // HTTP not-authorized
            }
        } else {
            return res.status(401).send(); // HTTP invalid request
        }
    },
};