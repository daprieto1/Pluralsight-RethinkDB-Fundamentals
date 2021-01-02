const r = require('rethinkdb');

r.connect({db: 'Music'}, (err, conn) => {

    const invoices = require('./data/invoices');
    let count = 1;

    r.table('invoices').insert(invoices).run(conn, {noreply: true, durability: 'soft'}, (err, res) => {
        console.log(invoices.length);
    });
    conn.close();

})
