const fs = require("fs");
const AWS = require("aws-sdk");
const creds = "./creds.json";

/**
 * If we have locally available credentials, use them
 *
 * If we don't find them, we are presumably operating somewhere that
 * credentials are obtained in some other way (e.g. in IAM if we are running as
 * a lambda
 */
if (fs.existsSync(creds)) {
    AWS.config.loadFromPath(creds);
}

/**
 * Create our various AWS clients
 */
const clients = {
    db: new AWS.DynamoDB.DocumentClient(),
    sns: new AWS.SNS()
};

/**
 * Get a value from DynamoDB, from a passed in table and query object
 */
const dbGet = (table, query) => {
    const params = {
        TableName: table,
        Key: query
    };

    const request = clients.db.get(params);
    return request.promise();
};

/**
 * Grab all a DB's rows
 */
const dbScan = (table) => {

    const request = clients.db.scan({ TableName: table });
    return request.promise();
};

/**
 * Write an object to DynamoDB
 *
 * Note that 'put' doesn't return the data, so we return it ourselves
 */
const dbPut = (table, data) => {
    const params = {
        TableName: table,
        Item: data
    };

    return clients.db.put(params).promise()
            .then(() => params);
};

/**
 * Publish an event to SNS (return a promise)
 *
 * I'm using AWS's PascalCase approach to variable naming for this function
 */
const snsPublish = (Subject, Message, TopicArn) => {

    if (typeof Message !== "string") {
        Message = JSON.stringify(Message);
    }

    return clients.sns.publish({ Message, Subject, TopicArn }).promise();
};

module.exports = {
    db: {
        get: dbGet,
        put: dbPut,
        scan: dbScan
    },
    sns: {
        publish: snsPublish
    }
};
