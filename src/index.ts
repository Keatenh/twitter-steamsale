import Twit from "twit";
import axios, { AxiosResponse } from "axios";
import retry from "async-retry";
import { CronJob } from "cron";
import config from "./config";
import { httpHandleError } from "./retry";
import { SteamResp, TwitError } from "./models";

const T = new Twit(config.twitOps);
const steamApp = config.steamOpts.appID;
let salePercent = -1; //state we are tracking after startup
const maxUpTime = 8; //number of hours / day we will allow process to run.
let upTime = 0;
let lastStatus: string | undefined;

const main = async () => {
  try {
    const steamResp: AxiosResponse<SteamResp> | undefined = await retry(
      async (bail, num): Promise<AxiosResponse<SteamResp> | undefined> => {
        try {
          return await axios.get<SteamResp>(
            `https://store.steampowered.com/api/appdetails/?appids=${steamApp}`
          );
        } catch (e) {
          httpHandleError(
            e,
            bail,
            num,
            (event: string, retryCount: number, e: any): void => {
              console.log(
                `${event} from Steam with error ${e.message} on retry ${retryCount}`
              );
            }
          );
          return;
        }
      },
      {
        retries: 3,
      }
    );
    if (steamResp === undefined) {
      throw new Error("undefined response in httpGetWithRetry from axios.get");
    }
    const game = steamResp.data[steamApp].data?.name;
    const curSale =
      steamResp.data[steamApp].data?.price_overview?.discount_percent;
    const curPrice =
      steamResp.data[steamApp].data?.price_overview?.final_formatted;
    /*  
    If this value has changed, store new value
    */
    if (game && curSale && curPrice && curSale !== salePercent) {
      salePercent = curSale;
      let status = "";
      if (curSale > 0) {
        status = `${game} is ${curSale}% off on Steam for ${curPrice} USD`;
      } else {
        status = `${game} is NOT currently on sale on Steam - Regular price: ${curPrice} USD`;
      }

      if (upTime === 0) {
        // On Startup
        try {
          const lastResp = await T.get("statuses/user_timeline", {
            user_id: config.appOpts.twitUserID,
            include_rts: false,
            count: 1,
          });
          const lastTweet  = lastResp.data as Twit.Twitter.Status[];
          lastStatus = lastTweet[0].text;
        } catch (e) {
          throw new Error(`Error fetching last tweet: ${e.message}`);
        }
      }
      /* 
      If we have something new to post:
      1.) Changed since we started node process (already in salePercent branch)
      OR 
      2.) New status message since we last ran job (where salePercent is assumed impossible value)
      */
      if (upTime > 0 || (lastStatus && status !== lastStatus)) {
        T.post(
          "statuses/update",
          { status },
          (err: TwitError, _data, _resp) => {
            if (err) {
              /*
                If the app restarts, it will have no state/diff and may send a duplicate status.
                Ignore crashing on this error, as it may cause a loop of attempts.
                */
              if (
                err.message !== "Status is a duplicate." &&
                err?.code !== 187
              ) {
                throw new Error(`Error in Twitter post: " + ${err.message}`);
              }
              console.log("Error - Attempted to send duplicate status!");
            } else {
              console.log("Done - Successfully posted sale Tweet.");
            }
          }
        );
      }
    } else {
      console.log("Done - No change in game data found this attempt.");
    }
  } catch (e) {
    console.log(e.message);
    throw e;
  }
};

// Initialization
main();

// Scheduled Runs
const job = new CronJob(
  "0 13 * * * *",
  () => {
    upTime++;
    console.log(`Starting hourly job #${upTime}...`);
    try {
      if (upTime > maxUpTime) {
        console.log(`Done with work for the day - Exiting...`);
        process.exit(0);
      }
      main();
      console.log(`Completed hourly job #${upTime}.`);
    } catch (e) {
      console.log("Error completing job!");
      throw e;
    }
  },
  null,
  true,
  "America/Chicago"
);
job.start();
