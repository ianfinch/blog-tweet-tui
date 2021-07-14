const utils = require("./utils.js");
const aws = require("./aws.js");
const term = require("terminal-kit").terminal;
const RssParser = require("rss-parser");
const rssParser = new RssParser();

/**
 * Allow us to break out
 */
process.on("SIGINT", () => {
    utils.log.info("Process received interrupt signal");
    process.exit();
});

/**
 * Split a CSV line into fields
 */
const splitCsvRecord = record => {
    return record.replace(/^"/, "")
                 .replace(/"$/, "")
                 .split('","');
};

/**
 * Convert CSV of articles to an object
 */
const csvToObject = csv => {
    return csv.split("\n")
              .filter(x => x.substr(0, 1) === '"')
              .map(splitCsvRecord);
};

/**
 * Publish the tweet information
 */
const publishToTweetStream = data => {

    if (!data) {
        return null;
    }

    return aws.sns.publish("To be tweeted", data, utils.config("topics.tweet-this"))
            .then(sns => ({ data, sns }));
};

/**
 * Get the RSS feed from the blog
 */
const getRssFeed = blogInfo => {

    return Promise.resolve(blogInfo)
            .then(articles => articles.Item.rss)
            .then(rssUrl => rssParser.parseURL(rssUrl))
            .then(articles => articles.items.map(article => ({
                title: article.title,
                url: article.link,
                date: article.isoDate.split("T")[0]
            })));
};

/**
 * Get the list of tweetable articles from the blog
 */
const getTweetInfo = blogInfo => {

    return Promise.resolve(blogInfo)
            .then(articles => articles.Item.articles)
            .then(utils.fetch)
            .then(csvToObject)
};

/**
 * Merge the list of tweets into the list of articles
 */
const mergeTweetsIntoArticles = ([articles, tweets]) => {

    // Make the tweets indexable by url
    tweets = tweets.reduce((result, tweet) => {

        result[tweet[1]] = tweet[0];
        return result;
    }, {});

    // Add the tweets into the articles
    return articles.map(article => {

        if (tweets[article.url]) {
            article.tweet = tweets[article.url];
        }

        return article;
    });
};

/**
 * Display a selectable list of blog posts
 */
const listBlogPosts = articles => {

    const tweetable = articles.filter(article => article.tweet);
    const articleList = tweetable.map(article => article.date + " " + article.title);

    term.blue("\nSelect a tweetable blog article ...\n");

    return term.singleColumnMenu(articleList).promise
            .then(choice => {

                term.eraseLineAfter();
                term("\n");
                return tweetable[choice.selectedIndex];
            });
};

/**
 * Display selection and get confirmation that it should be tweeted
 */
const confirmTweet = tweet => {

    term.blue("Tweet selected ...\n\n");
    term.wrapColumn({ x: 5, width: 60 });
    term.wrap.cyan(tweet.tweet + "\n");
    term("\n");

    term("Do you wish to tweet this article? (y/N) ");
    const confirmation = term.yesOrNo({ yes: ["y"], no: ["n", "ENTER"] }).promise
            .then(result => {
                term.eraseLineAfter();
                term("\n");
                return result;
            });

    return Promise.all([ confirmation, tweet ]);
};

/**
 * Format the tweet response for sending to the SNS queue
 */
const formatTweetMessage = ([okayToTweet, tweetDetails]) => {

    if (okayToTweet) {

        term.green("Publishing tweet\n");
        return [
            tweetDetails.tweet,
            tweetDetails.url
        ];
    }

    term.red("Tweet publishing cancelled\n");
    return null;
};

aws.db.get(utils.config("tables.config"), { blog: utils.config("blogName") })
    .then(blogInfo => Promise.all([ getRssFeed(blogInfo), getTweetInfo(blogInfo) ]))
    .then(mergeTweetsIntoArticles)
    .then(listBlogPosts)
    .then(confirmTweet)
    .then(formatTweetMessage)
    .then(publishToTweetStream)
    .then(response => { term("SNS message id: " + response.sns.MessageId); })
    .then(() => term.processExit());
