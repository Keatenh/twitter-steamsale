import { Options } from "twit";
import { load } from "ts-dotenv";

const env = load({
  TWITTER_CONSUMER_KEY: String,
  TWITTER_CONSUMER_SECRET: String,
  TWITTER_ACCESS_TOKEN: String,
  TWITTER_ACCESS_TOKEN_SECRET: String,
  TWITTER_USER_ID: String, // value of number too large
  STEAM_APP_ID: Number,
});

const twitOps: Options = {
  consumer_key: env.TWITTER_CONSUMER_KEY || "NOT_SET",
  consumer_secret: env.TWITTER_CONSUMER_SECRET || "NOT_SET",
  access_token: env.TWITTER_ACCESS_TOKEN,
  access_token_secret: env.TWITTER_ACCESS_TOKEN_SECRET,
  timeout_ms: 60 * 1000, // optional HTTP request timeout to apply to all requests.
  strictSSL: true, // optional - requires SSL certificates to be valid.
};

const steamOpts = {
  appID: env.STEAM_APP_ID,
};

const appOpts = {
  twitUserID: env.TWITTER_USER_ID,
};

export default { twitOps, steamOpts, appOpts };
