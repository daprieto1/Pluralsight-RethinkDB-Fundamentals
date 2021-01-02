//create some checkouts
const faker = require("faker");
const uuid = require("uuid");
var moment = require("moment");
var r = require("rethinkdb");
var assert = require("assert");
var _ = require("underscore")._;
var async = require("async");
var fs = require("fs");

var customers = require("./data/customers");
var albums = require("./data/products");
var stripe = require("./data/stripe");

var Checkout = require("./data/completed_checkout");
var Fullfillment = require("./data/fulfillment.js");

var loadBigDataset = function () {

    var sales = [], fullfillments = [];

    const getReferral = function () {
        const possibilities = [
            {id: 0, referral: null},
            {id: 1, referral: null},
            {id: 2, referral: null},
            {id: 3, referral: null},
            {id: 4, referral: null},
            {id: 5, referral: null},
            {id: 6, referral: null},
            {id: 7, referral: null},
            {id: 8, referral: null},
            {
                id: 9, referral: {
                    site: "http://example.com",
                    identifier: "1111111111",
                    landing_page: "/specials/extraspecials/example"
                }
            },
            {
                id: 10, referral: {
                    site: "http://test.com",
                    identifier: "22222222",
                    landing_page: "/not/so/special"
                }
            }
        ];
        return possibilities[faker.random.number({min: 1, max: 10})];
    }

    const generateItems = function () {
        const items = [];
        //decide how many
        const picked = faker.random.number({min: 1, max: 8});

        //now pull out those number
        for (let x = 1; x <= picked; x++) {
            const index = faker.random.number({min: 1, max: 347});
            const album = albums[index];
            if (album) {
                items.push({
                    discounts: [],
                    fulfillment: "download",
                    gift_card: false,
                    grams: "0",
                    price: album.price,
                    quantity: faker.random.number({min: 1, max: 3}),
                    requires_shipping: false,
                    sku: album.sku,
                    taxes: [],
                    taxable: true,
                    title: album.title,
                    vendor: album.vendor.name
                });
            }

        }

        return items;
    }

    const generateAddress = function (name) {
        return {
            name: name,
            address: faker.address.streetAddress(),
            city: faker.address.city(),
            state: faker.address.state(),
            country: faker.address.country(),
            lon: faker.address.longitude(),
            lat: faker.address.latitude()
        }
    }

    const calculateAmount = function (items) {
        let sum = 0;
        items.forEach(function (item) {
            sum += parseInt(item.price * item.quantity);
        });
        return sum;
    }

    const createFullfillment = function (sale) {
        const f = new Fullfillment({
            created_at: sale.completed_at,
            sale_id: sale.id,
            email: sale.customer.email,
            destination: sale.shipping_address
        });

        //add the items
        sale.items.forEach(function (item) {
            const fullfillmentItem = {
                fulfillment_service: "download",
                fulfillment_status: "not-downloaded",
                grams: 0,
                requires_shipping: false,
                sku: item.sku,
                vendor: item.vendor,
                name: item.title,
                download_url: "http://xxx.example.com?id=123"
            };
            f.items.push(fullfillmentItem);
        });

        //add a note
        f.notes.push({created_at: f.created_at, entry: "Fulfillment created"});

        //notifications - an example mailer log
        f.notifications.push({
            type: "email",
            subject: "Order " + sale.id + " is ready",
            body: "Hi " + sale.customer.first + " your order is ready! You can download at [urls here]"
        });

        return f;
    };

    const createSale = function () {
        const sale = new Checkout();
        const started_at = moment(faker.date.past());
        const completed_at = started_at.add(faker.random.number({min: 1, max: 40}), "minutes");
        const customerIndex = parseInt(faker.random.number({min: 0, max: 9998}));

        const customer = customers[customerIndex];

        sale.id = uuid.v4();
        sale.completed_at = completed_at.toDate();
        sale.started_at = started_at.toDate();
        sale.referral = getReferral().referral;
        sale.customer = customer;
        sale.items = generateItems();
        sale.billing_address = generateAddress(customer.first + " " + customer.last),
            sale.shipping_address = generateAddress(customer.first + " " + customer.last),
            sale.payment = {
                authorization: "XXXXXXXXXXX",
                gateway: "stripe",
                last_four: "4242",
                amount: calculateAmount(sale.items)
            };
        sale.processor_response = stripe.goodResponse({
            chargeDate: started_at,
            amount: calculateAmount(sale.items),
            name: customer.first + " " + customer.last
        });

        return sale;
    }

    const loadSales = function (next) {
        console.log("Loading up 100,000 sales");
        for (let i = 0; i < 100000; i++) {
            const sale = createSale();
            sales.push(sale);
        }
        console.log("DONE");
        next(null, true);
    };

    const loadFullfillments = function (next) {
        console.log("Loading up all the fullfillments...");
        sales.forEach(function (sale) {
            const f = createFullfillment(sale);
            fullfillments.push(f);
        });
        console.log("DONE");
        next(null, true);
    }


    const putToDisk = function (next) {
        console.log("Writing to disk...");
        console.log("Sales: ", sales.length);
        console.log("Fullfillments: ", fullfillments.length);
        fs.writeFileSync("./drop/sales.json", JSON.stringify(sales));
        fs.writeFileSync("./drop/fullfillments.json", JSON.stringify(fullfillments));
    };

    async.series({
        salesLoaded: loadSales,
        fullfillmentsLoaded: loadFullfillments,
        savedToDisk: putToDisk
    }, function (err, res) {
        console.log("FINISHED");
        console.log(res);
    });
}

loadBigDataset();
