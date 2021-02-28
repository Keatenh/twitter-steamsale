export interface SteamResp {
  [appID: string]: {
    success: string;
    data?: {
      type?: string;
      name?: string;
      steam_appid?: number;
      is_free?: boolean;
      dlc?: number[];
      detailed_description?: string;
      about_the_game?: string;
      short_description?: string;
      price_overview?: {
        currency?: string;
        initial?: number;
        final?: number;
        discount_percent?: number;
        initial_formatted?: string;
        final_formatted?: string;
      };
    };
  };
}

export interface TwitError extends Error {
  code: Number;
}
