const async = require('async');
const r = require('rethinkdb');

const databaseName = 'Music';

const createDb = (next) => {
    r.connect((err, conn) => {
        r.dbCreate(databaseName).run(conn, (err, res) => {
            conn.close();
            next(err, res);
        });
    });
}

const createTable = (name, next) => {
    r.connect({db: databaseName}, (err, conn) => {
        r.tableCreate(name).run(conn, (err, res) => {
            conn.close();
            next(err, res);
        })
    });
}

const createTables = (next) => {
    async.map(['artist', 'invoices'], createTable, next);
}

async.series({
    created: createDb,
    tables: createTables
}, (err, res) => {
    console.log(res);
})
