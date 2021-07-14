const fs = require("fs");
const https = require("https");
const configFile = "./config.json";
var configData = null;

/**
 * Load in any configuration
 */
if (fs.existsSync(configFile)) {
    configData = JSON.parse(fs.readFileSync(configFile).toString());
}

/**
 * The config function returns the data associated with the passed in field,
 * stored in the config data
 */
const config = field => {

    if (configData) {
        return field.split(".").reduce((result, term) => {
            return (result||{})[term];
        }, configData);
    }

    return null;
};

/**
 * Pass a success message out of a lambda
 */
const returnSuccess = (msg, callback) => {
    console.info("SUCCESS", JSON.stringify(msg));
    callback(null, msg);
};

/**
 * Pass a failure message out of a lambda
 */
const returnError = (msg, callback) => {
    console.error("ERROR", msg);
    callback(msg);
};

/**
 * A quick 'fetch' function, to return the result of a URL call as a promise
 */
const fetch = (url) => {
    return new Promise(resolve => {
        let result = "";

        https.get(url, response => {

            response.on("data", data => {
                result += data;
            });

            response.on("end", data => {
                resolve(result);
            });
        });
    });
};

module.exports = {
    config,
    fetch,
    returnError,
    returnSuccess
};
