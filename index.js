const jwt = require("jsonwebtoken");
const express = require("express");
const app = express();
const { User, Kitten } = require("./db");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { JWT_SECRET = "super-secret-key" } = process.env;

app.get("/", async (req, res, next) => {
    try {
        res.send(`
            <h1>Welcome to Cyber Kittens!</h1>
            <p>Cats are available at <a href="/kittens/1">/kittens/:id</a></p>
            <p>Create a new cat at <b><code>POST /kittens</code></b> and delete one at <b><code>DELETE /kittens/:id</code></b></p>
            <p>Log in via POST /login or register via POST /register</p>
        `);
    } catch (error) {
        console.error(error);
        next(error);
    }
});

// Verifies token with jwt.verify and sets req.user
// TODO - Create authentication middleware
async function authMW(req, resp, next) {
    const auth = req.get("Authorization");
    if (!auth) {
        resp.sendStatus(401);
        return;
    }

    const [, token] = auth.split(" ");
    const user = jwt.verify(token, JWT_SECRET);

    req.user = user;
    next();
}

async function getKittenMW(req, resp, next) {
    if (!req.user) {
        resp.status(500).send("getKittenMW can only be used after the authMW");
        return;
    }

    const kittenId = req.params.id;
    if (kittenId === undefined) {
        resp.sendStatus(400);
        return;
    }

    const kitten = await Kitten.findByPk(kittenId);
    if (!kitten) {
        resp.sendStatus(404);
        return;
    }

    if (kitten.ownerId !== req.user.id) {
        resp.sendStatus(401);
        return;
    }

    req.kitten = kitten;
    next();
}

// POST /register
// OPTIONAL - takes req.body of {username, password} and creates a new user with the hashed password

// POST /login
// OPTIONAL - takes req.body of {username, password}, finds user by username, and compares the password with the hashed version from the DB

// GET /kittens/:id
// TODO - takes an id and returns the cat with that id
app.get("/kittens/:id", authMW, getKittenMW, async (req, resp) => {
    resp.json({ name: req.kitten.name, age: req.kitten.age, color: req.kitten.color });
});

// POST /kittens
// TODO - takes req.body of {name, age, color} and creates a new cat with the given name, age, and color
app.post("/kittens", authMW, async (req, resp) => {
    const { name, age, color } = req.body;
    // We need an explicit check on age since could be 0 which is falsy
    if (!(name && age !== undefined && color)) {
        resp.sendStatus(400);
    }

    const ownerId = req.user.id;
    await Kitten.create({ name, age, color, ownerId });
    resp.status(201).json({ name, age, color });
});

// DELETE /kittens/:id
// TODO - takes an id and deletes the cat with that id
app.delete("/kittens/:id", authMW, getKittenMW, async (req, resp) => {
    await req.kitten.destroy();
    resp.sendStatus(204);
});

// error handling middleware, so failed tests receive them
app.use((error, _, res, __) => {
    console.error("SERVER ERROR: ", error);
    if (res.statusCode < 400) res.status(500);
    res.send({ error: error.message, name: error.name, message: error.message });
});

// we export the app, not listening in here, so that we can run tests
module.exports = app;
