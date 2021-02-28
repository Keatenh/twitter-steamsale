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
    If this value has changed:
      - store new value
      - post an update tweet
    */
    if (game && curSale && curPrice && curSale !== salePercent) {
      salePercent = curSale;
      let status = "";
      if (curSale > 0) {
        status = `${game} is ${curSale}% off on Steam for ${curPrice} USD`;
      } else {
        status = `${game} is NOT currently on sale on Steam - Regular price: ${curPrice} USD`;
      }
      T.post("statuses/update", { status }, (err: TwitError, _data, _resp) => {
        if (err) {
          /* 
          If the app restarts, it will have no state/diff and may send a duplicate status.
          Ignore crashing on this error, as it may cause a loop of attempts.
          */
          if (err.message !== "Status is a duplicate." && err?.code !== 187) {
            throw new Error(`Error in Twitter post: " + ${err.message}`);
          }
          console.log("Error - Attempted to send duplicate status!");
        } else {
          console.log("Done - Successfully posted sale Tweet.");
        }
      });
    } else {
      console.log("Done - No change in game data found this attempt.")
    }
  } catch (e) {
    console.log(e.message);
    throw e;
  }
};

const job = new CronJob(
  "0 13 * * * *",
  () => {
    console.log("Starting hourly job...");
    try {
      main();
      console.log("Completed hourly job.");
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
