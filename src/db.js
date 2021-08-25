// import mongo from 'mongodb';
const mongo = require('mongodb')


let connection_string = 'mongodb+srv://Martin:xwNIRlNSp3eZmQNb@cluster0.s28bq.mongodb.net/dbDrift?retryWrites=true&w=majority';

let client = new mongo.MongoClient(connection_string, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

let db = null;

// eksportamo Promise koji resolva na konekciju
module.exports = () => {
    return new Promise((resolve, reject) => {
        // ako smo inicijalizirali bazu i klijent je još uvijek spojen
        if (db && client.isConnected()) {
            resolve(db);
        } else {
            client.connect((err) => {
                if (err) {
                    reject('Spajanje na bazu nije uspjelo:' + err);
                } else {
                    console.log('Database connected successfully!');
                    db = client.db('driftst');
                    resolve(db);
                }
            });
        }
    });
};
