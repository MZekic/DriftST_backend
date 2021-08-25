const ObjectId = require('mongodb').ObjectID
const express = require('express')
const cors = require ('cors')
const connect = require ('./db.js')
const auth = require ('./auth')
const bodyParser = require("body-parser");
const app = express(); // instanciranje aplikacije
const port = 'https://driftst.herokuapp.com'; // port na kojem će web server slušati
app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(
  bodyParser.urlencoded({
    // to support URL-encoded bodies
    extended: true,
  })
);

app.use(cors());
app.use(express.json()); // automatski dekodiraj JSON poruke

app.get("/tajna", [auth.verify], async (req, res) => {
  // nakon što se izvrši auth.verify middleware, imamo dostupan req.jwt objekt
  res.status(200).send("tajna korisnika " + req.jwt.username);
});

Array.prototype.shuffle = function () {
  var i = this.length,
    j,
    temp;
  if (i == 0) return this;
  while (--i) {
    j = Math.floor(Math.random() * (i + 1));
    temp = this[i];
    this[i] = this[j];
    this[j] = temp;
  }
  return this;
};

app.post("/user/changepassword",[auth.verify], async (req, res) => {
  let changes = req.body;
  console.log(changes)
  let username = req.jwt.username
  if (changes.new_password && changes.old_password) {
    let result = await auth.changeUserPassword(
      username, 
      changes.old_password,
      changes.new_password
    );
    if (result) {
      res.status(201).send();
    } else {
      res.status(500).json({ error: "cannot change password" });
    }
  } else {
    res.status(400).json({ error: "unrecognized request" });
  }
});

app.post("/auth", async (req, res) => {
  let user = req.body;
  let username = user.username;
  let password = user.password;

  console

  try {
    let result = await auth.authenticateUser(username, password);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({
      error: e.message,
    });
  }
});

app.post("/user", async (req, res) => {
  let user = req.body;
  console.log(user);
  try {
    let result = await auth.registerUser(user);
    console.log(result)
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({
      error: e.message,
    });
  }
});

app.get("/users", [auth.verify], async (req, res) => {
  try {
   
    let db = await connect();
    let users = await db.collection("users").find({});
    let results = await users.toArray();
    res.json(results);
  } catch (e) {
    res.status(500).json({
      error: e.message,
    });
  }
});
app.get("/users/", [auth.verify], async (req, res) => {
  try {
    let db = await connect();
    let users = await db.collection("users").find({});
    let results = await users.toArray();
    res.json(results);
  } catch (e) {
    res.status(500).json({
      error: e.message,
    });
  }
});

app.post("/tournaments/create", [auth.verify], async (req, res) => {
  let db = await connect();
  let tournamentName = req.body.tournamentName;
  let result = await db
    .collection("Tournaments")
    .insertOne({ tournamentName: tournamentName, competitors: [] });

  res.json(result);
});

app.post("/tournaments/join", [auth.verify], async (req, res) => {
  let db = await connect();
  console.log(req.body);
  await db
    .collection("Tournaments")
    .updateOne(
      { _id: ObjectId(req.body._id) },
      { $push: { competitors: req.body.competitors } }
    );
  let competitors = await db
    .collection("Tournaments")
    .findOne({ _id: ObjectId(req.body._id) });

  if (competitors.competitors.length === 16) {
    competitors.competitors = competitors.competitors.shuffle();
    await db.collection("Tournaments").findOneAndUpdate(
      { _id: ObjectId(req.body._id) },
      {
        $addToSet: {
          round16: {
            $each: competitors.competitors,
          },
        },
        $set: {
          round8: ["", "", "", "", "", "", "", ""],
          round4: ["", "", "", ""],
          round2: ["", ""],
          round1: [""],
        },
      }
    );

    console.log(competitors);
  }
});

app.post("/tournaments/delete", [auth.verify], async (req, res) => {
  let db = await connect();
  try {
    console.log(req.body._id);
    let id = req.body._id;
    tournament = await db
      .collection("Tournaments")
      .remove({ _id: ObjectId(id) });
    res.json({ message: "deleted tournament" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/tournaments", [auth.verify], async (req, res) => {
  try {
    let db = await connect();
    let tournaments = await db.collection("Tournaments").find({});
    let results = await tournaments.toArray();
    res.json(results.reverse());
  } catch (e) {
    res.status(500).json({
      error: e.message,
    });
  }
});

app.get("/tournaments/statistics", [auth.verify], async (req, res) => {
  try {
    let db = await connect();

    let statistics = await db.collection("Tournaments").aggregate([
      {
        $project: {
          tournamentName: 1,
          numberOfCompetitors: { $size: "$competitors" },
        },
      },
    ]);
    let results = await statistics.toArray();
    console.log(results);

    res.json(results);
  } catch (e) {
    res.status(500).json({
      error: e.message,
    });
  }
});

app.get("/myProfile/:id", [auth.verify], async (req, res) => {
  try { 
    let db = await connect();
    let id = req.params.id;
    console.log(id)
    
    let statistics = await db.collection("Tournaments").find({ competitors: {$all : [id]} }).toArray()
   
    console.log("stats", statistics);

    res.json(statistics);
  } catch (e) {
    res.status(500).json({
      error: e.message,
    });
  }
});

app.get("/brackets/:id", [auth.verify], async (req, res) => {
  try {
    let id = req.params.id;
    let db = await connect();
    let competitors = await db
      .collection("Tournaments")
      .findOne({ _id: ObjectId(id) });

    res.json(competitors);
  } catch (e) {
    res.status(500).json({
      error: e.message,
    });
  }
});

app.post("/brackets/win", [auth.verify], async (req, res) => {
  let id = req.body.id;
  let index = req.body.index;
  let round = req.body.round;
  let db = await connect();
  let winner = await db
    .collection("Tournaments")
    .findOne({ _id: ObjectId(id) });
  await db.collection("Tournaments").findOneAndUpdate(
    { _id: ObjectId(id) },
    {
      $set: {
        [`round${round / 2}.${parseInt(index / 2)}`]:
          winner[`round${round}`][index],
      },
    }
  );
  let save = await db
  .collection("Tournaments")
  .findOne({ _id: ObjectId(id) });
  res.json(save)

});

app.listen(port, () => console.log(`Slušam na portu ${port}!`));
